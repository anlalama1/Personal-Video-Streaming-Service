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
- [ ] **DRM demonstrated** — Widevine-protected playback works on Android/web (stretch: AES-128 as a stepping stone; PlayReady understood conceptually; FairPlay explicitly out of scope).
- [ ] **Adaptive bitrate demonstrated at the algorithm level** — I can observe, tune, and force the player's rendition-switching decisions (not just enable them).
- [ ] **Captions rendered** — embedded CEA-608/708 captions display with a toggle.
- [ ] **Custom Player Engine (Stretch)** — Create my own low-level video renderer using `MediaCodec` and `AudioTrack` instead of depending on the common `ExoPlayer` library.
- [ ] **Codec matrix handled** — AVC + HEVC video and AAC + EAC3 audio all play, with active codecs visible in the overlay.
- [ ] **(Optional) Bedrock-powered recommendations** — explainable "For You" suggestions over the catalog, validated against the real library.
- [ ] I have **durable proof** captured (see "Proof Artifacts" below).
- [ ] AWS resources are **torn down** and a **final billing check** confirms no lingering charges.

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
- [ ] Rip **one** movie you own.
- [ ] Transcode it into **3 renditions** (e.g., 1080p/720p/480p) with **FFmpeg**.
- [ ] Handle a **codec matrix**: AVC (H.264) and HEVC (H.265) video; keep/handle **EAC3** (Dolby Digital Plus) audio from the rip alongside **AAC**.
- [ ] Package into **HLS** (`.m3u8` + segments) and **DASH** (`.mpd` + segments).
- [ ] Include captions: embedded **CEA-608/708** and/or sidecar **WebVTT**.
- [ ] Play it locally (VLC or a local hls.js/Shaka page) to confirm the pipeline works.

### Milestone 3 — Storage & delivery (AWS)
- [ ] Upload manifests + segments to **S3**.
- [ ] Put **CloudFront** in front of S3.
- [ ] Add **signed URLs / signed cookies** so content requires authorization.
- [ ] Confirm playback from the CloudFront URL in a browser.

### Milestone 4 — Web client (laptop + iPhone)
- [ ] Build a simple web player page (**Shaka Player** or **hls.js/dash.js**).
- [ ] Confirm playback in a **laptop browser**.
- [ ] Confirm playback in **iPhone Safari** (native HLS support — no native app, no Apple Developer fee).

### Milestone 5 — Android app (main learning vehicle)
- [ ] Browse/catalog screen — Compose grid of thumbnails (**MVVM**), metadata from a small backend or Room.
- [ ] Basic playback — drop in **ExoPlayer/Media3**, play one HLS stream.
- [ ] **Player lifecycle** — correctly release/resume across background, rotation, and process death.
- [ ] Adaptive streaming + **codec/bitrate overlay** showing current resolution/bitrate/codec (AVC/HEVC/AAC/EAC3).
- [ ] **ABR algorithms (depth):**
  - [ ] Baseline: enable ExoPlayer's default (hybrid) adaptive track selection.
  - [ ] Observability: overlay showing estimated bandwidth, buffer health, and a log of rendition switches.
  - [ ] Control: customize the `AdaptiveTrackSelection` parameters and articulate the tradeoffs (aggressive vs. conservative switching).
  - [ ] Proof: throttle the network (Android Studio) and record the player adapting 1080p→720p→480p and recovering.
- [ ] **Captions** — render embedded **CEA-608/708** (and/or WebVTT) with a toggle.
- [ ] **Custom controls** — seek bar with buffered-progress (Canvas/custom View).
- [ ] Player screen refactored to **MVI** (single immutable state, explicit intents).
- [ ] Player events (buffering, position, errors) modeled as **Flow** (reactive requirement).
- [ ] **Animations** — fading controls and/or thumbnail-to-player transition.
- [ ] **Hilt / DI** wiring the ViewModels, repository, and player.

### Milestone 6 — Small backend (optional but nice)
- [ ] Catalog/auth API on **Lambda + API Gateway + DynamoDB** (Free Tier).
- [ ] Issues signed URLs/cookies to authenticated family users.
- [ ] **Watch-history store** — record play events (userId, titleId, timestamp, completion %) in DynamoDB. Feeds recommendations (Milestone 10).

### Milestone 7 — Quality & performance (requirement proof)
- [ ] **Unit tests** for ViewModels and repository (Turbine for Flow assertions).
- [ ] **Android Profiler** pass: confirm the player is released (no memory leak), check for jank during control animations, and watch for excessive recomposition.
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
- [ ] (Optional, offline batch) Use Bedrock to **enrich catalog metadata** — synopses, mood/theme tags.
- [ ] Client **"For You" row** in Compose (also a nice animation surface).
- [ ] Keep Bedrock **server-side only** (never called directly from the client).

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
- AWS MediaConvert (transcode locally with FFmpeg — avoids per-minute charges)
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
