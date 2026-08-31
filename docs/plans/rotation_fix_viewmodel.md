# Video Rotation Fix (ViewModel Approach)

This plan outlines how to move the ExoPlayer instance from the UI layer (Composable) to a `ViewModel`. This ensures that the video playback is continuous when the device is rotated, as ViewModels survive Activity recreation.

## Architectural Change

### The Problem
Currently, the `ExoPlayer` is "remembered" inside the `VideoPlayer` Composable. When the device rotates, the `MainActivity` is destroyed and recreated, which causes the Composable to be disposed of and re-run. This creates a brand new `ExoPlayer` instance, starting the video from the beginning.

### The Solution: ViewModel
We will hoist the `ExoPlayer` into a `VideoPlayerViewModel`. 
- **Persistence**: The ViewModel instance stays in memory while the Activity is being recreated during rotation.
- **Single Source of Truth**: The UI simply "observes" the player provided by the ViewModel.

## Proposed Changes

### 1. Dependencies
#### [MODIFY] [build.gradle.kts](file:///I:/Android%20Projects/app/build.gradle.kts)
- Add `androidx.lifecycle:lifecycle-viewmodel-compose` to easily access ViewModels within Composables.

---

### 2. The ViewModel
#### [NEW] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayerViewModel.kt)
- **Init**: Create the `ExoPlayer` instance.
- **onCleared()**: This is the ViewModel's "cleanup" phase. We will release the player here. **Important**: Since the ViewModel survives rotation, `onCleared` is only called when the user actually closes the app or navigates away permanently.

---

### 3. Updating the Player UI
#### [MODIFY] [VideoPlayer.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayer.kt)
- Instead of creating the player, it will now accept a `Player` instance from the ViewModel.

---

### 4. Integration
#### [MODIFY] [MainActivity.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/MainActivity.kt)
- Obtain the ViewModel instance and pass it to the `VideoPlayer`.

## Verification Plan
1. **Rotate Screen**: Start the video, then rotate the device.
2. **Observe**: The video should continue playing from the exact same timestamp without interruption.
