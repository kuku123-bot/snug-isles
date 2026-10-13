// What this player owns from the Supporter Shop, remembered on this device (and found again from the blockchain with "Restore purchases"),
// and which cosmetics they chose to wear. Small and forgiving: if storage is not available everything still works, nothing is remembered.
import { SKU_BY_ID, COS, COS_ALL, maskOf } from '../data/store.js';

const OWN = 'snug.owned', WORN = 'snug.worn';
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

/** { sku: { sig, buyer } } of what is owned */
export function getOwned() {
  const o = read(OWN, {}), out = {};
  for (const id in o) if (SKU_BY_ID[id]) out[id] = o[id];
  return out;
}
export function addOwned(sku, sig, buyer) { if (!SKU_BY_ID[sku]) return; const o = getOwned(); o[sku] = { sig, buyer }; write(OWN, o); }
export const ownsSku = (sku) => !!getOwned()[sku];

/** the cosmetic bits you own (an owned pack gives all four) */
export const ownedMask = () => maskOf(Object.keys(getOwned()));
/** the bits you chose to hide (nothing hidden by default) */
const hidden = () => read(WORN, { hide: 0 }).hide | 0;
/** what you wear right now: owned and not hidden (this is what other players see) */
export const wornMask = () => ownedMask() & ~hidden() & COS_ALL;
export function setWorn(bit, on) { const h = hidden(); write(WORN, { hide: on ? h & ~bit : h | bit }); }
export { COS };
