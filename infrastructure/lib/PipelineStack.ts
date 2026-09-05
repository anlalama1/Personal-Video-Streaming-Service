import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { StreamingAppStage } from './StreamingAppStage';

/**
 * Principal SDE Strategy: Unified Pipeline (Infra + App).
 */
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
         * Lead Strategy: Dual-Build Synth.
         * We synth the infra AND build the Android app in the same stage
         * to ensure they are logically tied together in the release artifact.
         */
        commands: [
          // 1. Build Infrastructure
          'cd infrastructure',
          'npm install',
          'npm run build',
          'npx cdk synth',
          'cd ..',

          // 2. Build Android App
          // CodeBuild STANDARD_7_0 has Java 17 and Gradle support pre-installed.
          // We just need to ensure the Gradle wrapper is executable.
          'chmod +x ./gradlew',
          './gradlew :app:assembleDebug',

          // 3. Stage Artifacts
          // Move the APK to the assembly directory so it's captured in the artifact
          'mkdir -p infrastructure/cdk.out/android',
          'cp app/build/outputs/apk/debug/app-debug.apk infrastructure/cdk.out/android/latest-beta.apk'
        ],
        primaryOutputDirectory: 'infrastructure/cdk.out',
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true, // Needed for Docker and Android builds
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

    /**
     * Lead Strategy: Post-Deployment Distribution.
     * After the stacks are updated (and the bucket is created), we upload
     * the new APK to the distribution bucket.
     */
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
