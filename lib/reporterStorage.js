// Local-device storage helpers for reporter report tokens.
//
// Tokens live only in this device's localStorage under MINE_KEY so reporters
// can check review status and claim rewards without creating an account.
//
// Privacy rules:
//   - "Hide" only covers what is shown on screen; it NEVER clears MINE_KEY or
//     the offline IndexedDB queue.
//   - "Remove from this device" removes a single report's token via removeMine()
//     while leaving the report itself on the NEMA server and leaving other
//     reports on this device untouched.

export const MINE_KEY = "ww_mine";

function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function getMine(storage = defaultStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MINE_KEY);
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items.filter(
      (item) =>
        item && typeof item.id === "string" && typeof item.token === "string",
    );
  } catch {
    return [];
  }
}

export function addMine(report, storage = defaultStorage()) {
  if (
    !storage ||
    !report ||
    typeof report.id !== "string" ||
    typeof report.token !== "string"
  ) {
    return getMine(storage);
  }
  const existing = getMine(storage).filter((item) => item.id !== report.id);
  const next = [...existing, { id: report.id, token: report.token }];
  try {
    storage.setItem(MINE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function removeMine(id, storage = defaultStorage()) {
  if (!storage || typeof id !== "string") return getMine(storage);
  const next = getMine(storage).filter((item) => item.id !== id);
  try {
    storage.setItem(MINE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function tokenFor(id, storage = defaultStorage()) {
  if (typeof id !== "string") return undefined;
  return getMine(storage).find((item) => item.id === id)?.token;
}
