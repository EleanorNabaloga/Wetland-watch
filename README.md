# Kuuma Obutonde Reporter

The public-facing app lets community members photograph pollution or damage to the environment on wet or dry land (streets, slums, markets, wetlands, rivers), attach a location, submit a report, check its status, and claim an available reward. NEMA staff tools live in the separate `wetland-nema` project.

## Run locally

```bash
npm install
npm run dev
```

The reporter app is served at `http://localhost:3000`. Phone location access requires HTTPS; use `npm run dev:https` or an HTTPS tunnel for device testing.

## Shared report storage

Configure this app and `wetland-nema` with the same Neon `DATABASE_URL` and `PHONE_ENCRYPTION_KEY`. Apply `wetland-nema/db/migrations/20261001_shared_reporter_storage.sql` before starting either app. Keep real values in `.env.local`; never commit them.

The reporter app creates reports, checks only reports paired with the reporter's secret token, and stores reward phone numbers encrypted. The NEMA project owns staff review and dashboard operations.

## Main files

```
app/page.js                    Reporter experience
app/api/reports/route.js       Public report submission
app/api/reports/[id]/route.js  Token-protected status and reward claim
app/api/reports/mine/route.js  Status lookup for this phone's reports
lib/db.js                      Shared PostgreSQL report storage
lib/image.js  lib/hash.js      Photo resizing and evidence fingerprint
```

## Offline and install

The app is a Progressive Web App. `public/sw.js` (switched on in production by `components/RegisterServiceWorker.js`) saves pages and app files as they load, so after one visit with signal the app opens with no connection. Reports made offline wait on the phone and send when signal returns. `/api/` requests are never cached. Phones can install it from the browser menu ("Add to Home screen" / "Install app"); the manifest is `app/manifest.js`.

When you change caching rules in `sw.js`, bump its `CACHE` name so old caches are cleared.
