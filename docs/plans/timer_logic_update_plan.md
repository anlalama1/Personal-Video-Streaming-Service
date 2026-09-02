# Timer Logic Update Implementation Plan

This plan outlines the changes required to ensure the Parental Screen Time tracker only increments when a video is actually playing, rather than whenever the app is open.

## Architecture: Cross-ViewModel Synchronization

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer |
| :--- | :--- | :--- |
| **Logic Placement** | Might try to put timer logic inside the `VideoPlayerViewModel`. | Keeps `ScreenTimeViewModel` as a global session manager, but makes it "Activity-aware" via the UI controller. |
| **State Coordination** | Uses global variables or static flags to stop/start the clock. | Uses **Reactive Hoisting**. The UI acts as the bridge, observing the `isPlaying` state from the player and pushing it into the global timer. |
| **Efficiency** | Stops/Starts the coroutine repeatedly (expensive). | Keeps the "Heartbeat" loop running but uses a **State-Gate** (`if (isTicking)`) to decide whether to increment. |

## Proposed Changes

### 1. The Clock Gate
#### [MODIFY] [ScreenTimeViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/ScreenTimeViewModel.kt)
- Add a `_isTicking` MutableStateFlow (default: `false`).
- Update the `startHeartbeat` loop to only increment seconds if `_isTicking` is true.
- Add `setTicking(active: Boolean)` function.

---

### 2. The Bridge
#### [MODIFY] [MainActivity.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/MainActivity.kt)
- In the `Player` route, add a `LaunchedEffect(isPlaying)` that calls `screenTimeViewModel.setTicking(isPlaying)`.
- **Reset Logic**: Add a `DisposableEffect` or another `LaunchedEffect` to ensure that when the user leaves the player (returns to catalog), the timer stops automatically.

## Verification Plan

### Manual Verification
1. **Catalog Test**: Open the app to the catalog. Verify the timer **does not** move.
2. **Playback Test**: Start a video. Verify the timer **starts** moving.
3. **Pause Test**: Pause the video. Verify the timer **stops** moving.
4. **Return Home**: Go back to the catalog. Verify the timer **stays stopped**.
