import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { StreamingAppStage } from './StreamingAppStage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'StreamingPipeline', {
      pipelineName: 'StreamingService-Production-Pipeline',
      dockerEnabledForSynth: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection('anlalama1/Personal-Video-Streaming-Service', 'main', {
          connectionArn: 'arn:aws:codeconnections:us-east-1:575992668616:connection/5119b184-5098-45b0-bbc0-f56ed91d5f82',
          triggerOnPush: true,
        }),
        /**
         * Principal Strategy: High-Performance Cloud Build.
         * We bump the compute type and add exhaustive logging to solve the
         * environment-drift issues in the cloud.
         */
        commands: [
          'echo "BUILD LOG: Starting Environment Setup..."',

          // 1. Setup Android SDK path
          'export ANDROID_HOME=$(readlink -f ./android-sdk)',
          'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',
          'echo "BUILD LOG: ANDROID_HOME is $ANDROID_HOME"',

          // 2. Download and Extract Tools (No silence)
          'mkdir -p $ANDROID_HOME/cmdline-tools',
          'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip',
          'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools',
          'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest',

          // 3. Install Components (Explicit logging)
          'echo "BUILD LOG: Accepting licenses..."',
          'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses',
          'echo "BUILD LOG: Installing Platform 35..."',
          'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" "build-tools;35.0.0"',

          // 4. Create local.properties
          'echo "sdk.dir=$ANDROID_HOME" > local.properties',
          'echo "BUILD LOG: local.properties content:" && cat local.properties',

          // 5. Build Android App
          'echo "BUILD LOG: Launching Gradle..."',
          'chmod +x ./gradlew',
          './gradlew :app:assembleDebug --no-daemon',

          // 6. Build Infrastructure
          'echo "BUILD LOG: Starting Infrastructure Synth..."',
          'cd infrastructure',
          'npm install',
          'npm run build',
          'npx cdk synth',
          'cd ..',

          // 7. Stage Artifacts
          'mkdir -p infrastructure/cdk.out/android',
          'cp app/build/outputs/apk/debug/app-debug.apk infrastructure/cdk.out/android/latest-beta.apk',
          'echo "BUILD LOG: All stages complete."'
        ],
        primaryOutputDirectory: 'infrastructure/cdk.out',
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          computeType: codebuild.ComputeType.MEDIUM, // Boost to 7GB RAM
          privileged: true,
        },
        rolePolicy: [
          new iam.PolicyStatement({
            actions: ['ec2:DescribeAvailabilityZones', 'sts:AssumeRole'],
            resources: ['*'],
          }),
        ],
      }
    });

    const prodStage = new StreamingAppStage(this, 'Prod', {
      env: { account: '575992668616', region: 'us-east-1' }
    });

    pipeline.addStage(prodStage);

    pipeline.addWave('Distribution').addPost(
      new pipelines.ShellStep('UploadAndroidApk', {
        envFromCfnOutputs: {
          BUCKET_NAME: prodStage.appDistributionBucketName,
        },
        commands: [
          'aws s3 cp android/latest-beta.apk s3://$BUCKET_NAME/latest-beta.apk'
        ]
      })
    );
  }
}
