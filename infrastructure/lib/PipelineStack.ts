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
         * Principal Strategy: Deterministic Environment Setup.
         * We build the App BEFORE the Infra so the APK is ready for the assembly.
         */
        commands: [
          // 1. Setup Android Environment
          'export ANDROID_HOME=$(pwd)/android-sdk',
          'mkdir -p $ANDROID_HOME/cmdline-tools',
          'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip',
          'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools',
          'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest',
          'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',

          // 2. Install SDK Components
          'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses > /dev/null',
          'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /dev/null',

          // 3. Explicitly provide SDK to Gradle
          'echo "sdk.dir=$ANDROID_HOME" > local.properties',

          // 4. Build the Android App
          'chmod +x ./gradlew',
          './gradlew :app:assembleDebug --no-daemon',

          // 5. Build Infrastructure
          'cd infrastructure',
          'npm install',
          'npm run build',
          'npx cdk synth',
          'cd ..',

          // 6. Stage Artifacts
          'mkdir -p infrastructure/cdk.out/android',
          'cp app/build/outputs/apk/debug/app-debug.apk infrastructure/cdk.out/android/latest-beta.apk'
        ],
        primaryOutputDirectory: 'infrastructure/cdk.out',
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
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
