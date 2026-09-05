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

### 15. Reactive Timer Orchestration (Sept 1, 2026)
- **Challenge**: The screen time tracker was counting app uptime rather than actual watch time.
- **AI Contribution**: 
    - Designed a **Gate-based Coroutine** model in the `ScreenTimeViewModel`.
    - Implemented a bridge in the `MainActivity` using `LaunchedEffect` and `DisposableEffect` to sync player state with the global timer.
    - Explained the decoupling of global session data from transient player instances.
- **Outcome**: Accurate parental monitoring that strictly measures active media playback.

### 16. Persistent Data Integrity Fix (Sept 1, 2026)
- **Challenge**: The "Daily" timer was showing stale data from previous days (the "149m" bug).
- **AI Contribution**: 
    - Identified "Midnight Bugs" and regional formatting risks.
    - Implemented **Locale.US** for storage keys to ensure cross-region consistency.
    - Designed a **Defensive Read Flow** that filters out stale data at the mapping layer before it reaches the UI.
    - Added structured logging for system auditability.
- **Outcome**: A robust, production-grade tracking system that correctly handles day rollovers and region-specific formatting.

### 17. UI Polish: Video Navigation (Sept 1, 2026)
- **Challenge**: Users were "stuck" in the video player and had to use system gestures/buttons to return to the catalog.
- **AI Contribution**: 
    - Added a "Glass" styled Back button to the `PlayerControls` overlay using `Icons.AutoMirrored.Filled.ArrowBack`.
    - Wired the button to `navController.popBackStack()` in the `MainActivity` routing logic.
    - Ensured the button respects the same auto-hide/show lifecycle as the playback controls.
- **Outcome**: Improved UX with intuitive, player-centric navigation.

### 18. Bug Fix: Idempotent Playback (Sept 1, 2026)
- **Challenge**: Video was restarting on every screen rotation despite using a ViewModel.
- **AI Contribution**: 
    - Identified that `LaunchedEffect` in the `NavHost` re-triggers on Activity recreation.
    - Modified `VideoPlayerViewModel.playVideo` to be **Idempotent** by tracking the `currentUri`.
    - Prevented unnecessary calls to `exoPlayer.setMediaItem` which was causing the reset.
- **Outcome**: Seamless playback survival across rotations in a multi-screen architecture.

### 19. Full-Stack AWS Integration (Sept 1, 2026)
- **Challenge**: Transitioning from local-only media to a cloud-based infrastructure.
- **AI Contribution**: 
    - Designed and implemented a **CDK (TypeScript)** project to manage S3, DynamoDB, Lambda, and API Gateway.
    - Refactored Android networking using **Retrofit**, **Kotlinx Serialization**, and **Coil**.
    - Integrated the **BFF (Backend-for-Frontend)** pattern to decouple the client from cloud service details.
- **Outcome**: A professional, scalable cloud-native backend that allows for dynamic media discovery and remote streaming.

### 20. Advanced Observability with CloudWatch EMF (Sept 2, 2026)
- **Challenge**: Adding meaningful business metrics to the backend without increasing user-perceived latency.
- **AI Contribution**: 
    - Designed an **Embedded Metric Format (EMF)** logging strategy to emit custom metrics asynchronously.
    - Implemented a new `/play` API and Lambda handler to track video playback events with high-granularity dimensions (VideoId, Title).
    - Integrated error tracking metrics (`ApiErrorCount`) to monitor system health.
    - Synchronized the Android UI to trigger telemetry events only on active playback starts.
- **Outcome**: A professional, low-latency telemetry system that allows for real-time monitoring of user engagement and backend performance.

### 21. Architectural Visualization (Sept 1, 2026)
- **Challenge**: Maintaining a clear, high-level overview of the full-stack system as complexity grows.
- **AI Contribution**: 
    - Designed and authored `system-design.md` in the project root.
    - Implemented a **Mermaid diagram** to visualize the interaction between Android components and AWS services.
    - Documented core data flows and summarized strategic engineering decisions (BFF pattern, Reactive Polling, etc.).
