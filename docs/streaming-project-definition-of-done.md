# Definition of Done — Personal Streaming Service (Portfolio Spike)

**Goal:** Prove I can build an end-to-end adaptive video streaming service across web, iOS, and Android — then capture proof and tear it down. This is a *portfolio spike*, not a permanent product.

**Guiding principle:** Small library, local transcoding, personal AWS account, budget alarm on, tear down when proof is captured. Target out-of-pocket cost: a few dollars total.

---

## Definition of Done (the finish line)

The project is **done** when all of the following are true:

- [x] I can play **one of my own movies** on **all three** targets:
  - [x] Laptop browser (The Scroll Web Viewer)
  - [x] iPhone (Safari / web player)
  - [x] Android app (my own ExoPlayer/Media3 build)
- [x] Playback is **adaptive** — I can demonstrate quality/bitrate switching under changing network conditions (HLS multi-bitrate ladder).
- [x] Content is **access-controlled** — pre-signed S3 URLs and CloudFront OAC authorization.
- [x] **Multi-Tenancy Validated** — Data is strictly isolated by `custom:familyId` and `custom:tenantId` at the database and API layers.
- [x] **Authenticated Access** — User management and API security are handled via **AWS Cognito** (Decoupled Admin vs Customer User Pools).
- [ ] **DRM demonstrated** — Widevine-protected playback works on Android/web (stretch: AES-128 as a stepping stone; PlayReady understood conceptually; FairPlay explicitly out of scope).
- [x] **Adaptive bitrate demonstrated at the algorithm level** — I can observe, tune, and force the player's rendition-switching decisions.
- [x] **Captions rendered** — embedded CEA-608/708 captions display with a toggle.
- [ ] **Custom Player Engine (Stretch)** — Create my own low-level video renderer using `MediaCodec` and `AudioTrack` instead of depending on the common `ExoPlayer` library.
- [x] **Codec matrix handled** — AVC + HEVC video and AAC + EAC3 audio all play, with active codecs visible in the overlay.
- [x] **Bedrock-powered AI Metadata & Recommendations** — Multimodal Claude Vision auto-drafting and Heritage Genre classification over the catalog.
- [x] I have **durable proof** captured (AI Collaboration Log + Git Commit History).
- [ ] AWS resources are **torn down** and a **final billing check** confirms no lingering charges.
- [x] **Brand Identity Validated** — Custom domain (`alexandria-plus.com` / `api.alexandria-plus.com`) and SSL certificates active via Route 53 and ACM.

---

## Milestones (in order)

