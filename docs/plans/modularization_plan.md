# Multi-Module Project Refactoring Plan

This plan outlines the transition from a "Monolith" architecture (everything in one module) to a scalable, **Multi-Module** system. This is a critical requirement for building the **Administrator App** while reusing your existing AWS logic.

## Architecture: The "Scale" Design

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer (SDE Style) |
| :--- | :--- | :--- |
| **Organization** | One large `:app` module (Monolith). | **Modular Layers**. Code is split by responsibility (Data, UI, Features). |
| **Code Reuse** | Copy-pastes code between separate projects. | Uses **Shared Modules**. The Admin and Consumer apps both depend on the same `:core:data` module. |
| **Build Times** | Slow; a change in one file re-compiles everything. | **Parallel Builds**. Only the modified module and its dependents are re-compiled. |
| **Scalability** | Hard to maintain as the team/feature set grows. | Easy to assign different modules to different teams or engineers. |

## Proposed Changes

### 1. Structure Preparation
- Create a directory structure: `core/data`.
- Register the new module in `settings.gradle.kts`.

### 2. The Shared Core (`:core:data`)
#### [NEW] [core/data/build.gradle.kts](file:///I:/Android%20Projects/core/data/build.gradle.kts)
- Move Retrofit, DataStore, and AWS-specific dependencies here.
- This module will handle:
    - **Models**: `MediaFile` and `MediaItemDto`.
    - **Networking**: `StreamingApiService` and `StreamingApi`.
    - **Storage**: `ScreenTimeRepository`.

### 3. The Consumer App (`:app`)
#### [MODIFY] [app/build.gradle.kts](file:///I:/Android%20Projects/app/build.gradle.kts)
- Remove data-specific dependencies.
- Add `implementation(project(":core:data"))`.
- Update imports to use the new module paths.

### 4. The Administrator App (Coming Soon)
- Once the refactor is complete, we will create `:app-admin`, which will also simply `implementation(project(":core:data"))`.

## Verification Plan
1. **Gradle Sync**: Verify the multi-module project structure is recognized.
2. **Build**: Run `:app:assembleDebug` to ensure the Consumer app still works perfectly using the shared data module.
