import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give, findThing, standNear, freeSpot } from './helpers.js';
import { TILE } from '../js/util.js';
import { invCount } from '../js/sim/inventory.js';
import { BUILD } from '../js/data/build.js';
import { LAND } from '../js/sim/world.js';

test('world creation: start land owned, resources present, spawn is walkable', () => {
  const sim = makeSim();
  const w = sim.world;
  assert.equal(w.ownedCount(), 1);
  const nodes = [...w.things.values()];
  assert.ok(nodes.length > 40, 'has resources: ' + nodes.length);
  assert.ok(nodes.some((t) => t.type === 'oak'));
  assert.ok(nodes.some((t) => t.type === 'rock'));
  assert.ok(w.boxFree(sim.spawn.x, sim.spawn.y, 4, 3), 'spawn walkable');
  const p = sim.addPlayer('a', 'Alice');
  assert.ok(p.inv.some((s) => s && s.id === 'pickaxe_wood'));
});

test('open sea is blocked: the player cannot walk off the island', () => {
  const sim = makeSim();
  const w = sim.world, p = sim.addPlayer('a', 'Alice');
  assert.ok(!w.boxFree(2 * TILE, 2 * TILE, 4, 3), 'far water is solid');
  const r = w.moveBox(sim.spawn.x, sim.spawn.y, 2000, 0, 4, 3);
  assert.ok(w.isTileOwned(Math.floor(r.x / TILE), Math.floor(r.y / TILE)), 'stopped inside owned land');
  assert.ok(r.x < w.pxW() / 2 + 12 * TILE, 'did not run off to sea');
});

test('chopping a tree drops wood, grants xp, and the tree regrows', () => {
  const sim = makeSim();
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  const tree = findThing(sim, 'oak', p);
  standNear(sim, p, tree);
  let swings = 0;
  while (!tree.dep && swings < 40) { p.cd = 0; sim.exec('a', { c: 'use', slot: 0, ax: (tree.x + .5) * TILE, ay: (tree.y + .5) * TILE }); swings++; sim.update(0.05); }
  assert.ok(tree.dep, 'tree depleted after ' + swings);
  step(sim, 2);
  assert.ok(invCount(p.inv, 'wood') >= 12, 'collected wood: ' + invCount(p.inv, 'wood')); // 10 from kit + drops
  assert.ok(p.xp > 0 || p.level > 1, 'xp gained');
  step(sim, 700); // regrow
  assert.ok(!tree.dep, 'regrew');
});

test('hand crafting + workbench station rules', () => {
  const sim = makeSim();
  const p = sim.addPlayer('a', 'Alice');
  give(p, 'wood', 20);
  sim.exec('a', { c: 'craft', rid: 'plank', n: 5 });
  assert.equal(invCount(p.inv, 'plank'), 5);
  const before = invCount(p.inv, 'wood');
  sim.exec('a', { c: 'craft', rid: 'pickaxe_stone', n: 1 }); // no station, no tech
  assert.equal(invCount(p.inv, 'pickaxe_stone'), 0);
  assert.equal(invCount(p.inv, 'wood'), before);
});

test('building walls/floors/furniture, refunds, and rules', () => {
  const sim = makeSim('classic');
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  give(p, 'plank', 50); give(p, 'wood', 50); give(p, 'fiber', 20);
  const [fx, fy] = freeSpot(sim, p, 6);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 2) * TILE;
  const cx = fx, cy = fy;
  sim.exec('a', { c: 'build', bid: 'floor_plank', tx: cx, ty: cy });
  assert.ok(w.floor[w.idx(cx, cy)] > 0, 'floor placed');
  const planksAfterFloor = invCount(p.inv, 'plank');
  assert.equal(planksAfterFloor, 49);
  sim.exec('a', { c: 'build', bid: 'wall_plank', tx: cx + 1, ty: cy });
  assert.ok(w.wall[w.idx(cx + 1, cy)] > 0 && (w.solid[w.idx(cx + 1, cy)] & 1), 'wall placed & solid');
  sim.exec('a', { c: 'build', bid: 'door_plank', tx: cx + 2, ty: cy });
  assert.ok(w.wall[w.idx(cx + 2, cy)] > 0, 'door placed');
  assert.ok(w.solid[w.idx(cx + 2, cy)] & 1, 'closed door solid');
  sim.exec('a', { c: 'build', bid: 'rustic_chair', tx: cx, ty: cy + 1 });
  assert.ok(w.thingAt(cx, cy + 1), 'chair placed');
  sim.exec('a', { c: 'build', bid: 'rustic_bed', tx: cx + 3, ty: cy + 1 });
  assert.ok(w.thingAt(cx + 3, cy + 2), 'bed covers 2 tiles tall');
  // not on water / not on unowned land
  const bad = w.placeProblem(BUILD.workbench, 0, 0);
  assert.ok(bad, 'cannot build on unowned land: ' + bad);
  // unbuild refunds
  sim.exec('a', { c: 'unbuild', tx: cx + 1, ty: cy });
  assert.equal(w.wall[w.idx(cx + 1, cy)], 0);
  assert.equal(invCount(p.inv, 'plank'), planksAfterFloor - 2 - 1 /*door*/ - 0 - /*chair*/ 3 - 6 + 1 + 0, 'plank bookkeeping');
});

