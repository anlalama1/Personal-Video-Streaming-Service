# MVI Architecture Refactor Plan (Video Player)

This plan outlines the transition of the Video Player from an MVVM-style architecture to a strict **MVI (Model-View-Intent)** pattern. This is a "Senior/Lead" level architectural shift that ensures a unidirectional data flow and predictable UI states.

## Architecture: Unidirectional Data Flow (UDF)

### Intermediate (MVVM) vs. Senior/Lead (MVI)
| Component | Intermediate (MVVM) | Senior/Lead (MVI) |
| :--- | :--- | :--- |
| **State** | Multiple independent `StateFlow`s (`isPlaying`, `position`, `duration`). | **Single `ViewState` object**. One source of truth for the entire screen. |
| **Interaction** | Direct function calls on the ViewModel (`togglePlay()`, `seekTo()`). | **User Intents**. The UI sends "Intent" objects to the ViewModel. |
| **Consistency** | Risk of "Partial State" bugs (e.g., showing play icon while buffering). | **State Atomicity**. The UI is a direct, predictable function of the current state. |
| **Side Effects** | Logic scattered across multiple methods. | **Centralized Reducer**. All state transitions happen in one place. |

## Proposed Changes

### 1. Define the MVI Contract
#### [NEW] [PlayerContract.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/PlayerContract.kt)
- **`PlayerViewState`**: A data class representing the entire UI state (playing, position, duration, buffering, error).
- **`PlayerIntent`**: A sealed class for all user actions (Load, TogglePlay, Seek, Rewind, Forward).

### 2. Refactor the Brain
#### [MODIFY] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/VideoPlayerViewModel.kt)
- Replace individual flows with a single `MutableStateFlow<PlayerViewState>`.
- Implement a `handleIntent(intent: PlayerIntent)` method as the sole entry point for the UI.
- Use a "Reducer" pattern to update the state based on engine events and user intents.

### 3. Update the UI Bridge
#### [MODIFY] [VideoPlayer.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/VideoPlayer.kt)
- Update to accept the `PlayerViewState` object and an `onIntent` lambda.

#### [MODIFY] [PlayerControls.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/PlayerControls.kt)
- Refactor to consume the single state object.
- Simplify parameters by passing intents instead of individual callback functions.

### 4. Integration
#### [MODIFY] [MainActivity.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/MainActivity.kt)
- Update the navigation route to send the `Load` intent to the ViewModel.

## Verification Plan
1. **Regression Test**: Ensure all existing features (Play/Pause, Seek, Skip, Rotation Survival) work exactly as before.
2. **State Inspection**: Use the debugger to verify that the `PlayerViewState` transitions correctly between `Playing`, `Paused`, and `Buffering`.
