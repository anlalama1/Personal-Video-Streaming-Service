# HLS Adaptive Streaming Pipeline Plan

This plan outlines the implementation of a professional media transcoding pipeline. It converts raw MP4 uploads into HLS (HTTP Live Streaming) artifacts with a "Bitrate Ladder" for adaptive streaming.

## Architecture: Event-Driven Transcoding

### Intermediate (EC2) vs. Senior/Lead (Fargate)
| Component | Intermediate (EC2) | Senior/Lead (Fargate) |
| :--- | :--- | :--- |
| **Compute** | Persistent EC2 instance. | **Serverless Containers**. Spins up on-demand for each video. |
| **Orchestration** | Manual SQS polling script. | **AWS ECS**. Native integration with AWS events. |
| **Scalability** | 1 instance = 1 transcode at a time. | **Parallel Processing**. 10 uploads = 10 simultaneous containers. |
| **Maintenance** | Manage Linux, patches, FFmpeg installs. | **Immutable Docker Image**. Setup once, runs everywhere. |

## Proposed Pipeline Flow
1.  **Upload**: MP4 is uploaded to `MediaSourceBucket`.
2.  **Trigger**: S3 sends an event to **AWS EventBridge**.
3.  **Action**: EventBridge triggers an **ECS Fargate Task**.
4.  **Transcode**: A Docker container running **FFmpeg**:
    *   Downloads the MP4.
    *   Generates a 3-level Bitrate Ladder (1080p, 720p, 480p).
    *   Chunks the video into 6-second segments (`.ts`).
    *   Creates HLS Manifests (`.m3u8`).
5.  **Persistence**: Container uploads artifacts to `HlsOutputBucket`.
6.  **Update**: Task updates the DynamoDB record with the new `.m3u8` URL.

## Proposed Changes

### 1. Cloud Infrastructure (CDK)
#### [NEW] [MediaProcessingStack.ts](file:///I:/Android%20Projects/infrastructure/lib/MediaProcessingStack.ts)
- New S3 Bucket: `HlsOutputBucket`.
- ECS Cluster & Fargate Task Definition.
- IAM Roles (S3 Read/Write, DynamoDB Update).

### 2. Media Engineering (Docker/FFmpeg)
#### [NEW] [transcoder/Dockerfile](file:///I:/Android%20Projects/infrastructure/transcoder/Dockerfile)
- Base image with FFmpeg installed.
- Python or Node.js wrapper script to handle AWS I/O.

## Verification Plan
1. **Manual Upload**: Upload an MP4 to S3.
2. **Task Audit**: Monitor the ECS Console to see the task spin up.
3. **CloudFront Check**: Verify the `.m3u8` is accessible via CDN.
4. **Player Test**: Update the Android player to stream the HLS manifest.
