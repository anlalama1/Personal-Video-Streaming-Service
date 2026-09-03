import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  cdnDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly logPlayLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // 1. Catalog Lambda
    const catalogLambda = new lambda.Function(this, 'GetCatalogFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: props.table.tableName,
        CLOUDFRONT_DOMAIN: props.cdnDomain,
      },
    });

    // 2. Log Play Lambda
    this.logPlayLambda = new lambda.Function(this, 'LogPlayEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.logPlayHandler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });

    // Permissions
    props.table.grantReadData(catalogLambda);
    props.table.grantReadData(this.logPlayLambda);

    // 3. API Gateway
    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'Streaming Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const catalog = api.root.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(catalogLambda));

    const play = api.root.addResource('play');
    play.addMethod('POST', new apigateway.LambdaIntegration(this.logPlayLambda));

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
