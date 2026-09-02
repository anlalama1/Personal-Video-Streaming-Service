# Portfolio Knowledge Audit: Senior/Lead Engineer Readiness

> [!IMPORTANT]
> **Self-Determination Required**: You must attempt to answer these questions using only the source code, `system-design.md`, and your own logic first. Consulting the Answer Key before attempting a full self-audit is considered "Engineering Debt" and will hinder your performance in real technical interviews.

---

## Part 1: Android Architecture & Reactive UI

### 1. In `MainActivity.kt`, we used `LaunchedEffect(videoUri)` to trigger `playerViewModel.playVideo()`. Why is this necessary?
*   A) To ensure the video plays on a background thread.
*   B) To prevent the video from restarting every time the UI recomposes (e.g., when the timer ticks).
*   C) To increase the volume of the video automatically.
*   D) To bypass Android's security sandbox.

### 2. We used `SharingStarted.WhileSubscribed(5000)` for our StateFlows. What is the primary purpose of the `5000ms` delay?
*   A) To give the user 5 seconds to read the screen before loading data.
*   B) To ensure the data stream survives configuration changes (like screen rotation) without a restart penalty.
*   C) To throttle the AWS API so we don't exceed the free tier.
*   D) To allow the hardware decoders time to warm up.

### 3. Why did we choose `Jetpack DataStore` over the older `SharedPreferences` for the Screen Time tracker?
*   A) DataStore is easier to type and requires less code.
*   B) DataStore provides a reactive API (Flow) and is thread-safe, preventing UI jank during high-frequency writes.
*   C) SharedPreferences cannot store numbers larger than 100.
*   D) DataStore automatically encrypts data for HIPAA compliance.

### 4. What is the technical reason for wrapping the Media3 `PlayerView` in an `AndroidView` Composable?
*   A) To make the video play in 4K resolution.
*   B) Because `PlayerView` is a legacy Android XML View, and `AndroidView` acts as a bridge to host it within a Compose UI.
*   C) To prevent the user from taking screenshots of the video.
*   D) It is required for S3 streaming compatibility.

---

## Part 2: Cloud Infrastructure & Security (AWS)

### 5. Our architecture uses a **Lambda "BFF" (Backend-for-Frontend)**. What is the main advantage of this over having the Android app call DynamoDB directly?
*   A) Lambda makes the network calls faster than a direct connection.
*   B) It allows us to keep the Android app's SDK size small and hides the database schema details from the client.
*   C) DynamoDB is not compatible with Android's Kotlin compiler.
*   D) Lambda is free, while direct DynamoDB calls cost money.

### 6. In the CDK code for S3, we eventually decided to move toward **Origin Access Control (OAC)** and **Signed URLs**. Why is `publicReadAccess: true` considered a risk for a production service?
*   A) It allows anyone with the URL to download your content, leading to massive bandwidth bills and IP theft.
*   B) It makes the video files play slower on mobile devices.
*   C) Public buckets are limited to 1GB of storage.
*   D) Android's ExoPlayer cannot play files from public buckets.

### 7. Why did we choose **Local FFmpeg** for transcoding instead of using an **AWS Lambda**?
*   A) Lambda does not support the `.mp4` file format.
*   B) Full-length movie transcoding exceeds the Lambda 15-minute execution limit.
*   C) FFmpeg is owned by Google and only works on local machines.
*   D) Lambda can only process one video per day.

### 8. What is the role of **CORS (Cross-Origin Resource Sharing)** in our S3 bucket configuration?
*   A) It encrypts the video files on the disk.
*   B) It allows the Android app (a different "origin" than S3) to successfully request and stream the media bytes over HTTPS.
*   C) It automatically compresses images to save space.
*   D) It is required by the Google Play Store for all streaming apps.

---

## Part 3: Professional Engineering Strategy

### 9. Why did we use `Locale.US` when generating date strings for our database keys?
*   A) Because the project is hosted on US-EAST-1 servers.
*   B) To ensure that the numerical date format is consistent regardless of the user's phone language or region.
*   C) To save space in the DataStore file.
*   D) It is a requirement for using the AWS CDK.

### 10. What is the benefit of the `Screen` Sealed Class approach for Navigation?
*   A) It makes the app run faster by pre-loading all screens into memory.
*   B) It eliminates "Magic Strings," centralizes route logic, and provides type-safety for arguments like URIs.
*   C) It allows the app to run without a `navController`.
*   D) It is the only way to support 4K video playback.

### 11. Why did we move the `ExoPlayer` instance from the Composable to the `ViewModel`?
*   A) To make the volume louder.
*   B) So the player instance survives Activity destruction during screen rotation, preventing the video from resetting.
*   C) ViewModels have better access to the phone's GPU.
*   D) Because Media3 does not support Compose state.

### 12. Why did we use `URLEncoder.encode()` when passing the video URI through a Navigation route?
*   A) To compress the URI and save memory.
*   B) To "hide" the URI from hackers.
*   C) Because URIs contain forward slashes (`/`) which the Navigator interprets as sub-paths, breaking the routing logic.
*   D) It is a required parameter for the `ExoPlayer.prepare()` method.

---

## Audit Completion
Once you have finished, you may consult the **[Knowledge Audit Answer Key](./knowledge-audit-answers.md)** for detailed technical explanations of each decision.
