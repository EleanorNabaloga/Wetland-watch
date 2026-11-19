import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MINE_KEY,
  getMine,
  addMine,
  removeMine,
  tokenFor,
} from "../lib/reporterStorage.js";

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test("addMine stores report tokens and deduplicates by report id", () => {
  const storage = createMemoryStorage();
  addMine({ id: "R-1", token: "tok-1" }, storage);
  addMine({ id: "R-2", token: "tok-2" }, storage);
  addMine({ id: "R-1", token: "tok-1-new" }, storage);

  const items = getMine(storage);
  assert.equal(items.length, 2);
  assert.equal(tokenFor("R-1", storage), "tok-1-new");
  assert.equal(tokenFor("R-2", storage), "tok-2");
});

test("getMine handles missing, corrupt, and non-array storage safely", () => {
  assert.deepEqual(getMine(createMemoryStorage()), []);
  assert.deepEqual(getMine(createMemoryStorage({ [MINE_KEY]: "not-json" })), []);
  assert.deepEqual(getMine(createMemoryStorage({ [MINE_KEY]: "{}" })), []);
  assert.deepEqual(getMine(createMemoryStorage({ [MINE_KEY]: "null" })), []);
});

test("Hide switches only what is on screen and preserves tokens and offline queue", () => {
  const source = fs.readFileSync(
    path.resolve("components/ReporterApp.js"),
    "utf8",
  );
  const panicMatch = source.match(
    /const handlePanic = useCallback\(\(\) => \{[\s\S]*?\}, \[stopGps\]\);/,
  );
  assert.ok(panicMatch, "handlePanic handler should exist in ReporterApp.js");
  const body = panicMatch[0];

  assert.match(body, /setPanicked\(true\)/, "Hide must show the decoy screen");
  assert.doesNotMatch(
    body,
    /localStorage\.removeItem|removeMine|clearOfflineReport|setMine\(\[\]\)/,
    "Hide must not delete saved report tokens or clear the offline queue",
  );

  // Also verify background polling pauses while hidden
  assert.match(
    source,
    /if \(panicked\) return;/,
    "Background polling should pause while the decoy screen is active",
  );
});

test("Remove from this device deletes only the chosen report token and keeps other reports intact", () => {
  const storage = createMemoryStorage();
  addMine({ id: "R-1", token: "tok-1" }, storage);
  addMine({ id: "R-2", token: "tok-2" }, storage);
  addMine({ id: "R-3", token: "tok-3" }, storage);

  const remaining = removeMine("R-2", storage);
  assert.equal(remaining.length, 2);
  assert.equal(tokenFor("R-2", storage), undefined);
  assert.equal(tokenFor("R-1", storage), "tok-1");
  assert.equal(tokenFor("R-3", storage), "tok-3");

  // Removing a non-existent report id leaves remaining tokens unchanged
  const afterMissing = removeMine("R-999", storage);
  assert.equal(afterMissing.length, 2);
  assert.equal(tokenFor("R-1", storage), "tok-1");
  assert.equal(tokenFor("R-3", storage), "tok-3");

  // Verify the UI includes the separate confirmed Remove from this device flow
  const source = fs.readFileSync(
    path.resolve("components/ReporterApp.js"),
    "utf8",
  );
  assert.match(source, /handleRemoveFromDevice/);
  assert.match(source, /remove\.btn/);
  assert.match(source, /remove\.warn/);
  assert.match(source, /removeMine\(id\)/);
});
