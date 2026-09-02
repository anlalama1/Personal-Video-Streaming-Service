# Daily Timer Correction Implementation Plan

This plan fixes the bug where the "Daily" screen time counter shows stale data from previous days.

## Architecture: Robust Date Management

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer |
| :--- | :--- | :--- |
| **Date Formatting** | Uses `Locale.getDefault()`. | Uses `Locale.US` for persistent keys to ensure formatting is identical across all devices and regions. |
| **Reset Logic** | Resets only when a new value is saved. | Implements a "Reactive Filter" that ensures stale data is never even *seen* by the UI, regardless of when it's cleared on disk. |
| **Timezones** | Ignores them, leading to "Midnight Bugs." | Uses a consistent date-string format (`yyyyMMdd`) that is timezone-agnostic for simple day-bucket comparisons. |

## Proposed Changes

### 1. Robust Repository
#### [MODIFY] [ScreenTimeRepository.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/data/ScreenTimeRepository.kt)
- Switch to `Locale.US` for date string generation.
- Add detailed logging using `android.util.Log` to track date comparisons.
- Refactor the `dailySeconds` flow to be more defensive against stale data.

---

### 2. Debug Capability (Optional but Recommended)
#### [MODIFY] [ScreenTimeViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/ScreenTimeViewModel.kt)
- Add a `resetDailyTime()` function to allow manual clearing during development.

## Verification Plan

### Manual Verification
1. **Log Audit**: Check Logcat for "ScreenTimeRepo" tags to see the `lastDate` and `currentDate` values.
2. **Persistence**: Force close and reopen to ensure it stays at 0 (or increments correctly from 0).
3. **Mocking**: (Advanced) Temporarily change the `getCurrentDate` return value to a future date and verify the UI resets instantly.
