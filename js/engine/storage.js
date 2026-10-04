// Persistence: IndexedDB for worlds (big), localStorage for small settings/profile. Everything wrapped in try/catch
// because Safari private mode / blocked storage must never crash the game.
const DB_NAME = 'snug-isles', DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['worlds', 'meta', 'kv']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('db blocked'));
  });
}

class Store {
  constructor() { this.dbp = null; this.mem = { worlds: new Map(), meta: new Map(), kv: new Map() }; this.useMem = false; }
  db() { if (!this.dbp) this.dbp = openDB().catch((e) => { console.warn('IndexedDB unavailable, using memory only', e); this.useMem = true; return null; }); return this.dbp; }
  async _tx(store, mode, fn) {
    const db = await this.db();
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const st = tx.objectStore(store);
      let result;
      const r = fn(st);
      if (r && typeof r.onsuccess !== 'undefined') r.onsuccess = () => { result = r.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async get(store, key) { const db = await this.db(); if (!db) return this.mem[store].get(key); return this._tx(store, 'readonly', (s) => s.get(key)); }
  async put(store, key, val) { const db = await this.db(); if (!db) { this.mem[store].set(key, val); return; } return this._tx(store, 'readwrite', (s) => s.put(val, key)); }
  async del(store, key) { const db = await this.db(); if (!db) { this.mem[store].delete(key); return; } return this._tx(store, 'readwrite', (s) => s.delete(key)); }
  async all(store) {
    const db = await this.db();
    if (!db) return [...this.mem[store].entries()];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly'), st = tx.objectStore(store), out = [];
      const req = st.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
      req.onerror = () => reject(req.error);
    });
  }
}
export const store = new Store();

export async function saveWorldRecord(id, data, meta) {
  await store.put('worlds', id, JSON.stringify(data));
  await store.put('meta', id, meta);
}
export async function loadWorldRecord(id) {
  const s = await store.get('worlds', id);
  return s ? JSON.parse(s) : null;
}
export async function listWorlds() {
  const rows = await store.all('meta');
  return rows.map(([id, meta]) => ({ id, ...meta })).sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
export async function deleteWorld(id) { await store.del('worlds', id); await store.del('meta', id); }
export async function requestPersistence() { try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* fine */ } }

// ---- small json settings in localStorage
export function lsGet(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
export function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
export function uid() { const a = new Uint8Array(8); (crypto || window.crypto).getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); }
