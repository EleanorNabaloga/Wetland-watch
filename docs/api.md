# API reference

Public routes, no login. All take and return JSON. Errors look like `{ "error": "message" }`, sometimes with a `reason`.

## `POST /api/reports`

Send a report. Limit: 30 per hour per IP (many phones share one IP on mobile networks), counted in the database across all server instances.

```json
{
  "photo": "data:image/jpeg;base64,...",
  "lat": 0.3476,
  "lng": 32.5825,
  "acc": 12,
  "ts": 1762851600000,
  "type": "Sewage",
  "note": "Pipe emptying into the swamp",
  "source": "camera",
  "locationSource": "device",
  "timeSource": "submitted",
  "hash": "<sha256 hex of the signed string>",
  "publicKey": "<base64 SPKI>",
  "signature": "<base64 ECDSA signature>"
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `photo` | yes | JPEG data URL, under about 2 MB |
| `lat`, `lng` | yes | Valid numbers |
| `acc` | no | GPS accuracy in metres, 0 or more |
| `ts` | no | Capture time in ms. Defaults to now. |
| `type` | no | One of: Rubbish or waste, Sewage, Oil or chemicals, Dumping or filling, Blocked drainage, Open burning or smoke, Cutting trees or vegetation, Other. Anything else is stored empty. |
| `note` | no | Cut to 200 characters |
| `source` | no | `camera` (default) or `upload` (from the gallery) |
| `locationSource` | no | `device` (default) or `photo` |
| `timeSource` | no | `submitted` (default) or `photo` |
| `publicKey`, `signature`, `hash` | no | Evidence signature. Without them the report is stored as `unsigned`. |

Responses:

| Status | Body |
| --- | --- |
| 201 | `{ "id", "ts", "status": "new", "outcome": "", "rewardAvailable": false, "claimed": false, "token", "dupStatus"? }`. `dupStatus` is `group` or `flag` when the photo looked like an earlier one. **The token is shown only once.** |
| 400 | Missing or bad photo or location, unreadable photo, or `reason: "bad_signature"` |
| 409 | Duplicate photo. `reason`: `exact_duplicate`, `near_duplicate`, or either with `_claimed_elsewhere` |
| 429 | Too many reports from this connection |

## `POST /api/reports/mine`

Status of this phone's reports. POST so tokens stay out of URLs and logs.

```json
{ "items": [{ "id": "NEMA-101", "token": "..." }] }
```

Up to 50 items. Returns an array of `{ id, ts, status, outcome, rewardAvailable, claimed }` for items whose token matches. Others are left out silently.

## `GET /api/reports/[id]`

One report's status. Send the token in the `x-report-token` header. Returns `{ id, ts, status, outcome, rewardAvailable, claimed }`, or 404 when the report does not exist **or** the token is wrong (so ids cannot be probed).

## `PATCH /api/reports/[id]`

Claim the reward. Only possible when `rewardAvailable` is true: NEMA triaged the report as Emergency, Enforcement or Referral and did not mark it false.

```json
{ "claim": true, "token": "...", "phone": "+256 700 000000" }
```

| Status | Meaning |
| --- | --- |
| 200 | Claimed. Returns the status object with `claimed: true`. Claiming again keeps the first claim. |
| 400 | Missing `claim`, or bad phone number |
| 403 | Wrong token |
| 404 | No such report |
| 409 | Not unlocked yet (not verified by NEMA) |
