# Definition of Done — Personal Streaming Service (Portfolio Spike)

**Goal:** Prove I can build an end-to-end adaptive video streaming service across web, iOS, and Android — then capture proof and tear it down. This is a *portfolio spike*, not a permanent product.

**Guiding principle:** Small library, local transcoding, personal AWS account, budget alarm on, tear down when proof is captured. Target out-of-pocket cost: a few dollars total.

---

## Definition of Done (the finish line)

The project is **done** when all of the following are true:

- [ ] I can play **one of my own movies** on **all three** targets:
  - [ ] Laptop browser
  - [ ] iPhone (Safari / web player)
  - [ ] Android app (my own ExoPlayer/Media3 build)
- [ ] Playback is **adaptive** — I can demonstrate quality/bitrate switching under changing network conditions.
- [ ] Content is **access-controlled** — it cannot be fetched without authorization (CloudFront signed URLs/cookies at minimum).
- [ ] **Multi-Tenancy Validated** — Data is strictly isolated by `tenant_id` at the database and API layers.
- [ ] **Authenticated Access** — User management and API security are handled via **AWS Cognito**.
- [ ] **DRM demonstrated** — Widevine-protected playback works on Android/web (stretch: AES-128 as a stepping stone; PlayReady understood conceptually; FairPlay explicitly out of scope).
- [ ] **Adaptive bitrate demonstrated at the algorithm level** — I can observe, tune, and force the player's rendition-switching decisions (not just enable them).
- [ ] **Captions rendered** — embedded CEA-608/708 captions display with a toggle.
- [ ] **Custom Player Engine (Stretch)** — Create my own low-level video renderer using `MediaCodec` and `AudioTrack` instead of depending on the common `ExoPlayer` library.
- [ ] **Codec matrix handled** — AVC + HEVC video and AAC + EAC3 audio all play, with active codecs visible in the overlay.
- [ ] **(Optional) Bedrock-powered recommendations** — explainable "For You" suggestions over the catalog, validated against the real library.
- [ ] I have **durable proof** captured (see "Proof Artifacts" below).
- [ ] AWS resources are **torn down** and a **final billing check** confirms no lingering charges.
- [ ] **Brand Identity Validated (Stretch)** — Custom domain (e.g., `alexandria-plus.com`) and SSL certificates are active via Route 53 and ACM.

---

## Milestones (in order)

