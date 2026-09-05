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
      synth: new pipelines.CodeBuildStep('Synth', {
        input: pipelines.CodePipelineSource.connection('anlalama1/Personal-Video-Streaming-Service', 'main', {
          connectionArn: 'arn:aws:codeconnections:us-east-1:575992668616:connection/5119b184-5098-45b0-bbc0-f56ed91d5f82',
          triggerOnPush: true,
        }),
        commands: [
          'echo "BUILD LOG: Starting Environment Setup..."',

          // 1. Setup Android SDK path inside the project root for persistent caching
          // SDE Strategy: We use a hidden folder name to keep the project root clean
          'export ANDROID_HOME=$(pwd)/.android-sdk-cache',
          'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',
          'echo "BUILD LOG: ANDROID_HOME is $ANDROID_HOME"',

          // 2. Conditional Setup
          '[ -d "$ANDROID_HOME/cmdline-tools/latest" ] && echo "BUILD LOG: Found SDK in cache. Skipping download." || { ' +
          'echo "BUILD LOG: SDK not found in cache. Downloading tools..."; ' +
          'mkdir -p $ANDROID_HOME/cmdline-tools; ' +
          'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip; ' +
          'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools; ' +
          'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest; ' +
          'echo "BUILD LOG: Tools installed."; }',

          // 3. Install Components
          'echo "BUILD LOG: Ensuring licenses and platform 37.1 are present..."',
          'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses',
          'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-37.1" "build-tools;35.0.0"',

          // 4. Build Android App
          'echo "sdk.dir=$ANDROID_HOME" > local.properties',
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
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          cache: {
            paths: [
              '.android-sdk-cache/**/*' // Lead Strategy: Cache the persistent project subdirectory
            ]
          }
        }),
        primaryOutputDirectory: 'infrastructure/cdk.out',
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          computeType: codebuild.ComputeType.MEDIUM,
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
      new pipelines.CodeBuildStep('UploadAndroidApk', {
        input: pipeline.synth,
        envFromCfnOutputs: {
          BUCKET_NAME: prodStage.appDistributionBucketName,
          DISTRIBUTION_ID: prodStage.distributionId,
        },
        commands: [
          // 1. Upload APK with correct headers for mobile browsers
          'aws s3 cp android/latest-beta.apk s3://$BUCKET_NAME/latest-beta.apk --content-type "application/vnd.android.package-archive" --content-disposition "attachment; filename=\"personal-stream-beta.apk\""',

          // 2. Invalidate CDN cache to ensure the phone gets the fresh version
          'aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/download/*"'
        ],
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['s3:PutObject'],
            resources: [`arn:aws:s3:::*`], // Scoped by BUCKET_NAME env var at runtime
          }),
          new iam.PolicyStatement({
            actions: ['cloudfront:CreateInvalidation'],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
          }),
        ],
      })
    );
  }
}
