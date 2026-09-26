/**
 * ============================================================================
 * API Gateway Infrastructure Stack (Dual Cognito Authorizers)
 * ============================================================================
 * Architecture Pattern: Domain-Specific REST Endpoint Authorizers.
 *
 * Enterprise Decision Rationale:
 * High-privilege administrative endpoints (/ingest, /catalog/publish, /tenants)
 * are bound strictly to the Admin Authorizer (pointing to Admin User Pool), rejecting
 * customer JWT tokens at the cloud edge. Catalog viewing endpoints (/catalog) use a
 * dual-pool authorizer allowing both authenticated customers and shop admins.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Config } from '../bin/config';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  adminUserPool: cognito.IUserPool;
  customerUserPool: cognito.IUserPool;
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
    props.mediaBucket.grantPut(scribeLambda);
    if (props.orchestratorLambda) {
      props.orchestratorLambda.grantInvoke(scribeLambda);
    }

    // 3. API Gateway Definition
    const api = new apigateway.RestApi(this, 'StreamingApi', {
      restApiName: 'Alexandria+ Scribe API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'x-tenant-id', 'x-family-id'],
      },
    });

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

    // 4. Decoupled Authorizer Definitions
    // Admin Authorizer: Strictly for Demetrius Shop Operator endpoints
    const adminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AdminAuthorizer', {
      cognitoUserPools: [props.adminUserPool]
    });

    // Dual Authorizer: Allows both Shop Admins and Family Customers for catalog browsing
    const dualAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'DualAuthorizer', {
      cognitoUserPools: [props.adminUserPool, props.customerUserPool]
    });

    // 5. REST Endpoint Route Binding
    const catalog = api.root.addResource('catalog');
    catalog.addMethod('GET', new apigateway.LambdaIntegration(scribeLambda), { authorizer: dualAuthorizer });

    const catalogPublish = catalog.addResource('publish');
    catalogPublish.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const videoResource = catalog.addResource('{videoId}');
    const familyResource = videoResource.addResource('{familyId}');
    familyResource.addMethod('DELETE', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const ingest = api.root.addResource('ingest');
    ingest.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const tenants = api.root.addResource('tenants');
    tenants.addMethod('GET', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });
    tenants.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const upload = api.root.addResource('upload');

    const start = upload.addResource('start');
    start.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const part = upload.addResource('part');
    part.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const complete = upload.addResource('complete');
    complete.addMethod('POST', new apigateway.LambdaIntegration(scribeLambda), { authorizer: adminAuthorizer });

    const play = api.root.addResource('play');
    play.addMethod('POST', new apigateway.LambdaIntegration(this.logPlayLambda));

    // 6. Custom Domain Routing for API Gateway
    if (Config.useCustomDomain && Config.domainName) {
      const apiDomain = Config.apiSubdomain || `api.${Config.domainName}`;

      const hostedZone = route53.HostedZone.fromLookup(this, 'ApiHostedZone', {
        domainName: Config.domainName,
      });

      const apiCertificate = new acm.Certificate(this, 'ApiDomainCertificate', {
        domainName: apiDomain,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      const customDomain = new apigateway.DomainName(this, 'CustomApiDomain', {
        domainName: apiDomain,
        certificate: apiCertificate,
        endpointType: apigateway.EndpointType.REGIONAL,
      });

      customDomain.addBasePathMapping(api);

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: 'api',
        target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
      });

      new cdk.CfnOutput(this, 'CustomApiUrl', { value: `https://${apiDomain}/` });
    }

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
