# CloudWatch Dashboard Implementation Plan

This plan outlines the steps to create a centralized observability dashboard in AWS CloudWatch to monitor the health and usage of the streaming service.

## Architecture: Centralized Observability

### Senior/Lead Approach
| Component | Senior/Lead Developer (SDE Style) |
| :--- | :--- |
| **Visibility** | Uses a **CDK-defined Dashboard**. The dashboard is version-controlled and scales as new metrics are added. |
| **Insights** | Visualizes **Dimensions** (e.g., specific Video Titles) to provide business value, not just system health. |
| **Error Monitoring** | Includes dedicated error tracking widgets to enable fast debugging of Lambda/DynamoDB issues. |

## Proposed Changes

### 1. Cloud Infrastructure (CDK)
#### [MODIFY] [infrastructure-stack.ts](file:///I:/Android%20Projects/infrastructure/lib/infrastructure-stack.ts)
- Import `aws-cloudwatch`.
- Create a `Dashboard` resource named `StreamingServiceDashboard`.
- Add the following widgets:
    - **Usage Overview**: Catalog Request Count over time.
    - **Top Content**: Video Play Count visualized by `Title` dimension.
    - **System Health**: API Error Count segmented by service.

## Verification Plan
1. **CDK Deploy**: Deploy the stack to update the backend.
2. **Console Verification**: 
    - Open AWS Console -> CloudWatch -> Dashboards.
    - Select **StreamingServiceDashboard**.
    - Verify that graphs are present and correctly mapped to the `StreamingService` namespace.
