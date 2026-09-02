# AI-Assisted Development Collaboration Log

This document tracks the high-level collaboration between the human developer and the AI assistant (Gemini) for the **Personal Video Streaming Service** project. It serves as evidence of "Experience leveraging AI-assisted development tools" as required by senior-level engineering roles (e.g., Disney).

## Project Strategy & Vision
- **Goal**: Build a portfolio-grade streaming service to demonstrate "Senior/Lead" level competency in Android Media Engineering.
- **Architectural Bias**: Favor modern, scalable patterns (MVI/MVVM, Flow, Compose) and deep media internals (ExoPlayer/Media3, MediaCodec).

## Key Collaborative Decisions

### 1. Build System Modernization (Aug 30, 2026)
- **Challenge**: Initial project had several deprecated Gradle properties.
- **AI Contribution**: Identified deprecated flags (`android.enableJetifier`, `android.nonTransitiveRClass`, etc.) and recommended removal/update based on AGP 9.3.2 standards.
- **Outcome**: Clean `gradle.properties` and optimized dependency constraints for better import performance.

### 2. Basic Media Playback & Lifecycle (Aug 30, 2026)
- **Challenge**: Implement local MP4 playback while explaining the underlying "Media Engine" components.
- **AI Contribution**: 
    - Designed an implementation plan for Media3 ExoPlayer integration.
    - Implemented a Compose-to-View bridge (`AndroidView`) for the `PlayerView`.
    - Guided the user through Android's sandboxed file system (Device Explorer).
- **Outcome**: Successful playback of local video with proper runtime permission handling.

### 3. Solving Configuration Changes (Aug 30, 2026)
- **Challenge**: Video would restart/reset when rotating the device.
- **AI Contribution**: Explained two options: the "Manifest Trick" vs. "ViewModel Hoisting." Advised that ViewModel hoisting is the superior architectural lesson for a Senior role.
- **Outcome**: Refactored the app to an MVVM structure where the `ExoPlayer` instance survives Activity recreation in a `ViewModel`.

### 4. UI Customization & Theming (Aug 30, 2026)
- **Challenge**: Add a custom background image with specific transparency (50%).
- **AI Contribution**: 
    - Located the resource in the project.
    - Implemented a `Box` layout to layer the `Image` behind the `Surface`.
    - Applied `Color.Transparent` to the `Surface` and `alpha = 0.5f` to the `Image` to achieve the desired effect.
- **Outcome**: Enhanced visual branding while maintaining functional media playback.

### 5. Custom "Glass" Controls (Aug 30, 2026)
- **Challenge**: Replace default Media3 controls with a custom, high-quality transparent overlay.
- **AI Contribution**: 
    - Designed a reactive architecture using `StateFlow` and `Player.Listener` to keep UI in sync with the media engine.
    - Implemented a Compose-based overlay using `Box` layering and `AnimatedVisibility`.
    - Guided the user through adding `material-icons-extended` and refactoring the `VideoPlayer` to be stateless.
- **Outcome**: A professional, "Disney-tier" player experience with smooth animations and auto-hiding controls.

### 6. Reactive Progress Bar & Seeking (Aug 30, 2026)
- **Challenge**: Add a functional, semi-transparent progress bar that updates in real-time and allows user seeking.
- **AI Contribution**: 
    - Designed a temporal reactive state model using 200ms polling in the ViewModel.
    - Implemented a Compose `Slider` with "Glass" styling synced to the `ExoPlayer` engine.
    - Added time formatting (MM:SS) for current position and total duration.
- **Outcome**: Fully interactive media player with precise seeking and smooth visual feedback.

### 7. Skip Buttons (Aug 30, 2026)
- **Challenge**: Add "Rewind 10s" and "Forward 10s" buttons to the player controls.
- **AI Contribution**: 
    - Hoisted the skip logic into the ViewModel for better architectural separation.
    - Implemented boundary safety (e.g., never seeking below 0s).
    - Integrated professional `Replay10` and `Forward10` icons into the Compose UI.
- **Outcome**: Enhanced navigation controls for a better user experience.

