# Custom Transparent Controls Implementation Plan

This plan outlines the steps to replace the default Media3 player controls with a custom, semi-transparent "Glass" overlay built entirely in Jetpack Compose. 

## Architecture: The "Stateful" UI
Previously, the UI was passive—it just showed the `ExoPlayer` controls. We moved to a **Reactive** model where:
1.  **ViewModel** tracks the player's state (e.g., `isPlaying`).
2.  **UI** observes that state and updates itself automatically.
3.  **User Intents** (tapping play/pause) are sent back to the ViewModel to act on the `ExoPlayer` engine.

## Changes Implemented

### 1. The Reactive Brain
**File**: `VideoPlayerViewModel.kt`
- Added a `MutableStateFlow` to track `isPlaying`.
- Added a listener to `ExoPlayer` to keep the UI in sync with the engine's state changes.
- Added a `togglePlay()` function to handle user interaction.

---

### 2. The UI Bridge & Layering
**File**: `VideoPlayer.kt`
- Disabled default controls by setting `useController = false` on the `PlayerView`.
- Wrapped the `AndroidView` in a `Box` to allow layering Compose elements on top of the video.

---

### 3. The "Glass" Controls
**File**: `PlayerControls.kt`
- Created a new Composable for the custom overlay.
- Implemented semi-transparent visuals (`alpha = 0.4f`) for a modern "Glass" effect.
- Added smooth fade-in/out animations using `AnimatedVisibility`.
- Implemented auto-hide logic to clear the screen after 3 seconds of playback.

## Verification Result
- Tapping the screen toggles the control visibility.
- Play/Pause button updates the icon reactively based on the `ExoPlayer` state.
- Controls disappear automatically during playback.
