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
        /**
         * Principal Strategy: Fast Synth.
         * We stripped out the Android build from the Synth step.
         * This makes the pipeline update itself almost instantly.
         */
        commands: [
          'cd infrastructure',
          'npm install',
          'npm run build',
          'npx cdk synth'
        ],
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

    /**
     * Lead Strategy: The Parallel Android Build.
     * We create a standalone build step for the app.
     */
    const androidBuildStep = new pipelines.CodeBuildStep('BuildAndroidApp', {
      input: pipelines.CodePipelineSource.connection('anlalama1/Personal-Video-Streaming-Service', 'main', {
        connectionArn: 'arn:aws:codeconnections:us-east-1:575992668616:connection/5119b184-5098-45b0-bbc0-f56ed91d5f82',
      }),
      commands: [
        'echo "BUILD LOG: Starting Parallel Android Build..."',
        'export ANDROID_HOME=$(pwd)/.android-sdk-cache',
        'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',

        '[ -d "$ANDROID_HOME/cmdline-tools/latest" ] && echo "BUILD LOG: SDK in cache." || { ' +
        'echo "BUILD LOG: Downloading SDK..."; ' +
        'mkdir -p $ANDROID_HOME/cmdline-tools; ' +
        'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip; ' +
        'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools; ' +
        'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest; }',

        'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses',
        'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-37.1" "build-tools;35.0.0"',

        'echo "sdk.dir=$ANDROID_HOME" > local.properties',
        'chmod +x ./gradlew',
        './gradlew :app:assembleDebug --no-daemon',

        'mkdir -p artifacts',
        'cp app/build/outputs/apk/debug/app-debug.apk artifacts/latest-beta.apk'
      ],
      partialBuildSpec: codebuild.BuildSpec.fromObject({
        cache: { paths: ['.android-sdk-cache/**/*'] }
      }),
      primaryOutputDirectory: 'artifacts'
    });

    const prodStage = new StreamingAppStage(this, 'Prod', {
      env: { account: '575992668616', region: 'us-east-1' }
    });

    // We add the parallel builds as a Wave
    const buildWave = pipeline.addWave('ParallelBuilds');
    buildWave.addPost(androidBuildStep);

    pipeline.addStage(prodStage);

    pipeline.addWave('Distribution').addPost(
      new pipelines.CodeBuildStep('UploadAndroidApk', {
        input: androidBuildStep,
        envFromCfnOutputs: {
          BUCKET_NAME: prodStage.appDistributionBucketName,
          DISTRIBUTION_ID: prodStage.distributionId,
        },
        commands: [
          'aws s3 cp latest-beta.apk s3://$BUCKET_NAME/latest-beta.apk --content-type "application/vnd.android.package-archive" --content-disposition "attachment; filename=\"personal-stream-beta.apk\""',
          'aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/download/*"'
        ],
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['s3:PutObject'],
            resources: [`arn:aws:s3:::*`],
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
