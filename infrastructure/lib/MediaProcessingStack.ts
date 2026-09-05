import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

interface MediaProcessingStackProps extends cdk.StackProps {
  sourceBucket: s3.IBucket;
  hlsBucket: s3.IBucket;
  metadataTable: dynamodb.ITable;
}

export class MediaProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MediaProcessingStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'TranscoderVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC }],
    });

    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Private endpoints for ECR and Logs (Required for Fargate to pull images without a NAT)
    vpc.addInterfaceEndpoint('EcrEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR });
    vpc.addInterfaceEndpoint('EcrDockerEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER });
    vpc.addInterfaceEndpoint('LogsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS });

    // Lead Strategy: Dedicated Security Group for the Transcoder
    // This allows us to control exactly what the task can talk to.
    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TranscoderSecurityGroup', {
      vpc,
      description: 'Allow outbound traffic for transcoding',
      allowAllOutbound: true,
    });

    const cluster = new ecs.Cluster(this, 'TranscoderCluster', { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TranscodeTask', {
      memoryLimitMiB: 8192,
      cpu: 4096,
    });

    const container = taskDefinition.addContainer('TranscoderContainer', {
      // Principal Strategy: Use native Docker assets.
      // The Pipeline will build this in the cloud automatically.
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../transcoder')),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'Transcoder' }),
      environment: {
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        DEST_BUCKET: props.hlsBucket.bucketName,
        TABLE_NAME: props.metadataTable.tableName,
      },
    });

    props.sourceBucket.grantRead(taskDefinition.taskRole);
    props.hlsBucket.grantReadWrite(taskDefinition.taskRole);
    props.metadataTable.grantReadWriteData(taskDefinition.taskRole);

    const transcodeQueue = new sqs.Queue(this, 'TranscodeQueue', {
      visibilityTimeout: cdk.Duration.minutes(15),
    });

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

    const orchestratorLambda = new lambda.Function(this, 'OrchestratorLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'orchestrator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        CLUSTER_NAME: cluster.clusterName,
        TASK_DEFINITION: taskDefinition.taskDefinitionArn,
        SUBNETS: JSON.stringify(vpc.publicSubnets.map(s => s.subnetId)),
        SECURITY_GROUPS: JSON.stringify([taskSecurityGroup.securityGroupId]),
        CONTAINER_NAME: container.containerName,
      },
    });

    orchestratorLambda.addEventSource(new SqsEventSource(transcodeQueue));
    orchestratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:RunTask'],
      resources: [taskDefinition.taskDefinitionArn],
    }));
    orchestratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [taskDefinition.taskRole.roleArn, taskDefinition.executionRole!.roleArn],
    }));
  }
}