### 8. Coding Standards & Linting (Aug 30, 2026)
- **Challenge**: Resolved a lint warning regarding naming conventions for private properties.
- **AI Contribution**: Recommended moving the `REWIND_FORWARD_INCREMENT_MS` literal to a `companion object` as a `const val` and renaming it to `SKIP_INCREMENT_MS` to follow Kotlin's standard naming conventions for constants.
- **Outcome**: Cleaner, more idiomatic Kotlin code that adheres to industry-standard styling.

### 9. Parental Screen Time Tracker (Aug 30, 2026)
- **Challenge**: Implement a dual-counter system (Session vs Daily) to help parents track usage, with a visibility toggle in the player.
- **AI Contribution**: 
    - Recommended **Jetpack DataStore** for high-frequency, thread-safe persistence.
    - Designed a `Repository` pattern to separate storage logic from UI logic.
    - Implemented a "Heartbeat" coroutine in the `ScreenTimeViewModel` to keep both clocks in sync.
    - Layered a subtle, transparent overlay at the Activity level using Compose `Box` and `AnimatedVisibility`.
- **Outcome**: A unique, "portfolio-plus" feature that demonstrates innovation and advanced data handling.

### 10. UI Polish: Overlay Repositioning (Aug 30, 2026)
- **Challenge**: The screen time counter was overlapping with the system clock in the top-right corner.
- **AI Contribution**: Repositioned the `AnimatedVisibility` container from `Alignment.TopEnd` to `Alignment.TopCenter` within the root `Box` layout.
- **Outcome**: Improved UI legibility and eliminated overlap with system-level elements.

### 11. Professional Rebranding (Aug 30, 2026)
- **Challenge**: The project was using the generic `com.example` package name, which looked unprofessional for a Senior portfolio.
- **AI Contribution**: 
    - Orchestrated a full project rename from `com.example.videostreaming` to `com.portfolio.videostreaming`.
    - Automated the update of `build.gradle.kts`, `AndroidManifest.xml`, and all source code headers.
    - Managed the physical filesystem move and directory cleanup.
- **Outcome**: A polished, professionally-branded project identity ready for production-level evaluation.

### 12. Legal & Regulatory Documentation (Aug 30, 2026)
- **Challenge**: Addressing the legal complexities of a streaming service (Copyright, COPPA, DRM, Patent Royalties) for a professional portfolio.
- **AI Contribution**: 
    - Explained the legal risks associated with distribution and children's privacy (COPPA).
    - Drafted a "Legal & Ethical Considerations" section for the project README.
    - Emphasized "Privacy by Design" regarding the local-only storage of parental tracking data via DataStore.
- **Outcome**: A professional, transparent project baseline that respects intellectual property and privacy laws—a vital trait for Lead Engineer candidates.

### 13. Scalable Media Discovery & Navigation (Sept 1, 2026)
- **Challenge**: Move from a hardcoded single-video app to a dynamic catalog.
- **AI Contribution**: 
    - Orchestrated the move to **Android MediaStore API** for high-performance discovery.
    - Implemented **Jetpack Navigation** to manage multi-screen architecture.
    - Compared **Intermediate vs. Senior** strategies: 
        - Chose `LazyColumn` over `Column` for performance.
        - Used `Dispatchers.IO` for non-blocking I/O.
        - Safely passed URIs using `URLEncoder` to avoid route breakage.
- **Outcome**: A professional "Browse -> Play" flow that mirrors commercial streaming platforms.

### 14. Navigation Architecture Refactor (Sept 1, 2026)
- **Challenge**: Raw strings for navigation routes are difficult to maintain and prone to typos.
- **AI Contribution**: 
    - Introduced a **Sealed Class (`Screen`)** to manage navigation routes.
    - Encapsulated **URL Encoding** logic within the route creator to keep the UI clean.
    - Explained the **Back Stack** and **Decoupling** principles (Lambda pattern).
- **Outcome**: A type-safe, centralized navigation system that aligns with Lead Engineer architectural standards.

## Future Work / Stretch Goals
- **MVI Refactor**: Transition from MVVM to MVI for more robust reactive state management.
- **Custom Media Engine**: Implement a low-level renderer using `MediaCodec` and `AudioTrack` to demonstrate deep internal knowledge of video synchronization.
- **ABR & Codec Overlays**: Implement real-time monitoring of bitrate and codec switching to prove deep HLS/DASH expertise.
