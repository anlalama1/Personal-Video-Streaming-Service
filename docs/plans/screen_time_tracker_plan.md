# Advanced Screen Time Tracker Implementation Plan

This plan outlines the addition of a dual-counter parental tracking system:
1.  **Session Time**: Resets when the app is closed.
2.  **Daily Time**: Persists across app restarts for the current day.
3.  **Visibility Toggle**: A control within the video player to hide/show these counters.

## Architecture: Persistence & State Hoisting
To achieve a "Senior" level implementation, we will use **Jetpack DataStore** for persistence and a dedicated **Repository** pattern.

### 1. The Multi-Clock (ViewModel)
The `ScreenTimeViewModel` will act as the single source of truth for all time-tracking data. It will handle:
- Calculating elapsed session time.
- Syncing daily totals with disk storage.
- Managing the visibility state (toggled from the player controls).

### 2. Data Persistence (DataStore)
Unlike `SharedPreferences`, `DataStore` uses Kotlin Coroutines and Flow to provide a reactive way to store data. This ensures the Daily counter is always accurate and updated without blocking the main UI thread.

## Proposed Changes

### 1. Dependencies
**File**: `build.gradle.kts`
Add `androidx.datastore:datastore-preferences`.

### 2. The Data Layer
**File**: `data/ScreenTimeRepository.kt`
A repository to handle the read/write operations to the DataStore.

### 3. The Logic Layer
**File**: `ui/ScreenTimeViewModel.kt`
The clock heartbeat and state management.

### 4. The UI Layer
**Files**: `PlayerControls.kt` (Toggle button) and `MainActivity.kt` (Overlay display).

## Verification
- Verify Daily time persists after killing the app.
- Verify the toggle switch in the video player works.
- Verify the counter is subtle and non-distracting.
