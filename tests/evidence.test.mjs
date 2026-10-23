import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import { verifyEvidence, evidenceString } from "../lib/evidence.js";

// Sign exactly the way the phone does (lib/device.js + page send()).
async function signLikePhone(core, keyPair) {
  const text = JSON.stringify(core);
  const sig = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    keyPair.privateKey,
    new TextEncoder().encode(text),
  );
  const spki = await webcrypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    signature: Buffer.from(sig).toString("base64"),
    publicKey: Buffer.from(spki).toString("base64"),
    hash: createHash("sha256").update(text).digest("hex"),
  };
}

const newKey = () =>
  webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);

const base = {
  photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  lat: 0.347596,
  lng: 32.58252,
  acc: 12.5,
  ts: 1792700000123,
};

test("the server rebuilds the same string the phone signs", () => {
  assert.equal(
    evidenceString(base),
    JSON.stringify([base.photo, base.lat, base.lng, base.acc, base.ts]),
  );
  // The phone puts pos.acc straight into the array; undefined becomes null.
  assert.equal(
    evidenceString({ ...base, acc: null }),
    JSON.stringify([base.photo, base.lat, base.lng, undefined, base.ts]),
  );
});

test("a report signed on the phone verifies", async () => {
  const key = await newKey();
  const s = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], key);
  assert.equal(await verifyEvidence({ ...base, ...s }), "verified");
});

test("a photo location with no accuracy still verifies", async () => {
  const key = await newKey();
  const s = await signLikePhone([base.photo, base.lat, base.lng, undefined, base.ts], key);
  assert.equal(await verifyEvidence({ ...base, acc: null, ...s }), "verified");
});

test("the same device key signs many reports", async () => {
  const key = await newKey();
  for (const lat of [0.1, 0.2, 0.3]) {
    const s = await signLikePhone([base.photo, lat, base.lng, base.acc, base.ts], key);
    assert.equal(await verifyEvidence({ ...base, lat, ...s }), "verified");
  }
});

test("changed evidence is invalid", async () => {
  const key = await newKey();
  const s = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], key);
  assert.equal(await verifyEvidence({ ...base, lat: base.lat + 0.01, ...s }), "invalid");
  assert.equal(await verifyEvidence({ ...base, ts: base.ts + 1, ...s }), "invalid");
  assert.equal(await verifyEvidence({ ...base, photo: base.photo + "A", ...s }), "invalid");
});

test("a signature checked against another device's key is invalid", async () => {
  const s = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], await newKey());
  const other = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], await newKey());
  assert.equal(
    await verifyEvidence({ ...base, signature: s.signature, publicKey: other.publicKey, hash: s.hash }),
    "invalid",
  );
});

test("a hash that does not match is invalid even with a good signature", async () => {
  const key = await newKey();
  const s = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], key);
  assert.equal(await verifyEvidence({ ...base, ...s, hash: "0".repeat(64) }), "invalid");
});

test("the hash is optional when the phone could not make one", async () => {
  const key = await newKey();
  const s = await signLikePhone([base.photo, base.lat, base.lng, base.acc, base.ts], key);
  assert.equal(await verifyEvidence({ ...base, ...s, hash: "unavailable" }), "verified");
});

test("no signature is unsigned; garbage is invalid", async () => {
  assert.equal(await verifyEvidence({ ...base }), "unsigned");
  assert.equal(await verifyEvidence({ ...base, signature: null, publicKey: null }), "unsigned");
  assert.equal(await verifyEvidence({ ...base, signature: "abc", publicKey: "not base64!" }), "invalid");
  assert.equal(await verifyEvidence({ ...base, signature: "AAAA", publicKey: "AAAA" }), "invalid");
});
