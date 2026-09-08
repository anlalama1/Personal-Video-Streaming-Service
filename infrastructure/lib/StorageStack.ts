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
  public readonly adminPortalBucket: s3.IBucket;
  public readonly viewerPortalBucket: s3.IBucket;
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
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        exposeHeaders: ['ETag'], // Mandatory for Multipart Uploads to read ETag in the browser
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

    this.appDistributionBucket = new s3.Bucket(this, 'AppDistributionBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    this.adminPortalBucket = new s3.Bucket(this, 'AdminPortalBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // Principal Strategy: Public Viewer Bucket (The Scroll Web)
    this.viewerPortalBucket = new s3.Bucket(this, 'ViewerPortalBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // 2. CloudFront OAC
    const oac = new cloudfront.CfnOriginAccessControl(this, 'StreamingOAC', {
      originAccessControlConfig: {
        name: 'Alexandria-OAC-Integrated',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // 3. Edge Functions (The Scribe's Gate)
    const rewriteFunction = new cloudfront.Function(this, 'RewritePath', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;

          // Handle Thumbnails
          if (uri.startsWith('/thumbnails/')) {
            request.uri = uri.replace('/thumbnails/', '/');
          }
          // Handle HLS
          if (uri.startsWith('/hls/')) {
            request.uri = uri.replace('/hls/', '/');
          }
          // Handle Downloads
          if (uri.startsWith('/download/')) {
            request.uri = uri.replace('/download/', '/');
          }
          // Handle Raw Media (Consistency Refactor)
          if (uri.startsWith('/media/')) {
            request.uri = uri.replace('/media/', '/');
          }

          // Handle Demetrius (Admin Portal)
          if (uri === '/admin' || uri.startsWith('/admin/')) {
            request.uri = uri.replace('/admin/', '/');
            if (request.uri === '/admin') request.uri = '/';
            if (!request.uri.includes('.')) {
              request.uri = '/index.html';
            }
          }

          // Handle The Scroll (Viewer Portal - Root)
          // For all other requests, if no file extension, serve index.html
          if (!uri.startsWith('/admin/') && !uri.startsWith('/media/') &&
              !uri.startsWith('/hls/') && !uri.startsWith('/thumbnails/') &&
              !uri.startsWith('/download/') && !uri.includes('.')) {
            request.uri = '/index.html';
          }

          return request;
        }
      `),
    });

    // 4. Unified Distribution
    this.distribution = new cloudfront.Distribution(this, 'StreamingDistribution', {
      comment: 'Unified CDN for Alexandria+ Ecosystem',
      // Default: The Scroll (Web Viewer)
      defaultBehavior: {
        origin: new origins.S3Origin(this.viewerPortalBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: rewriteFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/media/*': {
          origin: new origins.S3Origin(this.mediaBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
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
        '/download/*': {
          origin: new origins.S3Origin(this.appDistributionBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
        '/admin/*': {
          origin: new origins.S3Origin(this.adminPortalBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          functionAssociations: [{
            function: rewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        }
      }
    });

    // OAC Attachment (L1 Escape Hatch)
    const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    // Indices: 0:Default(Viewer), 1:Media, 2:Thumbnails, 3:HLS, 4:Download, 5:Admin
    const origins_list = [0, 1, 2, 3, 4, 5];
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
    allowCloudFront(this.adminPortalBucket);
    allowCloudFront(this.viewerPortalBucket);

    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: this.distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'AppDistributionBucketName', { value: this.appDistributionBucket.bucketName });
    new cdk.CfnOutput(this, 'AdminBucketName', { value: this.adminPortalBucket.bucketName });
    new cdk.CfnOutput(this, 'ViewerBucketName', { value: this.viewerPortalBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
  }
}
