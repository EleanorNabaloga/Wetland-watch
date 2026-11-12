# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-11

### Added
- Asynchronous AI queue integration in `lib/db.js`:
  - `addReport` automatically enqueues incoming citizen submissions into `ai_triage_queue` inside the database transaction.
- Open-source governance and security files:
  - `LICENSE` (GNU Affero General Public License v3).
  - `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
  - `CONTRIBUTING.md` (branch promotion workflow and maintainer gates).
  - `SECURITY.md` (vulnerability disclosure policy and zero-PII whistleblower protection).
- Automated CI and repository protection workflows:
  - `.github/workflows/ci.yml` (automated test, build, and CodeQL SAST scanning).
  - `.github/workflows/merge-guard.yml` (branch promotion hierarchy, fork isolation, and maintainer review gates).
  - `.github/workflows/release.yml` (automated semantic versioning and release notes).
  - `.github/workflows/pr-lint.yml` (Conventional Commits PR title validation).
  - `.github/workflows/stale.yml` (automated inactive issue and PR cleanup).
  - `.github/dependabot.yml` (automated daily dependency security updates).
  - `.github/CODEOWNERS` (restricting code review to @EleanorNabaloga and @MarkDanielsMCraft).
  - `.githooks/pre-push` and `scripts/install-git-hooks.mjs` (client-side pre-push hooks blocking direct pushes to protected branches).
  - `.github/ISSUE_TEMPLATE/` (bug reports, feature proposals, documentation updates, and config chooser).
- Automated documentation integrity test suite in `tests/docs_integrity.test.mjs` (`npm run test:docs`) validating markdown links, environment variable parity against `.env.example`, npm scripts synchronization, and issue/PR template schemas.
- Comprehensive technical roadmap in `docs/ROADMAP.md` tracking planned milestones strictly from existing design specifications.
- Engineering handoff documentation in `docs/HANDOFF.md`.

### Changed
- Updated `README.md` with CI badges, sequence diagram for cryptographic evidence signing, perceptual hashing thresholds, and quickstart documentation.
- Updated `docs/api.md` documenting report creation and automatic queue intake.
- Configured `"license": "AGPL-3.0"` and `"prepare": "node scripts/install-git-hooks.mjs"` in `package.json`.

### Fixed
- Cleaned database migration script `scripts/run-migration.mjs` headers.
- Fixed Node.js 24 test runner discovery by updating test script glob in `package.json` to `'tests/*.test.mjs'`.

### Security
- Whistleblower telephone numbers remain segregated in `identity_vault` and encrypted with AES-256-GCM.
- Capture-time evidence payloads signed with hardware-backed ECDSA P-256 keys.
- Rate limiting shared across database instances with memory fallbacks.

## [0.1.0] - 2026-10-31

### Added
- Progressive Web Application for citizen environmental incident reporting.
- Camera capture and EXIF metadata extraction (GPS coordinates, accuracy, capture timestamp).
- Perceptual difference hashing (64-bit dHash) and byte-level SHA-256 deduplication.
- Offline report queueing using browser IndexedDB.
- Anonymous status lookup and reward claim tokens.
- Multilingual interface support for English, Luganda, and Kiswahili.
