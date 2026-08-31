# Video Progress Bar Implementation Plan

This plan outlines the steps to add a reactive progress bar and seeking capability to our custom video player controls.

## Architecture: Temporal Reactive State
Video position is "noisy" state—it changes every few milliseconds. We will handle this by:
1.  **ViewModel Polling**: The ViewModel will expose the `currentPosition` and `duration` of the video.
2.  **State Synchronization**: We will use a Coroutine in the ViewModel to poll the `ExoPlayer` every 200ms while it's playing, updating a `StateFlow`.
3.  **Bidirectional Seeking**: The UI will allow the user to drag the progress bar, sending "Seek" intents back to the ViewModel.

## Proposed Changes

### 1. The Temporal Brain
#### [MODIFY] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayerViewModel.kt)
- Add `currentPosition` and `duration` as `StateFlow`.
- Implement a `updateProgress()` loop using `viewModelScope` that runs while the video is playing.
- Add `seekTo(position: Long)` to control the `ExoPlayer`.

---

### 2. UI Refactoring
#### [MODIFY] [VideoPlayer.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayer.kt)
- Pass `currentPosition`, `duration`, and `onSeek` down to the `PlayerControls`.

---

### 3. The "Glass" Progress Bar
#### [MODIFY] [PlayerControls.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/PlayerControls.kt)
- Add a `Column` or `Box` at the bottom of the overlay.
- Implement a `Slider` with custom colors (`Color.White` for active, `Color.White.copy(alpha = 0.3f)` for track) to match the "Glass" theme.
- Add time labels (e.g., `01:23 / 05:00`).

## Verification Plan

### Manual Verification
1. **Progress Observation**: Verify the bar moves smoothly as the video plays.
2. **Manual Seeking**: Drag the bar to different points and verify the video jumps correctly.
3. **Visibility**: Ensure the bar only appears when the controls are toggled (tapped).
