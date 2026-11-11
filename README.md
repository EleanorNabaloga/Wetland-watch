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

Run these migrations once, in this order:

```bash
node --env-file=.env.local scripts/run-migration.mjs ../wetland-nema/db/migrations/20261001_shared_reporter_storage.sql
node --env-file=.env.local scripts/run-migration.mjs db/migrations/20261010_duplicate_detection.sql
node --env-file=.env.local scripts/run-migration.mjs db/migrations/20261023_evidence_signature.sql
```

All are safe to run more than once. The last one also runs automatically when the first report is stored.

The base tables (`reports`, `identity_vault`) are not created by any file in either repo yet. They must already exist in the database.

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

The limits are in `lib/dup/thresholds.js`. They are starting values: outdoor photos look alike, so measure them on real photos before the pilot.

### Status and rewards

- The server returns a random token once and stores only its SHA-256 hash.
- The phone keeps `{id, token}` pairs in `localStorage` and asks `POST /api/reports/mine` for their status. The answer has status, next step and claim state only: no photo, no location.
- Once an officer marks a report as reviewed, the reporter can claim a reward with a phone number. The number is encrypted (AES-256-GCM) into `identity_vault`, apart from the report.

### Offline and install

The app is a Progressive Web App. `public/sw.js` (switched on in production by `components/RegisterServiceWorker.js`) saves pages and app files as they load, so after one visit with signal the app opens with no connection. Reports made offline wait on the phone and send when signal returns. `/api/` requests are never cached. Phones can install it from the browser menu ("Add to Home screen" / "Install app"); the manifest is `app/manifest.js`.

When you change caching rules in `sw.js`, bump its `CACHE` name so old caches are cleared.

### Languages

English, Kiswahili and Luganda (`lib/strings/`). The phone always sends keys, never translated text, so NEMA sees English. To add a language, create `lib/strings/xx.js` and add it to `LANGS` in `lib/i18n.js`; missing keys fall back to English. Check translations with `node scripts/check-i18n.mjs`.

## Tests

```bash
npm test
```

33 tests (Node's built-in runner) covering duplicate detection and evidence signing. They need no database. All passed on 11 November 2026.

## Project structure

```
app/
  page.js                       re-exports ../page.backup.js (the reporter screens)
  layout.js  manifest.js        page shell, PWA manifest
  api/reports/route.js          send a report
  api/reports/[id]/route.js     one report's status, claim reward
  api/reports/mine/route.js     status of this phone's reports
page.backup.js                  the reporter screens (camera, form, my reports)
components/
  LanguagePicker.js  PinMap.js  RegisterServiceWorker.js
lib/
  db.js                         all database access
  dup/                          duplicate photo detection
  device.js  evidence.js        phone key and signature check
  crypto.js                     phone number encryption
  image.js  exif.js  hash.js    photo resizing, photo GPS/time, evidence hash
  offline.js                    offline queue (IndexedDB)
  i18n.js  strings/             translations
  ratelimit.js  geo.js  constants.js
db/migrations/                  SQL changes
scripts/                        run a migration, check translations
tests/                          node --test suites
wetland-dedupe/                 early stand-alone prototype (Express), not used by the app
```

## Deploying

1. Set `DATABASE_URL` and `PHONE_ENCRYPTION_KEY` on the host (e.g. Vercel). Use the same database as `wetland-nema`.
2. Run the migrations above.
3. Deploy. The report route uses `sharp`, so it runs on the Node.js runtime, not the edge.

## Known gaps

Found while writing these docs (November 2026):

1. **Rewards unlock on "reviewed", not on verification.** An officer only has to open and mark a report reviewed for its reward to be claimable, even if it is later triaged as Duplicate or Insufficient. The design spec says rewards come after verification.
2. **`npm run tune` is broken.** It runs `scripts/tune-thresholds.mjs`, which is not in the repo.
3. **Base table definitions are missing** from both repos (see Database setup).
4. **Rate limiting is in memory**, so on serverless hosting each instance counts separately and it resets on restart.
5. **Leftover files.** The reporter screens live in `page.backup.js` at the repo root (re-exported by `app/page.js`). `lib/tokens.js`, `lib/flags.js`, `lib/queue.js` and `lib/format.js` are not used. `kuuma-obutonde.html` is the original single-file prototype. `debug-toggle.mjs` edits the report route to show error details. `wetland-dedupe/` is an old prototype that includes sample photos and JSON data.
