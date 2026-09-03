# CDK Infrastructure Modularization Plan

This plan outlines the refactoring of the monolithic `InfrastructureStack` into multiple, independent stacks grouped by their architectural domain (Storage, Database, API, and Observability).

## Architecture: Multi-Stack Design

### Monolith vs. Modular Stacks
| Aspect | Monolithic Stack | Modular Stacks (Senior SDE Style) |
| :--- | :--- | :--- |
| **Complexity** | Hard to read; one file manages everything. | High readability; each file focuses on one domain. |
| **Deployment** | Changing one Lambda requires re-calculating the whole stack. | **Atomic Deployments**. You can update the API without touching Storage. |
| **Blast Radius** | A bug in the dashboard code could fail the whole infrastructure. | Errors are isolated to their specific stack. |
| **Limits** | Risk of hitting the 500-resource CloudFormation limit. | Practically unlimited as resources are distributed across stacks. |

## Proposed Changes

### 1. The Storage Domain
#### [NEW] [StorageStack.ts](file:///I:/Android%20Projects/infrastructure/lib/StorageStack.ts)
- S3 Buckets (`MediaSourceBucket`, `ThumbnailBucket`).
- CloudFront Distribution + OAC.
- Bucket Policies.

### 2. The Data Domain
#### [NEW] [DatabaseStack.ts](file:///I:/Android%20Projects/infrastructure/lib/DatabaseStack.ts)
- DynamoDB Table (`VideoMetadataTable`).

### 3. The Logic & API Domain
#### [NEW] [ApiStack.ts](file:///I:/Android%20Projects/infrastructure/lib/ApiStack.ts)
- Lambda Functions (`GetCatalog`, `LogPlayEvent`).
- API Gateway integration.
- Dependency Injection: Accepts the Table and Buckets as props.

### 4. The Observability Domain
#### [NEW] [ObservabilityStack.ts](file:///I:/Android%20Projects/infrastructure/lib/ObservabilityStack.ts)
- CloudWatch Dashboard.
- Monitors metrics from the API Stack.

### 5. Orchestration
#### [MODIFY] [infrastructure.ts](file:///I:/Android%20Projects/infrastructure/bin/infrastructure.ts)
- Orchestrate the instantiation of all four stacks.
- Handle **Cross-Stack References** (passing ARNs and IDs between modules).

## Verification Plan
1. **CDK Diff**: Run `npx cdk diff` to ensure no resources are accidentally deleted or modified during the move.
2. **CDK Deploy**: Run a full deployment.
3. **App Check**: Verify the Android app still functions perfectly with the new backend structure.
