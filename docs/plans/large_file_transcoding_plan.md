# Large File Transcoding Strategy (The "Return of the King" Challenge)

This plan outlines the architectural shifts required to handle massive media files (e.g., a 4-hour 4K movie) that exceed the 20GB local storage limit of standard AWS Fargate tasks.

## The Bottleneck: Stateless Disk Limits
Currently, the transcoder uses a "Batch" workflow:
1.  Download entire MP4 (~50GB).
2.  Transcode to HLS segments (~100GB total across ladder).
3.  Upload to S3.

**Result**: Fargate's 20GB `/tmp` storage is overwhelmed, leading to `Disk Full` crashes.

## Proposed Strategy: "Stream & Drain" (SDE Pro)

### 1. Inbound Streaming (Piping)
Instead of downloading the whole file, we use FFmpeg's ability to read from an **S3 HTTP URL** directly.
- **Benefit**: Zero local storage used for the input file.
- **How**: Use CloudFront or S3 Signed URLs as the input path for FFmpeg.

### 2. Outbound "Draining" (Continuous Sync)
Instead of waiting for the transcode to finish, we "Drain" segments to S3 as they are created.
- **Workflow**: 
    - FFmpeg runs in the background.
    - A secondary "Watcher" process monitors the output directory.
    - As soon as a `.ts` segment is finished, it is uploaded to S3 and deleted locally.
- **Benefit**: Local disk usage never exceeds the size of a few 6-second segments.

### 3. Resiliency & Checkpointing (The "Resume" Benefit)
Using a continuous "Drain" strategy allows the system to recover from runtime failures without starting from zero.
- **Mechanism**: By persisting segments to S3 immediately, the system effectively "Checkpoints" its progress. 
- **Recovery**: If a Fargate task crashes at hour 3 of a 4-hour movie, the replacement task can inspect the output bucket, see that segments 001-900 already exist, and instruct FFmpeg to begin transcoding from the 3-hour timestamp.
- **Efficiency**: Eliminates the risk of "Wasted Compute" on long-running tasks.

## High-Level Implementation Steps

### A. Infrastructure (CDK)
- Mount an **Amazon EFS** (Elastic File System) volume to the Fargate task as a "Safety Buffer" if streaming isn't preferred.

### B. Transcoder Engine (Docker)
- Refactor `index.js` to use the `chokidar` (or similar) library to watch for file events.
- Implement an **Async Upload Queue** to ensure S3 uploads don't bottleneck the FFmpeg CPU.

### C. Scaling (Shredding)
- For ultra-large files, move to a **"Scatter-Gather"** architecture:
    - Task 1: "Shred" MP4 into 5-minute chunks.
    - Tasks 2-N: Transcode chunks in parallel.
    - Task Final: "Stitch" the master manifest.

## Verification Plan
1. **Stress Test**: Upload a 10GB test file.
2. **Disk Monitoring**: Use CloudWatch Container Insights to verify that `/tmp` usage stays low and flat during the process.
