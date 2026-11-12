# Product and Technical Roadmap: Kuuma Obutonde

This document provides a strictly verified status of all planned features for Kuuma Obutonde, derived exclusively from the project design specification (`docs/design-spec.md`), the AI specification and build order (`wetland-nema/docs/ai.md`), and existing repository documentation.

---

## 1. Feature Status Matrix

| Feature | Source in Existing Docs | Current Status | Code Verification Reference |
| :--- | :--- | :--- | :--- |
| **Citizen Reporter PWA** | `docs/design-spec.md` (Track B: Smartphone) | Completed | `components/ReporterApp.js`, `public/sw.js`, `app/manifest.js` |
| **Cryptographic Evidence Signing** | `docs/design-spec.md` (Track B: Evidence-Grade) | Completed | `lib/device.js`, `lib/evidence.js`, `tests/evidence.test.mjs` |
| **Perceptual Duplicate Detection** | `docs/design-spec.md` (Backend: Dedupe) | Completed | `lib/dup/`, `tests/duplicate-detection.test.mjs` |
| **Whistleblower Vault (Zero-PII)** | `docs/design-spec.md` (Governance: DPIA) | Completed | `identity_vault` table, AES-256-GCM encryption in `lib/crypto.js` |
| **Anonymous Token Status Check** | `docs/design-spec.md` (Track B: Case ID) | Completed | `app/api/reports/mine/route.js`, `app/api/reports/[id]/route.js` |
| **AI Triage Queue Intake** | `wetland-nema/docs/ai.md` (Build order: Job 1) | Completed | `lib/db.js` (`addReport` enqueues into `ai_triage_queue`) |
| **Repository Merge Safeguards** | `docs/BRANCH_PROTECTION.md` | Completed | `.github/workflows/merge-guard.yml`, `.githooks/pre-push`, `CODEOWNERS` |
| **Direct Object Storage Uploads** | `wetland-nema/README.md` (Still to build) | Planned | Tracked in Phase 2 |
| **Automated Airtime Redemption** | `docs/design-spec.md` (Rewards) | Planned | Tracked in Phase 2 |
| **Voice Note Recording (Track B)** | `docs/design-spec.md` (Backend: ASR) | Planned | Tracked in Phase 3 |
| **Feature Phone USSD Status Check**| `docs/design-spec.md` (Track A) | Planned | Tracked in Phase 3 |

---

## 2. Completed Capabilities Evidenced by Code

### A. Progressive Web Application (PWA) and Offline Queue
- **Documentation Reference**: `docs/design-spec.md` (Track B: Smartphone PWA).
- **Implementation**:
  - `components/ReporterApp.js`: Citizen report intake screens.
  - `public/sw.js` and `components/RegisterServiceWorker.js`: Service worker caching for offline operation.
  - `lib/offline.js`: IndexedDB outbox queue saving un-transmitted reports until network signal returns.

### B. Hardware-Backed Evidence Signing
- **Documentation Reference**: `docs/design-spec.md` (Track B: Capture-time cryptographic signing).
- **Implementation**:
  - `lib/device.js`: Generates anonymous non-exportable ECDSA P-256 key pair in browser IndexedDB.
  - `lib/evidence.js`: Signs `[photo, lat, lng, acc, ts]` on phone and verifies signature on server.
  - `tests/evidence.test.mjs`: 9 unit tests verifying signature integrity and tampering rejection.

### C. Perceptual Difference Hashing (dHash)
- **Documentation Reference**: `docs/design-spec.md` (Backend: Dedupe).
- **Implementation**:
  - `lib/dup/hash.js` and `lib/dup/store.js`: 64-bit difference hashing comparing visual structure.
  - `tests/duplicate-detection.test.mjs`: 24 unit tests validating byte-level SHA-256 and dHash Hamming distance bands.

### D. Whistleblower Anonymity and Rewards State Machine
- **Documentation Reference**: `docs/design-spec.md` (Reporter protection: no retaliation).
- **Implementation**:
  - `lib/rewards.js`: Unlocks reward claim capability only when NEMA verifies the report (Emergency, Enforcement, Referral) without false report flags.
  - `lib/crypto.js`: AES-256-GCM encryption for citizen telephone numbers.
  - `tests/rewards.test.mjs`: 8 unit tests validating reward unlock states.

---

## 3. Specifications for Planned Enhancements (Directly from Existing Docs)

### A. Direct Object Storage Uploads
- **Source**: `wetland-nema/README.md` ("Still to build: photos in object storage instead of the database").
- **Requirement**: Use short-lived presigned URLs to upload photos directly to private S3-compatible storage rather than base64 strings in Postgres.

### B. Automated Airtime Redemption via Telecom APIs
- **Source**: `docs/design-spec.md` (Feedback and incentives: "lottery-based airtime after verification").
- **Requirement**: Connect verified reward claims to MTN and Airtel Uganda open payment APIs for automated airtime disbursement.

### C. Voice Note Recording and Audio Deduplication
- **Source**: `docs/design-spec.md` (Backend: "ASR with language-specific confidence and human review; audio fingerprint").
- **Requirement**: In-browser audio recording component for citizens to record spoken incident descriptions in local languages.
