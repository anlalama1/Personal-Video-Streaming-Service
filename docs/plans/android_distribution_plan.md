# Android Cloud-Build & Distribution Plan

This plan outlines the automation of the Android build process and the creation of a secure "Beta Distribution" channel. This allows you to download the latest version of your app directly to your physical phone via AWS CloudFront.

## Architecture: Unified Release Engine

### Senior/Lead Approach
| Component | Local Build (Current) | Cloud Build (SDE Pro) |
| :--- | :--- | :--- |
| **Environment** | Local Android Studio (Variable). | **AWS CodeBuild**. Deterministic & Clean. |
| **Artifacts** | Stays on your PC. | **S3 Distribution**. Hosted in the cloud. |
| **Delivery** | USB Cable / Manual move. | **CDN Link**. Download directly to phone. |
| **Scaling** | One build at a time. | **Parallel Pipelines**. Build infra and app at once. |

## Proposed Pipeline Flow
1.  **Git Push**: Triggers the `StreamingPipeline`.
2.  **Build Stage**:
    - **Step A**: Synth CDK Infrastructure.
    - **Step B**: **Android Build**.
        - Provision a Java 17 container.
        - Install Android SDK Command-line Tools.
        - Run `./gradlew assembleDebug`.
3.  **Deploy Stage**: 
    - Update Cloud Infrastructure.
    - Upload `app-debug.apk` to `AppDistributionBucket`.
4.  **Distribution**:
    - Accessible via `https://[CDN_DOMAIN]/download/latest-beta.apk`.

## Proposed Changes

### 1. Cloud Storage (Infrastructure)
#### [MODIFY] [StorageStack.ts](file:///I:/Android%20Projects/infrastructure/lib/StorageStack.ts)
- New Bucket: `AppDistributionBucket`.
- New CloudFront Behavior: `/download/*` maps to this bucket.

### 2. Deployment Orchestration (Pipeline)
#### [MODIFY] [PipelineStack.ts](file:///I:/Android%20Projects/infrastructure/lib/PipelineStack.ts)
- Add the `AndroidBuild` step.
- Configure post-deployment asset upload (moving the APK to the distribution bucket).

## Verification Plan
1.  **Pipeline Audit**: Verify the new `AndroidBuild` step shows up in CodePipeline.
2.  **S3 Check**: Verify the APK is present in the `prod-storagestack-appdistributionbucket...`.
3.  **Physical Phone**: Navigate to the CloudFront URL on your mobile browser, download, and install.
