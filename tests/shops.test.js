// Lighthouses (more from resources around them, faster regrowth, new resources pop up) and the Marketplace (random daily goods to buy, selling for more).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give, freeSpot, findThing, standNear } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { NODES } from '../js/data/nodes.js';
import { ITEMS } from '../js/data/items.js';
import { TECHS } from '../js/data/techs.js';
import { footprintFor } from '../js/data/facing.js';
import { genStock, buyPrice, shopCap, restockCost, SHOP_SLOTS, TAG_DEAL, TAG_RARE } from '../js/data/shop.js';
import { invCount } from '../js/sim/inventory.js';
import { beaconAt, resourcesInCircle } from '../js/sim/beacon.js';
import { breakNode, depleteNode } from '../js/sim/gather.js';
import { marketNear } from '../js/sim/shop.js';
import { applyEvent } from '../js/net/protocol.js';
import { floorCodeOf } from '../js/sim/world.js';

const sim = (o = {}, seed = 31) => { const s = makeSim('classic', { enemyDensity: 0, pace: 1, ...o }, seed); const p = s.addPlayer('a', 'Alice'); return { sim: s, w: s.world, p }; };
const clearAround = (w, p, r) => { for (const t of [...w.things.values()]) if (Math.hypot((t.x + 0.5) * TILE - p.x, (t.y + 0.5) * TILE - p.y) < r * TILE) w.removeThing(t.id); };
const spot = (s, p, dx, dy) => [Math.floor(p.x / TILE) + dx, Math.floor(p.y / TILE) + dy];

// ------------------------------------------------------------------ lighthouses
test('three lighthouses, each bigger than the last; the old decoration is now a working one (so already-built ones start working)', () => {
  const ids = ['little_lighthouse', 'lighthouse', 'grand_lighthouse'];
  let prev = null;
  for (const id of ids) {
    const d = BUILD[id], c = d.conf;
    assert.equal(d.behavior, 'beacon', id);
    assert.ok(TECHS[d.tech], id + ' has a tech');
    if (prev) for (const k of ['radius', 'yield', 'regrow', 'cap']) assert.ok(c[k] > prev[k], `${id} has a bigger ${k}`);
    assert.ok(c.spawn > 0 && c.light === undefined);
    prev = c;
  }
  assert.deepEqual(footprintFor(BUILD.lighthouse, 0), [2, 3], 'the lighthouse keeps its old footprint, so built ones stay where they are');
  assert.equal(BUILD.lighthouse.tech, 'optics');
});

test('beaconAt: inside the circle only, the best lighthouse counts (they do not add up), depleted-by-removal gives nothing', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 14);
  const [bx, by] = spot(s, p, 0, 0);
  const a = w.addThing('lighthouse', bx, by); // radius 9, +75%
  assert.equal(beaconAt(s, bx + 4, by + 1).yield, 0.75);
  assert.equal(beaconAt(s, bx + 4, by + 1).regrow, 2);
  assert.equal(beaconAt(s, bx + 14, by).yield, 0, 'outside the circle');
  const b = w.addThing('little_lighthouse', bx + 3, by + 5); // radius 5, +30%, overlapping
  assert.equal(beaconAt(s, bx + 3, by + 4).yield, 0.75, 'the better one counts, not the sum');
  w.removeThing(a.id);
  assert.equal(beaconAt(s, bx + 4, by + 5).yield, 0.3, 'only the little one is left');
  w.removeThing(b.id);
  assert.equal(beaconAt(s, bx + 4, by + 5).yield, 0);
});

test('gathering inside a lighthouse circle gives more, and the resource grows back sooner', () => {
  const { sim: s, w, p } = sim({ resourceRespawn: 1 });
  clearAround(w, p, 16);
  const [lx, ly] = spot(s, p, 0, 0);
  w.addThing('lighthouse', lx, ly);
  const total = (tx, ty, n) => {
    let wood = 0, regrow = 0;
    for (let i = 0; i < n; i++) {
      const t = w.addThing('oak', tx, ty);
      for (const d of [...w.drops.values()]) w.drops.delete(d.id);
      breakNode(s, t, p);
      for (const d of w.drops.values()) if (d.item === 'wood') wood += d.n;
      regrow += t.t;
      w.removeThing(t.id);
    }
    return { wood, regrow };
  };
  const near = total(lx + 3, ly + 1, 150), far = total(lx + 3, ly + 14, 150);
  assert.ok(near.wood > far.wood * 1.5, `a lighthouse gives clearly more wood (${near.wood} vs ${far.wood})`);
  assert.ok(near.wood < far.wood * 2, 'but not wildly more');
  assert.ok(near.regrow < far.regrow * 0.6, `and it grows back faster (${(near.regrow / 150).toFixed(0)} s vs ${(far.regrow / 150).toFixed(0)} s)`);
});

