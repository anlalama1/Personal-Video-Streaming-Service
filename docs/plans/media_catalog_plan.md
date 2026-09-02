# Media Catalog (Browse Screen) Implementation Plan

This plan outlines the steps to transition from a single-video app to a multi-title "Streaming Service" catalog. We will implement a browse screen that discovers videos on the device and allows the user to select what to play.

## Architecture: The Discovery Pipeline
To build a professional catalog, we will move away from hardcoded file paths and use the **Android MediaStore API**.

### Intermediate vs. Senior/Lead Approach
| Component | Intermediate Developer | Senior/Lead Developer |
| :--- | :--- | :--- |
| **Discovery** | Manually scans the `/Movies/` directory using `File` APIs. | Uses `MediaStore` + `ContentResolver` for high-performance, system-indexed queries. |
| **Navigation** | Uses `if/else` or simple boolean flags in `MainActivity` to swap screens. | Implements `Jetpack Navigation` with a `NavHost` for professional back-stack management and deep linking. |
| **Data State** | Hardcodes a single video file. | Uses dynamic URIs and models `MediaItem` as a first-class data object for scalability. |

## Proposed Changes

### 1. Navigation Infrastructure
#### [MODIFY] [build.gradle.kts](file:///I:/Android%20Projects/app/build.gradle.kts)
- Add `androidx.navigation:navigation-compose`.

---

### 2. The Catalog Brain
#### [NEW] [MediaBrowserViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/MediaBrowserViewModel.kt)
- **Logic**: Use `ContentResolver` to query `MediaStore.Video`.
- **State**: Expose a `List<MediaItem>` via `StateFlow`.
- **Learning Point**: This demonstrates how Android apps interact with system-wide data (like photos and videos) securely and efficiently.

---

### 3. The Browse UI
#### [NEW] [CatalogScreen.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/CatalogScreen.kt)
- A simple `LazyColumn` that lists the names of all found videos.
- Each item is clickable and triggers navigation to the player.

---

### 4. Wiring it Together
#### [MODIFY] [MainActivity.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/MainActivity.kt)
- Implement the `NavHost`.
- Update the layout to show the `CatalogScreen` by default.

#### [MODIFY] [VideoPlayerViewModel.kt](file:///I:/Android%20Projects/app/src/main/java/com/portfolio/videostreaming/ui/VideoPlayerViewModel.kt)
- Update to accept a dynamic URI instead of a hardcoded path.

## Verification Plan

### Manual Verification
1. **Discovery**: Push a second video file to `/sdcard/Movies/` using Device Explorer.
2. **List**: Open the app and verify both videos appear in the list.
3. **Selection**: Click the second video and verify it starts playing in the player.
4. **Back Navigation**: Use the system "Back" button to return to the catalog and pick the first video again.
