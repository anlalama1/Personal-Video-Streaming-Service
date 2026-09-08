# Alexandria+: Legal Strategy & Compliance Considerations

As Alexandria+ evolves from a personal spike into a B2B SaaS platform, we must architect for **Liability Mitigation**. This document outlines the legal guardrails and technical compliance strategies required to protect the platform from copyright infringement and regulatory risk.

## 1. The "Demetrius" Shield (B2B Contractual Barrier)
In our model, the Digitization Shop (the Tenant) is the primary user. We must place the legal burden of content verification on them.

- **Mandatory Certification**: Every ingestion via the Demetrius portal will require a cryptographic "click-wrap" agreement. The shop owner must certify that the media is personal, non-commercial, and non-infringing.
- **Indemnification**: Our Terms of Service (ToS) will include an indemnification clause where the shop agrees to hold Alexandria+ harmless for any copyright claims arising from their uploads.

## 2. DMCA Safe Harbor (The Federal Shield)
To qualify for protection under the Digital Millennium Copyright Act (DMCA), Alexandria+ must act as a "passive service provider."

- **Registered Agent**: Formally designate a Copyright Agent with the U.S. Copyright Office.
- **Notice and Takedown**: Implement a standard URL (e.g., `alexandria-plus.com/copyright`) for submitting takedown notices.
- **Repeat Infringer Policy**: Establish a "Three Strikes" rule for shop partners. If a shop repeatedly uploads commercial content (e.g., Disney movies), their tenant account is terminated.

## 3. "Private by Design" (Risk Isolation)
Publicly accessible content is the primary trigger for large-scale copyright litigation.

- **Strict Multi-Tenancy**: Alexandria+ is not a "Social Network." There are no public search engines or "Share" buttons.
- **Cognito Enforcement**: Content is physically and logically inaccessible without a verified JWT (JSON Web Token) linked to a specific family ID.
- **Reduced "Public Performance"**: By limiting sharing to verified family groups, we stay within the "Private Use" exception of copyright law.

## 4. Technical Compliance (Automated Mitigation)
We will leverage AWS AI services to build a "Self-Policing" pipeline.

- **Logo Detection (Amazon Rekognition)**: Before starting the high-cost Fargate transcode, we will send 3-5 frames (at the 0%, 50%, and 90% marks) to Rekognition to detect commercial studio logos (Disney, Universal, Warner Bros).
- **Audio Fingerprinting**: (Future Goal) Integrate with services like Audible Magic or ACRCloud to identify commercial music tracks in the background.
- **The "Flag" State**: If commercial content is detected, the `transcodeStatus` is moved to `FLAGGED`. The Fargate task is cancelled immediately to save cost, and a manual review task is created for the platform owner.

## 5. Handling Personal Backups (Format Shifting)
Alexandria+ recognizes the "Physical Media Preservation" use-case, where customers digitize legally owned physical media (VHS, Vinyl, DVD) for private preservation.

- **The "Digital VCR" Standard**: To stay within the spirit of personal use exceptions, the platform strictly prohibits public links or social sharing. Media is locked to a single "Family Vault" (authorized Cognito group).
- **Owner Certification**: Shops must log that the customer possesses the physical original of any commercial IP being digitized. 
- **Audit Logging**: The "Pharos Engine" will log AI matches (via Rekognition) of commercial logos, cross-referencing them with the shop's ownership certification to create a "Defense Trail."

## 6. Abuse Prevention & The "Bad Faith" Kill-Switch
Alexandria+ reserves the right to suspend transcoding or playback for any media that triggers copyright flags if the platform owner suspects "Bad Faith" use or systematic abuse (e.g., mass-distribution of commercial content).

- **Internal Auditing**: All `COPYRIGHT_MATCH` events are logged in a private administrative dashboard for periodic review.
- **Manual Revocation**: The platform architecture includes a "Kill-Switch" capability to block access to specific assets or terminate tenant (shop) access for repeated violations of the "Personal Use Only" policy.

## 7. Privacy & Data Residency
- **PII Isolation**: We do not store family names or addresses in DynamoDB. We use logical `familyId` strings.
- **GDPR/CCPA Readiness**: By allowing shops to "Delete" a family partition, we fulfill "Right to be Forgotten" requirements natively via our Single-Table Design.
