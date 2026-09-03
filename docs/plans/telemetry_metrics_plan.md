# Telemetry & Metrics Implementation Plan

This plan outlines the steps to add professional-grade observability to the streaming service using **Amazon CloudWatch Custom Metrics**.

## Architecture: The "Observability" Pipeline

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer (SDE Style) |
| :--- | :--- | :--- |
| **Data Collection** | Logs "API Called" as a simple string in console. | Uses **Custom Metrics** to track quantitative trends over time. |
| **Performance** | Calls `PutMetricData` synchronously (adds latency to user). | Uses **Embedded Metric Format (EMF)** via `console.log`. CloudWatch parses logs asynchronously with zero impact on user latency. |
| **Granularity** | Tracks total plays only. | Tracks plays with **Dimensions** (e.g., Title Name, Genre) allowing for a "Top 10" dashboard. |
| **Tracking Point** | Only tracks what the backend sees. | Implements a dedicated **Analytics API** to track client-side events like "Playback Started." |

## Proposed Changes

### 1. Cloud Infrastructure (CDK)
#### [MODIFY] [infrastructure-stack.ts](file:///I:/Android%20Projects/infrastructure/lib/infrastructure-stack.ts)
- Add a new Lambda: `LogPlayEventFunction`.
- Add a new API Gateway endpoint: `POST /play`.
- Grant the Lambdas `cloudwatch:PutMetricData` permissions (though EMF uses logs, explicit permissions are safer for future expansion).

---

### 2. Backend Logic (Lambda)
#### [MODIFY] [index.js](file:///I:/Android%20Projects/infrastructure/lambda/index.js)
- **Catalog Metric**: Emit an EMF metric `CatalogRequested` every time the catalog is fetched.
- **Play Metric**: Implement the new handler to emit `VideoPlayed` with `Title` and `VideoID` as dimensions.

---

### 3. Android Integration
#### [MODIFY] [StreamingApiService.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/data/network/StreamingApiService.kt)
- Add `logPlayEvent(videoId: String)` to the Retrofit interface.

#### [MODIFY] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/VideoPlayerViewModel.kt)
- Trigger the API call the moment `playVideo()` is called.

## Verification Plan
1. **CloudWatch Metrics**: Open the AWS Console -> CloudWatch -> Metrics -> "All Metrics" -> "StreamingService".
2. **Dashboard**: (Optional) Create a simple graph showing the most played titles.
3. **Android**: Verify that starting a video doesn't lag while the metric is being sent.
