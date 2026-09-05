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
  public readonly appDistributionBucket: s3.IBucket;
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Buckets
    this.mediaBucket = new s3.Bucket(this, 'MediaSourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      eventBridgeEnabled: true,
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

    // Lead Strategy: Dedicated bucket for Android APK distribution
    this.appDistributionBucket = new s3.Bucket(this, 'AppDistributionBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
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
    const rewriteFunction = new cloudfront.Function(this, 'RewritePath', {
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
          if (uri.startsWith('/download/')) {
            request.uri = uri.replace('/download/', '/');
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
        },
        // Lead Strategy: Distribution path for Android APKs
        '/download/*': {
          origin: new origins.S3Origin(this.appDistributionBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Don't cache beta APKs
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        }
      }
    });

    // OAC Attachment (L1 Escape Hatch)
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    const origins_list = [0, 1, 2, 3]; // Media, Thumbnails, HLS, App
    origins_list.forEach(i => {
        cfnDistribution.addPropertyOverride(`DistributionConfig.Origins.${i}.OriginAccessControlId`, oac.attrId);
        cfnDistribution.addPropertyOverride(`DistributionConfig.Origins.${i}.S3OriginConfig.OriginAccessIdentity`, '');
    });

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
    allowCloudFront(this.appDistributionBucket);

    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: this.distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'AppDistributionBucketName', { value: this.appDistributionBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
  }
}