### Milestone 0 — Setup & guardrails
- [X] Create a **personal AWS account** (own credit card, not corporate/internal). https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1#
- [X] Set an **AWS Budget alarm** (e.g., alert at $10). https://us-east-1.console.aws.amazon.com/costmanagement/home?region=us-east-1#/budgets/details?name=My%20Zero-Spend%20Budget
- [X] Confirm internal policy if considering any employee account/credit (default: don't).
- [X] Install Android Studio, FFmpeg, and set up a Git repository for the project.

### Milestone 1 — Android fundamentals (prerequisite learning)
- [X ] Complete the first units of **Android Basics with Compose**.
- [X ] Build 2-3 throwaway apps (counter, converter, static list + detail navigation).
- [X ] Build a small **Room + ViewModel + Compose** list app (first taste of MVVM).

### Milestone 2 — Media pipeline spike (decoupled from any app)
> [!NOTE]
> **Architectural Decision: Local Transcoding.** Full-length movie transcoding is CPU-intensive and exceeds the **AWS Lambda 15-minute timeout**. While **AWS Elemental MediaConvert** is the industry standard, it is costly for a personal spike. We will use **local FFmpeg** to prove understanding of GOP sizes, segmenting, and manifest structures without cloud overhead.

- [X] Rip **one** movie you own.
- [X] Transcode it into **3 renditions** (e.g., 1080p/720p/480p) with **FFmpeg**.
- [X] Handle a **codec matrix**: AVC (H.264) and HEVC (H.265) video; keep/handle **EAC3** (Dolby Digital Plus) audio from the rip alongside **AAC**.
- [X] Package into **HLS** (`.m3u8` + segments) and **DASH** (`.mpd` + segments).
- [X] Include captions: embedded **CEA-608/708** and/or sidecar **WebVTT**.
- [X] Play it locally (VLC or a local hls.js/Shaka page) to confirm the pipeline works.

### Milestone 3 — Storage & delivery (AWS)
- [X] Upload manifests + segments to **S3**.
- [X] Put **CloudFront** in front of S3.
- [ ] Add **signed URLs / signed cookies** so content requires authorization.
- [X] Confirm playback from the CloudFront URL in a browser.

### Milestone 4 — Web client (laptop + iPhone)
- [X] Build a simple web player page (**Shaka Player** or **hls.js/dash.js**).
- [X] Confirm playback in a **laptop browser**.
- [X] Confirm playback in **iPhone Safari** (native HLS support — no native app, no Apple Developer fee).

### Milestone 5 — Android app (main learning vehicle)
- [X] Browse/catalog screen — Compose grid of thumbnails (**MVVM**), metadata from a small backend or Room.
- [X] Basic playback — drop in **ExoPlayer/Media3**, play one HLS stream.
- [X] **Player lifecycle** — correctly release/resume across background, rotation, and process death.
- [X] Adaptive streaming + **codec/bitrate overlay** showing current resolution/bitrate/codec (AVC/HEVC/AAC/EAC3).
- [ ] **ABR algorithms (depth):**
  - [ ] Baseline: enable ExoPlayer's default (hybrid) adaptive track selection.
  - [ ] Observability: overlay showing estimated bandwidth, buffer health, and a log of rendition switches.
  - [ ] Control: customize the `AdaptiveTrackSelection` parameters and articulate the tradeoffs (aggressive vs. conservative switching).
  - [ ] Proof: throttle the network (Android Studio) and record the player adapting 1080p→720p→480p and recovering.
- [ ] **Captions** — render embedded **CEA-608/708** (and/or WebVTT) with a toggle.
- [X] **Custom controls** — seek bar with buffered-progress (Canvas/custom View).
- [X] Player screen refactored to **MVI** (single immutable state, explicit intents).
- [X] Player events (buffering, position, errors) modeled as **Flow** (reactive requirement).
- [ ] **Animations** — fading controls and/or thumbnail-to-player transition.
- [X] **Hilt / DI** wiring the ViewModels, repository, and player.

### Milestone 6 — Small backend (optional but nice)
- [X] Catalog/auth API on **Lambda + API Gateway + DynamoDB** (Free Tier).
- [ ] Issues signed URLs/cookies to authenticated family users.
- [ ] **Watch-history store** — record play events (userId, titleId, timestamp, completion %) in DynamoDB. Feeds recommendations (Milestone 10).

### Milestone 7 — Quality & performance (requirement proof)
- [ ] **Unit tests** for ViewModels and repository (Turbine for Flow assertions).
- [X] **Android Profiler** pass: confirm the player is released (no memory leak), check for jank during control animations, and watch for excessive recomposition.
- [ ] Capture Profiler screenshots as evidence.

### Milestone 8 — DRM capstone
- [ ] AES-128 encrypted HLS working (stepping stone), OR
- [ ] **Widevine** DRM working on Android/web against a license server.
- [ ] Understand **PlayReady** (Microsoft/Windows/Xbox) conceptually — the third DRM ecosystem alongside Widevine (Google) and FairPlay (Apple). Demo Widevine; be able to explain PlayReady.
- [ ] (FairPlay explicitly **out of scope** — avoids Apple Developer fee and complexity.)

### Milestone 9 — Capture proof, then tear down
- [ ] Record a **screen-capture demo**: same movie playing on laptop, iPhone, and Android, showing adaptive switching and (if achieved) DRM.
- [ ] Write a short **architecture write-up / README** (diagram + tech decisions + what each requirement maps to).
- [ ] Push all code to a **public (or shareable) Git repo**.
- [ ] **Tear down AWS:** delete CloudFront distribution, empty + delete S3 buckets, remove Lambda/API Gateway/DynamoDB.
- [ ] **Final billing check** to confirm charges have stopped.

### Milestone 10 — (Optional) Bedrock-powered recommendations
- [ ] Backend **recommendations endpoint** (Lambda): fetch user watch history + catalog metadata, build a prompt, call **AWS Bedrock**.
- [ ] **Constrain + validate**: instruct the model to recommend only from the provided catalog, and validate returned title IDs against the real catalog before display (guards against hallucination).
- [ ] **Explainable output**: recommendations include a short "why" ("because you watched X and Y…").
- [ ] **Cache** recommendations; regenerate only when history changes (controls cost + determinism).
- [X] (Optional, offline batch) Use Bedrock to **enrich catalog metadata** — synopses, mood/theme tags.
- [ ] Client **"For You" row** in Compose (also a nice animation surface).
- [X] Keep Bedrock **server-side only** (never called directly from the client).


### Milestone 11 — Knowledge Mastery & Audit
- [ ] Complete the **[Knowledge Audit](./knowledge-audit.md)** self-assessment.
- [ ] Achieve a 100% score on architectural and strategic reasoning.
- [ ] **Lead Engineer Demonstration**: Prove that you "Own" the code and decisions by being able to defend them without AI assistance, mirroring the expectations of a technical lead interview at a Tier-1 company.

### Milestone 13 — SaaS Monetization: Payment Orchestration (Stripe)
- [ ] **Stripe Account & Product Catalog**: Define subscription tiers (Starter, Pro, Enterprise) in the Stripe Dashboard.
- [ ] **Merchant Integration**:
  - [ ] Implement **Stripe Checkout** in the Partner Portal for secure, PCI-compliant subscription signup.
  - [ ] Use **AWS Secrets Manager** to securely store Stripe API keys.
- [ ] **Event-Driven Billing**:
  - [ ] Create a **Stripe Webhook Lambda** to receive lifecycle events (e.g., `customer.subscription.deleted`, `invoice.paid`).
  - [ ] Integrate with **Amazon EventBridge** to orchestrate "Entitlement Updates" (enabling/disabling shop access).
- [ ] **Metered Billing (Future)**: Integrate with Stripe's usage-based billing to charge shops per GB of storage consumed.

### Milestone 14 — Multimedia Expansion: Audio & Music Support (Premium)
- [ ] **Audio Pipeline**: Configure the Fargate factory to detect and process MP3/AAC/FLAC files.
- [ ] **Lossless Support**: Implement FLAC preservation for audiophile-grade CD/Vinyl digitization.
- [ ] **Music Player UI**: Update the Android app to support an "Audio-Only" mode with persistent playback notification and album art rendering.
- [ ] **AI Music Metadata**: Leverage **Amazon Bedrock** and **Amazon Transcribe** to identify songs, artists, and lyrics from digitized audio.
- [ ] **Premium Entitlement**: Link audio upload capability to the "Enterprise" Stripe tier.

### Milestone 15 — Enterprise Governance: Multi-Account Strategy
- [ ] **Organization Setup**: Configure **AWS Organizations** to manage multiple child accounts.
- [ ] **Environment Isolation**:
  - [ ] Provision a dedicated **Development Account** for unstable spikes and manual testing.
  - [ ] Provision a dedicated **Production Account** as a locked-down sanctuary for customer data.
- [ ] **Cross-Account Pipeline**:
  - [ ] Refactor the CI/CD pipeline to deploy to both accounts sequentially (Dev -> Manual Approval -> Prod).
  - [ ] Implement **IAM Role Trust** to allow the central Pipeline account to deploy resources into member accounts.

### Milestone 16 — Brand Identity: Custom Domain & Route 53 (Stretch)
- [ ] **Domain Registration**: Acquire `alexandria-plus.com` (or similar) via Route 53.
- [ ] **Security (ACM)**: Provision an SSL/TLS certificate for the custom domain.
- [ ] **DNS & Routing**:
  - [ ] Create a **Hosted Zone** in Route 53.
  - [ ] Map the custom domain to the CloudFront distribution using **Alias Records**.
  - [ ] Update the `RewritePath` logic to support domain-specific routing (e.g., `www.alexandria-plus.com/demetrius/`).

### Milestone 17 — The Mouseion: Self-Serve Family Contributions
- [ ] **Administrative Hierarchy**: Update Cognito to support `FamilyAdmin` vs `FamilyMember` roles.
- [ ] **Self-Serve Portal**: Build a consumer-facing version of Demetrius allowing families to upload modern media directly.
- [ ] **Metered Storage Billing**: 
  - [ ] Implement a nightly **S3 Inventory Lambda** to calculate per-family storage consumption.
  - [ ] Integrate with **Stripe Billing** to dynamically adjust subscription costs based on "Storage-as-a-Utility."
- [ ] **Purge Protocol**: Implement the secure `DELETE` workflow for Family Admins to manage their own storage footprint.

### Milestone 18 — The Scroll (Web): Cross-Platform Viewer
- [ ] **Web Engine**: Integrate **Shaka Player** for resilient, multi-bitrate streaming on web browsers.
- [ ] **Responsive UI**: Build the viewer using **React + Tailwind**, optimized for both desktop and tablet layouts.
- [ ] **Casting Support**: Implement **Google Chromecast** and **Apple AirPlay** integration.
- [ ] **Unified CI/CD**: Add the web deployment stage to the Release Engine (Pipeline).

### Milestone 19 — The Scroll (iOS): Apple Mobile Support
- [ ] **Native Development**: Build the iOS viewer using **SwiftUI**.
- [ ] **Player Integration**: Utilize **AVPlayer** for native, high-performance HLS playback on iPhone and iPad.
- [ ] **DRM Handshake**: Prepare the backend for **FairPlay Streaming** (FPS) certificate handshakes (Apple's proprietary DRM).

### Milestone 20 — The Scroll (Living Room): Smart TV & Roku
- [ ] **Android TV**: Optimize the existing Kotlin/Compose code for Android TV lean-back interactions (D-Pad navigation).
- [ ] **Roku App**: Build a native Roku channel using **BrightScript** and **SceneGraph**.
- [ ] **Activation Flow**: Implement the standard "6-digit code" TV activation workflow to link a Smart TV to a family's Cognito account.

### Milestone 21 — The Great Intake: Automated Mobile Heritage Sync
- [ ] **Background Observer**: Implement an Android `ContentObserver` + `WorkManager` service to detect new videos in the system camera roll.
- [ ] **Unmetered Ingestion Logic**: Enforce "Wi-Fi Only" constraints for large 4K uploads to protect user data plans and battery health.
- [ ] **Approval Gate Settings**: Add user toggles for "Auto-Publish," "AI Draft Only," or "Manual Review Required" for mobile uploads.
- [ ] **In-App Metadata Refinement**: Enable users to edit titles and descriptions directly within the Android app, synchronized via a `PATCH` API endpoint.
- [ ] **Storage Metering & Notifications**: Implement a usage-tracking Lambda to notify users when they approach their tier's storage limits (S3/R2).

### Milestone 22 — FinOps: Short-Form Optimization
- [ ] **Duration-Aware Orchestration**: Update the Fargate orchestrator to detect video duration via FFmpeg probe.
- [ ] **Passthrough Logic**: Skip heavy HLS transcoding for videos under 5 minutes.
- [ ] **Direct MP4 Delivery**: Update the Lambda BFF to serve raw MP4 CloudFront URLs for short-form assets, bypassing the HLS bitrate ladder.

### Milestone 23 — Cleanup & Governance: Deletion & Rejection Workflows
- [ ] **Review Rejection**: Implement a "Reject/Cancel" action in the Demetrius Review Board to purge unwanted uploads and metadata drafts.
- [ ] **Library Deletion**: Implement a secure "Delete from Vault" feature in both the Admin and Consumer apps.
- [ ] **S3 Lifecycle Alignment**: Ensure that deleting a DynamoDB record triggers a background purge of all associated S3 assets (Source MP4, Thumbnails, HLS Fragments).
- [ ] **Hard vs Soft Delete Strategy**: Implement "Soft Delete" (e.g., `isDeleted` flag) for the first 30 days to allow for accidental recovery, followed by permanent hard deletion.

### Milestone 24 — Privacy-First Metadata Architecture
- [ ] **Privacy Onboarding UI**: Implement a "Trust Disclosure" screen during the first upload that explains the three metadata modes: *Luddite* (Manual), *Privacy* (On-Device ML), and *Magic* (Cloud AI).
- [ ] **On-Device Labeling (Default)**: Integrate Google ML Kit in the Android app to perform local object detection/labeling.
- [ ] **"Blind" Cloud Narratives**: Update the Fargate/Bedrock pipeline to support a text-only mode that generates descriptions based solely on local ML tags, ensuring no images leave the device for default users.
- [ ] **Opt-in "Magic" Mode**: Implement the secure toggle to allow users to explicitly opt-in to the current multimodal analysis for high-fidelity storytelling.

### Milestone 25 — Release Engineering: Production App Signing
- [ ] **Release Keystore Generation**: Generate a permanent, secure JKS (Java KeyStore) for production app signing.
- [ ] **AWS Secrets Manager Integration**: Store the Keystore binary and passwords securely in AWS Secrets Manager to decouple identity from the build environment.
- [ ] **Pipeline Build Signing**: Update the CI/CD pipeline and `build.gradle.kts` to pull the signing credentials during the build process.
- [ ] **Consistent Updating**: Verify that apps built via the pipeline can be installed as updates over locally-built versions (and vice versa) without package conflicts.

### Milestone 26 — Architectural Hardening: Lambda Decomposition
- [ ] **Service Mapping**: Audit the monolithic Scribe Lambda and map logic to domain-specific services (Ingestion, Catalog, Management).
- [ ] **Event-Driven Handlers**: Transition from direct Lambda-to-Lambda invocations to **Amazon EventBridge** or SQS for asynchronous workflows (e.g., triggering metadata extraction).
- [ ] **Micro-Service Deployment**: Deploy decoupled functions with scoped IAM permissions to minimize the "Blast Radius" of any single service failure.

### Milestone 27 — Personalized Aesthetics: Dynamic Theme Library
- [ ] **Theme Schema Registry**: Define a collection of premium, historically-inspired themes (e.g., *Heritage Gold*, *Midnight Ocean*, *Royal Library*) in a centralized JSON registry.
- [ ] **User Preference Persistence**: Update the User Profile layer (Cognito/DynamoDB) to store and sync a user's `selectedThemeId`.
- [ ] **Runtime Token Injection (Web)**: Refactor the React apps to utilize **CSS Variables** (`var(--heritage-gold)`) instead of static Tailwind colors, allowing for real-time theme switching without a rebuild.
- [ ] **Dynamic Palette Switching (Android)**: Refactor `AlexandriaTheme` to be driven by a `ThemeRepository`, enabling the app to swap the entire `ColorScheme` at runtime based on user preference.
- [ ] **Material You (Monet) Integration**: (Stretch) Integrate Android 12+ dynamic coloring to allow the vault's aesthetic to match the user's device wallpaper.

### Milestone 28 — Verification Code Identity & Custom Email Sender (Amazon SES)
- [x] **Auth Flow Parity**: Configure `USER_PASSWORD_AUTH` and `USER_SRP_AUTH` explicitly in `AuthStack.ts`, `app-admin`, and `app-viewer` for cross-platform login parity.
- [x] **Custom Domain Verification (SES)**: Verify `alexandria-plus.com` identity and DKIM keys in Amazon SES.
- [x] **Custom FROM Identity**: Configure AWS Cognito User Pool to send transactional emails (verification codes, password resets) from `no-reply@alexandria-plus.com`.
- [x] **Branded Verification Templates**: Configure custom HTML/text verification email templates with the Alexandria+ Heritage Gold aesthetic and logo.
- [ ] **SES Production Access**: Transition Amazon SES out of Sandbox mode to enable delivery to external family member email addresses.
- [x] **CDK Integration**: Update `AuthStack.ts` to programmatically provision `cognito.UserPoolEmail.withSES` and link SES domain identity.

### Milestone 29 — Serverless Multi-Tenant Vault Management & Cryptographic Isolation
- [x] **DynamoDB Tenant Registry**: Provisioned `/tenants` REST endpoints backed by Single-Table Design (`PK = "TENANTS_REGISTRY"`, `SK = "TENANT#<familyId>"`).
- [x] **Cryptographic Tenancy Enforcement**: Enforced `claims['custom:familyId']` extraction in Lambda (`index.js`), guaranteeing data isolation between family vaults.
- [x] **Demetrius Tenant Operations**: Integrated `/admin/tenants` registry page and on-the-fly vault provisioning drawers in Demetrius (`app-admin`).
- [x] **Mandatory Family Vault Registration**: Enforced mandatory Family Code validation for consumer sign-ups on Desktop Viewer (`app-viewer`) and Android Viewer.
- [x] **Authenticated Identity & Token Inspection**: Decoded Cognito ID Token payloads (`session.tokens.idToken.payload`) to display authenticated user emails and family partition keys across web and mobile clients.

### Milestone 30 — Google Registration & Phone Verification
- [ ] **Google Account Registration**: Let family users and shop operators register with their Google accounts and use the associated email as their account identity.
- [ ] **Phone Number Verification**: Collect and verify each registrant's phone number by sending a one-time verification code via SMS.
- [ ] **Pool and Client Integration**: Configure Google identity federation and SMS verification consistently across the customer and shop-operator Cognito user pools and their web/mobile clients.
- [ ] **Registration UX & Recovery**: Provide clear Google sign-in, phone verification, resend-code, and error flows in the registration experiences.
- [ ] **End-to-End Validation**: Verify successful and failed registration flows for both family users and shop operators, including unverified phone numbers.

---

## Requirement Coverage Map

Confirm each résumé requirement is provably demonstrated:

| Requirement | Where it's proven |
|---|---|
| Android SDK, Activity/Fragment lifecycle | Milestone 5 (player lifecycle across rotation/background/process death) |
| Thread management | Milestone 5 (coroutines for network + player events off main thread) |
| Custom views | Milestone 5 (custom seek bar / controls via Canvas) |
| Compose + animations | Milestones 5, 10 (Compose UI, fading controls, transitions, "For You" row) |
| Architecture patterns (MVVM, MVI) | Milestone 5 (MVVM browse screen, MVI player screen) + DI |
| Reactive frameworks (RxJava/Flow) | Milestone 5 (player events as Flow) |
| Testing + performance tools | Milestone 7 (unit tests + Android Profiler) |
| HLS (preferred) / DASH | Milestones 2-5 (packaged both, lead with HLS) |
| DRM (PlayReady/Widevine) | Milestone 8 (Widevine demo; PlayReady conceptual) |
| ABR algorithms | Milestone 5 (custom track-selection policy + switch visualization + throttled proof) |
| Captions CEA-608/708 | Milestones 2, 5 (packaged and rendered with toggle) |
| Codecs AVC/HEVC/AAC/EAC3 | Milestone 2 (transcode/handle) + Milestone 5 (overlay shows active codecs) |
| AWS Bedrock | Milestone 10 (explainable recommendations over the catalog) |

---

## Out of Scope (deliberately, to control cost & time)

- Native iOS app / FairPlay DRM (use Safari HLS instead — avoids $99/yr Apple fee)
- **Cloud-based Transcoding**: (AWS MediaConvert/Lambda)
  - Lambda is excluded due to the **15-minute execution limit**.
  - MediaConvert is excluded to avoid per-minute usage charges.
  - Custom ECS/Fargate FFmpeg clusters are avoided to keep the "Video Science" proofs (FFmpeg parameters) visible and local.
- Custom domain name (use raw CloudFront domain — avoids registration fee)
- Large media library (3-5 titles is enough to prove capability)
- Long-term hosting / maintenance (tear down after proof captured)

---

## Cost Guardrails (recap)

- Personal AWS account, own card. Confirm internal policy before any employee account use (default: don't).
- Budget alarm set on day one (~$10).
- Transcode locally (FFmpeg), not MediaConvert.
- Small library, short-lived deployment, deliberate teardown.
- **Target total out-of-pocket: a few dollars.**
- Always verify current AWS pricing for your region rather than relying on estimates.
