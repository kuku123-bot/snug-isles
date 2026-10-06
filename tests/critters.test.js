// Hunting: wild critters (chicks, bunnies...) can be hit, but only when you aim right at them; pets never; they run when hurt and drop things.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, freeSpot } from './helpers.js';
import { spawnMob, canHit } from '../js/sim/combat.js';
import { ensurePets } from '../js/sim/pets.js';
import { MOBS } from '../js/data/mobs.js';
import { TILE } from '../js/util.js';

function setup(tool = 'sword_wood') {
  const sim = makeSim('classic'), w = sim.world, p = sim.addPlayer('a', 'Alice', {});
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 0.5) * TILE;
  p.inv[0] = { id: tool, n: 1 }; p.sel = 0;
  w.mobs.clear(); w.drops.clear();
  return { sim, w, p };
}
const swing = (sim, p, ax, ay) => { p.cd = 0; sim.exec(p.pid, { c: 'use', slot: 0, ax, ay }); };

test('every wild critter has something to drop, and every hostile one still does', () => {
  for (const id of ['bunny', 'snow_bunny', 'chick', 'duck', 'penguin', 'lizard', 'unicorn']) assert.ok(MOBS[id].drops.length > 0 && MOBS[id].xp > 0, id);
});

test('a swing aimed at a chick hits it; the same swing aimed at something else does not', () => {
  const { sim, w, p } = setup();
  const chick = spawnMob(sim, 'chick', p.x + 14, p.y, {});
  assert.ok(chick && w.mobs.has(chick.id));
  swing(sim, p, p.x - 30, p.y); // aimed the other way (like chopping a tree next to it)
  assert.equal(chick.hp, MOBS.chick.hp, 'not aimed at it: untouched');
  swing(sim, p, chick.x, chick.y - 2);
  assert.ok(!w.mobs.has(chick.id) || chick.hp < MOBS.chick.hp, 'aimed at it: hurt');
});

test('a chick dies in a couple of hits, drops feathers/eggs and gives a little XP', () => {
  const { sim, w, p } = setup();
  const chick = spawnMob(sim, 'chick', p.x + 12, p.y, {});
  const xp0 = p.xp;
  for (let i = 0; i < 6 && w.mobs.has(chick.id); i++) { chick.x = p.x + 12; chick.y = p.y; swing(sim, p, chick.x, chick.y - 2); }
  assert.ok(!w.mobs.has(chick.id), 'the chick is gone');
  const dropped = [...w.drops.values()].map((d) => d.item);
  assert.ok(dropped.includes('feather') || dropped.includes('egg') || p.inv.some((s) => s && (s.id === 'feather' || s.id === 'egg')), `it dropped something (${dropped.join(',')})`);
  assert.ok(p.xp > xp0 || p.level > 1, 'and a little XP');
});

test('a hurt critter bolts away from whoever hit it', () => {
  const { sim, w, p } = setup('pickaxe_wood');
  const bunny = spawnMob(sim, 'bunny', p.x + 10, p.y, {});
  bunny.hp = 100; // survive the hit
  swing(sim, p, bunny.x, bunny.y - 2);
  assert.ok(bunny.hp < 100 && bunny.panic > 0, 'hurt and panicking');
  const d0 = Math.hypot(bunny.x - p.x, bunny.y - p.y);
  step(sim, 1.2);
  assert.ok(Math.hypot(bunny.x - p.x, bunny.y - p.y) > d0 + 8, 'it ran off');
});

test('a hatched pet can never be hurt (not by you, not by your partner)', () => {
  const { sim, w, p } = setup();
  const q = sim.addPlayer('b', 'Bob', {});
  q.x = p.x + 8; q.y = p.y; q.inv[0] = { id: 'sword_wood', n: 1 }; q.sel = 0;
  p.pet = 'bunny'; ensurePets(sim);
  const pet = [...w.mobs.values()].find((m) => m.pet === 'a');
  assert.ok(pet, 'the pet exists');
  assert.equal(canHit(pet, pet.x, pet.y), false);
  for (let i = 0; i < 4; i++) { pet.x = p.x + 10; pet.y = p.y; swing(sim, p, pet.x, pet.y - 2); q.cd = 0; sim.exec('b', { c: 'use', slot: 0, ax: pet.x, ay: pet.y - 2 }); }
  assert.equal(pet.hp, MOBS.bunny.hp); assert.ok(w.mobs.has(pet.id));
});

test('turrets and other helpers still ignore critters (only players hunt them)', () => {
  const { sim, w, p } = setup();
  const chick = spawnMob(sim, 'chick', p.x + 14, p.y, {});
  assert.equal(canHit(chick, chick.x + 80, chick.y), false, 'aim far away');
  assert.equal(canHit(chick, chick.x, chick.y - 4), true, 'aim on it');
  // hostile creatures are always fair game for any aim
  const slime = spawnMob(sim, 'slime_green', p.x + 20, p.y, {});
  assert.equal(canHit(slime, 0, 0), true);
});
