# Knowledge Audit: Answer Key & Technical Explanations

This document provides the correct answers for the [Knowledge Audit](./knowledge-audit.md) along with the "Senior Engineer" reasoning behind each choice.

---

## Part 1: Android Architecture & Reactive UI

### 1. Answer: B
**Reasoning**: Composables are functions that can be re-executed many times (recomposition). If you put a "Start Playback" command in the body of a Composable, the video would restart every time the UI updates (like when the clock ticks). `LaunchedEffect` ensures the action only happens when the key (`videoUri`) actually changes.

### 2. Answer: B
**Reasoning**: When a phone rotates, the Activity is destroyed and recreated. During those few milliseconds, the subscriber count of your `StateFlow` drops to zero. `WhileSubscribed(5000)` keeps the flow "hot" for 5 seconds, allowing the new Activity instance to reconnect without triggering a full data reload or flickering.

### 3. Answer: B
**Reasoning**: `SharedPreferences` is synchronous and can block the main thread, causing "jank" (stutter). `DataStore` uses Coroutines and Flow to provide a non-blocking, thread-safe way to handle high-frequency writes (like our per-second timer updates).

### 4. Answer: B
**Reasoning**: Much of the Android ecosystem (including Media3's `PlayerView`) was built before Jetpack Compose. `AndroidView` is the interoperability bridge that allows you to safely host legacy Views inside a modern declarative UI.

---

## Part 2: Cloud Infrastructure & Security (AWS)

### 5. Answer: B
**Reasoning**: A **BFF (Backend-for-Frontend)** acts as an abstraction layer. It prevents your app from being bloated with heavy cloud SDKs and allows you to change your database schema (DynamoDB) without having to push a new version of the app to the Play Store.

### 6. Answer: A
**Reasoning**: `publicReadAccess: true` is "Security Debt." In a real-world scenario, bots would crawl your S3 URLs and drain your bandwidth budget. Using **CloudFront OAC** ensures that your S3 bucket is a fortress, and only the CDN (which you control) can access the data.

### 7. Answer: B
**Reasoning**: Transcoding is a heavy compute task. Full-length movies can take over an hour to process. AWS Lambda has a hard limit of 15 minutes per execution, making it physically impossible to transcode a movie without using a more complex service like ECS or MediaConvert.

### 8. Answer: B
**Reasoning**: Browsers and mobile network clients have security policies that block requests between different domains (e.g., your API domain vs. your S3 domain). **CORS** is the explicit "handshake" that tells S3 it's safe to give data to your app.

---

## Part 3: Professional Engineering Strategy

### 9. Answer: B
**Reasoning**: `Locale.getDefault()` changes based on the user's phone settings. If you use it for database keys, a user in one country might save data that a user in another country can't read. `Locale.US` ensures that numerical strings (like `20260901`) are mathematically identical for every device on Earth.

### 10. Answer: B
**Reasoning**: Centralizing routes in a Sealed Class prevents "Magic Strings" (hardcoded strings hidden in the UI). This makes your navigation type-safe, easy to refactor, and mirrors the architecture of large-scale apps like Disney+.

### 11. Answer: B
**Reasoning**: Composables are disposed of when an Activity is recreated. If the `ExoPlayer` is "remembered" in the UI, it dies during rotation. The `ViewModel` survives rotation, allowing the player instance to remain active and the video to continue playing seamlessly.

### 12. Answer: C
**Reasoning**: Jetpack Navigation uses a URL-like syntax for routes. Since URIs naturally contain slashes, the Navigator thinks a URI is a list of sub-folders (e.g., `player/content:/media...`). Encoding converts those slashes into characters the Navigator ignores, ensuring the path is parsed as a single argument.

---

## Next Steps
If you struggled with any of these, revisit the **[System Design](../system-design.md)** or read through the **[AI Collaboration Log](./ai-collaboration.md)** to see these decisions in action.
