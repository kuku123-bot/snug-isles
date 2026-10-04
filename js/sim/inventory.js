// Inventory helpers: slot arrays hold {id, n} or null. Pure functions over arrays.
import { ITEMS } from '../data/items.js';

export const stackMax = (id) => (ITEMS[id] ? ITEMS[id].stack : 99);
export const makeInv = (n) => new Array(n).fill(null);

/** Does an item satisfy an ingredient token ('@fish' = any fish) */
export function matchesToken(token, itemId) {
  if (token === itemId) return true;
  if (token === '@fish') return !!(ITEMS[itemId] && ITEMS[itemId].fish);
  return false;
}

export function invCount(inv, token) {
  let n = 0;
  for (const s of inv) if (s && matchesToken(token, s.id)) n += s.n;
  return n;
}

/** Try to add; returns the number that did NOT fit. */
export function invAdd(inv, id, n) {
  const max = stackMax(id);
  for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i];
    if (s && s.id === id && s.n < max) {
      const k = Math.min(max - s.n, n);
      s.n += k; n -= k;
    }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) {
      const k = Math.min(max, n);
      inv[i] = { id, n: k }; n -= k;
    }
  }
  return n;
}

export function invRoomFor(inv, id, n) {
  const max = stackMax(id);
  let room = 0;
  for (const s of inv) {
    if (!s) room += max;
    else if (s.id === id) room += max - s.n;
    if (room >= n) return true;
  }
  return room >= n;
}

/** Remove n of token; returns true on success (all-or-nothing). */
export function invRemove(inv, token, n) {
  if (invCount(inv, token) < n) return false;
  for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i];
    if (s && matchesToken(token, s.id)) {
      const k = Math.min(s.n, n);
      s.n -= k; n -= k;
      if (s.n <= 0) inv[i] = null;
    }
  }
  return true;
}

/** cost: {token: n}. */
export function canAfford(inv, cost, mult = 1) {
  for (const k in cost) if (invCount(inv, k) < Math.ceil(cost[k] * mult)) return false;
  return true;
}
export function spend(inv, cost, mult = 1) {
  if (!canAfford(inv, cost, mult)) return false;
  for (const k in cost) invRemove(inv, k, Math.ceil(cost[k] * mult));
  return true;
}
export function missing(inv, cost, mult = 1) {
  const out = [];
  for (const k in cost) { const need = Math.ceil(cost[k] * mult), have = invCount(inv, k); if (have < need) out.push([k, need - have]); }
  return out;
}

/** Can all of `items` ({id:n}) fit? (used before awarding crafts) */
export function canHold(inv, items) {
  const tmp = inv.map((s) => (s ? { id: s.id, n: s.n } : null));
  for (const id in items) if (invAdd(tmp, id, items[id]) > 0) return false;
  return true;
}

export function resizeInv(inv, n) {
  while (inv.length < n) inv.push(null);
  return inv;
}

export function compact(inv) {
  // merge stacks and sort by item category order then id (used by "sort" button)
  const totals = new Map();
  for (const s of inv) if (s) totals.set(s.id, (totals.get(s.id) || 0) + s.n);
  const order = ['tool', 'weapon', 'armor', 'charm', 'potion', 'food', 'seed', 'mat', 'res', 'misc'];
  const ids = [...totals.keys()].sort((a, b) => {
    const ca = order.indexOf(ITEMS[a].cat), cb = order.indexOf(ITEMS[b].cat);
    return ca - cb || a.localeCompare(b);
  });
  for (let i = 0; i < inv.length; i++) inv[i] = null;
  for (const id of ids) invAdd(inv, id, totals.get(id));
}
