/* Minimal IndexedDB wrapper so local (lossless) files and offline downloads
   survive a reload. */
const DB = "grabit";
const FILES = "files";
const DOWNLOADS = "downloads";
const VERSION = 2;

function open() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("no idb"));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILES)) {
        db.createObjectStore(FILES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DOWNLOADS)) {
        db.createObjectStore(DOWNLOADS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const out = fn(store);
        t.oncomplete = () => resolve(out?.result ?? out);
        t.onerror = () => reject(t.error);
      })
  );
}

/* ---- local files (user imports) ---- */
export const putFile = (rec) =>
  tx(FILES, "readwrite", (s) => {
    s.put(rec);
  });
export const allFiles = () =>
  tx(FILES, "readonly", (s) => s.getAll()).then((r) => r || []);
export const delFile = (id) =>
  tx(FILES, "readwrite", (s) => {
    s.delete(id);
  });
export const clearFiles = () =>
  tx(FILES, "readwrite", (s) => {
    s.clear();
  });

/* ---- offline downloads ---- */
export const putDownload = (rec) =>
  tx(DOWNLOADS, "readwrite", (s) => {
    s.put(rec);
  });
export const allDownloads = () =>
  tx(DOWNLOADS, "readonly", (s) => s.getAll()).then((r) => r || []);
export const delDownload = (id) =>
  tx(DOWNLOADS, "readwrite", (s) => {
    s.delete(id);
  });
export const clearDownloads = () =>
  tx(DOWNLOADS, "readwrite", (s) => {
    s.clear();
  });