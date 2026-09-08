# The Scroll (Web): Implementation Plan

This plan outlines the architecture for **The Scroll (Web)**, the primary viewing experience for desktop, laptop, and Smart TV browsers. It leverages the existing Alexandria+ infrastructure to deliver professional-grade HLS streaming with zero-install friction.

## Architecture: Unified Web Delivery

### Lead SDE Strategy
| Component | Responsibility |
| :--- | :--- |
| **Frontend (React)** | The "Public Face." Handles library browsing and responsive media playback. |
| **Media Player** | **Shaka Player**. A high-performance, open-source library that handles our ABR bitrate ladder natively on web. |
| **Hosting** | Hosted on the root path (`/`) of the existing Alexandria+ CloudFront distribution. |

## Proposed Workflow
1.  **Authentication**: User logs in (Cognito). The JWT is stored in the browser's local state.
2.  **Discovery**: App calls `GET /catalog` with the family's `tenant-id` and `family-id`.
3.  **Playback**: 
    - User selects a title.
    - React initializes Shaka Player with the CloudFront `.m3u8` URL.
    - Shaka Player automatically negotiates the best bitrate based on the user's internet speed (ABR).
4.  **Telemetry**: Playback events (heartbeats) are sent to the Scribe API every 60 seconds to update watch history.

## Proposed Changes

### 1. Cloud Infrastructure (CDK)
#### [MODIFY] [StorageStack.ts](file:///I:/Android%20Projects/infrastructure/lib/StorageStack.ts)
- Add `ViewerPortalBucket` for the root website.
- Add the root behavior (`/*`) to CloudFront to serve the viewer.

### 2. Frontend Development (React)
#### [NEW] `/app-viewer`
- **Catalog Component**: Reusable library view (Shared logic with Demetrius).
- **Player Component**: Integration with **Shaka Player**.
- **Responsive Layout**: Optimized for "Lean Back" viewing (10ft UI for TVs).

## Verification Plan
1. **Multi-Browser Test**: Verify playback on Chrome, Safari, and Firefox.
2. **ABR Verification**: Use Chrome DevTools to throttle network speed and verify Shaka Player switches between 1080p and 480p segments.
3. **Casting Test**: Verify the "Cast" icon appears and works with Google Chromecast.
