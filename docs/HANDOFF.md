# Engineering Handoff: Citizen Reporter and Repository Governance

This document provides a comprehensive engineering handoff for the citizen reporting application, queue integration, and open-source infrastructure implemented in `Wetland-watch`.

---

## 1. Contributor Scope and Core Architecture

The contributor was tasked with integrating the intake pipeline with the background AI queue, establishing open-source governance and automated CI/CD workflows, and hardening repository protections without modifying unaffected parts of the application.

### A. Intake Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen Whistleblower
    participant PWA as Mobile Browser PWA
    participant Key as IndexedDB Keystore (ECDSA P-256)
    participant API as POST /api/reports
    participant DB as Shared Neon Postgres
    participant Queue as ai_triage_queue Table

    Citizen->>PWA: Capture photo and location
    PWA->>Key: Sign payload (photo hash, lat, lng, acc, ts)
    Key-->>PWA: Non-exportable cryptographic signature
    PWA->>API: Submit signed incident report
    API->>API: Verify ECDSA P-256 signature
    API->>API: Compute SHA-256 and 64-bit difference hash
    API->>DB: Check duplicate thresholds and rate limits
    API->>DB: Insert record into reports table
    API->>Queue: Enqueue report into ai_triage_queue
    API-->>PWA: Return report ID and unguessable secret token
```

---

## 2. Implemented Code Footprint

### A. Asynchronous Queue Intake (`lib/db.js`)
- `addReport`: When a report is accepted and stored, it enqueues the incident into `ai_triage_queue` within the same database transaction:
  ```sql
  INSERT INTO ai_triage_queue (report_id, status) VALUES ($1, 'pending') ON CONFLICT (report_id) DO NOTHING
  ```
- **Reliability**: Running the queue insert inside the report creation transaction keeps the citizen report and its pending queue item consistent.

### B. Migration Script Cleanup (`scripts/run-migration.mjs`)
- Simplified script header comments in `scripts/run-migration.mjs`.

### C. Open-Source Infrastructure and Automations
- **Semantic Versioning & Releases** (`.github/workflows/release.yml`): Automates release note generation and tagging on merges into `main`.
- **Conventional Commit PR Linter** (`.github/workflows/pr-lint.yml`): Enforces standard commit message formatting.
- **Automated Stale Management** (`.github/workflows/stale.yml`): Marks inactive issues and pull requests after 60 days.
- **Issue Templates** (`.github/ISSUE_TEMPLATE/`): Bug reports, feature requests, documentation improvements, and template chooser (`config.yml`).

---

## 3. Operational Runbook

### A. Environment Configuration (`.env.local`)
Configure the following environment variables:

```bash
# Shared PostgreSQL Connection (Must match wetland-nema)
DATABASE_URL="postgres://user:password@ep-sample-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Phone Number Encryption Key (64 hexadecimal characters)
PHONE_ENCRYPTION_KEY="your-64-character-hexadecimal-key"
```

Generate a telephone encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### B. Test and Build Execution
```bash
# Run unit test suite (46 tests, 100 percent pass required)
npm test

# Verify production Turbopack compilation (0 errors required)
npm run build
```

---

## 4. GitHub Settings Required from Repository Owner (Eleanor Nabaloga)

As a contributor, the following repository configurations require administrative execution by repository owner `@EleanorNabaloga`:

### A. Repository Description and Topics
Run via GitHub CLI:
```bash
gh repo edit EleanorNabaloga/Wetland-watch \
  --description "Citizen reporting progressive web application for environmental damage and wetland protection with cryptographic evidence signing in Uganda." \
  --add-topic "environmental-protection,citizen-science,uganda,nema,pwa,offline-first,evidence-signing,cryptography,anti-fraud,whistleblower-protection"
```

### B. Branch Protection Rules (`Settings > Branches`)
Configure rules for `main`, `staging`, and `dev`:
1. Require a pull request before merging.
2. Require approvals (minimum 1) and enable *Require review from Code Owners*.
3. Dismiss stale pull request approvals when new commits are pushed.
4. Require status checks to pass before merging:
   - `validate` (Lint, Test and Build)
   - `sast` (CodeQL Security Scan)
   - `verify-authorization` (Merge Guard)
   - `verify-environment-authorization` (Environment Authorization Gate)
   - `lint-pr-title` (Pull Request Title Linter)
5. Restrict who can push to matching branches: `@EleanorNabaloga` and `@MarkDanielsMCraft`.
6. Enforce restrictions for administrators: *Do not allow bypassing the above settings*.
