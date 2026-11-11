# Kuuma Obutonde: reporter app

Kuuma Obutonde is a reporting system for pollution and damage to the environment on wet and dry land: wetlands, rivers, forests, streets, markets and slums. It has two apps that share one Postgres database:

| App | Repo | Who uses it | What it does |
| --- | --- | --- | --- |
| **Reporter app (this repo)** | `Wetland-watch` (live at https://wetland-watch.vercel.app) | The public | Take a photo, attach location, send a report, check its status, claim a reward |
| Staff dashboard | [`wetland-nema`](https://github.com/EleanorNabaloga/wetland-nema) | NEMA officers | Sign in with MFA, review and triage reports, deadlines, hotspots, trust scores |

Nobody signs in to this app. Each report gets a secret token, kept on the phone, which is the only way to see that report's status or claim its reward.

More detail:

- [docs/api.md](docs/api.md): the three API routes
- [docs/design-spec.md](docs/design-spec.md): the product design the system is working towards
- [`wetland-nema/docs/architecture.md`](https://github.com/EleanorNabaloga/wetland-nema/blob/main/docs/architecture.md): how both apps fit together and what officers do with a report

## Quick start

You need Node.js 20 or newer and a Postgres database (this app has no offline demo mode).

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run dev                     # http://localhost:3000
```

Location and the camera need HTTPS on a phone. Use `npm run dev:https`, or a tunnel such as `cloudflared tunnel --url http://localhost:3000`, and open the https address on the phone.

## Environment variables

Keep real values in `.env.local`. It is git-ignored. Never commit it.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string, with `?sslmode=require`. **Must be the same database as `wetland-nema`.** |
| `PHONE_ENCRYPTION_KEY` | 64 hex characters. Encrypts reward phone numbers in `identity_vault`. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Losing it means stored numbers can no longer be read. |

## Database setup

Run the migrations once, in date order. They are split between the two repos; with both checked out side by side:

```bash
node --env-file=.env.local scripts/run-migration.mjs ../wetland-nema/db/migrations/20260930_base_tables.sql
node --env-file=.env.local scripts/run-migration.mjs ../wetland-nema/db/migrations/20261001_shared_reporter_storage.sql
node --env-file=.env.local scripts/run-migration.mjs db/migrations/20261010_duplicate_detection.sql
node --env-file=.env.local scripts/run-migration.mjs ../wetland-nema/db/migrations/20261020_reporter_trust.sql
node --env-file=.env.local scripts/run-migration.mjs db/migrations/20261023_evidence_signature.sql
node --env-file=.env.local scripts/run-migration.mjs db/migrations/20261111_rate_limits.sql
```

All are safe to run more than once. The signature columns and the `rate_limits` table are also created automatically on first use.

## How a report works

```
 Phone (browser)                              Server (POST /api/reports)
 ---------------                              --------------------------
 1. Take photo (or pick from gallery,
    location and time read from the photo)
 2. Resize to JPEG, read GPS + accuracy
 3. Sign [photo, lat, lng, acc, time]
    with this phone's key
 4. No signal? Save to IndexedDB and
    send when the phone is back online
                     ---- send ---->
                                              5. Rate limit: 30 per hour per IP
                                                 (counted in the database)
                                              6. Check the signature
                                                 changed evidence -> refused
                                              7. Duplicate check on the photo bytes
                                                 same photo -> refused, logged
                                              8. Store report, return id + token
                     <---- id, token ----
 9. Keep id + token in localStorage
10. Later: check status, claim reward
```

### Evidence signing

`lib/device.js` creates one anonymous ECDSA P-256 key per phone, kept in IndexedDB and impossible to read out. It signs `JSON.stringify([photo, lat, lng, acc, ts])`. `lib/evidence.js` rebuilds the same string on the server and checks it:

| Result | Meaning | What happens |
| --- | --- | --- |
| `verified` | Evidence is exactly what the phone signed | Stored |
| `unsigned` | Phone could not sign (old browser, private mode) | Stored and marked for the reviewer |
| `invalid` | Signature or hash does not match | Refused with 400 |

The public key also identifies the phone (without a name or number) for the dashboard's trust scores and hotspots.

### Duplicate photo detection

`lib/dup/`. The server fingerprints the bytes it received, never trusting what the phone says about the photo.

1. **Same file** (SHA-256 of the bytes): refused.
2. **Same picture** (64-bit difference hash, mirror images included), compared by how many bits differ:

| Bits different | Same place (≤ 300 m) within 48 h | Elsewhere |
| --- | --- | --- |
| 0 to 5 | refused (`near_duplicate`) | refused (`..._claimed_elsewhere`) |
| 6 to 10 | accepted and **grouped** into the same incident (`case_id`) | accepted and **flagged** for NEMA |
| 11 or more | accepted | accepted |

Refused uploads are logged in `duplicate_attempts` (fingerprints and IP, never the photo). A unique index on `photo_hash` stops two identical uploads that arrive at the same moment.

The limits are in `lib/dup/thresholds.js`. They are starting values: outdoor photos look alike, so measure them on real photos before the pilot:

```bash
npm run tune -- path/to/photos
```

Put photos of the same scene (same place, different shot) in subfolders if you have them. The script re-saves each photo the way a reused one usually arrives (smaller, recompressed, mirrored, brightened), compares every pair, and shows how many re-saved copies the current limits catch and how many honest photos they would refuse or flag. It changes nothing.

### Status and rewards

- The server returns a random token once and stores only its SHA-256 hash.
- The phone keeps `{id, token}` pairs in `localStorage` and asks `POST /api/reports/mine` for their status. The answer has status, next step and claim state only: no photo, no location.
- A reward unlocks only when NEMA **verifies** the report: an officer triages it as Emergency, Enforcement or Referral, and has not marked it false (`lib/rewards.js`). Being reviewed is not enough, and Duplicate or Insufficient reports earn nothing. The phone sees this as `rewardAvailable`.
- The reporter then claims with a phone number. The number is encrypted (AES-256-GCM) into `identity_vault`, apart from the report.

### Offline and install

The app is a Progressive Web App. `public/sw.js` (switched on in production by `components/RegisterServiceWorker.js`) saves pages and app files as they load, so after one visit with signal the app opens with no connection. Reports made offline wait on the phone and send when signal returns. `/api/` requests are never cached. Phones can install it from the browser menu ("Add to Home screen" / "Install app"); the manifest is `app/manifest.js`.

When you change caching rules in `sw.js`, bump its `CACHE` name so old caches are cleared.

### Languages

English, Kiswahili and Luganda (`lib/strings/`). The phone always sends keys, never translated text, so NEMA sees English. To add a language, create `lib/strings/xx.js` and import it and add it to `LANGS` and `MESSAGES` in `lib/messages.js`; missing keys fall back to English. Check translations with `npm run check:i18n`.

## Tests

```bash
npm test
```

41 tests (Node's built-in runner) covering duplicate detection, evidence signing and the reward rule. They need no database. All passed on 11 November 2026.

## Project structure

```
app/
  page.js                       shows components/ReporterApp.js
  layout.js  manifest.js        page shell, PWA manifest
  api/reports/route.js          send a report
  api/reports/[id]/route.js     one report's status, claim reward
  api/reports/mine/route.js     status of this phone's reports
components/
  ReporterApp.js                the reporter screens (camera, form, my reports)
  LanguagePicker.js  PinMap.js  RegisterServiceWorker.js
lib/
  db.js                         all database access
  dup/                          duplicate photo detection
  device.js  evidence.js        phone key and signature check
  crypto.js                     phone number encryption
  rewards.js                    when a reward unlocks
  image.js  exif.js  hash.js    photo resizing, photo GPS/time, evidence hash
  offline.js                    offline queue (IndexedDB)
  i18n.js  strings/             translations
  ratelimit.js                  rate limits (database, memory fallback)
  geo.js  constants.js
db/migrations/                  SQL changes
scripts/                        run a migration, check translations, tune duplicate limits
tests/                          node --test suites
```

## Deploying

1. Set `DATABASE_URL` and `PHONE_ENCRYPTION_KEY` on the host (e.g. Vercel). Use the same database as `wetland-nema`.
2. Run the migrations above.
3. Deploy. The report route uses `sharp`, so it runs on the Node.js runtime, not the edge.

## Fixed in November 2026

- Rewards unlock on verification (Emergency, Enforcement or Referral, not marked false) instead of on "reviewed".
- Rate limits are kept in the database (`rate_limits`, hashed keys), so all server instances share one count. If the database cannot be reached they fall back to memory.
- The stored evidence hash is now worked out on the server. Before, phones that could not make a hash all sent `"unavailable"`, and because the column is unique, the second such report failed with a server error.
- Added `scripts/tune-thresholds.mjs`, which `npm run tune` pointed to but was missing.
- Added the base-table migration (in `wetland-nema`).
- Moved the reporter screens from `page.backup.js` to `components/ReporterApp.js`; removed unused modules (`lib/tokens.js`, `flags.js`, `queue.js`, `format.js`), `debug-toggle.mjs`, the first prototype `kuuma-obutonde.html` and the `wetland-dedupe/` prototype. They are still in the git history.
