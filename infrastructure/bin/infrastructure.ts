#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/StorageStack';
import { DatabaseStack } from '../lib/DatabaseStack';
import { ApiStack } from '../lib/ApiStack';
import { ObservabilityStack } from '../lib/ObservabilityStack';
import { MediaProcessingStack } from '../lib/MediaProcessingStack';
import { ImageBuilderStack } from '../lib/ImageBuilderStack';

const app = new cdk.App();

const env = {
  account: '575992668616',
  region: 'us-east-1'
};

// 1. Storage Layer
const storage = new StorageStack(app, 'StreamingStorageStack', { env });

// 2. Data Layer
const database = new DatabaseStack(app, 'StreamingDatabaseStack', { env });

// 3. Logic & API Layer
const api = new ApiStack(app, 'StreamingApiStack', {
  env,
  table: database.table,
  cdnDomain: storage.distribution.distributionDomainName
});

// 4. Build System (The "Image Factory")
const builder = new ImageBuilderStack(app, 'StreamingImageBuilderStack', { env });

// 5. Media Processing Layer (The "Transcoder Engine")
// Note: This stack depends on the builder's output.
new MediaProcessingStack(app, 'StreamingMediaProcessingStack', {
  env,
  sourceBucket: storage.mediaBucket,
  hlsBucket: storage.hlsBucket,
  metadataTable: database.table,
  repository: builder.repository
});

// 6. Observability Layer
new ObservabilityStack(app, 'StreamingObservabilityStack', {
  env,
  logPlayLambda: api.logPlayLambda
});
