# Personal Streaming Service — Portfolio Project

A self-hosted "mini Netflix": rip physical media I own, transcode it to adaptive streaming formats, store it in AWS, and stream it to my family on laptop, iPhone, and Android — with DRM, adaptive bitrate, captions, and LLM-powered recommendations.

**Goal:** Prove hands-on competence across a broad media + mobile + cloud + applied-GenAI skill set by building the whole thing end to end, capturing proof, and tearing it down. This is a **portfolio spike**, not a permanent product.

> **Personal project notice:** This is built entirely on personal infrastructure (personal computer, personal AWS account on my own card) — deliberately separate from any Amazon internal systems, accounts, or build tooling.

---

## Documents in this repo

| File | What it's for |
|---|---|
| [`streaming-project-glossary.md`](./streaming-project-glossary.md) | Plain-language definitions of every technology/term (HLS, DASH, DRM, codecs, ABR, captions, Android/architecture terms, Bedrock/GenAI), how each fits this project, and where to learn more. **Start here if a term is unfamiliar.** |
| [`streaming-project-definition-of-done.md`](./streaming-project-definition-of-done.md) | The execution plan: the finish line, 10 sequenced milestones, a requirement→milestone coverage map, out-of-scope items, and cost guardrails. **The project tracker.** |
| [`engineering-log.md`](./engineering-log.md) | Running record of decisions, tradeoffs, and learnings. Includes a key-decisions table and a depth-calibration table. **Update as I build — it's half the proof.** |
| [`streaming-starter-kit/`](./streaming-starter-kit/) | Milestone 2 hands-on kit: FFmpeg transcode script, a local hls.js player, and a step-by-step README. **The cheapest way to validate the concept (free, local).** |

---

## Suggested reading / build order

1. **Skim the glossary** to get oriented on the vocabulary.
2. **Read the definition of done** to understand the milestones and the finish line.
3. **Run the starter kit** (`streaming-starter-kit/README.md`) — get one movie playing as adaptive HLS locally. This is Milestone 2 and validates the whole idea cheaply.
4. **Work the milestones in order**, logging decisions in `engineering-log.md` as you go.

---

## The big picture (architecture)

```
Physical media (owned)
   │  rip + transcode (FFmpeg, local, free)
   ▼
Adaptive packages (HLS + DASH: renditions, segments, manifests)
   │  upload
   ▼
S3  ──fronted by──▶  CloudFront (CDN + signed-URL access control)
   ▲                     │  streams to
   │                     ▼
Backend (Lambda + API Gateway + DynamoDB)      Clients:
 - catalog + auth                               - Laptop browser (Shaka/hls.js)
 - watch-history store                          - iPhone (Safari native HLS)
 - Bedrock recommendations endpoint             - Android app (ExoPlayer/Media3)
```

---

## Requirement coverage (summary)

Full mapping is in the definition-of-done. High level, this project demonstrates:

- **Media:** HLS (preferred) + DASH, ABR algorithms, CEA-608/708 captions, codecs (AVC/HEVC/AAC/EAC3), DRM (Widevine; PlayReady conceptually)
- **Android:** SDK/lifecycles, thread management, custom views, Compose + animations, MVVM + MVI, Flow (reactive), Hilt/DI
- **Cloud:** S3, CloudFront, signed URLs, serverless backend
- **Applied GenAI:** AWS Bedrock recommendations (RAG pattern, hallucination-guarded)
- **Quality:** unit tests + Android Profiler

---

## Cost & safety guardrails

- Personal AWS account (own card); AWS Budget alarm set on day one (~$10).
- Transcode locally with FFmpeg (avoids MediaConvert per-minute charges).
- Small library (3-5 titles), short-lived deployment, deliberate teardown.
- Target total out-of-pocket: a few dollars.
- Verify current AWS pricing for your region rather than trusting estimates.

---

## Status

- [x] Project scoped, documented, glossary + plan written
- [ ] Milestone 0 — setup & guardrails
- [ ] Milestone 2 — local media pipeline spike (start here)
- [ ] …see `streaming-project-definition-of-done.md` for the full checklist