- **Outcome**: A "living" architectural blueprint that facilitates system understanding and onboarding—a standard requirement for Lead/Principal Engineering roles.

### 22. Knowledge Audit & Mastery System (Sept 1, 2026)
- **Challenge**: Overcoming "AI Knowledge Dependency" and ensuring the developer can independently defend architectural decisions.
- **AI Contribution**: 
    - Designed a comprehensive 12-question **Multiple-Choice Knowledge Audit**.
    - Created a separate **Answer Key & Technical Explanation** document ([knowledge-audit-answers.md](./knowledge-audit-answers.md)).
    - Emphasized "Self-Determination" and "Engineering Debt" prevention in the docs.
- **Outcome**: A mechanism for verifying system mastery and ensuring the developer "Owns" the system design.

### 23. Content Ingestion Strategy (Sept 1, 2026)
- **Challenge**: Moving away from manual AWS CLI/Console operations for content management to a scalable, mobile-first approach.
- **AI Contribution**: 
    - Introduced a new milestone for a dedicated **Android Administrator App**.
    - Designed the high-level architecture for mobile content ingestion: local file picking, metadata entry, and multi-part cloud uploads.
    - Updated the `system-design.md` and `definition-of-done.md` to reflect the multi-app ecosystem.
- **Outcome**: A strategic roadmap for internal tool development, proving the ability to engineer full-lifecycle systems for media platforms.

### 24. Multi-Module Architectural Refactor (Sept 2, 2026)
- **Challenge**: Enabling code reuse for future internal tools (Administrator App) without duplication.
- **AI Contribution**: 
    - Designed and executed a transition from a monolithic `:app` to a multi-module system.
    - Created the `:core:data` shared library for AWS networking and storage.
    - Implemented **Dependency Isolation**, ensuring the UI layer remains decoupled from backend implementation details.
    - Refactored 6+ files to new package structures while maintaining system stability.
- **Outcome**: A scalable, "SDE-Grade" project structure that supports parallel feature development and maximizes build efficiency.

### 25. MVI Architectural Refactor (Sept 2, 2026)
- **Challenge**: Managing complex, overlapping UI states in a video player (playback, buffering, time tracking) without race conditions.
- **AI Contribution**: 
    - Designed and implemented a strict **MVI (Model-View-Intent)** architecture.
    - Centralized all screen logic into a single **"Reducer"** in the `VideoPlayerViewModel`.
    - Introduced **Atomic State Management** using a single `PlayerViewState` object.
    - Decoupled the UI by converting Composables into "Pure Functions" of the state.
- **Outcome**: A "bulletproof" UI layer that matches the engineering standards of world-class streaming services like Disney+ and Netflix.

### 26. CDK Infrastructure Modularization (Sept 2, 2026)
- **Challenge**: The monolithic `infrastructure-stack.ts` was becoming difficult to manage and violated SDE "Separation of Concerns" standards.
- **AI Contribution**: 
    - Redesigned the backend into 4 isolated domain stacks: `Storage`, `Database`, `Api`, and `Observability`.
    - Implemented **Cross-Stack Dependency Injection**, allowing stacks to securely share resource references.
    - Automated the transition from a single orchestrator to a multi-stack orchestration model in `infrastructure.ts`.
- **Outcome**: A professional, enterprise-grade infrastructure codebase that maximizes maintainability and minimizes deployment blast radius.

### 27. Event-Driven HLS Transcoding Pipeline (Sept 4, 2026)
- **Challenge**: Automating the conversion of raw MP4 uploads into professional HLS adaptive streaming artifacts.
- **AI Contribution**: 
    - Architected a **Cloud-Native Media Pipeline** using **AWS ECS Fargate** and **FFmpeg**.
    - Designed an event-driven flow: **S3 -> SQS -> Lambda Orchestrator -> Fargate Task**.
    - Implemented a professional **3-tier Bitrate Ladder** (1080p, 720p, 480p) to support varied network conditions.
    - Integrated **CloudFront OAC** for the new HLS output bucket, maintaining a "Zero-Public-Access" security posture.
