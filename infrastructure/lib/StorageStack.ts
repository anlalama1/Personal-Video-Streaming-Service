import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';

export class StorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.IBucket;
  public readonly thumbnailBucket: s3.IBucket;
  public readonly hlsBucket: s3.IBucket;
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Buckets
    this.mediaBucket = new s3.Bucket(this, 'MediaSourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      eventBridgeEnabled: true, // Lead Strategy: Enable EventBridge to decouple triggers
      cors: [{
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    this.thumbnailBucket = new s3.Bucket(this, 'ThumbnailBucket', {
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

    this.hlsBucket = new s3.Bucket(this, 'HlsOutputBucket', {
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

    // 2. CloudFront OAC
    const oac = new cloudfront.CfnOriginAccessControl(this, 'StreamingOAC', {
      originAccessControlConfig: {
        name: 'StreamingServiceOAC-Modular',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // 3. Edge Functions
    const rewriteFunction = new cloudfront.Function(this, 'RewriteThumbnails', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (uri.startsWith('/thumbnails/')) {
            request.uri = uri.replace('/thumbnails/', '/');
          }
          if (uri.startsWith('/hls/')) {
            request.uri = uri.replace('/hls/', '/');
          }
          return request;
        }
      `),
    });

    // 4. Distribution
    this.distribution = new cloudfront.Distribution(this, 'StreamingDistribution', {
      comment: 'CDN for Portfolio Streaming Service',
      defaultBehavior: {
        origin: new origins.S3Origin(this.mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/thumbnails/*': {
          origin: new origins.S3Origin(this.thumbnailBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        '/hls/*': {
          origin: new origins.S3Origin(this.hlsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        }
      }
    });

    // OAC Attachment (L1 Escape Hatch)
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.S3OriginConfig.OriginAccessIdentity', '');

    // 5. Bucket Policies
    const allowCloudFront = (bucket: s3.IBucket) => {
        bucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [bucket.arnForObjects('*')],
            principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
            conditions: {
                StringEquals: {
                    'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
                },
            },
        }));
    };

    allowCloudFront(this.mediaBucket);
    allowCloudFront(this.thumbnailBucket);
    allowCloudFront(this.hlsBucket);

    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: this.distribution.distributionDomainName });
  }
}
