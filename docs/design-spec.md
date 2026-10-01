# Wetland Watch Reporter App: design spec

This project contains only the public reporter experience. NEMA staff workflows, review controls, and dashboard operations belong to the separate `wetland-nema` project.

## Reporter flow

- Capture or select a photo and record its location, accuracy, and available capture time.
- Let the reporter review the evidence and add a category or note before sending.
- Store unsent reports on the device and clearly show whether a report is queued or submitted.
- Give each submitted report a private token so only its reporter can check status or claim a reward.
- Display status and next-step feedback supplied by the NEMA system without exposing staff controls.

## Privacy and evidence

- Do not require a reporter account to submit a report.
- Keep reporter phone numbers separate from report evidence and encrypted at rest.
- Do not expose report photos, locations, or secret tokens through reporter status endpoints.
- Preserve evidence metadata and its fingerprint; make uncertainty in photo location or capture time visible to the reporter.

## Integration boundary

- Submit new reports to the shared PostgreSQL database used by `wetland-nema`.
- Read a report's status only when the reporter presents its secret token.
- Allow a reporter to claim an unlocked reward; do not expose staff review, outcome editing, bulk report access, or data-reset operations here.
