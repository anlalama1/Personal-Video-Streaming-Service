# CI/CD Pipeline Implementation Plan

This plan outlines the creation of a professional, automated deployment pipeline using **AWS CDK Pipelines**. This will eliminate manual `cdk deploy` commands and ensure that every push to the GitHub `main` branch automatically updates your cloud infrastructure and rebuilds your media engine.

## Architecture: The "Self-Mutating" Pipeline

### Senior/Lead Approach
| Component | Manual Deployment (Current) | Automated Pipeline (SDE Pro) |
| :--- | :--- | :--- |
| **Trigger** | Manual CLI command on your PC. | **Git Push**. Infrastructure follows code. |
| **Docker Build** | Manual CLI command to CodeBuild. | **Pipeline Asset Stage**. Automated as part of the release. |
| **Consistency** | Risk of "Dirty" local builds. | **Clean Room Environment**. Built on fresh AWS servers every time. |
| **Safety** | High risk of manual error. | **Orchestrated Stages**. Stacks are deployed in the correct dependency order. |

## Proposed Pipeline Flow
1.  **Source**: GitHub triggers the pipeline on `main` branch push.
2.  **Build**: CodeBuild synthesizes the CDK app.
3.  **Update**: The pipeline "Self-Mutates" (updates its own structure if needed).
4.  **Assets**: Docker images (FFmpeg) and Lambda code are built and published.
5.  **Deploy**: Stacks are deployed in sequence:
    *   Stage 1: Foundation (`Storage`, `Database`).
    *   Stage 2: Application (`Api`, `ImageBuilder`, `MediaProcessing`).
    *   Stage 3: Monitoring (`Observability`).

## Proposed Changes

### 1. Infrastructure Orchestration
#### [NEW] [PipelineStack.ts](file:///I:/Android%20Projects/infrastructure/lib/PipelineStack.ts)
- Define the `CodePipeline` resource.
- Configure the GitHub connection.

#### [NEW] [StreamingAppStage.ts](file:///I:/Android%20Projects/infrastructure/lib/StreamingAppStage.ts)
- A new construct to group all your modular stacks together for pipeline deployment.

### 2. Deployment Entry Point
#### [MODIFY] [infrastructure.ts](file:///I:/Android%20Projects/infrastructure/bin/infrastructure.ts)
- Add the `PipelineStack` as the primary entry point.

## User Action Required: GitHub Connection
AWS requires a manual "Handshake" to talk to your GitHub. 
1.  Go to **AWS Console** -> **CodePipeline** -> **Settings** -> **Connections**.
2.  Click **Create connection**.
3.  Select **GitHub** and name it `github-portfolio-connection`.
4.  Follow the prompts to authorize AWS and click **Install a new app** if needed.
5.  **Copy the Connection ARN** and provide it to me.

## Verification Plan
1.  **Initial Deploy**: Run `npx cdk deploy StreamingPipelineStack` once.
2.  **Git Trigger**: Push a small comment change to `main`.
3.  **Dashboard Audit**: Watch the pipeline progress in the AWS CodePipeline Console.
