import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StorageStack } from './StorageStack';
import { DatabaseStack } from './DatabaseStack';
import { ApiStack } from './ApiStack';
import { AuthStack } from './AuthStack';
import { MediaProcessingStack } from './MediaProcessingStack';
import { ObservabilityStack } from './ObservabilityStack';
import { SystemGovernanceStack } from './SystemGovernanceStack';
import { Config } from '../bin/config';

/**
 * Senior Strategy: The Application Stage.
 * Centralizes the environment configuration for the production stacks.
 */
export class StreamingAppStage extends cdk.Stage {
  public readonly appDistributionBucketName: cdk.CfnOutput;
  public readonly adminPortalBucketName: cdk.CfnOutput;
  public readonly viewerPortalBucketName: cdk.CfnOutput;
  public readonly distributionId: cdk.CfnOutput;
  public readonly apiUrl: cdk.CfnOutput;

  // Decoupled Identity Stack Outputs
  public readonly adminUserPoolId: cdk.CfnOutput;
  public readonly adminWebClientId: cdk.CfnOutput;
  public readonly customerUserPoolId: cdk.CfnOutput;
  public readonly customerWebClientId: cdk.CfnOutput;
  public readonly customerAndroidClientId: cdk.CfnOutput;

  // Legacy Outputs
  public readonly userPoolId: cdk.CfnOutput;
  public readonly webClientId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const env = {
      account: Config.account,
      region: Config.region
    };

    const storage = new StorageStack(this, 'StorageStack', { env });
    this.appDistributionBucketName = storage.node.findChild('AppDistributionBucketName') as cdk.CfnOutput;
    this.adminPortalBucketName = storage.node.findChild('AdminBucketName') as cdk.CfnOutput;
    this.viewerPortalBucketName = storage.node.findChild('ViewerBucketName') as cdk.CfnOutput;
    this.distributionId = storage.node.findChild('DistributionId') as cdk.CfnOutput;

    const database = new DatabaseStack(this, 'DatabaseStack', { env });

    const auth = new AuthStack(this, 'AuthStack', { env });
    this.adminUserPoolId = auth.node.findChild('AdminUserPoolId') as cdk.CfnOutput;
    this.adminWebClientId = auth.node.findChild('AdminWebClientId') as cdk.CfnOutput;
    this.customerUserPoolId = auth.node.findChild('CustomerUserPoolId') as cdk.CfnOutput;
    this.customerWebClientId = auth.node.findChild('CustomerWebClientId') as cdk.CfnOutput;
    this.customerAndroidClientId = auth.node.findChild('CustomerAndroidClientId') as cdk.CfnOutput;

    this.userPoolId = auth.node.findChild('UserPoolId') as cdk.CfnOutput;
    this.webClientId = auth.node.findChild('WebClientId') as cdk.CfnOutput;

    const mediaProcessing = new MediaProcessingStack(this, 'MediaProcessingStack', {
      env,
      sourceBucket: storage.mediaBucket,
      thumbnailBucket: storage.thumbnailBucket,
      hlsBucket: storage.hlsBucket,
      metadataTable: database.table,
    });

    const effectiveCdnDomain = Config.useCustomDomain && Config.domainName
      ? Config.domainName
      : storage.distribution.distributionDomainName;

    const api = new ApiStack(this, 'ApiStack', {
      env,
      table: database.table,
      adminUserPool: auth.adminUserPool,
      customerUserPool: auth.customerUserPool,
      cdnDomain: effectiveCdnDomain,
      mediaBucket: storage.mediaBucket,
      orchestratorLambda: mediaProcessing.orchestratorLambda
    });
    this.apiUrl = api.node.findChild('ApiUrl') as cdk.CfnOutput;

    new ObservabilityStack(this, 'ObservabilityStack', {
      env,
      logGroup: api.logGroup
    });

    // System Governance Stack with dual user pool purge grants
    new SystemGovernanceStack(this, 'SystemGovernanceStack', {
      env,
      sourceBucket: storage.mediaBucket,
      thumbnailBucket: storage.thumbnailBucket,
      hlsBucket: storage.hlsBucket,
      metadataTable: database.table,
      adminUserPool: auth.adminUserPool,
      customerUserPool: auth.customerUserPool,
    });
  }
}