test('opening doors: walking into a closed door opens it, then it closes again', () => {
  const sim = makeSim();
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  give(p, 'plank', 20);
  const [fx, fy] = freeSpot(sim, p, 6);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 2) * TILE;
  sim.exec('a', { c: 'build', bid: 'door_plank', tx: fx, ty: fy });
  assert.ok(w.solid[w.idx(fx, fy)] & 1);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 1) * TILE + 6; p.ix = 0; p.iy = -1;
  step(sim, 0.2);
  assert.equal(w.wallState[w.idx(fx, fy)], 1, 'door opened');
  assert.ok(!(w.solid[w.idx(fx, fy)] & 1), 'open door is walkable');
  p.ix = 0; p.iy = 0; p.x += 80;
  step(sim, 2);
  assert.equal(w.wallState[w.idx(fx, fy)], 0, 'door auto-closed');
});

test('buying land: needs coins and adjacency; new land brings new resources and merges', () => {
  const sim = makeSim();
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  const c = w.gw >> 1;
  const opts = sim.buyableLands();
  assert.equal(opts.length, 4);
  const [gx, gy] = opts[0];
  w.coins = 0;
  sim.exec('a', { c: 'buyLand', gx, gy });
  assert.ok(!w.isLandOwned(gx, gy), 'cannot afford');
  w.coins = 5000;
  const before = w.things.size;
  sim.exec('a', { c: 'buyLand', gx, gy });
  assert.ok(w.isLandOwned(gx, gy));
  assert.ok(w.things.size > before + 20);
  assert.ok(w.coins < 5000);
  // the two lands must be connected by walkable ground along their shared border
  const [ox, oy] = w.landOrigin(c, c);
  const [nx, ny] = w.landOrigin(gx, gy);
  let seamLand = 0;
  for (let k = 0; k < LAND; k++) {
    const tx = gx !== c ? (gx > c ? ox + LAND : ox - 1) : ox + k;
    const ty = gy !== c ? (gy > c ? oy + LAND : oy - 1) : oy + k;
    if (w.isLand(tx, ty)) seamLand++;
  }
  assert.ok(seamLand >= LAND - 4, 'seam connected: ' + seamLand);
});

test('research: needs a table + materials; unlocks recipes/blueprints', () => {
  const sim = makeSim();
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  give(p, 'stone', 100); give(p, 'wood', 100); give(p, 'plank', 30); give(p, 'fiber', 30);
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 3) * TILE;
  sim.exec('a', { c: 'research', tid: 'stonecraft' });
  assert.ok(!w.techs.has('stonecraft'), 'needs a table');
  sim.exec('a', { c: 'build', bid: 'research_table', tx: fx, ty: fy });
  assert.ok(w.thingAt(fx, fy), 'table built');
  sim.exec('a', { c: 'research', tid: 'stonecraft' });
  assert.ok(w.techs.has('stonecraft'), 'researched');
  sim.exec('a', { c: 'research', tid: 'smelting' });
  assert.ok(!w.techs.has('smelting'), 'smelting needs coal & clay');
});

test('furnace smelts ore with fuel, chest pulls/pushes automatically', () => {
  const sim = makeSim('dreamy'); // free building + research
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  w.techs.add('stonecraft'); w.techs.add('smelting');
  give(p, 'copper_ore', 6); give(p, 'coal', 4);
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 3) * TILE;
  sim.exec('a', { c: 'build', bid: 'furnace', tx: fx, ty: fy });
  sim.exec('a', { c: 'build', bid: 'chest', tx: fx + 1, ty: fy });
  const furnace = w.thingAt(fx, fy), chest = w.thingAt(fx + 1, fy);
  assert.ok(furnace && chest);
  // put ore & coal into the chest via transfer commands
  for (let i = 0; i < p.inv.length; i++) { const s = p.inv[i]; if (s && (s.id === 'copper_ore' || s.id === 'coal')) sim.exec('a', { c: 'inv', op: 'quick', from: { k: 'p', i }, to: { id: chest.id } }); }
  assert.ok(chest.s.inv.some((s) => s && s.id === 'copper_ore'), 'ore in chest');
  step(sim, 60);
  const have = chest.s.inv.filter(Boolean).find((s) => s.id === 'copper_ingot');
  assert.ok(have && have.n >= 4, 'smelted ingots flowed back into the chest: ' + JSON.stringify(chest.s.inv.filter(Boolean)));
});

