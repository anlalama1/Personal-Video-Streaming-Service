#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/PipelineStack';

const app = new cdk.App();

const env = {
  account: '575992668616',
  region: 'us-east-1'
};

/**
 * Principal Strategy: The Pipeline as the Orchestrator.
 * We no longer instantiate individual stacks here. Instead, we instantiate
 * the PipelineStack, which internally contains our 'StreamingAppStage'.
 *
 * This ensures that EVERY deployment follows the same automated path.
 */
new PipelineStack(app, 'StreamingPipelineStack', { env });

app.synth();
