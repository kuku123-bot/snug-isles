// Big stacks (9999 per slot) and the storage skills: Pack Mule (bag slots) and Warehouse Keeper (every chest, for everybody).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, give, freeSpot } from './helpers.js';
import { ITEMS, STACK } from '../js/data/items.js';
import { invAdd, invCount, makeInv, stackMax } from '../js/sim/inventory.js';
import { storageBonus, growStorage } from '../js/sim/machines.js';
import { calcStats } from '../js/sim/player.js';
import { TILE } from '../js/util.js';

test('normal items hold 9999 per slot, potions and trophies 999, tools one, eggs and keys stay small', () => {
  assert.equal(STACK, 9999);
  assert.equal(stackMax('wood'), 9999); assert.equal(stackMax('plank'), 9999); assert.equal(stackMax('coin'), 9999);
  assert.equal(stackMax('potion_health_s'), 999); assert.equal(stackMax('boss_token'), 999);
  assert.equal(stackMax('pickaxe_wood'), 1); assert.equal(stackMax('pet_egg'), 5); assert.equal(stackMax('treasure_key'), 5);
  for (const id of Object.keys(ITEMS)) assert.ok(ITEMS[id].stack >= 1 && ITEMS[id].stack <= 9999, id);
});

test('a bag fills in 9999s, tops up existing stacks, and reports what did not fit', () => {
  const inv = makeInv(4);
  assert.equal(invAdd(inv, 'wood', 25000), 0);
  assert.deepEqual(inv.map((s) => s && s.n), [9999, 9999, 5002, null]);
  assert.equal(invAdd(inv, 'wood', 100), 0);
  assert.equal(inv[2].n, 5102);
  assert.equal(invCount(inv, 'wood'), 25100);
  const small = makeInv(1);
  assert.equal(invAdd(small, 'stone', 10050), 51, 'one slot holds 9999');
  assert.equal(small[0].n, 9999);
});

test('Pack Mule adds bag slots on top of Bigger Backpack', () => {
  const sim = makeSim('dreamy'), p = sim.addPlayer('a', 'Alice', {});
  const base = calcStats(sim.world, p).slots;
  p.sp = 20;
  sim.exec('a', { c: 'skill', sid: 'pack_mule' }); // needs Bigger Backpack first
  assert.equal(p.skills.pack_mule || 0, 0, 'the requirement is enforced');
  sim.exec('a', { c: 'skill', sid: 'backpack' }); sim.exec('a', { c: 'skill', sid: 'pack_mule' }); sim.exec('a', { c: 'skill', sid: 'pack_mule' });
  assert.equal(calcStats(sim.world, p).slots, base + 4 + 12);
});

// build something on the first free tile near the player
function buildNear(sim, p, bid) {
  const [x, y] = freeSpot(sim, p, 8);
  p.x = (x + 0.5) * TILE; p.y = (y + 2) * TILE;
  sim.exec(p.pid, { c: 'build', bid, tx: x, ty: y });
  return sim.world.thingAt(x, y);
}

test('Warehouse Keeper grows every chest for everybody, new ones too, and never touches gravestones', () => {
  const sim = makeSim('dreamy'), w = sim.world, p = sim.addPlayer('a', 'Alice', {}), q = sim.addPlayer('b', 'Bob', {});
  w.techs.add('carpentry'); // barrels
  const chest = buildNear(sim, p, 'chest'), barrel = buildNear(sim, p, 'barrel');
  assert.ok(chest && barrel, 'both were built');
  assert.equal(chest.s.inv.length, 20); assert.equal(barrel.s.inv.length, 10);
  chest.s.inv[3] = { id: 'wood', n: 77 };
  assert.equal(storageBonus(w), 0);
  p.sp = 20; p.skills.backpack = 1; p.skills.pack_mule = 1;
  sim.exec('a', { c: 'skill', sid: 'warehouse' });
  assert.equal(storageBonus(w), 4);
  assert.equal(chest.s.inv.length, 24); assert.equal(barrel.s.inv.length, 14);
  assert.deepEqual(chest.s.inv[3], { id: 'wood', n: 77 }, 'nothing is lost');
  sim.exec('a', { c: 'skill', sid: 'warehouse' });
  assert.equal(chest.s.inv.length, 28);
  // the partner never learned it, but benefits: a chest THEY build is big too
  q.x = p.x; q.y = p.y; p.x += 9 * TILE; // (Alice steps away so she is not standing on the next free tile)
  const theirs = buildNear(sim, q, 'chest');
  assert.ok(theirs); assert.equal(theirs.s.inv.length, 28);
  assert.equal(growStorage(w), false, 'already as big as it should be');
  // a gravestone keeps its own size
  const [hx, hy] = freeSpot(sim, q, 8);
  const grave = w.addThing('gravestone', hx, hy, {});
  grave.s = { inv: new Array(60).fill(null) };
  growStorage(w);
  assert.equal(grave.s.inv.length, 60);
});

test('the Warehouse change is replicated as a thing update (so the partner sees the bigger chest)', () => {
  const sim = makeSim('dreamy'), w = sim.world, p = sim.addPlayer('a', 'Alice', {});
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 3) * TILE;
  sim.exec('a', { c: 'build', bid: 'chest', tx: fx, ty: fy });
  w.events.length = 0;
  p.sp = 5; p.skills.backpack = 1; p.skills.pack_mule = 1;
  sim.exec('a', { c: 'skill', sid: 'warehouse' });
  const ev = (w.events || []).filter((e) => e[0] === 'tu');
  assert.ok(ev.length >= 1 && ev.some((e) => e[2].s && e[2].s.inv.length === 24), 'a "tu" event carries the grown inventory');
});