test('a lighthouse makes new resources pop up inside its circle, only when someone is near, never past its limit, never beside your things', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 14);
  const [lx, ly] = spot(s, p, 0, 0);
  const lh = w.addThing('little_lighthouse', lx, ly), c = BUILD.little_lighthouse.conf;
  // your floor and a chest nearby: nothing may grow touching them
  const fx = lx + 3, fy = ly + 1;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (w.isTileOwned(fx + dx, fy + dy)) w.setFloor(fx + dx, fy + dy, floorCodeOf('floor_plank'));
  const before = new Set(w.things.keys());
  step(s, 1200);
  const born = [...w.things.values()].filter((t) => !before.has(t.id) && NODES[t.type]);
  assert.ok(born.length >= 2, `new resources appeared (${born.length})`);
  assert.ok(resourcesInCircle(w, lh, c.radius) <= c.cap, 'never more than the cap in the circle');
  for (const t of born) assert.ok(Math.hypot(t.x + 0.5 - (lx + 1), t.y + 0.5 - (ly + 1)) <= c.radius + 0.01, 'inside the circle');
  for (const t of born) { const i = w.idx(t.x, t.y); assert.ok(!w.floor[i], 'not on a floor'); }
  // nobody around: nothing grows
  p.online = false;
  for (const t of born) w.removeThing(t.id);
  const n0 = w.things.size;
  step(s, 600);
  assert.equal(w.things.size, n0, 'nothing grows for nobody');
});

test('pressing E on a lighthouse tells what it does; it never opens a window', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 6);
  const [lx, ly] = spot(s, p, 1, 0);
  const t = w.addThing('lighthouse', lx, ly);
  standNear(s, p, t, 0, 30);
  s.tells = []; s.exec('a', { c: 'interact', id: t.id });
  const toast = s.tells.map((x) => x[1]).find((e) => e.t === 'toast');
  assert.ok(toast && /75% more/.test(toast.text) && /9 tiles/.test(toast.text), toast && toast.text);
  assert.ok(!s.tells.some((x) => x[1].t === 'ui'));
});

// ------------------------------------------------------------------ the marketplace
test('the day\'s goods: the same every time for the same day, only real things with prices, one deal, one rare find', () => {
  const a = genStock(99, 4, 0, 12), b = genStock(99, 4, 0, 12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(genStock(99, 5, 0, 12).items, a.items, 'a new day has new goods');
  assert.notDeepEqual(genStock(99, 4, 1, 12).items, a.items, 'a restock has new goods');
  assert.equal(a.items.length, SHOP_SLOTS + 1);
  assert.equal(new Set(a.items.slice(0, SHOP_SLOTS).map((e) => e[0])).size, SHOP_SLOTS, 'no item twice on the plain shelves');
  assert.equal(a.items.filter((e) => e[3] === TAG_DEAL).length, 1);
  assert.equal(a.items.filter((e) => e[3] === TAG_RARE).length, 1);
  for (const [id, n, price, tag] of a.items) {
    assert.ok(ITEMS[id] && n >= 1 && price >= 1, id);
    if (tag === TAG_DEAL) assert.ok(price < buyPrice(id), 'a deal is cheaper than the usual price');
    else assert.equal(price, buyPrice(id));
    assert.ok(buyPrice(id) > ITEMS[id].sell || id === 'pet_egg', `${id}: the shop asks more than it pays`);
  }
});

test('the shop keeps up with you: more research, better goods', () => {
  const avg = (techs) => { let sum = 0, n = 0; for (let d = 0; d < 60; d++) for (const [id, , , tag] of genStock(5, d, 0, techs).items) if (!tag) { sum += ITEMS[id].sell; n++; } return sum / n; };
  assert.ok(avg(40) > avg(0) * 2, `${avg(0).toFixed(0)} → ${avg(40).toFixed(0)}`);
  for (let d = 0; d < 30; d++) for (const [id, , , tag] of genStock(8, d, 0, 0).items) if (tag === 0) assert.ok(ITEMS[id].sell <= shopCap(0), `${id} is too dear for the start`);
  assert.ok(restockCost(2, 10) > restockCost(1, 10) && restockCost(1, 40) > restockCost(1, 0));
});

test('buying: you need the Marketplace (a Market Stall only buys), the coins and the room; stock goes down; the other player is told', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 8);
  const [mx, my] = spot(s, p, 2, 0);
  const stall = w.addThing('market_stall', mx, my);
  standNear(s, p, stall, 0, 20);
  w.coins = 10000;
  const shop = () => w.shared.shop;
  s.exec('a', { c: 'interact', id: stall.id });
  s.exec('a', { c: 'buy', i: 0, item: 'wood', n: 1 });
  assert.equal(w.coins, 10000, 'a Market Stall sells nothing');
  w.removeThing(stall.id);
  const mp = w.addThing('marketplace', mx, my);
  standNear(s, p, mp, 20, 28);
  w.events.length = 0;
  s.tells = []; s.exec('a', { c: 'interact', id: mp.id });
  assert.ok(shop() && shop().day === w.day && shop().items.length, 'the shelves are set out when you open the shop');
  assert.ok(s.tells.some((x) => x[1].t === 'ui' && x[1].kind === 'shop'), 'and the window opens');
  assert.ok(w.events.some((e) => e[0] === 'shop'), 'both players get the shelves');
  const [id, n, price] = shop().items[0];
  const bag = invCount(p.inv, id), coins = w.coins;
  s.exec('a', { c: 'buy', i: 0, item: id, n: 1 });
  assert.equal(invCount(p.inv, id), bag + 1);
  assert.equal(w.coins, coins - price);
  assert.equal(shop().items[0][1], n - 1);
  assert.equal(w.shared.flags.gs.bought, 1);
  s.exec('a', { c: 'buy', i: 0, item: 'diamond', n: 1 }); // the shelf changed under you: nothing happens
  assert.equal(w.coins, coins - price);
  // all of it, then sold out
  s.exec('a', { c: 'buy', i: 0, item: id, n: 999 });
  assert.equal(shop().items[0][1], 0);
  const c2 = w.coins; s.exec('a', { c: 'buy', i: 0, item: id, n: 1 });
  assert.equal(w.coins, c2, 'sold out');
  // poor
  w.coins = 0; const bag2 = invCount(p.inv, shop().items[1][0]); s.exec('a', { c: 'buy', i: 1, item: shop().items[1][0], n: 1 });
  assert.equal(invCount(p.inv, shop().items[1][0]), bag2, 'no coins, no goods');
  // a full bag
  w.coins = 99999; for (let i = 0; i < p.inv.length; i++) p.inv[i] = { id: 'stone', n: 9999 };
  const e2 = shop().items[2]; const bag3 = invCount(p.inv, e2[0]); s.exec('a', { c: 'buy', i: 2, item: e2[0], n: 1 });
  assert.equal(invCount(p.inv, e2[0]), bag3, 'a full bag takes nothing');
  assert.equal(w.coins, 99999);
  // far away
  p.x += 40 * TILE; const e3 = shop().items[3]; s.exec('a', { c: 'buy', i: 3, item: e3[0], n: 1 });
  assert.equal(w.coins, 99999, 'too far from the shop');
});

