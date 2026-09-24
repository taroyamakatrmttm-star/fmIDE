// The apps' browser storage (src/shared/store.js): one IndexedDB database per app
// ('fmIDE', 'fmIDE-ExcelExporter'), one object store 'kv' of string values.
// Read straight from the page, the same way the tests used to read localStorage.

const DB = { fmIDE: 'fmIDE', ExcelExporter: 'fmIDE-ExcelExporter' };

// All key → value pairs in an app's database whose key starts with `prefix`.
function storedEntries(page, app, prefix = ''){
  return page.evaluate(({ name, prefix }) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('kv')){ db.close(); resolve({}); return; }
      const out = {};
      const cur = db.transaction('kv').objectStore('kv').openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if(!c){ db.close(); resolve(out); return; }
        if(String(c.key).startsWith(prefix)) out[c.key] = c.value;
        c.continue();
      };
      cur.onerror = () => reject(cur.error);
    };
  }), { name: DB[app], prefix });
}

async function storedKeys(page, app, prefix = ''){
  return Object.keys(await storedEntries(page, app, prefix));
}

// Make every IndexedDB write fail as if the browser's storage were full, and undo that.
function breakStorage(page){
  return page.evaluate(() => {
    window.__realIdbPut = window.__realIdbPut || IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(){ throw new DOMException('full', 'QuotaExceededError'); };
  });
}
function fixStorage(page){
  return page.evaluate(() => { IDBObjectStore.prototype.put = window.__realIdbPut; });
}

// Tell the page it has been hidden (switching tab, minimising, closing).
function hidePage(page){
  return page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
}

module.exports = { storedEntries, storedKeys, breakStorage, fixStorage, hidePage };