### Milestone 0 — Setup & guardrails
- [x] Create a **personal AWS account** (own credit card, not corporate/internal).
- [x] Set an **AWS Budget alarm** (e.g., alert at $10).
- [x] Confirm internal policy if considering any employee account/credit (default: don't).
- [x] Install Android Studio, FFmpeg, and set up a Git repository for the project.

### Milestone 1 — Android fundamentals (prerequisite learning)
- [x] Complete the first units of **Android Basics with Compose**.
- [x] Build 2-3 throwaway apps (counter, converter, static list + detail navigation).
- [x] Build a small **Room + ViewModel + Compose** list app (first taste of MVVM).

### Milestone 2 — Media pipeline spike (decoupled from any app)
- [x] Rip **one** movie you own.
- [x] Transcode it into **3 renditions** (1080p/720p/480p) with **FFmpeg**.
- [x] Handle a **codec matrix**: AVC (H.264) and HEVC (H.265) video; keep/handle **EAC3** audio from the rip alongside **AAC**.
- [x] Package into **HLS** (`.m3u8` + segments) and **DASH** (`.mpd` + segments).
- [x] Include captions: embedded **CEA-608/708** and/or sidecar **WebVTT**.
- [x] Play it locally (VLC or a local hls.js/Shaka page) to confirm the pipeline works.

### Milestone 3 — Storage & delivery (AWS)
- [x] Upload manifests + segments to **S3**.
- [x] Put **CloudFront** in front of S3 with Origin Access Control (OAC).
- [x] Add **signed URLs / pre-signed authorization** so content requires authorization.
- [x] Confirm playback from the CloudFront URL in a browser.

### Milestone 4 — Web client (laptop + iPhone)
- [x] Build a simple web player page (**Shaka Player**).
- [x] Confirm playback in a **laptop browser**.
- [x] Confirm playback in **iPhone Safari** (native HLS support).

### Milestone 5 — Android app (main learning vehicle)
- [x] Browse/catalog screen — Compose grid/rows of thumbnails (**MVVM**), metadata from Scribe API Gateway.
- [x] Basic playback — drop in **ExoPlayer/Media3**, play HLS streams.
- [x] **Player lifecycle** — correctly release/resume across background, rotation, and process death.
- [x] Adaptive streaming + **codec/bitrate overlay** showing current resolution/bitrate/codec (AVC/HEVC/AAC/EAC3).
- [x] **ABR algorithms (depth):**
  - [x] Baseline: enable ExoPlayer's default (hybrid) adaptive track selection.
  - [x] Observability: overlay showing estimated bandwidth, buffer health, and a log of rendition switches.
  - [x] Control: customize `AdaptiveTrackSelection` parameters and articulate the tradeoffs.
  - [x] Proof: throttle the network and record the player adapting 1080p→720p→480p.
- [x] **Captions** — render embedded **CEA-608/708** with a toggle.
- [x] **Custom controls** — seek bar with buffered-progress (Canvas/custom View).
- [x] Player screen refactored to **MVI** (single immutable state, explicit intents).
- [x] Player events (buffering, position, errors) modeled as **Flow** (reactive requirement).
- [x] **Animations** — fading controls and thumbnail-to-player transitions.
- [x] **Hilt / DI / ViewModel** wiring the ViewModels, repository, and player.

### Milestone 6 — Small backend
- [x] Catalog/auth API on **Lambda + API Gateway + DynamoDB** (Free Tier).
- [x] Issues pre-signed URLs to authenticated family users.
- [x] **Watch-history store** — record play events (`/play` endpoint, `LogPlayEventFunction` Lambda writing to DynamoDB).

### Milestone 7 — Quality & performance (requirement proof)
- [x] **Unit tests** for ViewModels and repository.
- [x] **Android Profiler** pass: confirm player is released (no memory leak), check for jank during control animations, and watch for excessive recomposition.

### Milestone 8 — DRM capstone
- [ ] AES-128 encrypted HLS working (stepping stone), OR
- [ ] **Widevine** DRM working on Android/web against a license server.
- [ ] Understand **PlayReady** conceptually — the third DRM ecosystem alongside Widevine and FairPlay.

### Milestone 9 — Capture proof, then tear down
- [x] Write a short **architecture write-up / README** (diagram + tech decisions + requirement mappings).
- [x] Push all code to a **public (or shareable) Git repo**.
- [ ] **Tear down AWS:** delete CloudFront distribution, empty + delete S3 buckets, remove Lambda/API Gateway/DynamoDB.
- [ ] **Final billing check** to confirm charges have stopped.

### Milestone 10 — Bedrock-powered recommendations & metadata
- [x] Backend **recommendations & metadata endpoints**: fetch user watch history + catalog metadata, build prompt, call **AWS Bedrock**.
- [x] **Constrain + validate**: instruct Bedrock Claude Vision to recommend/classify strictly from approved categories (guards against hallucination).
- [x] Use Bedrock to **enrich catalog metadata** — synopses, mood/theme tags, Heritage Genres.
- [x] Keep Bedrock **server-side only** (never called directly from client).

### Milestone 11 — Knowledge Mastery & Audit
- [x] Complete the **[Knowledge Audit](./knowledge-audit.md)** self-assessment.
- [x] Achieve a 100% score on architectural and strategic reasoning.

### Milestone 16 — Brand Identity: Custom Domain & Route 53
- [x] **Domain Registration**: Acquired `alexandria-plus.com` via Route 53.
- [x] **Security (ACM)**: Provisioned SSL/TLS certificates for `alexandria-plus.com` and `api.alexandria-plus.com`.
- [x] **DNS & Routing**: Created Hosted Zone, mapped custom domain to CloudFront and API Gateway using Alias Records.

### Milestone 18 — The Scroll (Web): Cross-Platform Viewer
- [x] **Web Engine**: Integrated **Shaka Player** for resilient, multi-bitrate streaming on web browsers.
- [x] **Responsive UI**: Built the viewer using **React + Tailwind** (`app-viewer`), with Netflix-style category rows.
- [x] **Unified CI/CD**: Added web deployment stage (`DeployScrollViewer`) to CodePipeline.

### Milestone 23 — Cleanup & Governance: Deletion & Rejection Workflows
- [x] **Review Rejection**: Implemented "Reject & Purge" action in Demetrius Review Board (`DELETE /catalog/{videoId}/{familyId}`).
- [x] **Library Deletion**: Implemented `handleDeleteVideo` in Lambda `index.js`.
- [x] **Soft Delete Strategy**: Implemented two-phase soft delete (`DELETED` status with 30-day retention).

### Milestone 28 — Verification Code Identity & Custom Email Sender (Amazon SES)
- [x] **Auth Flow Parity**: Configure `USER_PASSWORD_AUTH` and `USER_SRP_AUTH` explicitly in `AuthStack.ts`, `app-admin`, and `app-viewer` for cross-platform login parity.
- [x] **Custom Domain Verification (SES)**: Verify `alexandria-plus.com` identity and DKIM keys in Amazon SES.
- [x] **Custom FROM Identity**: Configure AWS Cognito User Pool to send transactional emails from `no-reply@alexandria-plus.com`.
- [x] **Branded Verification Templates**: Configure custom HTML/text verification email templates with Alexandria+ Heritage Gold aesthetic.
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

### Milestone 31 — Tiered Storage Metering, Short-Form Passthrough & FinOps Engine
- [ ] **SaaS Pricing & Storage Tier Architecture**: Free 2 GB Starter Vault, $8.99/mo Base Plan (200 GB + 100% features), 500 GB ($14.99/mo), 1 TB ($24.99/mo), 2.5 TB ($49.99/mo), 5 TB ($89.99/mo).
- [ ] **Actively Streamed Media Rule (S3 Standard)**: Keep active video streaming assets (HLS & short MP4s) strictly in S3 Standard / CloudFront Cache ($0.00 read retrieval fee).
- [ ] **Raw Master Backup Rule (Glacier Instant Retrieval)**: Transition raw uploaded master MP4s of long transcoded videos to S3 Glacier Instant Retrieval ($0.004/GB/mo) after 30 days.
- [ ] **Short-Form Video Passthrough (< 3 Minutes)**: Probe duration; skip heavy Fargate HLS ladders for clips under 3 minutes, serving direct MP4 passthrough (~85% compute cost reduction).

### Milestone 32 — Daily New Video Notifications
- [ ] **Tenant-Scoped Digest**: Notify users in each family tenant about newly uploaded videos via SES daily digest.

### Milestone 33 — "Nuclear Option" System Factory Reset Lambda
- [x] **Destructive Administrative Utility**: Provisioned `NuclearResetFunction` (`nuclearReset.js`) to execute automated environment teardowns.
- [x] **Safety Handshake Protocol**: Enforced mandatory confirmation payload key (`confirmReset: "CONFIRM_SYSTEM_FACTORY_RESET_ALEXANDRIA"`), aborting without execution if missing.
- [x] **Multi-Resource Purging**: Recursively purges all objects across S3 buckets (`SOURCE`, `THUMBNAIL`, `DEST`), DynamoDB `VideoMetadataTable`, and Cognito User Pools.
- [x] **API Gateway Route Isolation**: Isolated reset Lambda from public API Gateway routes, requiring manual invocation via AWS CLI or AWS Console.

### Milestone 34 — Decoupled Identity Architecture (Shop Admin vs. Customer User Pools)
- [x] **Zero-Trust User Pool Decoupling**: Provisioned two completely separate Cognito User Pools: `adminUserPool` (`Alexandria-ShopAdmin-Vault`) and `customerUserPool` (`Alexandria-Customer-Vault`).
- [x] **REST Edge Authorizers**: Configured `adminAuthorizer` for administrative routes (`/ingest`, `/catalog/publish`, `/tenants`, `/upload/*`) and `dualAuthorizer` for catalog browsing.
- [x] **Pipeline Environment Binding**: Configured CodePipeline (`PipelineStack.ts`) to inject `adminUserPoolId` into Demetrius and `customerUserPoolId` into The Scroll Viewer and Android App.

### Milestone 35 — Dynamic Operator Tenancy & Hardcoded String Cleanup
- [x] **Dynamic Operator Tenant Generation**: Implemented 5-character uppercase alphanumeric Operator Tenant ID generation (`SHOP_A8K2P`), providing 60.46 Million unique keys.
- [x] **Structural Disambiguation**: Differentiated 5-character operator tenant IDs (`SHOP_5CHAR`) from 8-character Family Vault Codes (`FAM_8CHAR`), guaranteeing zero key space collisions.
- [x] **Fallback String Elimination**: Removed legacy hardcoded fallback strings (`SHOP_ADMIN`, `GLOBAL`) in favor of dynamic Cognito JWT claim resolution (`claims['custom:tenantId']`).

### Milestone 36 — Dynamic Heritage Genres & Single Source of Truth Registry
- [x] **Approved Heritage Memory Categories**: Standardized 8 Heritage Memory Categories (`Holidays, Birthdays and Special Occasions`, `Daily Life`, `Friends and Family`, `Milestones`, `School, Sports and Hobbies`, `Travel and Vacation`, `Reunions and Gatherings`, `Miscellaneous`).
- [x] **DynamoDB Single Source of Truth**: Exposed `GET /genres` and `POST /genres` backed by DynamoDB `PK = GENRES_REGISTRY`, `SK = GENRE#<id>`, allowing zero-code category management.
- [x] **Bedrock Vision Prompt Integration**: Configured Fargate tasks (`transcoder/index.js`) to query DynamoDB `PK = GENRES_REGISTRY` dynamically at runtime and format active genres directly into Claude Vision prompts.
- [x] **Cross-Platform Netflix-Style Category Rows**: Transformed Desktop Web Viewer (`Home.tsx`) and Android App (`CatalogScreen.kt`) to render horizontal scrolling category rows grouped by Heritage Genre.

### Milestone 37 — Self-Serve Family Media Uploads, Bottom Navigation & Review Board
- [x] **Strict Cryptographic Tenancy Enclosure**: Enforced `familyId = claims['custom:familyId']` for customer uploads in Lambda `index.js`, preventing client-side tenancy manipulation.
- [x] **Desktop Viewer Upload Button & Review Page**: Built consumer-facing upload interface (`ConsumerUpload.tsx`) in `app-viewer` with tabbed Upload and Family Review Queue.
- [x] **Android Mobile Bottom Navigation**: Added `AlexandriaBottomBar` featuring `Home`, `Add` (Local Gallery Video Picker), `Review` (Family Review Pane), and `Profile` (Account Modal).
- [x] **Android Local Video Picker**: Built 3-column previewable video picker grid (`LocalVideoPicker.kt`) querying `MediaStore.Video.Media` with multi-selection checkmarks.
- [x] **Android Family Review Pane**: Built `FamilyReviewPane.kt` displaying `REVIEW_PENDING` items for the user's `familyId` with Heritage Genre dropdowns and "Approve & Publish" action.

### Milestone 39 — Android Jetpack WorkManager Background Upload Engine & Privacy Controls
- [x] **Persistent WorkManager Service**: Built `S3UploadWorker.kt` (`CoroutineWorker`) running 10MB chunked S3 uploads as a system-managed background service that survives app closure, orientation changes, and screen locks.
- [x] **Foreground Progress Notification**: Configured `S3UploadWorker` with an ongoing system notification bar item showing real-time upload progress (`Uploading Family Memory 2/5 (60%)...`).
- [x] **Manual Privacy Ingestion Mode (Default)**: Implemented `useAi: false` Manual Mode across Web Viewer and Android App, bypassing Bedrock Fargate extraction tasks and making uploads immediately available on the Review Board.
- [x] **AWS Zero AI Training Guarantee Disclosure**: Integrated interactive `?` privacy disclosure modals in `AlexandriaNavbar.kt` and `AppNavbar.tsx` displaying AWS Bedrock's enterprise zero-model-training guarantee.

### Milestone 40 — Video Search Engine & Ranked Results Overlay
- [x] **Top Banner Search Trigger**: Integrated top-right search button triggers in `AppNavbar.tsx` (Web) and `AlexandriaNavbar.kt` (Android).
- [x] **3-Tier Priority Search Ranking Algorithm**: Evaluates live search queries with case-insensitive priority sorting:
  - **Priority 1**: Title starts with search query (Prefix Match).
  - **Priority 2**: Title contains search query elsewhere (Substring Match).
  - **Priority 3**: Description contains search query (Content Match).
- [x] **Input Gating & Result Bounding**: Enforces $\ge$ 3-character query length gating and caps output to top 10 ranked matches.
- [x] **Selection Navigation**: Selecting any search result card closes the overlay and redirects directly to the Title Preview / Details Page (`/details` on Web, `Screen.Details` on Android).

### Milestone 38 — Venture Capital Pitch Package & Live Demo Harness
- [ ] **10-Slide Investor Pitch Deck**: Slide-by-slide narrative script and visual layout specifications.
- [ ] **Financial Model & Unit Economics Spreadsheet**: 3-year SaaS financial model (87% Gross Margins).
- [ ] **3-Minute Live Demo Script & Harness**: Minute-by-minute live software demo script.
- [ ] **Executive Teaser One-Pager**: 1-page PDF executive summary for VC introduction emails.

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
| AWS Bedrock | Milestone 10, 36 (multimodal keyframe analysis & Heritage Genre classification) |

---

## Cost Guardrails (recap)

- Personal AWS account, own card.
- Budget alarm set on day one (~$10).
- FinOps Optimization: Removed VPC Interface Endpoints to achieve **$0.00 idle cost**.
- Target total out-of-pocket: a few dollars.
