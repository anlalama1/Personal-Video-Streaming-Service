# Secure Streaming (S3 Lockdown) Implementation Plan

This plan outlines the steps to move from insecure public S3 buckets to a professional, restricted access model using **Amazon CloudFront** and **Origin Access Control (OAC)**.

## Architecture: The "Fortress" Pattern

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer |
| :--- | :--- | :--- |
| **Access Control** | Uses S3 Pre-signed URLs (Direct to S3). | Uses **CloudFront Signed URLs**. Access is restricted to the CDN, keeping the S3 bucket entirely private. |
| **Performance** | Users download directly from S3 (Higher latency, higher egress costs). | Users fetch from **Edge Locations**. Content is cached globally, reducing latency and AWS costs. |
| **Security** | Buckets are public or require complex IAM management on the client. | Buckets use **Origin Access Control (OAC)**. Only CloudFront can talk to S3; the internet is blocked. |

## Proposed Changes

### 1. Cloud Infrastructure (CDK)
#### [MODIFY] [infrastructure-stack.ts](file:///I:/Android%20Projects/infrastructure/lib/infrastructure-stack.ts)
- **Lockdown S3**: Set `publicReadAccess: false` and `blockPublicAccess: BlockPublicAccess.BLOCK_ALL`.
- **CloudFront OAC**: Create an Origin Access Control to allow CloudFront to securely talk to the private buckets.
- **Distribution**: Create a CloudFront Distribution for both media and thumbnails.

---

### 2. Backend Logic (Lambda)
#### [MODIFY] [index.js](file:///I:/Android%20Projects/infrastructure/lambda/index.js)
- **Signer Integration**: Use the AWS SDK to generate **CloudFront Signed URLs**.
- **Dynamic Catalog**: Instead of returning raw S3 links, the Lambda will now return temporary, time-limited URLs that only work for your app.

---

### 3. Android Client
- No code changes are required for the initial fetch, as the app already handles HTTPS URLs. However, we will verify that "raw" S3 links now return `403 Forbidden`.

## Verification Plan

### Security Verification
1. **Public Block**: Try to access an image link in your browser directly via S3 URL. It should return **403 Forbidden**.
2. **CDN Access**: Access the same image via the CloudFront URL. It should work perfectly.

### Android Verification
1. **Catalog Load**: Verify the app still displays thumbnails and plays video (now coming through the CDN).
