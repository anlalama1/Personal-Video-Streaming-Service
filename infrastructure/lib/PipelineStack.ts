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
      selfMutation: true, // Lead Strategy: Explicitly manage the self-update logic
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection('anlalama1/Personal-Video-Streaming-Service', 'main', {
          connectionArn: 'arn:aws:codeconnections:us-east-1:575992668616:connection/5119b184-5098-45b0-bbc0-f56ed91d5f82',
          triggerOnPush: true,
        }),
        /**
         * Principal Strategy: Clean-Room Building.
         * We move the Android SDK to /tmp to prevent it from being
         * included in the Cloud Assembly, which breaks self-mutation hashing.
         */
        commands: [
          'echo "BUILD LOG: Starting Environment Setup..."',

          // 1. Setup Android SDK path (Outside the source root!)
          'export ANDROID_HOME=/tmp/android-sdk',
          'mkdir -p $ANDROID_HOME/cmdline-tools',
          'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',
          'echo "BUILD LOG: ANDROID_HOME is $ANDROID_HOME"',

          // 2. Download and Extract Tools
          'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip',
          'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools',
          'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest',

          // 3. Install Components (Explicit logging)
          'echo "BUILD LOG: Accepting licenses..."',
          'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses',
          'echo "BUILD LOG: Installing Platform 37.1..."',
          'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-37.1" "build-tools;35.0.0"',

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
        // Principal Strategy: Connect the Artifacts.
        // We explicitly pass the synth output (which contains the APK)
        // to this post-deployment step.
        input: pipeline.synth,
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
