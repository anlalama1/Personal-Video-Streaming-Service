# Demetrius: Partner Portal Implementation Plan

This plan outlines the creation of **Demetrius**, the web-based administrative portal for digitization shops. It enables shop owners to ingest new media, manage their library, and monitor transcoding health.

## Architecture: The "Demetrius" & "Scribe" Interaction

### Lead SDE Strategy
| Component | Responsibility |
| :--- | :--- |
| **Demetrius (React)** | The "Great Hall" UI. Handles metadata entry and direct browser-to-S3 multi-part uploads. |
| **The Scribe (API)** | Provides pre-signed S3 URLs for secure uploads and manages DynamoDB metadata. |
| **Hosting** | S3 Static Web Hosting fronted by the existing Alexandria+ CloudFront CDN. |

## Proposed Workflow
1.  **Selection**: Admin picks a file and enters Title/Genre/Year/FamilyID.
2.  **Handshake**: 
    - Portal calls `POST /ingest` to create a `PENDING` record in DynamoDB.
    - Portal calls `GET /upload-url` to receive a secure, temporary S3 link.
3.  **Direct Upload**: Browser uploads the file directly to S3 using the pre-signed URL.
4.  **Completion**: S3 trigger wakes up the **Pharos Engine** (Transcoder) as usual.
5.  **Dashboard**: Admin views a real-time list of their shop's partition.

## Proposed Changes

### 1. Infrastructure (CDK)
#### [MODIFY] [StorageStack.ts](file:///I:/Android%20Projects/infrastructure/lib/StorageStack.ts)
- Add `AdminPortalBucket` for static site hosting.
- Add `/admin/*` behavior to CloudFront.

#### [MODIFY] [ApiStack.ts](file:///I:/Android%20Projects/infrastructure/lib/ApiStack.ts)
- Add `POST /ingest` and `GET /upload-url` endpoints to the Scribe.

### 2. Frontend (React/TypeScript)
#### [NEW] `/app-admin`
- **UploadPage**: Form for metadata + file progress tracker.
- **LibraryPage**: Table showing all videos, metadata, and `transcodeStatus`.

## Verification Plan
1. **Local Dev**: Run the React app locally and verify it can fetch the catalog.
2. **End-to-End Ingest**: Upload a 50MB test file. Verify the DynamoDB entry is created and Fargate starts automatically.
3. **Pipeline Check**: Verify the CI/CD pipeline correctly builds and deploys the React app to S3.
