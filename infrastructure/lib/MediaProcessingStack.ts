/**
 * ============================================================================
 * Media Processing & Transcoding Compute Stack (ECS Fargate & SQS Orchestrator)
 * ============================================================================
 * Architecture Pattern: Asynchronous Decoupled Event Pipeline & Compute Offloading.
 *
 * Enterprise Decision Rationale:
 * Heavy video processing (FFmpeg multi-bitrate HLS encoding and Bedrock AI vision passes)
 * exceeds Lambda's 15-minute execution limit. This stack decouples upload event triggers
 * using SQS queues and EventBridge rules, delegating long-running processing tasks to
 * serverless ECS Fargate tasks with $0.00 idle cost.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * * lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { Config } from '../bin/config';

interface MediaProcessingStackProps extends cdk.StackProps {
  sourceBucket: s3.IBucket;
  thumbnailBucket: s3.IBucket;
  hlsBucket: s3.IBucket;
  metadataTable: dynamodb.ITable;
}

export class MediaProcessingStack extends cdk.Stack {
  public readonly orchestratorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: MediaProcessingStackProps) {
    super(scope, id, props);

    // 1. VPC Infrastructure with $0.00 Idle Cost (Public Subnets, No NAT Gateways)
    const vpc = new ec2.Vpc(this, 'TranscoderVpc', {
      maxAzs: 2,
      natGateways: 0, // Zero NAT Gateways eliminates ~$64/month idle AWS charges
      subnetConfiguration: [{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC }],
    });

    // Free VPC Gateway Endpoint for direct S3 traffic
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Security Group for Fargate worker tasks
    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TranscoderSecurityGroup', {
      vpc,
      description: 'Allow outbound traffic for video processing and Bedrock API calls',
      allowAllOutbound: true,
    });

    // ECS Cluster hosting Fargate tasks
    const cluster = new ecs.Cluster(this, 'TranscoderCluster', { vpc });

    // Fargate Task Definition (4 vCPU / 8GB RAM for fast HLS FFmpeg encoding)
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TranscodeTask', {
      memoryLimitMiB: 8192,
      cpu: 4096,
    });

    // Fargate Container Image built natively from local Dockerfile
    const container = taskDefinition.addContainer('TranscoderContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../transcoder')),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'Transcoder' }),
      environment: {
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        THUMBNAIL_BUCKET: props.thumbnailBucket.bucketName,
        DEST_BUCKET: props.hlsBucket.bucketName,
        TABLE_NAME: props.metadataTable.tableName,
        BEDROCK_MODEL_ID: Config.bedrockModelId,
      },
    });

    // IAM Permissions for Task Role
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
      resources: [props.metadataTable.tableArn]
    }));

    props.sourceBucket.grantRead(taskDefinition.taskRole);
    props.thumbnailBucket.grantReadWrite(taskDefinition.taskRole);
    props.hlsBucket.grantReadWrite(taskDefinition.taskRole);

    // Bedrock Multimodal Inference IAM Grant for AI Vision Analysis
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:us-*:${Config.account}:inference-profile/${Config.bedrockModelId}`,
        `arn:aws:bedrock:us-*::foundation-model/${Config.bedrockModelId.replace('us.', '')}`,
      ]
    }));

    // 2. SQS Buffer Queue for Upload Events
    const transcodeQueue = new sqs.Queue(this, 'TranscodeQueue', {
      visibilityTimeout: cdk.Duration.minutes(15),
    });

    // EventBridge Rule: Triggers SQS queue whenever an .mp4 is uploaded to S3
    const rule = new events.Rule(this, 'S3UploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.sourceBucket.bucketName] },
          object: { key: [{ suffix: '.mp4' }] }
        },
      },
    });
    rule.addTarget(new targets.SqsQueue(transcodeQueue));

    // 3. Orchestrator Lambda: Receives SQS events and launches ECS Fargate tasks
    this.orchestratorLambda = new lambda.Function(this, 'OrchestratorLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'orchestrator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        CLUSTER_NAME: cluster.clusterName,
        TASK_DEFINITION: taskDefinition.taskDefinitionArn,
        SUBNETS: JSON.stringify(vpc.publicSubnets.map(s => s.subnetId)),
        SECURITY_GROUPS: JSON.stringify([taskSecurityGroup.securityGroupId]),
        CONTAINER_NAME: container.containerName,
        TABLE_NAME: props.metadataTable.tableName,
        THUMBNAIL_BUCKET: props.thumbnailBucket.bucketName,
      },
    });

    this.orchestratorLambda.addEventSource(new SqsEventSource(transcodeQueue));
    props.metadataTable.grantReadWriteData(this.orchestratorLambda);

    // Allow Orchestrator Lambda to trigger ECS tasks
    this.orchestratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:RunTask'],
      resources: [taskDefinition.taskDefinitionArn],
    }));
    this.orchestratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [taskDefinition.taskRole.roleArn, taskDefinition.executionRole!.roleArn],
    }));

    // 4. Automated Sweeper Cron Job (Ran every 15 minutes for self-healing)
    const sweeperLambda = new lambda.Function(this, 'TranscodingSweeper', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sweeper.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      timeout: cdk.Duration.minutes(5),
      environment: {
        TABLE_NAME: props.metadataTable.tableName,
        QUEUE_URL: transcodeQueue.queueUrl,
        RETENTION_PERIOD_HOURS: '720', // Default 30-day retention
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        THUMBNAIL_BUCKET: props.thumbnailBucket.bucketName,
        DEST_BUCKET: props.hlsBucket.bucketName,
      },
    });

    props.metadataTable.grantReadWriteData(sweeperLambda);
    transcodeQueue.grantSendMessages(sweeperLambda);
    props.sourceBucket.grantReadWrite(sweeperLambda);
    props.thumbnailBucket.grantReadWrite(sweeperLambda);
    props.hlsBucket.grantReadWrite(sweeperLambda);

    // EventBridge Schedule Rule: 15-minute sweeper execution
    const sweepRule = new events.Rule(this, 'SweeperRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
    });
    sweepRule.addTarget(new targets.LambdaFunction(sweeperLambda));
  }
}
