#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/StorageStack';
import { DatabaseStack } from '../lib/DatabaseStack';
import { ApiStack } from '../lib/ApiStack';
import { ObservabilityStack } from '../lib/ObservabilityStack';

const app = new cdk.App();

const env = {
  account: '575992668616',
  region: 'us-east-1'
};

// 1. Storage Layer (S3 + CloudFront)
const storage = new StorageStack(app, 'StreamingStorageStack', { env });

// 2. Data Layer (DynamoDB)
const database = new DatabaseStack(app, 'StreamingDatabaseStack', { env });

// 3. Logic & API Layer (Lambda + API Gateway)
const api = new ApiStack(app, 'StreamingApiStack', {
  env,
  table: database.table,
  cdnDomain: storage.distribution.distributionDomainName
});

// 4. Observability Layer (Dashboards)
new ObservabilityStack(app, 'StreamingObservabilityStack', {
  env,
  logPlayLambda: api.logPlayLambda
});
