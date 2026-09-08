# Asynchronous Multipart Ingestion Plan

This plan outlines the architecture for handling massive media files (50GB+) in the Demetrius Partner Portal. It moves the upload process to a resilient, background-threaded model using S3 Multipart Uploads.

## Architecture: The "Slice and Ship" Pattern

### Lead SDE Strategy
| Component | Responsibility |
| :--- | :--- |
| **Scribe API** | Handshake for `UploadId` and generating pre-signed URLs for individual 10MB chunks. |
| **React Context** | A global state manager that coordinates the "Chunk Queue," ensuring the browser doesn't time out. |
| **DDB State Machine**| Introduces the `UPLOADING` state to keep the UI in sync while bits are in transit. |

## Proposed Workflow
1.  **Start**: Browser calls `/upload/start`. S3 returns an `UploadId`.
2.  **State**: Metadata is saved in DynamoDB with `transcodeStatus = UPLOADING`.
3.  **Parallel Chunks**: React slices the file. It requests signed URLs for Part 1, Part 2, etc., and uploads them in parallel (up to 3 at a time).
4.  **Finalize**: Browser calls `/upload/complete`. S3 assembles the parts into a single file.
5.  **Trigger**: S3 ObjectCreated event pings the Orchestrator. 

## Proposed Changes

### 1. Backend (The Scribe)
#### [MODIFY] [lambda/index.js](file:///I:/Android%20Projects/infrastructure/lambda/index.js)
- Add handlers for Multipart Start, Part, and Complete.

### 2. Frontend (Demetrius)
#### [NEW] [context/UploadContext.tsx](file:///I:/Android%20Projects/app-admin/src/context/UploadContext.tsx)
- Global background manager for the upload queue.
#### [NEW] [components/UploadDrawer.tsx](file:///I:/Android%20Projects/app-admin/src/components/UploadDrawer.tsx)
- Persistent "Tasks" UI showing per-file percentage and status.

## Verification Plan
1. **Large File Test**: Attempt to upload a 2GB file. Navigate away to "Library" while it is 50% done. Verify it continues to upload in the drawer.
2. **Failure Recovery**: Briefly disconnect the internet during an upload. Verify that the current chunk fails but the context allows for retry logic.
3. **End-to-End**: Verify Fargate only starts AFTER the S3 "Complete" call is made.
