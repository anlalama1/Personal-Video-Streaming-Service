# Package Rename Implementation Plan

This plan outlines the steps to rename the project package from `com.example.videostreaming` to `com.portfolio.videostreaming`. This is a crucial "Senior Engineer" step to ensure the project looks production-ready.

## Architecture: Identity Transition
A package name isn't just a folder; it's the **Unique Identity** of your app on the Google Play Store and inside the Android OS. 

1.  **Namespace**: Used for internal code referencing (e.g., `R.layout`).
2.  **Application ID**: Used for external identification (Store ID, permissions).
3.  **Directory Structure**: Must match the package declaration for the Kotlin compiler to work correctly.

## Proposed Changes

### 1. Build Configuration
#### [MODIFY] [build.gradle.kts](file:///I:/Android%20Projects/app/build.gradle.kts)
- Update `namespace` to `com.portfolio.videostreaming`.
- Update `applicationId` to `com.portfolio.videostreaming`.

---

### 2. Manifest Updates
#### [MODIFY] [AndroidManifest.xml](file:///I:/Android%20Projects/app/src/main/AndroidManifest.xml)
- Ensure all activity and component paths are correctly referenced.

---

### 3. Source Code Refactoring
#### [MODIFY] Multiple Files
Update the `package` header in:
- `MainActivity.kt`
- `ScreenTimeRepository.kt`
- `PlayerControls.kt`
- `ScreenTimeViewModel.kt`
- `VideoPlayer.kt`
- `VideoPlayerViewModel.kt`

Update `import` statements in any file that cross-references these packages.

---

### 4. Filesystem Migration
#### [MOVE] Directory Move
- Move everything from `I:/Android Projects/app/src/main/java/com/example/videostreaming` to `I:/Android Projects/app/src/main/java/com/portfolio/videostreaming`.

## Verification Plan

### Automated Verification
- **Gradle Sync**: Verify the IDE recognizes the new structure.
- **Build**: Run `:app:assembleDebug` to ensure no broken references.

### Manual Verification
- **Run app**: Ensure it deploys to the device (it will count as a "new" app because the Application ID changed).
- **Permissions**: Verify storage permissions are still prompted (changing the ID resets granted permissions).
