#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/PipelineStack';
import { Config } from './config';

const app = new cdk.App();

const env = {
  account: Config.account,
  region: Config.region
};

/**
 * Principal Strategy: The Pipeline as the Orchestrator.
 * The PipelineStack acts as the entry point for Git-Ops based deployments.
 */
new PipelineStack(app, 'StreamingPipelineStack', { env });

app.synth();
