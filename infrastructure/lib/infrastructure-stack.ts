import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Buckets for Media and Thumbnails (LOCKED DOWN)
    const mediaBucket = new s3.Bucket(this, 'MediaSourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Senior: No public access
      enforceSSL: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'], // Needed for cross-origin media streaming
        allowedHeaders: ['*'],
      }],
    });

    const thumbnailBucket = new s3.Bucket(this, 'ThumbnailBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // 2. CloudFront OAC (Origin Access Control) - The modern way to secure S3 origins
    const oac = new cloudfront.CfnOriginAccessControl(this, 'StreamingOAC', {
      originAccessControlConfig: {
        name: 'StreamingServiceOAC',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // 3. CloudFront Distribution
    const rewriteFunction = new cloudfront.Function(this, 'RewriteThumbnails', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (uri.startsWith('/thumbnails/')) {
            request.uri = uri.replace('/thumbnails/', '/');
          }
          return request;
        }
      `),
    });

    const distribution = new cloudfront.Distribution(this, 'StreamingDistribution', {
      comment: 'CDN for Portfolio Streaming Service',
      defaultBehavior: {
        origin: new origins.S3Origin(mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/thumbnails/*': {
          origin: new origins.S3Origin(thumbnailBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        }
      }
    });

    // SDE Tip: Since OAC support in high-level constructs can be trailing, we use an escape hatch
    // to attach the OAC to the underlying L1 CloudFormation resource.
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;

    // Media Origin
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');

    // Thumbnail Origin (if present in behaviors)
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');

    // 4. Bucket Policies: Only allow CloudFront to read
    // SDE Fix: Each bucket policy must only reference resources belonging to that specific bucket.
    const mediaCloudfrontPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [mediaBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    });
    mediaBucket.addToResourcePolicy(mediaCloudfrontPolicy);

    const thumbnailCloudfrontPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [thumbnailBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    });
    thumbnailBucket.addToResourcePolicy(thumbnailCloudfrontPolicy);

    // 5. DynamoDB Table for Video Metadata
    const table = new dynamodb.Table(this, 'VideoMetadataTable', {
      partitionKey: { name: 'videoId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // 6. Lambda Function for the Catalog API
    const catalogLambda = new lambda.Function(this, 'GetCatalogFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: table.tableName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
      },
    });

    // 6b. Lambda Function for Logging Play Events
    const logPlayLambda = new lambda.Function(this, 'LogPlayEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.logPlayHandler', // New handler in same file
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadData(catalogLambda);
    table.grantReadData(logPlayLambda); // To verify videoId if needed

    // 7. API Gateway
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
    play.addMethod('POST', new apigateway.LambdaIntegration(logPlayLambda));

    // 8. CloudWatch Dashboard
    // Senior Strategy: Define the dashboard in CDK for automated deployment and consistency.
    const dashboard = new cloudwatch.Dashboard(this, 'StreamingServiceDashboard', {
      dashboardName: 'StreamingService-Overview',
    });

    // Widget: Usage Overview (Catalog Requests)
    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Catalog Requests',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'CatalogRequestCount',
        dimensionsMap: { Service: 'CatalogService' },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      })],
      width: 12
    }));

    // Widget: Top Content (Play Count)
    // SDE Tip: We use a Log Query or a general metric if dimensions are dynamic.
    // For now, we'll track the general play count.
    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'Video Playback Activity',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'VideoPlayCount',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      })],
      width: 12
    }));

    // Widget: Top 10 Popular Videos
    // Senior SDE Strategy: Use a Log Query Widget to aggregate dynamic dimensions (Video Titles).
    // This allows the dashboard to scale automatically as you add new movies to DynamoDB.
    dashboard.addWidgets(new cloudwatch.LogQueryWidget({
      title: 'Top 10 Most Played Videos',
      logGroupNames: [logPlayLambda.logGroup.logGroupName],
      queryString: `
        fields @timestamp, VideoPlayCount, Title
        | filter ispresent(VideoPlayCount)
        | stats sum(VideoPlayCount) as Plays by Title
        | sort Plays desc
        | limit 10
      `,
      width: 24,
      height: 6
    }));

    // Widget: System Health (Errors)
    dashboard.addWidgets(new cloudwatch.GraphWidget({
      title: 'API Errors',
      left: [new cloudwatch.Metric({
        namespace: 'StreamingService',
        metricName: 'ApiErrorCount',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
        color: '#d62728'
      })],
      width: 24
    }));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
  }
}
