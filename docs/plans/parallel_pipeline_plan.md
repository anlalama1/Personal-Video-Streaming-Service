# Parallel Build Pipeline Optimization Plan

This plan outlines the transition from a sequential build process to a professional "Parallel Wave" architecture. This will significantly reduce the "Code-to-Phone" latency by building the Android App and the FFmpeg Docker image simultaneously.

## Architecture: Fork-Join Parallelism

### Senior vs. Principal Approach
| Phase | Sequential (Current) | Parallel (Principal SDE Pro) |
| :--- | :--- | :--- |
| **Infrastructure** | CDK Synth. | CDK Synth (Fast). |
| **Execution** | Waits for Android, then builds Docker. | **Parallel Build**. Android APK and Docker Image build at once. |
| **Dependency** | Linked in one large step. | **Decoupled**. One failure doesn't block the other's logs. |
| **Speed** | ~12+ Minutes. | **~6-7 Minutes** (Longest pole). |

## Proposed Changes

### 1. The Build Orchestration
#### [MODIFY] [PipelineStack.ts](file:///I:/Android%20Projects/infrastructure/lib/PipelineStack.ts)
- **Synth Cleanup**: Remove Android SDK installation and Gradle build from the `synth` step.
- **New Step**: Create `androidBuildStep` as a standalone `CodeBuildStep`.
- **The Wave**: Use `pipeline.addWave('ParallelBuilds')` to run the Android build alongside the automated CDK Assets (Docker) build.

### 2. Artifact Handover
- Ensure the standalone Android step provides the `android/latest-beta.apk` to the final `UploadAndroidApk` step.

## Verification Plan
1. **GitHub Push**: Trigger the pipeline.
2. **Dashboard Audit**: Open the **AWS CodePipeline Visualizer**. 
3. **Parallel Check**: Verify that the **Assets** stage and the new **Android Build** action are running at the same time.
4. **Speed Test**: Compare total execution time with the previous sequential run.
