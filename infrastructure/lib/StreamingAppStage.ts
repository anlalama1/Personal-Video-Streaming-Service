import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StorageStack } from './StorageStack';
import { DatabaseStack } from './DatabaseStack';
import { ApiStack } from './ApiStack';
import { MediaProcessingStack } from './MediaProcessingStack';
import { ObservabilityStack } from './ObservabilityStack';
import { Config } from '../bin/config';

/**
 * Senior Strategy: The Application Stage.
 * Centralizes the environment configuration for the production stacks.
 */
export class StreamingAppStage extends cdk.Stage {
  public readonly appDistributionBucketName: cdk.CfnOutput;
  public readonly distributionId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const env = {
      account: Config.account,
      region: Config.region
    };

    const storage = new StorageStack(this, 'StorageStack', { env });
    this.appDistributionBucketName = storage.node.findChild('AppDistributionBucketName') as cdk.CfnOutput;
    this.distributionId = storage.node.findChild('DistributionId') as cdk.CfnOutput;

    const database = new DatabaseStack(this, 'DatabaseStack', { env });

    const api = new ApiStack(this, 'ApiStack', {
      env,
      table: database.table,
      cdnDomain: storage.distribution.distributionDomainName
    });

    new MediaProcessingStack(this, 'MediaProcessingStack', {
      env,
      sourceBucket: storage.mediaBucket,
      hlsBucket: storage.hlsBucket,
      metadataTable: database.table,
    });

    new ObservabilityStack(this, 'ObservabilityStack', {
      env,
      logGroup: api.logGroup
    });
  }
}
