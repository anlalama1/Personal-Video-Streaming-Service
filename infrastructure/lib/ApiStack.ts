import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  userPool: cognito.IUserPool;
  cdnDomain: string;
  mediaBucket: s3.IBucket;
  orchestratorLambda?: lambda.IFunction;
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
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: props.table.tableName,
        CLOUDFRONT_DOMAIN: props.cdnDomain,
        MEDIA_BUCKET: props.mediaBucket.bucketName,
        ORCHESTRATOR_LAMBDA_ARN: props.orchestratorLambda ? props.orchestratorLambda.functionArn : '',
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
    if (props.orchestratorLambda) {
      props.orchestratorLambda.grantInvoke(scribeLambda);
    }

    // 3. API Gateway
    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'Alexandria+ Scribe API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'x-tenant-id', 'x-family-id'],
      },
    });

    // Keep browser clients informed when API Gateway itself rejects a request
    // before the Lambda integration can add its normal CORS headers.
    api.addGatewayResponse('Default4xxCors', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });
    api.addGatewayResponse('Default5xxCors', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AlexandriaAuthorizer', {
      cognitoUserPools: [props.userPool]
    });

    const catalog = api.root.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const catalogPublish = catalog.addResource('publish');
    catalogPublish.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const videoResource = catalog.addResource('{videoId}');
    const familyResource = videoResource.addResource('{familyId}');
    familyResource.addMethod('DELETE', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const ingest = api.root.addResource('ingest');
    ingest.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const upload = api.root.addResource('upload');

    const start = upload.addResource('start');
    start.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const part = upload.addResource('part');
    part.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const complete = upload.addResource('complete');
    complete.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer });

    const play = api.root.addResource('play');
    play.addMethod('POST', new apigateway.LambdaIntegration(this.logPlayLambda)); // Keep telemetry public for now or auth later

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
