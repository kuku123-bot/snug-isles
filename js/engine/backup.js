// World backup files: a plain JSON file the players can keep anywhere (Files app, AirDrop, Messages…). Pure functions, no DOM.
import { restoreWorld, SAVE_VERSION } from '../sim/serialize.js';

export const BACKUP_KIND = 'snug-isles-world';
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;

export function makeBackup(data, meta, appVersion) {
  // the backup-connection secret belongs to the live session, not to a file that may travel
  const clean = { ...data, shared: { ...(data.shared || {}), flags: { ...((data.shared && data.shared.flags) || {}) } } };
  delete clean.shared.flags.relayKey; delete clean.shared.flags.room;
  return { kind: BACKUP_KIND, format: 1, saveVersion: SAVE_VERSION, app: appVersion, exported: Date.now(), meta: { ...meta, id: undefined }, data: clean };
}

/** Read and validate a backup file's text. Throws an Error with a human-readable message when it is not usable. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('That file is too big to be a Snug Isles world.');
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('That is not a Snug Isles backup file.'); }
  if (!o || o.kind !== BACKUP_KIND || !o.data || typeof o.data !== 'object') throw new Error('That is not a Snug Isles backup file.');
  if (o.saveVersion > SAVE_VERSION || o.data.v > SAVE_VERSION) throw new Error('This backup was made by a newer version of the game. Reload the page to update, then try again.');
  const d = o.data;
  if (!(Number.isInteger(d.gw) && d.gw >= 3 && d.gw <= 15)) throw new Error('This backup looks damaged (bad world size).');
  try { restoreWorld(d, { withSim: false }); } catch (e) { throw new Error('This backup looks damaged and could not be opened.'); }
  return { data: d, meta: o.meta || {} };
}

export function backupFileName(name, day) {
  const safe = String(name || 'Our Isles').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'world';
  return `snug-isles-${safe}-day${day || 1}.json`;
}
