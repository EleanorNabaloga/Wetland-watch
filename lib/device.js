// lib/device.js
//
// Each phone keeps ONE anonymous ECDSA P-256 key pair, stored in the browser
// (IndexedDB) on that phone. It is not linked to a name or phone number. Using
// the same key for every report lets NEMA:
//   - verify that a report's evidence was not changed after it was signed, and
//   - build a trust score per device, so repeat false reporters are penalised
//     and one device cannot dominate a hotspot.
//
// The private key is created non-extractable: page code can sign with it but
// can never read it out. If the browser can't store keys (private mode, very
// old browser), a one-off key is used for that report instead.

const DB_NAME = "kuuma_device";
const STORE = "keys";
const KEY_ID = "device";

const ALGO = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: { name: "SHA-256" } };

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

const newKeyPair = () => window.crypto.subtle.generateKey(ALGO, false, ["sign", "verify"]);

let cached = null;

/** This phone's key pair: loaded from IndexedDB, or created and saved once. */
async function deviceKeyPair() {
  if (cached) return cached;
  try {
    const db = await openDb();
    try {
      let pair = await idb(db, "readonly", (s) => s.get(KEY_ID));
      if (!pair || !pair.privateKey || !pair.publicKey) {
        pair = await newKeyPair();
        // add() fails if another tab saved a key first; then use that one.
        await idb(db, "readwrite", (s) => s.add(pair, KEY_ID)).catch(() => undefined);
        pair = (await idb(db, "readonly", (s) => s.get(KEY_ID))) || pair;
      }
      cached = pair;
      return pair;
    } finally {
      db.close();
    }
  } catch {
    return newKeyPair(); // storage unavailable: one-off key for this report
  }
}

const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/**
 * Signs JSON.stringify(evidenceArray) with this phone's key.
 * The server rebuilds the same string in lib/evidence.js and checks it.
 */
export async function signEvidence(evidenceArray) {
  const keyPair = await deviceKeyPair();
  const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const data = new TextEncoder().encode(JSON.stringify(evidenceArray));
  const signature = await window.crypto.subtle.sign(SIGN, keyPair.privateKey, data);
  return { signature: toBase64(signature), publicKey: toBase64(publicKey) };
}
