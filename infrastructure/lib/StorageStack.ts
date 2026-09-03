import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';

export class StorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.IBucket;
  public readonly thumbnailBucket: s3.IBucket;
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Buckets for Media and Thumbnails (LOCKED DOWN)
    this.mediaBucket = new s3.Bucket(this, 'MediaSourceBucket', {
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

    // 2. CloudFront OAC (Origin Access Control)
    const oac = new cloudfront.CfnOriginAccessControl(this, 'StreamingOAC', {
      originAccessControlConfig: {
        name: 'StreamingServiceOAC-Modular', // SDE Fix: Unique name to avoid collisions
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
        }
      }
    });

    // Escape hatch for OAC
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', oac.attrId);
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');

    // 4. Bucket Policies
    const mediaCloudfrontPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [this.mediaBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
        },
      },
    });
    this.mediaBucket.addToResourcePolicy(mediaCloudfrontPolicy);

    const thumbnailCloudfrontPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [this.thumbnailBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
        },
      },
    });
    this.thumbnailBucket.addToResourcePolicy(thumbnailCloudfrontPolicy);

    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: this.distribution.distributionDomainName });
  }
}
