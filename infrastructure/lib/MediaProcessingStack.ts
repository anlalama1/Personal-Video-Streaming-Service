import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

interface MediaProcessingStackProps extends cdk.StackProps {
  sourceBucket: s3.IBucket;
  hlsBucket: s3.IBucket;
  metadataTable: dynamodb.ITable;
  repository: ecr.IRepository;
}

export class MediaProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MediaProcessingStackProps) {
    super(scope, id, props);

    // 1. Networking (VPC)
    const vpc = new ec2.Vpc(this, 'TranscoderVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC }],
    });

    // Lead Strategy: Add Private Tunnels (Endpoints) to ECR and CloudWatch.
    // This ensures the task can pull the image and send logs even if
    // the public internet path is jittery.
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addInterfaceEndpoint('EcrEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });

    vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    vpc.addInterfaceEndpoint('LogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });

    // 2. Security Group for the Task
    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TranscoderSecurityGroup', {
      vpc,
      description: 'Allow outbound traffic for transcoding',
      allowAllOutbound: true,
    });

    // Senior Strategy: Allow the task to talk to ECR and S3
    taskSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS inbound if needed');

    // 3. ECS Cluster
    const cluster = new ecs.Cluster(this, 'TranscoderCluster', { vpc });

    // 3. Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TranscodeTask', {
      memoryLimitMiB: 8192, // Boosted from 2GB to 8GB
      cpu: 4096,           // Boosted from 1 vCPU to 4 vCPUs
    });

    const container = taskDefinition.addContainer('TranscoderContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'Transcoder' }),
      environment: {
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        DEST_BUCKET: props.hlsBucket.bucketName,
        TABLE_NAME: props.metadataTable.tableName,
      },
    });

    // Permissions
    props.sourceBucket.grantRead(taskDefinition.taskRole);
    props.hlsBucket.grantReadWrite(taskDefinition.taskRole);
    props.metadataTable.grantReadWriteData(taskDefinition.taskRole);

    // 4. SQS Queue
    const transcodeQueue = new sqs.Queue(this, 'TranscodeQueue', {
      visibilityTimeout: cdk.Duration.minutes(15),
    });

    // 5. Decoupled Trigger: EventBridge Rule
    // Senior Strategy: Using EventBridge breaks the circular dependency between
    // Storage and Media stacks. Storage stack only emits to the "bus",
    // and this stack "listens" to it.
    const rule = new events.Rule(this, 'S3UploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.sourceBucket.bucketName]
          },
          object: {
            key: [{ suffix: '.mp4' }]
          }
        },
      },
    });

    rule.addTarget(new targets.SqsQueue(transcodeQueue));

    // 6. Orchestrator
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
