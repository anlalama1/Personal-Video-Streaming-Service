# Rewind and Forward Implementation Plan

This plan outlines the steps to add "Rewind 10s" and "Forward 10s" buttons to our custom video player controls.

## Architecture: Intent Hoisting
While the logic for "calculate current time +/- 10s" could live in the UI, the **Senior Architect** approach is to hoist this logic into the **ViewModel**. This ensures that the engine's state is manipulated in one central place and makes the UI even "dumber" and easier to test.

## Proposed Changes

### 1. The Logic (ViewModel)
#### [MODIFY] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayerViewModel.kt)
- Add `rewind()` function: Seeks to `currentPosition - 10,000ms`. Includes a safety check to never seek below 0.
- Add `forward()` function: Seeks to `currentPosition + 10,000ms`. Includes a safety check to never seek past the video duration.

---

### 2. The UI Bridge
#### [MODIFY] [VideoPlayer.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/VideoPlayer.kt)
- Update the `VideoPlayer` signature to accept `onRewind` and `onForward` lambdas.
- Pass these down to the `PlayerControls` component.

---

### 3. The Layout (PlayerControls)
#### [MODIFY] [PlayerControls.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/ui/PlayerControls.kt)
- Wrap the Play/Pause button in a `Row` with `horizontalArrangement = Arrangement.spacedBy(32.dp)`.
- Add two new `Surface` buttons (styled exactly like the Play button but slightly smaller).
- Use `Icons.Default.Replay10` and `Icons.Default.Forward10` for professional media visuals.

---

### 4. Integration
#### [MODIFY] [MainActivity.kt](file:///I:/Android%20Projects/app/src/main/java/com/example/videostreaming/MainActivity.kt)
- Connect the new UI events to the ViewModel's `rewind()` and `forward()` methods.

## Verification Plan
1. **Rewind**: Tap the rewind button and verify the slider and video jump back exactly 10 seconds.
2. **Forward**: Tap the forward button and verify they jump ahead 10 seconds.
3. **Boundaries**: Verify that rewinding at the start of the video stays at 00:00.
