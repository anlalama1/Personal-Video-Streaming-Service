import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StorageStack } from './StorageStack';
import { DatabaseStack } from './DatabaseStack';
import { ApiStack } from './ApiStack';
import { MediaProcessingStack } from './MediaProcessingStack';
import { ObservabilityStack } from './ObservabilityStack';
import { ImageBuilderStack } from './ImageBuilderStack';

/**
 * Senior Strategy: The Application Stage.
 * In a professional CI/CD environment, we wrap our related stacks in a "Stage".
 * This allows the pipeline to deploy the entire application as a single unit
 * into different environments (e.g., Staging, Production).
 */
export class StreamingAppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const env = {
      account: props?.env?.account || '575992668616',
      region: props?.env?.region || 'us-east-1'
    };

    // 1. Foundation
    const storage = new StorageStack(this, 'StorageStack', { env });
    const database = new DatabaseStack(this, 'DatabaseStack', { env });

    // 2. Logic
    const api = new ApiStack(this, 'ApiStack', {
      env,
      table: database.table,
      cdnDomain: storage.distribution.distributionDomainName
    });

    // 3. Media Processing
    const builder = new ImageBuilderStack(this, 'ImageBuilderStack', { env });

    new MediaProcessingStack(this, 'MediaProcessingStack', {
      env,
      sourceBucket: storage.mediaBucket,
      hlsBucket: storage.hlsBucket,
      metadataTable: database.table,
      repository: builder.repository
    });

    // 4. Monitoring
    new ObservabilityStack(this, 'ObservabilityStack', {
      env,
      logPlayLambda: api.logPlayLambda
    });
  }
}
