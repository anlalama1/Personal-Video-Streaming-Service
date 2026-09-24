#!/usr/bin/env node
/**
 * ============================================================================
 * AWS CDK Application Entry Binary
 * ============================================================================
 * Architecture Pattern: Infrastructure-as-Code (IaC) Entry Point.
 * Instantiates the top-level PipelineStack which orchestrates GitOps deployments
 * and synthesizes CloudFormation templates for AWS CloudAssembly.
 */

import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/PipelineStack';
import { Config } from './config';

const app = new cdk.App();

// Environment configuration containing AWS Account ID and Deployment Region
const env = {
  account: Config.account,
  region: Config.region
};

/**
 * Principal Strategy: The CI/CD Pipeline as the Primary Orchestrator.
 * The PipelineStack acts as the GitOps entry point for self-mutating deployments.
 */
new PipelineStack(app, 'StreamingPipelineStack', { env });

// Synthesize CloudFormation template artifacts into cdk.out
app.synth();
