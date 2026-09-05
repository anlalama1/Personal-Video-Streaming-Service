import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StorageStack } from './StorageStack';
import { DatabaseStack } from './DatabaseStack';
import { ApiStack } from './ApiStack';
import { MediaProcessingStack } from './MediaProcessingStack';
import { ObservabilityStack } from './ObservabilityStack';
import { ImageBuilderStack } from './ImageBuilderStack';

export class StreamingAppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const env = {
      account: props?.env?.account || '575992668616',
      region: props?.env?.region || 'us-east-1'
    };

    const storage = new StorageStack(this, 'StorageStack', { env });
    const database = new DatabaseStack(this, 'DatabaseStack', { env });

    const api = new ApiStack(this, 'ApiStack', {
      env,
      table: database.table,
      cdnDomain: storage.distribution.distributionDomainName
    });

    const builder = new ImageBuilderStack(this, 'ImageBuilderStack', { env });

    new MediaProcessingStack(this, 'MediaProcessingStack', {
      env,
      sourceBucket: storage.mediaBucket,
      hlsBucket: storage.hlsBucket,
      metadataTable: database.table,
      repository: builder.repository
    });

    new ObservabilityStack(this, 'ObservabilityStack', {
      env,
      logGroup: api.logGroup
    });
  }
}
