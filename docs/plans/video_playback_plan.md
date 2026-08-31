# Local Video Playback Implementation Plan

This plan outlines the steps to build a basic local video player using Jetpack Compose and the Media3 ExoPlayer library. Our goal is to play an MP4 file from the device's storage while overexplaining the "why" behind each component.

## Architecture & Logic

### 1. The Media3 Engine (ExoPlayer)
We use `androidx.media3`. Media3 is the successor to the original ExoPlayer library. It combines player functionality with a "Session" API that makes it easier to handle background playback and media notifications later.

### 2. The Compose Bridge (`AndroidView`)
Since Media3's UI components (`PlayerView`) are built on the legacy Android `View` system, we use `AndroidView` to host them inside our Compose layout.

### 3. Lifecycle Management
Video players are resource-heavy. We must initialize the player when the UI is visible and **release** it when the UI is destroyed to prevent memory leaks and audio continuing in the background.

## Proposed Changes

### 1. Dependencies
**File**: `app/build.gradle.kts`
Add `androidx.media3:media3-exoplayer` and `androidx.media3:media3-ui`.

### 2. Permissions
**File**: `AndroidManifest.xml`
Declare `READ_EXTERNAL_STORAGE` and `READ_MEDIA_VIDEO`.

### 3. VideoPlayer Component
**File**: `ui/VideoPlayer.kt`
A custom Composable that wraps `ExoPlayer` and `PlayerView`.

### 4. Integration
**File**: `MainActivity.kt`
Connect the player to the main app flow.

## Verification
- Push a file to `/sdcard/Movies/test.mp4`.
- Run the app and grant permissions.
- Verify playback.
