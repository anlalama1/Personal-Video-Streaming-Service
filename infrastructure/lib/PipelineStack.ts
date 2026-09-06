import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { StreamingAppStage } from './StreamingAppStage';
import { Config } from '../bin/config';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = Config.account;
    const region = Config.region;

    // Lead Strategy: Persistent S3-based cache for the Android SDK
    const sdkCacheBucket = new s3.Bucket(this, 'AndroidSdkCacheBucket', {
      bucketName: `android-sdk-cache-${account}-${region}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const source = pipelines.CodePipelineSource.connection(Config.githubRepo, Config.githubBranch, {
      connectionArn: Config.githubConnectionArn,
      triggerOnPush: true,
    });

    const pipeline = new pipelines.CodePipeline(this, 'StreamingPipeline', {
      pipelineName: `${Config.projectPrefix}-Production-Pipeline`,
      dockerEnabledForSynth: true,
      synth: new pipelines.CodeBuildStep('Synth', {
        input: source,
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

    const androidBuildStep = new pipelines.CodeBuildStep('BuildAndroidApp', {
      input: source,
      env: {
        SDK_CACHE_BUCKET: sdkCacheBucket.bucketName,
      },
      commands: [
        'echo "BUILD LOG: Starting Parallel Android Build..."',
        'export ANDROID_HOME=$(pwd)/.android-sdk-cache',
        'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin',

        'echo "BUILD LOG: Syncing SDK from S3 Cache..."',
        'aws s3 sync s3://$SDK_CACHE_BUCKET .android-sdk-cache || echo "BUILD LOG: S3 Cache empty."',

        '[ -d "$ANDROID_HOME/cmdline-tools/latest" ] && echo "BUILD LOG: SDK tools found." || { ' +
        'echo "BUILD LOG: Tools not in cache. Downloading..."; ' +
        'mkdir -p $ANDROID_HOME/cmdline-tools; ' +
        'wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/tools.zip; ' +
        'unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools; ' +
        'mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest; }',

        'yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses',
        'sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-37.1" "build-tools;35.0.0"',

        'echo "BUILD LOG: Syncing updated SDK back to S3 Cache..."',
        'aws s3 sync .android-sdk-cache s3://$SDK_CACHE_BUCKET --delete',

        'echo "sdk.dir=$ANDROID_HOME" > local.properties',
        'chmod +x ./gradlew',
        './gradlew :app:assembleDebug --no-daemon',

        'mkdir -p artifacts',
        'cp app/build/outputs/apk/debug/app-debug.apk artifacts/latest-beta.apk'
      ],
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['s3:Get*', 's3:List*', 's3:Put*', 's3:Delete*'],
          resources: [sdkCacheBucket.bucketArn, sdkCacheBucket.arnForObjects('*')],
        }),
      ],
      primaryOutputDirectory: 'artifacts'
    });

    const prodStage = new StreamingAppStage(this, 'Prod', {
      env: { account, region }
    });

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
            resources: [`arn:aws:cloudfront::${account}:distribution/*`],
          }),
        ],
      })
    );
  }
}
