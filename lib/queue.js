// Offline queue in IndexedDB: reports wait on the phone until there is signal.
const DB = "ww", STORE = "queue";
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "clientId" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(req && req.result); };
    t.onerror = t.onabort = () => { db.close(); rej(t.error); };
  });
}
export const queuePut = (item) => run("readwrite", (s) => s.put(item));
export const queueAll = () => run("readonly", (s) => s.getAll()).then((x) => x || []);
export const queueDelete = (id) => run("readwrite", (s) => s.delete(id));