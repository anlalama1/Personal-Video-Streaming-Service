# Self-Healing Transcoding Sweeper Plan

This plan implements a professional **Reconciliation Loop** for the media pipeline. It ensures that every video in the catalog eventually receives HLS artifacts, even if the initial upload trigger fails or the transcoder crashes.

## Architecture: The Reconciliation Loop

### Intermediate vs. Senior/Lead Approach
| Aspect | Event-Only (Current) | Self-Healing (Lead SDE) |
| :--- | :--- | :--- |
| **Reliability** | "Best Effort". Fails silently if event is lost. | **Guaranteed Consistency**. System fixes itself. |
| **Visibility** | Requires checking logs to find stuck videos. | **Automatic Detection**. Database state drives the fix. |
| **Remediation** | Manual re-upload required. | **Automated Retry**. Zero human intervention. |
| **Safety** | High risk of "Hanging" entries. | **Guardrails**. Tracks retry counts to avoid infinite loops. |

## Proposed Workflow
1.  **Schedule**: EventBridge triggers a "Sweep" every 15 minutes.
2.  **Scan**: `SweeperLambda` scans DynamoDB for items where `hlsKey` is missing.
3.  **Filter**:
    - Ignore items created in the last 10 minutes (allow time for initial processing).
    - Ignore items with `retryCount >= 3` (DLQ logic for corrupt files).
4.  **Re-Trigger**: Push the `videoKey` into the `TranscodeQueue`.
5.  **Process**: `OrchestratorLambda` starts Fargate. 
6.  **Update**: `Transcoder` increments `retryCount` on start and clears it on success.

## Proposed Changes

### 1. Infrastructure (CDK)
#### [MODIFY] [MediaProcessingStack.ts](file:///I:/Android%20Projects/infrastructure/lib/MediaProcessingStack.ts)
- New Lambda: `TranscodingSweeper`.
- EventBridge Rule: `Cron(0/15 * * * ? *)`.
- Permissions: DDB Scan + SQS Send.

### 2. Logic (Lambda)
#### [NEW] [sweeper.js](file:///I:/Android%20Projects/infrastructure/lambda/sweeper.js)
- Logic to identify "Stuck" videos and push them to SQS.

#### [MODIFY] [orchestrator.js](file:///I:/Android%20Projects/infrastructure/lambda/orchestrator.js)
- Unpacking logic to support a simpler `{"videoKey": "..."}` message format.

## Verification Plan
1. **Simulate Failure**: Manually add a DynamoDB entry with a valid `videoKey` but **no** `hlsKey`.
2. **Audit**: Verify the Sweeper detects the entry within 15 minutes.
3. **Loop Close**: Verify the Fargate task starts and completes without manual intervention.
