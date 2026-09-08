import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  cdnDomain: string;
  mediaBucket: s3.IBucket;
}

export class ApiStack extends cdk.Stack {
  public readonly logPlayLambda: lambda.Function;
  public readonly logGroup: logs.ILogGroup;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // 1. Unified Scribe Lambda (Logic Layer)
    const scribeLambda = new lambda.Function(this, 'ScribeFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: props.table.tableName,
        CLOUDFRONT_DOMAIN: props.cdnDomain,
        MEDIA_BUCKET: props.mediaBucket.bucketName,
      },
    });

    // 2. Log Play Lambda (Telemetry Layer)
    this.logPlayLambda = new lambda.Function(this, 'LogPlayEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.logPlayHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });

    this.logGroup = this.logPlayLambda.logGroup;

    // Permissions
    props.table.grantReadWriteData(scribeLambda);
    props.table.grantReadData(this.logPlayLambda);
    props.mediaBucket.grantPut(scribeLambda); // Needed for pre-signed URLs

    // 3. API Gateway
    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'Alexandria+ Scribe API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'x-tenant-id', 'x-family-id'],
      },
    });

    const catalog = api.root.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(scribeLambda));

    const ingest = api.root.addResource('ingest');
    ingest.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda));

    const upload = api.root.addResource('upload');

    const start = upload.addResource('start');
    start.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda));

    const part = upload.addResource('part');
    part.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda));

    const complete = upload.addResource('complete');
    complete.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda));

    const play = api.root.addResource('play');
    play.addMethod('POST', new apigateway.LambdaIntegration(this.logPlayLambda));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
