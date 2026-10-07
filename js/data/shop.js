// The Marketplace: a fresh random selection of goods every day, bought with coins. Pure (Node + browser) so the stock is the same for both players
// and easy to test. An entry is [itemId, howMany, priceEach, tag]; tag 0 = plain, 1 = a deal (cheaper), 2 = a rare find.
import { ITEMS } from './items.js';
import { RNG, hash32, clamp } from '../util.js';

export const SHOP_SLOTS = 9;      // plain listings (a deal is one of them), plus one rare find
export const TAG_DEAL = 1, TAG_RARE = 2;

// how likely each kind of goods is to turn up, and what the Marketplace asks compared to what the Market Stall pays for it
const WEIGHT = { res: 3, mat: 2.2, food: 2.2, seed: 0.8, potion: 1.1, bomb: 1.4, charm: 0.5, tool: 0.5, weapon: 0.6, armor: 0.6 };
const MARKUP = { res: 3, mat: 3, food: 3, seed: 4, potion: 3.5, bomb: 3.5, charm: 4, tool: 3.5, weapon: 3.5, armor: 3.5 };
const EGG_PRICE = 360;

/** what one of this item costs at the Marketplace (0 = not for sale there) */
export function buyPrice(id) {
  const it = ITEMS[id];
  if (!it || !(it.sell > 0) || !(it.cat in MARKUP)) return id === 'pet_egg' ? EGG_PRICE : 0;
  return Math.max(2, Math.ceil(it.sell * MARKUP[it.cat]));
}

/** the dearest thing (by its selling value) the Marketplace will stock: it grows with what you have researched, so the shop keeps up with you */
export const shopCap = (techCount) => 40 + 16 * techCount;

/** a new day's goods. The same seed, day and restock count always give the same shelves. */
export function genStock(seed, day, restocks, techCount) {
  const rng = new RNG(hash32(seed, day, 7700 + restocks * 31)), cap = shopCap(techCount);
  const plain = [], rare = [];
  for (const id in ITEMS) {
    const it = ITEMS[id], p = buyPrice(id);
    if (!p) continue;
    if (id === 'pet_egg' || it.cat === 'charm' || (it.cat === 'res' && it.sell >= 40)) { if (id === 'pet_egg' || it.sell <= cap * 2) rare.push(id); }
    if (it.sell > cap || it.cat === 'charm') continue;
    plain.push([id, (WEIGHT[it.cat] || 1) / (1 + it.sell / 45)]);
  }
  const items = [], used = new Set();
  const take = (list) => { const id = rng.weighted(list.filter((e) => !used.has(e[0]))); used.add(id); return id; };
  const qty = (id) => { const it = ITEMS[id], base = clamp(Math.round(64 / (4 + it.sell)), 1, 24); return it.stack === 1 || it.cat === 'tool' || it.cat === 'weapon' || it.cat === 'armor' ? 1 : Math.max(1, Math.round(base * (0.6 + rng.next() * 0.8))); };
  // the first shelf is always something worth coming for: from the dearer half of what the shop can stock at your stage
  const grand = plain.filter(([id]) => ITEMS[id].sell >= cap * 0.25);
  if (grand.length) { const id = take(grand.map(([x]) => [x, 1])); items.push([id, qty(id), buyPrice(id), 0]); }
  for (let i = items.length; i < SHOP_SLOTS && plain.length > used.size; i++) { const id = take(plain); items.push([id, qty(id), buyPrice(id), 0]); }
  if (items.length) { const d = items[rng.int(items.length)]; d[2] = Math.max(1, Math.round(d[2] * 0.65)); d[3] = TAG_DEAL; } // a deal: a third off
  if (rare.length) { const id = rng.weighted(rare.map((r) => [r, r === 'pet_egg' ? 1.2 : 1])); items.push([id, 1, buyPrice(id), TAG_RARE]); }
  return { day, rr: restocks, items };
}

/** what a fresh restock costs: it climbs with every restock today and with how far you have got */
export const restockCost = (restocks, techCount) => Math.round(25 * (1 + restocks) * (1 + techCount / 25));
