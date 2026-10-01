import { Pool } from "pg";
import crypto from "node:crypto";
import { encrypt } from "./crypto";

export const TYPES = [
  "Rubbish or waste",
  "Sewage",
  "Oil or chemicals",
  "Dumping or filling",
  "Other",
];
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!global._wetlandPool) {
    global._wetlandPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return global._wetlandPool;
}

const query = (text, params) => getPool().query(text, params);
const reportSelect = `
  SELECT r.id, r.ts, r.received_at AS "receivedAt", r.photo_url AS photo,
         r.photo_hash AS "photoHash", r.source, r.location_source AS "locationSource",
         r.time_source AS "timeSource", r.device_public_key AS "publicKey",
         r.lat, r.lng, r.acc, r.type, r.note, r.hash, r.status,
         r.viewed_at AS "viewedAt", r.outcome, r.token_hash AS "tokenHash",
         COALESCE(i.claimed, false) AS claimed
  FROM reports r LEFT JOIN identity_vault i ON i.report_id = r.id`;

function fromRow(row) {
  return {
    id: row.id,
    ts: Number(row.ts),
    receivedAt: row.receivedAt ? new Date(row.receivedAt).getTime() : null,
    photo: row.photo,
    photoHash: row.photoHash,
    source: row.source,
    locationSource: row.locationSource,
    timeSource: row.timeSource,
    publicKey: row.publicKey,
    lat: Number(row.lat),
    lng: Number(row.lng),
    acc: row.acc == null ? null : Number(row.acc),
    type: row.type || "",
    note: row.note || "",
    hash: row.hash || "",
    status: row.status,
    viewedAt: row.viewedAt ? new Date(row.viewedAt).getTime() : null,
    outcome: row.outcome || "",
    claimed: Boolean(row.claimed),
    tokenHash: row.tokenHash || "",
  };
}

/* ---------- report tokens ----------
   When a phone sends a report, the server makes a secret token and returns it once.
   Only a hash of it is stored. The phone shows it back to check status and claim the reward,
   so nobody else can claim it, and the reporter never has to sign in. */
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function tokenOk(report, token) {
  if (
    !report ||
    !report.tokenHash ||
    typeof token !== "string" ||
    token.length > 100
  )
    return false;
  const a = Buffer.from(sha(token), "hex");
  const b = Buffer.from(report.tokenHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- reporter-visible data ---------- */
export function forReporter(r) {
  return {
    id: r.id,
    ts: r.ts,
    status: r.status,
    outcome: r.outcome,
    claimed: r.claimed,
  };
}

/* ---------- reads ---------- */
export async function getReport(id) {
  const result = await query(`${reportSelect} WHERE r.id = $1`, [id]);
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

// items: [{ id, token }] from one phone. Returns status only, and only where the token matches.
export async function listForReporter(items) {
  if (!items.length) return [];
  const ids = [...new Set(items.map((item) => item.id))];
  const result = await query(`${reportSelect} WHERE r.id = ANY($1::text[])`, [
    ids,
  ]);
  const all = new Map(result.rows.map((row) => [row.id, fromRow(row)]));
  const out = [];
  for (const it of items) {
    const r = all.get(it.id);
    if (r && tokenOk(r, it.token)) out.push(forReporter(r));
  }
  return out;
}

export async function addReport(input) {
  const token = newToken();
  const photoHash = sha(input.photo);
  try {
    const result = await query(
      `INSERT INTO reports
         (lat, lng, acc, ts, type, note, photo_url, hash, token_hash, photo_hash,
          source, location_source, time_source, device_public_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        input.lat,
        input.lng,
        input.acc,
        input.ts,
        input.type,
        input.note,
        input.photo,
        input.hash,
        sha(token),
        photoHash,
        input.source,
        input.locationSource,
        input.timeSource,
        input.publicKey,
      ],
    );
    return { report: await getReport(result.rows[0].id), token };
  } catch (error) {
    if (
      error.code === "23505" &&
      error.constraint === "reports_photo_hash_uidx"
    )
      return { duplicate: true };
    throw error;
  }
}

export async function claimReward(id, phone) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `${reportSelect} WHERE r.id = $1 FOR UPDATE OF r`,
      [id],
    );
    if (!result.rows[0]) {
      await client.query("COMMIT");
      return null;
    }

    const report = fromRow(result.rows[0]);
    if (report.status !== "viewed" || report.claimed) {
      await client.query("COMMIT");
      return report;
    }

    await client.query(
      `INSERT INTO identity_vault (report_id, encrypted_phone, claimed, claim_ts)
       VALUES ($1, $2, true, now())
       ON CONFLICT (report_id) DO UPDATE
       SET encrypted_phone = EXCLUDED.encrypted_phone, claimed = true,
           claim_ts = COALESCE(identity_vault.claim_ts, now())`,
      [id, encrypt(phone)],
    );
    report.claimed = true;

    await client.query("COMMIT");
    return report;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
