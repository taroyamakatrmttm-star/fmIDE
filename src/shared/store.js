// ---------- browser storage (shared: src/shared/store.js, used by both apps) ----------
// createStore(dbName): a small promise-based key–value store on IndexedDB, one database
// per app, one object store ('kv'). Values are mostly strings (the apps store JSON text,
// exactly what they used to keep in localStorage); IndexedDB also keeps other values the
// browser can store, such as file handles. Where IndexedDB is missing or will not open
// (some browsers block it for pages opened from disk, or in private windows) the same
// calls fall back to localStorage, so the app keeps working — it never fails for that.
//   ready                        resolves once the store is usable (never rejects)
//   get(key)                     the stored value, or null
//   put(key, value)              rejects with the browser's error (e.g. QuotaExceededError,
//                                or DataCloneError for a value it cannot store); on the
//                                localStorage fallback, anything but a string is refused
//   canStoreObjects()            whether put accepts more than strings (after ready)
//   remove(key)
//   keys(prefix)                 every stored key that starts with prefix
//   migrateFromLocalStorage(fn)  once per browser: copy localStorage keys for which fn(key)
//                                is true into IndexedDB (never over a key already there);
//                                the localStorage copies are kept
//   requestPersistence()         ask the browser once, ever, to keep this app's data
//                                (navigator.storage.persist); the answer is remembered
export function createStore(dbName){
  const KV = 'kv';
  const META_MIGRATED = dbName + '/migrated-from-localStorage';
  const META_PERSIST = dbName + '/persistence-requested';
  let db = null;   // the open IndexedDB database, or null when using localStorage

  const ready = new Promise(resolve => {
    let settled = false;
    const done = (openDb) => {
      if(settled){ if(openDb) openDb.close(); return; }
      settled = true;
      db = openDb || null;
      if(db) db.onversionchange = () => { db.close(); };
      resolve();
    };
    let req;
    try{
      if(!window.indexedDB){ done(null); return; }
      req = window.indexedDB.open(dbName, 1);
    }catch(err){ done(null); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(KV); };
    req.onsuccess = () => done(req.result);
    req.onerror = (ev) => { if(ev && ev.preventDefault) ev.preventDefault(); done(null); };
    // A browser that never answers must not hold the app up.
    setTimeout(() => done(null), 5000);
  });

  // Runs fn(objectStore) in one transaction; resolves with the result of the request fn
  // returns (if any) once the transaction has committed.
  function run(mode, fn){
    return ready.then(() => new Promise((resolve, reject) => {
      let result;
      try{
        const t = db.transaction(KV, mode);
        t.oncomplete = () => resolve(result);
        t.onabort = t.onerror = () => reject(t.error || new DOMException('The browser did not store the data.', 'UnknownError'));
        const r = fn(t.objectStore(KV));
        if(r) r.onsuccess = () => { result = r.result; };
      }catch(err){ reject(err); }
    }));
  }

  function get(key){
    return ready.then(() => db
      ? run('readonly', s => s.get(key)).then(v => (v === undefined ? null : v))
      : localStorage.getItem(key));
  }
  function put(key, value){
    return ready.then(() => {
      if(db) return run('readwrite', s => { s.put(value, key); });
      if(typeof value !== 'string') throw new TypeError('Only text can be stored in this browser.');
      localStorage.setItem(key, value);
    });
  }
  function remove(key){
    return ready.then(() => db ? run('readwrite', s => { s.delete(key); }) : localStorage.removeItem(key));
  }
  function keys(prefix){
    return ready.then(() => {
      if(db) return run('readonly', s => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')))
        .then(ks => (ks || []).filter(k => typeof k === 'string' && k.startsWith(prefix)));
      const out = [];
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(k !== null && k.startsWith(prefix)) out.push(k);
      }
      return out;
    });
  }

  // The marker makes this happen once: without it, a key deleted later (e.g. a layout
  // reset) would be copied back from the old localStorage copy on the next start.
  function migrateFromLocalStorage(match){
    return ready.then(() => {
      if(!db) return 0; // already using localStorage: nothing to move
      return get(META_MIGRATED).then(migrated => {
        if(migrated) return 0;
        const items = [];
        try{
          for(let i = 0; i < localStorage.length; i++){
            const k = localStorage.key(i);
            if(k !== null && match(k)){ const v = localStorage.getItem(k); if(v !== null) items.push([k, v]); }
          }
        }catch(err){ /* localStorage unavailable: nothing to move */ }
        let copied = 0;
        return run('readwrite', s => {
          items.forEach(([k, v]) => {
            const r = s.get(k);
            r.onsuccess = () => { if(r.result === undefined){ s.put(v, k); copied++; } };
          });
          s.put(new Date().toISOString(), META_MIGRATED);
        }).then(() => copied);
      });
    }).catch(() => 0); // a failed copy leaves the old data where it was; try again next start
  }

  let persistenceRequested = false;
  function requestPersistence(){
    if(persistenceRequested) return;
    persistenceRequested = true;
    const sm = navigator.storage;
    if(!sm || typeof sm.persist !== 'function') return;
    get(META_PERSIST).then(asked => {
      if(asked) return;
      return Promise.resolve(sm.persist()).then(granted =>
        put(META_PERSIST, JSON.stringify({ granted: !!granted, at: new Date().toISOString() })));
    }).catch(() => { /* silent */ });
  }

  return { ready, get, put, remove, keys, migrateFromLocalStorage, requestPersistence, canStoreObjects: () => !!db };
}