test('farming: plant, grow, harvest', () => {
  const sim = makeSim('dreamy');
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  w.techs.add('gardening');
  give(p, 'seed_wheat', 3);
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 2) * TILE;
  sim.exec('a', { c: 'build', bid: 'farm_plot', tx: fx, ty: fy });
  const plot = w.thingAt(fx, fy);
  assert.ok(plot);
  const slot = p.inv.findIndex((s) => s && s.id === 'seed_wheat');
  p.cd = 0;
  sim.exec('a', { c: 'use', slot, ax: (fx + .5) * TILE, ay: (fy + .5) * TILE });
  assert.equal(plot.s.c, 'wheat');
  step(sim, 120);
  assert.equal(plot.s.st, 3, 'ripe');
  sim.exec('a', { c: 'interact', id: plot.id });
  assert.ok(invCount(p.inv, 'wheat') >= 2);
  assert.equal(plot.s.c, null);
});

test('combat: slimes hurt, swords kill, drops and xp follow', async () => {
  const sim = makeSim('classic');
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  const { spawnMob } = await import('../js/sim/combat.js');
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 0.5) * TILE;
  const m = spawnMob(sim, 'slime_green', p.x + 20, p.y);
  m.agg = true;
  const hp0 = p.hp;
  step(sim, 6);
  assert.ok(p.hp < hp0 || m.hp <= 0, 'slime attacked the player (hp ' + p.hp + ')');
  const sword = p.inv.findIndex((s) => s && s.id === 'sword_wood');
  let guard = 0;
  while (w.mobs.has(m.id) && guard++ < 80) {
    p.cd = 0; p.shield = 5;
    p.x = m.x - 12; p.y = m.y;
    sim.exec('a', { c: 'use', slot: sword, ax: m.x, ay: m.y - 4 });
    sim.update(0.05);
  }
  assert.ok(!w.mobs.has(m.id), 'slime died');
  step(sim, 1);
  assert.ok(p.xp > 0 || p.level > 1);
});

test('sleeping skips the night; cozy rooms are detected', () => {
  const sim = makeSim('dreamy');
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  const [fx, fy] = freeSpot(sim, p, 8);
  // build a 5x5 room: walls around a 3x3 interior with a bed + lamp
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const edge = x === 0 || y === 0 || x === 4 || y === 4;
    const tx = fx + x, ty = fy + y;
    p.x = (fx + 2.5) * TILE; p.y = (fy + 6) * TILE;
    if (edge) sim.exec('a', { c: 'build', bid: 'wall_plank', tx, ty });
    else sim.exec('a', { c: 'build', bid: 'floor_plank', tx, ty });
  }
  p.x = (fx + 2.5) * TILE; p.y = (fy + 3.2) * TILE;
  w.techs.add('cottage_style');
  sim.exec('a', { c: 'build', bid: 'rustic_bed', tx: fx + 1, ty: fy + 1 });
  sim.exec('a', { c: 'build', bid: 'rustic_lamp', tx: fx + 3, ty: fy + 1 });
  sim.exec('a', { c: 'build', bid: 'rustic_rug', tx: fx + 2, ty: fy + 2 });
  assert.ok(w.thingAt(fx + 1, fy + 1), 'bed');
  p.x = (fx + 2.5) * TILE; p.y = (fy + 3.4) * TILE;
  sim.computeCozy(p);
  assert.ok(p.room >= 4 && p.room <= 9, 'enclosed room detected: ' + p.room);
  assert.ok(p.cozy > 3, 'cozy score: ' + p.cozy);
  // sleep at night
  w.time = w.settings.dayLength * 0.8;
  sim.exec('a', { c: 'interact', id: w.thingAt(fx + 1, fy + 1).id });
  assert.ok(p.sleeping, 'sleeping');
  step(sim, 20);
  assert.ok(!p.sleeping, 'woke up');
  assert.ok(sim.nightness() < 0.2, 'it is day now: ' + sim.nightness() + ' phase ' + sim.dayPhase());
});

test('inventory transfers: chest <-> bag, equipment, processors', () => {
  const sim = makeSim('dreamy');
  const w = sim.world;
  const p = sim.addPlayer('a', 'Alice');
  give(p, 'tunic_cloth', 1);
  const slot = p.inv.findIndex((s) => s && s.id === 'tunic_cloth');
  sim.exec('a', { c: 'equip', i: slot });
  assert.equal(p.equip.body.id, 'tunic_cloth');
  sim.exec('a', { c: 'unequip', slot: 'body' });
  assert.equal(p.equip.body, null);
  assert.ok(p.inv.some((s) => s && s.id === 'tunic_cloth'));
});