test('restock costs coins and brings new goods; a new day replaces the shelves for everybody', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 8);
  const [mx, my] = spot(s, p, 2, 0);
  const mp = w.addThing('marketplace', mx, my);
  standNear(s, p, mp, 20, 28);
  s.exec('a', { c: 'interact', id: mp.id });
  const first = JSON.stringify(w.shared.shop.items), cost = restockCost(0, w.techs.size);
  w.coins = cost - 1; s.exec('a', { c: 'restock' });
  assert.equal(JSON.stringify(w.shared.shop.items), first, 'not enough coins');
  w.coins = 1000; s.exec('a', { c: 'restock' });
  assert.equal(w.coins, 1000 - cost);
  assert.notEqual(JSON.stringify(w.shared.shop.items), first);
  assert.equal(w.shared.shop.rr, 1);
  const second = restockCost(1, w.techs.size); assert.ok(second > cost, 'each restock costs more');
  // the day turns
  const rev = JSON.stringify(w.shared.shop.items);
  w.day++; w.events.length = 0; s.onNewDay();
  assert.equal(w.shared.shop.day, w.day);
  assert.equal(w.shared.shop.rr, 0);
  assert.notEqual(JSON.stringify(w.shared.shop.items), rev);
  assert.ok(w.events.some((e) => e[0] === 'shop'));
});

test('the other player\'s world mirror takes the shelves from the event', () => {
  const { sim: s, w } = sim();
  const m = makeSim('classic', { enemyDensity: 0 }, 31).world;
  const stock = genStock(w.seed, w.day, 0, 5);
  applyEvent(m, ['shop', stock]);
  assert.deepEqual(m.shared.shop, stock);
});

test('selling at the Marketplace pays 10% more than at a Market Stall; nothing sells with no shop near', () => {
  const run = (piece) => {
    const { sim: s, w, p } = sim();
    clearAround(w, p, 8);
    const [mx, my] = spot(s, p, 2, 0);
    const t = w.addThing(piece, mx, my);
    standNear(s, p, t, 20, 28);
    p.inv[0] = { id: 'gold_ingot', n: 10 }; w.coins = 0;
    s.exec('a', { c: 'sell', i: 0, n: 10 });
    return w.coins;
  };
  const stall = run('market_stall'), shop = run('marketplace');
  assert.ok(stall > 0 && shop > stall * 1.05 && shop <= stall * 1.15, `${stall} → ${shop}`);
  const { sim: s, w, p } = sim(); clearAround(w, p, 8);
  p.inv[0] = { id: 'gold_ingot', n: 10 }; w.coins = 0; s.exec('a', { c: 'sell', i: 0, n: 10 });
  assert.equal(w.coins, 0);
  assert.equal(marketNear(w, p), null);
});
