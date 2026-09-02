import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Buckets for Media and Thumbnails
    const mediaBucket = new s3.Bucket(this, 'MediaSourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true, // Allow the app to stream the file
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    const thumbnailBucket = new s3.Bucket(this, 'ThumbnailBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true, // Allow the app to see the JPGs
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // 2. DynamoDB Table for Video Metadata
    const table = new dynamodb.Table(this, 'VideoMetadataTable', {
      partitionKey: { name: 'videoId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For portfolio dev, easy cleanup
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // 3. Lambda Function for the Catalog API
    const catalogLambda = new lambda.Function(this, 'GetCatalogFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: table.tableName,
        MEDIA_BUCKET_NAME: mediaBucket.bucketName,
        THUMBNAIL_BUCKET_NAME: thumbnailBucket.bucketName,
      },
    });

    // Grant Lambda permissions
    table.grantReadData(catalogLambda);

    // 4. API Gateway
    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'Streaming Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const catalog = api.root.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(catalogLambda));

    // Outputs for Android App Configuration
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'ThumbnailBucketName', {
      value: thumbnailBucket.bucketName,
    });
  }
}
