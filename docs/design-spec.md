# Kuuma Obutonde Reporter App: design spec

This project contains only the public reporter experience. NEMA staff workflows, review controls, and dashboard operations belong to the separate `wetland-nema` project.

## Reporter flow

- Capture or select a photo and record its location, accuracy, and available capture time.
- Let the reporter review the evidence and add a category or note before sending.
- Store unsent reports on the device and clearly show whether a report is queued or submitted.
- Give each submitted report a private token so only its reporter can check status or claim a reward.
- Display status and next-step feedback supplied by the NEMA system without exposing staff controls.

## Privacy and evidence

- Do not require a reporter account to submit a report.
- Keep reporter phone numbers separate from report evidence and encrypted at rest in `identity_vault`.
- Do not expose report photos, locations, or secret tokens through reporter status endpoints.
- Preserve exact signed evidence metadata and its fingerprint; make uncertainty in photo location or capture time visible to the reporter.

### Evidence integrity and coordinate precision

- On submission, the device signs `JSON.stringify([photo, lat, lng, acc, ts])` with its ECDSA P-256 key and sends the signature, public key, and SHA-256 hash.
- The server verifies the signature on arrival (`lib/evidence.js`) and stores the **exact signed coordinates** (`lat`, `lng`), `acc`, `ts`, `photo_url`, `hash`, `device_public_key`, `signature`, and `signature_status` in `reports`.
- Preserving exact coordinates ensures NEMA inspectors receive an accurate pin for site verification and allows saved evidence to be re-verified at any later time by reconstructing `evidenceString({ photo, lat, lng, acc, ts })` from the stored row and running `verifyEvidence()` against `signature`, `device_public_key`, and `hash`.
- Location privacy is enforced at egress boundaries rather than by mutating stored evidence: reporter status endpoints never return coordinates or photos, and external AI calls in `wetland-nema` quantize coordinates to 3 decimal places (~110 m) before transmission.

### Quick screen cover (Hide) vs. removing local access

- **Hide** immediately switches only what is shown on screen to a neutral **Daily Farming Tips** decoy screen and pauses background status polling while hidden. It preserves saved report-tracking tokens and the offline report queue on the device so reporters can return later to check review updates and claim rewards.
- **Remove from this device** is a separate, confirmed action inside a report's status view. It deletes only that report's local tracking token from the phone while keeping the report on the NEMA server, and warns the reporter that status updates and reward claims for that report can no longer be accessed from that device.

## Integration boundary

- Submit new reports to the shared PostgreSQL database used by `wetland-nema`.
- Read a report's status only when the reporter presents its secret token.
- Allow a reporter to claim an unlocked reward; do not expose staff review, outcome editing, bulk report access, or data-reset operations here.
