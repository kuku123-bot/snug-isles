// The Marketplace (host side): the day's random goods (shared by both players), buying with the shared coins, restocking.
// The stock lives in world.shared.shop = { day, rr, items: [[id, n, price, tag]] }; every change is sent to the other player as a 'shop' event.
import { TILE } from '../util.js';
import { ITEMS } from '../data/items.js';
import { BUILD } from '../data/build.js';
import { genStock, restockCost } from '../data/shop.js';
import { invAdd, invRoomFor } from './inventory.js';
import { touch } from './player.js';

const REACH = 7 * TILE;

/** the nearest piece that trades (a Market Stall or a Marketplace) within reach: { thing, def } or null; the Marketplace wins when both are close */
export function marketNear(w, p) {
  let best = null;
  for (const t of w.thingsNear(p.x, p.y - 6, REACH)) {
    const d = BUILD[t.type];
    if (!d || (d.behavior !== 'market' && d.behavior !== 'shop')) continue;
    if (!best || (d.behavior === 'shop' && best.def.behavior !== 'shop')) best = { thing: t, def: d };
  }
  return best;
}
/** what selling is worth there compared to a Market Stall */
export const sellBonusOf = (near) => (near && near.def.conf && near.def.conf.sellBonus) || 1;

function put(sim, shop) { sim.world.shared.shop = shop; sim.world.emit(['shop', shop]); return shop; }

/** today's shelves: made when first needed each day (and again when the day turns, so both players always see the same ones) */
export function ensureShop(sim) {
  const w = sim.world, s = w.shared.shop;
  if (s && s.day === w.day) return s;
  return put(sim, genStock(w.seed, w.day, 0, w.techs.size));
}
export function newDayShop(sim) { if (sim.world.shared.shop) put(sim, genStock(sim.world.seed, sim.world.day, 0, sim.world.techs.size)); }

export function doBuy(sim, p, cmd) {
  const w = sim.world;
  const near = marketNear(w, p);
  if (!near || near.def.behavior !== 'shop') return sim.toast(p.pid, 'Stand near the Marketplace.', 'warn');
  const shop = ensureShop(sim), i = cmd.i | 0, e = shop.items[i];
  if (!e || e[0] !== cmd.item) return sim.toast(p.pid, 'The shelves just changed. Have another look!', 'info');
  const n = Math.max(1, Math.min(cmd.n | 0 || 1, e[1]));
  if (e[1] <= 0) return sim.toast(p.pid, 'Sold out!', 'info');
  const cost = e[2] * n;
  if (w.coins < cost) return sim.toast(p.pid, `Not enough coins (${cost} needed).`, 'warn');
  if (!invRoomFor(p.inv, e[0], n)) return sim.toast(p.pid, 'Your bag is full!', 'warn');
  invAdd(p.inv, e[0], n);
  w.coins -= cost;
  e[1] -= n;
  sim.bump('bought', n);
  w.emit(['coins', w.coins]);
  w.fx('coin', p.x, p.y - 14, -cost);
  touch(p);
  put(sim, shop);
  sim.toast(p.pid, `Bought ${n} ${ITEMS[e[0]].name}`, 'good');
}

export function doRestock(sim, p) {
  const w = sim.world, near = marketNear(w, p);
  if (!near || near.def.behavior !== 'shop') return sim.toast(p.pid, 'Stand near the Marketplace.', 'warn');
  const shop = ensureShop(sim), cost = restockCost(shop.rr, w.techs.size);
  if (w.coins < cost) return sim.toast(p.pid, `A new selection costs ${cost} coins.`, 'warn');
  w.coins -= cost;
  w.emit(['coins', w.coins]);
  put(sim, genStock(w.seed, w.day, shop.rr + 1, w.techs.size));
  sim.toast(p.pid, 'The shelves are full of new goods!', 'good');
}
