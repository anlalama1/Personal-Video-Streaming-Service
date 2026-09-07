# Multi-Tenant Refactor Plan (The "Scribe" Evolution)

This plan outlines the transition of the Alexandria+ backend from a single-user system to a professional, multi-tenant B2B platform. This ensures data isolation between different digitization shops (Tenants).

## Architecture: Single-Table Design

### Senior vs. Principal Approach
| Component | Single-User (Current) | Multi-Tenant (Principal SDE) |
| :--- | :--- | :--- |
| **Partition Key (PK)** | `videoId` | **`PK` (Generic)**. Value: `TENANT#<ShopID>` |
| **Sort Key (SK)** | None | **`SK` (Generic)**. Value: `VIDEO#<VideoID>` |
| **Data Isolation** | None. All users see all videos. | **Physical Partitioning**. Queries are scoped to a single tenant. |
| **Scalability** | Limited by single partition throughput. | **Horizontal Scale**. Each shop gets its own partition performance. |

## Proposed Schema
| PK | SK | Attributes |
| :--- | :--- | :--- |
| `TENANT#SEATTLE_LAB` | `METADATA` | `{ shopName: "Seattle Media Lab", logo: "..." }` |
| `TENANT#SEATTLE_LAB` | `VIDEO#123` | `{ title: "Christmas 94", videoKey: "...", hlsKey: "..." }` |
| `TENANT#TACOMA_SHOP` | `VIDEO#456` | `{ title: "Wedding 2002", videoKey: "...", hlsKey: "..." }` |

## Proposed Changes

### 1. Database (CDK)
#### [MODIFY] [DatabaseStack.ts](file:///I:/Android%20Projects/infrastructure/lib/DatabaseStack.ts)
- Rename `partitionKey` from `videoId` to `PK`.
- Add `sortKey` named `SK`.

### 2. Backend API (The Scribe)
#### [MODIFY] [lambda/index.js](file:///I:/Android%20Projects/infrastructure/lambda/index.js)
- Update `ScanCommand` to `QueryCommand`.
- Force the query to use `PK = TENANT#<tenantId>`.
- Note: For the MVP, we will pass `x-tenant-id` in the header until Cognito is live.

### 3. Transcoder (The Pharos Engine)
#### [MODIFY] [transcoder/index.js](file:///I:/Android%20Projects/infrastructure/transcoder/index.js)
- Update the DynamoDB update logic to include the `PK` and `SK` format.
- Task now accepts `TENANT_ID` as an environment variable.

### 4. Android Client (The Scroll)
#### [MODIFY] [core/data/network/StreamingApiService.kt](file:///I:/Android%20Projects/core/data/src/main/java/com/portfolio/videostreaming/core/data/network/StreamingApiService.kt)
- Update Retrofit to pass the `tenantId` in the request headers.

## Verification Plan
1. **Manual Data Entry**: Create two items in DynamoDB with different `TENANT#` PKs.
2. **API Isolation Test**: Call the API twice using different `x-tenant-id` headers. Verify only the corresponding videos are returned.
3. **End-to-End Transcode**: Upload a video and verify the Pharos Engine correctly updates the new `PK/SK` schema.
