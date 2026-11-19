import test from "node:test";
import assert from "node:assert/strict";
import { fingerprint, normalizePhone, encrypt } from "../lib/crypto.js";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.PHONE_ENCRYPTION_KEY = TEST_KEY;
process.env.PHONE_FINGERPRINT_KEY = TEST_KEY;

test("normalizePhone standardizes Ugandan numbers", () => {
  assert.equal(normalizePhone("0772123456"), "256772123456");
  assert.equal(normalizePhone("772123456"), "256772123456");
  assert.equal(normalizePhone("+256772123456"), "256772123456");
  assert.equal(normalizePhone("256772123456"), "256772123456");
  assert.equal(normalizePhone("077-212-3456"), "256772123456");
  assert.equal(normalizePhone(""), "");
});

test("fingerprint produces deterministic HMAC-SHA-256 keyed fingerprints", () => {
  const fp1 = fingerprint("0772123456");
  const fp2 = fingerprint("+256772123456");
  const fpDiff = fingerprint("0782999999");

  // Same phone with different formatting produces identical fingerprint
  assert.equal(fp1, fp2);
  assert.equal(typeof fp1, "string");
  assert.equal(fp1.length, 64); // hex-encoded SHA-256 HMAC

  // Different phone produces different fingerprint
  assert.notEqual(fp1, fpDiff);
});

test("encrypt still uses non-deterministic AES-256-GCM ciphertexts", () => {
  const enc1 = encrypt("0772123456");
  const enc2 = encrypt("0772123456");
  // AES-256-GCM uses random IV so ciphertexts differ
  assert.notEqual(enc1, enc2);
});
