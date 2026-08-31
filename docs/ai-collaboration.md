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

## Future Work / Stretch Goals
- **MVI Refactor**: Transition from MVVM to MVI for more robust reactive state management.
- **Custom Media Engine**: Implement a low-level renderer using `MediaCodec` and `AudioTrack` to demonstrate deep internal knowledge of video synchronization.
- **ABR & Codec Overlays**: Implement real-time monitoring of bitrate and codec switching to prove deep HLS/DASH expertise.