- **Outcome**: A fully automated, scalable transcoding engine that powers modern adaptive bitrate streaming, mirroring the internal infrastructure of major streaming platforms.

### 28. Transcoder Performance Optimization (Sept 4, 2026)
- **Challenge**: Initial transcoding was prohibitively slow (30 mins for a 3 min clip), leading to poor developer and user experience.
- **AI Contribution**: 
    - Performed a **Bottleneck Analysis** identifying vCPU starvation as the primary cause.
    - Optimized infrastructure spec: Increased Fargate task to **4 vCPUs / 8GB RAM**.
    - Optimized FFmpeg logic: Implemented the **`veryfast` encoder preset**.
    - Explained the **Speed-Cost-Quality Triangle**, demonstrating how higher compute specs can paradoxically lead to lower total AWS costs by reducing execution duration.
- **Outcome**: Reduced transcode time by ~90%, achieving "Near-Real-Time" media processing.

- **Outcome**: Reduced transcode time by ~90%, achieving "Near-Real-Time" media processing.

### 29. Self-Mutating CI/CD Pipeline (Sept 4, 2026)
- **Challenge**: Manual deployments were tedious, error-prone, and required local environment setup (AWS CLI, credentials).
- **AI Contribution**: 
    - Architected a professional **CDK Pipeline** with GitHub integration.
    - Implemented a **"Self-Mutating"** logic where the pipeline updates its own structure automatically upon code changes.
    - Designed the **`StreamingAppStage`** to allow atomic, multi-stack deployments across environments.
    - Decoupled the build process from the local developer machine, enabling "Zero-Config" onboarding.
- **Outcome**: A fully automated, "Git-Ops" deployment workflow where a single `git push` triggers the entire cloud infrastructure update.

### 30. Pipeline Troubleshooting: VPC Lookup Permissions (Sept 4, 2026)
- **Challenge**: The CI/CD pipeline failed during the `synth` phase with an `ec2:DescribeAvailabilityZones` authorization error.
- **AI Contribution**: 
    - Identified that CDK requires EC2 lookup permissions during synthesis to determine VPC networking structure.
    - Updated `PipelineStack` to explicitly grant `ec2:DescribeAvailabilityZones` and `sts:AssumeRole` (for lookup roles) to the CodeBuild service role.
    - Enabled `dockerEnabledForSynth` and `privileged` mode to ensure the pipeline can handle containerized assets.
- **Outcome**: Resolved the "Chicken and Egg" permission issue, allowing the pipeline to successfully self-mutate and orchestrate multi-stack deployments.

### 31. Pipeline Fix: Cloud Assembly Path Alignment (Sept 4, 2026)
- **Challenge**: The pipeline failed in the `SelfMutate` stage with `No stacks match the name StreamingPipelineStack`.
- **AI Contribution**: 
    - Diagnosed the issue as a directory mismatch between the subdirectory `synth` output and the pipeline's expected assembly root.
    - Refactored the `Synth` step to output the cloud assembly to the repository root (`cdk.out`) while running commands from the `infrastructure/` folder.
    - Updated the `primaryOutputDirectory` to align the artifact structure with the CDK CLI's deployment expectations.
- **Outcome**: Enabled successful pipeline self-updates and streamlined the CI/CD artifact flow.

## Future Work / Stretch Goals
- **Custom Media Engine**: Implement a low-level renderer using `MediaCodec` and `AudioTrack` to demonstrate deep internal knowledge of video synchronization.
- **ABR & Codec Overlays**: Implement real-time monitoring of bitrate and codec switching to prove deep HLS/DASH expertise.
