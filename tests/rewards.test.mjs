import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rewardAvailable } from "../lib/rewards.js";
import { evidenceHash, evidenceString } from "../lib/evidence.js";

const reviewed = { status: "viewed" };

test("no reward before an officer reviews the report", () => {
  assert.equal(rewardAvailable({ status: "new", category: "Emergency" }), false);
});

test("being reviewed alone does not unlock a reward", () => {
  assert.equal(rewardAvailable({ ...reviewed, category: null }), false);
});

test("Emergency, Enforcement and Referral unlock a reward", () => {
  for (const category of ["Emergency", "Enforcement", "Referral"]) {
    assert.equal(rewardAvailable({ ...reviewed, category }), true, category);
  }
});

test("Duplicate and Insufficient reports earn no reward", () => {
  assert.equal(rewardAvailable({ ...reviewed, category: "Duplicate" }), false);
  assert.equal(rewardAvailable({ ...reviewed, category: "Insufficient" }), false);
});

test("a report marked false earns no reward, even if verified first", () => {
  assert.equal(rewardAvailable({ ...reviewed, category: "Enforcement", markedFalse: true }), false);
});

test("no report, no reward", () => {
  assert.equal(rewardAvailable(null), false);
});

test("the server's evidence hash equals the one a phone makes", () => {
  const core = { photo: "data:image/jpeg;base64,AAAA", lat: 0.34, lng: 32.54, acc: 8, ts: 1762851600000 };
  const phone = createHash("sha256")
    .update(JSON.stringify([core.photo, core.lat, core.lng, core.acc, core.ts]))
    .digest("hex");
  assert.equal(evidenceHash(core), phone);
  assert.equal(evidenceString(core), JSON.stringify([core.photo, core.lat, core.lng, core.acc, core.ts]));
});

test("reports from phones without a hash still get different stored hashes", () => {
  const a = evidenceHash({ photo: "data:image/jpeg;base64,AAAA", lat: 0.34, lng: 32.54, acc: null, ts: 1 });
  const b = evidenceHash({ photo: "data:image/jpeg;base64,BBBB", lat: 0.34, lng: 32.54, acc: null, ts: 1 });
  assert.notEqual(a, b);
});
