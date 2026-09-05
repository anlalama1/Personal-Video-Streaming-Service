import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { StreamingAppStage } from './StreamingAppStage';

/**
 * Principal SDE Strategy: Git-Ops Automation.
 * This stack creates the "Self-Mutating" pipeline. Every time you push to GitHub,
 * AWS CodePipeline will wake up, re-synth the project, and deploy all stacks.
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
        }),
        // Lead Strategy: Keep the synth output local to the infrastructure folder.
        // This ensures the internal manifest.json metadata remains consistent.
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
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5, // Use Amazon Linux 2023 base
          privileged: true,
        },
        rolePolicy: [
          new iam.PolicyStatement({
            actions: ['ec2:DescribeAvailabilityZones'],
            resources: ['*'],
          }),
          // Lead Strategy: Grant lookup permissions so the pipeline can
          // query VPC and other existing infrastructure details.
          new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: ['arn:aws:iam::*:role/cdk-hnb659fds-lookup-role-*'],
          }),
        ],
      }
    });

    // Add our application stage to the pipeline
    pipeline.addStage(new StreamingAppStage(this, 'Prod', {
      env: { account: '575992668616', region: 'us-east-1' }
    }));
  }
}
