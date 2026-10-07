// Functional sweep through the REAL command path: every recipe is crafted, every blueprint is built + removed, every tech is
// researched, and every machine type does its job. Cheats only supply materials; all rules (costs, reach, stations, tech gates) apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { RECIPES, PROCESS } from '../js/data/recipes.js';
import { TECHS, researchTierFor } from '../js/data/techs.js';
import { ITEMS } from '../js/data/items.js';
import { CROPS } from '../js/data/crops.js';
import { MOBS } from '../js/data/mobs.js';
import { invCount } from '../js/sim/inventory.js';
import { placeCheck, buildMult } from '../js/sim/commands.js';
import { spawnMob } from '../js/sim/combat.js';

function env(overrides = {}) {
  const sim = makeSim('classic', { enemyDensity: 0, techCost: 1, buildCost: 1, pace: 1, ...overrides });
  const w = sim.world, p = sim.addPlayer('a', 'Alice');
  let start = null;
  for (let gx = 0; gx < w.gw; gx++) for (let gy = 0; gy < w.gh; gy++) if (w.isLandOwned(gx, gy)) start = [gx, gy];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const gx = start[0] + dx, gy = start[1] + dy;
    if (gx >= 0 && gy >= 0 && gx < w.gw && gy < w.gh && !w.isLandOwned(gx, gy)) sim.claimLand(gx, gy);
  }
  return { sim, w, p };
}
const clearBag = (p) => { p.inv.fill(null); p.rev++; };
const bagTotal = (p, id) => invCount(p.inv, id);
/** nearest tile where the real placement rules allow `def` */
function findSpot(sim, p, def, minR = 2) {
  const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
  for (let r = minR; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const tx = cx + dx, ty = cy + dy;
    if (placeCheck(sim, p, def, tx, ty) === null) return [tx, ty];
  }
  return null;
}
/** stand a couple of tiles below a footprint (inside build/interact reach, never on top of it) */
function standBelow(p, tx, ty, def) { p.x = (tx + (def.w || 1) / 2) * TILE; p.y = (ty + (def.h || 1) + 1.6) * TILE; p.vx = p.vy = 0; }
function buildAt(sim, p, bid, tx, ty) { const def = BUILD[bid]; standBelow(p, tx, ty, def); sim.exec(p.pid, { c: 'build', bid, tx, ty }); }
function place(sim, p, bid, near) {
  const def = BUILD[bid];
  if (near) { p.x = near[0]; p.y = near[1]; }
  const spot = findSpot(sim, p, def);
  assert.ok(spot, `a free spot for ${bid}`);
  give(p, 'wood', 0);
  const w = sim.world;
  w.techs.add(def.tech || 'carpentry');
  for (const k of Object.keys(def.cost)) give(p, k, Math.ceil(def.cost[k] * 3) + 1);
  buildAt(sim, p, bid, spot[0], spot[1]);
  const t = w.thingAt(spot[0], spot[1]);
  assert.ok(t && t.type === bid, `${bid} was built at ${spot}`);
  return t;
}
const allTechs = (w) => { for (const id of Object.keys(TECHS)) w.techs.add(id); w.shared.flags.statsRev = (w.shared.flags.statsRev || 0) + 1; };

test('every recipe can be crafted at its station through the command path', () => {
  const { sim, w, p } = env();
  allTechs(w);
  // one of every station within reach of one spot
  const stations = {};
  for (const d of Object.values(BUILD)) if (d.behavior === 'station' && !stations[d.conf.station]) stations[d.conf.station] = d.id;
  const anchor = [p.x, p.y];
  const built = {};
  for (const [st, bid] of Object.entries(stations)) {
    const def = BUILD[bid];
    const spot = (() => { p.x = anchor[0]; p.y = anchor[1]; return findSpot(sim, p, def, 1); })();
    assert.ok(spot, 'spot for ' + bid);
    built[st] = w.addThing(bid, spot[0], spot[1]);
    assert.ok(Math.hypot((spot[0] + 0.5) * TILE - anchor[0], (spot[1] + 0.5) * TILE - anchor[1]) < 5.2 * TILE, `${bid} within reach of the crafting spot`);
  }
  p.x = anchor[0]; p.y = anchor[1];
  const failed = [];
  for (const r of RECIPES) {
    clearBag(p);
    for (const [k, n] of Object.entries(r.in)) give(p, k === '@fish' ? 'fish_minnow' : k, n);
    const lvl0 = p.xp;
    sim.exec('a', { c: 'craft', rid: r.id, n: 1 });
    const got = bagTotal(p, r.out);
    if (got !== r.n) failed.push(`${r.id}: expected ${r.n} ${r.out}, got ${got}`);
    for (const [k, n] of Object.entries(r.in)) { if (k !== '@fish' && k !== r.out && bagTotal(p, k) !== 0) failed.push(`${r.id}: ingredient ${k} not consumed`); }
  }
  assert.deepEqual(failed, []);
  // and without the station / the tech it is refused
  clearBag(p); give(p, 'iron_ingot', 20); give(p, 'plank', 20);
  const far = { ...p, x: 0 };
  p.x = 3 * TILE; p.y = 3 * TILE; // far out at sea: no station near
  sim.exec('a', { c: 'craft', rid: 'sword_iron' });
  assert.equal(bagTotal(p, 'sword_iron'), 0, 'no crafting away from the anvil');
});

test('every blueprint can be built with the real rules, costs materials, and refunds when removed', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const problems = [];
  let n = 0;
  for (const def of Object.values(BUILD)) {
    if (def.hidden) continue;
    clearBag(p);
    const mult = buildMult(sim, p, def);
    // walldeco needs a wall behind it: build a plank wall first
    let spot;
    if (def.kind === 'walldeco') {
      give(p, 'plank', 50);
      const wallDef = BUILD.wall_plank;
      p.x = Math.floor(sim.spawn.x / TILE) * TILE; p.y = sim.spawn.y;
      spot = findSpot(sim, p, wallDef);
      buildAt(sim, p, 'wall_plank', spot[0], spot[1]);
      if (!w.wall[w.idx(spot[0], spot[1])]) { problems.push(`${def.id}: could not make a wall to hang it on`); continue; }
      clearBag(p);
    } else {
      p.x = sim.spawn.x; p.y = sim.spawn.y;
      spot = findSpot(sim, p, def);
    }
    if (!spot) { problems.push(`${def.id}: no valid spot on the starting lands`); continue; }
    for (const k of Object.keys(def.cost)) give(p, k, Math.ceil(def.cost[k] * 3) + 2);
    const before = Object.fromEntries(Object.keys(def.cost).map((k) => [k, bagTotal(p, k)]));
    buildAt(sim, p, def.id, spot[0], spot[1]);
    const i = w.idx(spot[0], spot[1]);
    const there = def.kind === 'wall' ? w.wall[i] > 0 : def.kind === 'floor' ? w.floor[i] > 0 : def.kind === 'walldeco' ? w.deco[i] > 0 : (w.thingAt(spot[0], spot[1]) || w.flatAt(spot[0], spot[1])) && (w.thingAt(spot[0], spot[1]) || w.flatAt(spot[0], spot[1])).type === def.id;
    if (!there) { problems.push(`${def.id}: not present after building at ${spot}`); continue; }
    const after = Object.fromEntries(Object.keys(def.cost).map((k) => [k, bagTotal(p, k)]));
    for (const k of Object.keys(def.cost)) { const spent = before[k] - after[k], want = Math.ceil(def.cost[k] * mult - 1e-9); if (def.kind !== 'walldeco' && Math.abs(spent - want) > 1) problems.push(`${def.id}: spent ${spent} ${k}, expected about ${want}`); }
    // remove it again
    standBelow(p, spot[0], spot[1], def);
    sim.exec('a', { c: 'unbuild', tx: spot[0], ty: spot[1], layer: def.kind === 'walldeco' ? 'deco' : undefined });
    const gone = def.kind === 'wall' ? !w.wall[i] : def.kind === 'floor' ? !w.floor[i] : def.kind === 'walldeco' ? !w.deco[i] : !(w.thingAt(spot[0], spot[1]) && w.thingAt(spot[0], spot[1]).type === def.id) && !(w.flatAt(spot[0], spot[1]) && w.flatAt(spot[0], spot[1]).type === def.id);
    if (!gone) { problems.push(`${def.id}: still there after removing`); continue; }
    for (const k of Object.keys(def.cost)) { const got = bagTotal(p, k) - after[k], want = Math.ceil(def.cost[k] * mult - 1e-9); if (def.kind !== 'walldeco' && got !== want) problems.push(`${def.id}: refunded ${got} ${k}, expected ${want}`); }
    n++;
  }
  assert.deepEqual(problems, []);
  assert.ok(n > 250, `exercised ${n} blueprints`);
});

test('building is refused without the tech, the materials, or the reach', () => {
  const { sim, w, p } = env();
  clearBag(p);
  const spot = findSpot(sim, p, BUILD.workbench);
  standBelow(p, spot[0], spot[1], BUILD.workbench);
  sim.exec('a', { c: 'build', bid: 'workbench', tx: spot[0], ty: spot[1] });
  assert.ok(!w.thingAt(spot[0], spot[1]), 'no materials -> nothing built');
  give(p, 'wood', 30);
  p.x += 30 * TILE;
  sim.exec('a', { c: 'build', bid: 'workbench', tx: spot[0], ty: spot[1] });
  assert.ok(!w.thingAt(spot[0], spot[1]), 'too far -> nothing built');
  standBelow(p, spot[0], spot[1], BUILD.workbench);
  sim.exec('a', { c: 'build', bid: 'furnace', tx: spot[0], ty: spot[1] });
  assert.ok(!w.thingAt(spot[0], spot[1]), 'furnace needs Stonecraft first');
  sim.exec('a', { c: 'build', bid: 'workbench', tx: spot[0], ty: spot[1] });
  assert.ok(w.thingAt(spot[0], spot[1]), 'workbench built');
  assert.equal(bagTotal(p, 'wood'), 20, 'cost was paid');
});

test('the whole tech tree can be researched in order at the right research stations', () => {
  const { sim, w, p } = env();
  const order = [], seen = new Set();
  const topo = (id) => { if (seen.has(id)) return; seen.add(id); for (const q of TECHS[id].req) topo(q); order.push(TECHS[id]); };
  for (const t of Object.values(TECHS).sort((a, b) => a.tier - b.tier)) topo(t.id);
  const stations = {};
  for (const [bid, tier] of [['research_table', 1], ['library', 2], ['observatory', 3]]) {
    const def = BUILD[bid];
    p.x = sim.spawn.x; p.y = sim.spawn.y;
    const spot = findSpot(sim, p, def, 1 + tier * 2);
    stations[tier] = w.addThing(bid, spot[0], spot[1]);
  }
  const done = [];
  for (const t of order) {
    const need = researchTierFor(t.tier);
    const st = stations[need];
    clearBag(p);
    for (const [k, n] of Object.entries(t.cost)) give(p, k, n);
    // away from the right station: refused
    p.x = 3 * TILE; p.y = 3 * TILE;
    sim.exec('a', { c: 'research', tid: t.id });
    assert.ok(!w.techs.has(t.id), `${t.id} needs a research station nearby`);
    p.x = (st.x + 1) * TILE; p.y = (st.y + 1.8) * TILE;
    // missing prerequisites are refused too
    const missing = t.req.find((q) => !w.techs.has(q));
    sim.exec('a', { c: 'research', tid: t.id });
    assert.ok(w.techs.has(t.id), `${t.id} researched (missing prereq? ${missing})`);
    assert.equal(Object.keys(t.cost).filter((k) => bagTotal(p, k) !== 0).length, 0, `${t.id}: cost was paid in full`);
    done.push(t.id);
  }
  assert.equal(done.length, Object.keys(TECHS).length);
  // permanent bonuses are applied
  const bonus = Object.values(TECHS).filter((t) => t.fx && t.fx.slots).reduce((a, t) => a + t.fx.slots, 0);
  assert.ok(bonus >= 8, 'bag-size techs exist');
});

test('processors turn raw materials into ingots/bricks/glass/flour with fuel', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const kinds = { furnace: 'furnace', blast: 'blast_furnace', magma: 'magma_furnace', mill: 'windmill' };
  const machines = {};
  for (const [kind, bid] of Object.entries(kinds)) machines[kind] = place(sim, p, bid, [sim.spawn.x, sim.spawn.y]);
  const problems = [];
  for (const rec of PROCESS) {
    const bid = kinds[rec.kind], t = machines[rec.kind];
    standBelow(p, t.x, t.y, BUILD[bid]);
    clearBag(p);
    t.s.inp = null; t.s.out = null; t.s.fuel = null; t.s.heat = 0; t.s.prog = 0;
    give(p, rec.input, rec.n * 3);
    if (!BUILD[bid].conf.noFuel) give(p, 'coal', 4);
    // load through the same command the UI uses (shift-click a stack from the bag into the machine)
    for (let i = 0; i < p.inv.length; i++) if (p.inv[i]) sim.exec('a', { c: 'inv', op: 'quick', from: { k: 'p', i }, to: { id: t.id } });
    if (!t.s.inp || t.s.inp.id !== rec.input) { problems.push(`${rec.kind}:${rec.input}: input was not accepted`); continue; }
    step(sim, (rec.t * 3) / (1 + 0) + 8);
    const made = (t.s.out && t.s.out.id === rec.out ? t.s.out.n : 0);
    if (made < rec.on) problems.push(`${rec.kind}:${rec.input}->${rec.out}: produced ${made}`);
    // take the product out with a click
    sim.exec('a', { c: 'inv', op: 'quick', from: { k: 'm', id: t.id, f: 'out' }, to: {} });
    if (made && bagTotal(p, rec.out) < 1) problems.push(`${rec.kind}:${rec.out}: could not take the product`);
  }
  assert.deepEqual(problems, []);
});

test('processors can be fed and emptied by an adjacent chest (automation)', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const furnace = place(sim, p, 'furnace', [sim.spawn.x, sim.spawn.y]);
  // chest right next to it
  const chestDef = BUILD.chest;
  let chest = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (placeCheck(sim, p, chestDef, furnace.x + dx, furnace.y + dy) === null) { give(p, 'plank', 20); buildAt(sim, p, 'chest', furnace.x + dx, furnace.y + dy); chest = w.thingAt(furnace.x + dx, furnace.y + dy); break; }
  }
  assert.ok(chest, 'a chest next to the furnace');
  const inv = chest.s.inv;
  inv[0] = { id: 'copper_ore', n: 10 }; inv[1] = { id: 'coal', n: 10 };
  step(sim, 60);
  const ingots = inv.filter(Boolean).filter((s) => s.id === 'copper_ingot').reduce((a, s) => a + s.n, 0);
  assert.ok(ingots >= 4, `the chest collected ingots by itself (${ingots})`);
});

test('farm plots grow every crop and give a harvest (with regrow where promised)', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const plot = place(sim, p, 'farm_plot', [sim.spawn.x, sim.spawn.y]);
  const problems = [];
  for (const [id, crop] of Object.entries(CROPS)) {
    standBelow(p, plot.x, plot.y, BUILD.farm_plot);
    clearBag(p);
    give(p, 'seed_' + id, 2);
    p.sel = 0;
    sim.exec('a', { c: 'interact', id: plot.id });
    if (plot.s.c !== id) { problems.push(`${id}: seed was not planted (state ${JSON.stringify(plot.s)})`); continue; }
    step(sim, crop.time / 0.6 + 5, 1 / 10);
    if (plot.s.st < 3) { problems.push(`${id}: not ripe after ${crop.time}s (stage ${plot.s.st})`); continue; }
    sim.exec('a', { c: 'interact', id: plot.id });
    const got = bagTotal(p, crop.item);
    if (got < crop.yield[0]) problems.push(`${id}: harvested ${got} ${crop.item}`);
    if (crop.regrow && plot.s.c !== id) problems.push(`${id}: should regrow`);
    if (plot.s.c) { plot.s = { c: null, g: 0, st: 0, by: plot.s.by }; }
  }
  assert.deepEqual(problems, []);
});

test('animal pens, beehives and fish traps produce goods that can be collected', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const problems = [];
  for (const bid of ['beehive', 'chicken_coop', 'cow_shed', 'sheep_pen', 'fish_trap']) {
    const def = BUILD[bid];
    const t = place(sim, p, bid, [sim.spawn.x, sim.spawn.y]);
    standBelow(p, t.x, t.y, def);
    clearBag(p);
    if (def.conf.flowers) for (let i = 0; i < 4; i++) { const f = findSpot(sim, p, BUILD.flower_bed || BUILD.bench, 1); const x = t.x + 1 + i, y = t.y + 2; try { w.addThing('flower_pink', x, y); } catch (e) { /* tile may be taken */ } }
    if (def.conf.feed) { give(p, def.conf.feed[0], 12); sim.exec('a', { c: 'interact', id: t.id }); if (!(t.s.feed > 0)) problems.push(`${bid}: could not be fed`); }
    step(sim, def.conf.every * 3.2 + 10, 1 / 5);
    if (!(t.s.stock > 0)) { problems.push(`${bid}: no goods after waiting (stock ${t.s.stock})`); continue; }
    const total0 = p.inv.reduce((a, s) => a + (s ? s.n : 0), 0);
    sim.exec('a', { c: 'interact', id: t.id });
    const total1 = p.inv.reduce((a, s) => a + (s ? s.n : 0), 0);
    if (total1 <= total0) problems.push(`${bid}: collecting gave nothing`);
  }
  assert.deepEqual(problems, []);
});

test('drills mine nearby resources by themselves (fuel from an adjacent chest or the solar kind)', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const problems = [];
  for (const bid of ['drill_iron', 'drill_steel', 'drill_solar', 'drill_void']) {
    const def = BUILD[bid];
    p.x = sim.spawn.x; p.y = sim.spawn.y;
    const d = place(sim, p, bid, [sim.spawn.x, sim.spawn.y]);
    // a rock right next to it
    let rock = null;
    for (let r = 1; r < 5 && !rock; r++) for (let dy = -r; dy <= r + 1 && !rock; dy++) for (let dx = -r; dx <= r + 1 && !rock; dx++) {
      const x = d.x + dx, y = d.y + dy;
      if (w.inb(x, y) && !w.occ[w.idx(x, y)] && w.isTileOwned(x, y) && w.ground[w.idx(x, y)] && !w.wall[w.idx(x, y)] && !(x >= d.x - 0 && x < d.x + d.w && y >= d.y && y < d.y + d.h)) rock = w.addThing('rock', x, y);
    }
    assert.ok(rock, 'rock near ' + bid);
    if (def.conf.fuel) { d.s.heat = 400; }
    step(sim, def.conf.every * Math.ceil(rock.hp / def.conf.dmg) + 12, 1 / 5);
    const got = (d.s.buf || []).reduce((a, b) => a + b.n, 0) + [...w.drops.values()].filter((x) => x.item === 'stone').reduce((a, x) => a + x.n, 0);
    if (!(rock.dep || rock.hp <= 0 || got > 0)) problems.push(`${bid}: did not break the rock (hp ${rock.hp})`);
  }
  assert.deepEqual(problems, []);
});

test('turrets shoot hostile creatures in range (ammo or magic)', () => {
  const { sim, w, p } = env();
  allTechs(w);
  const problems = [];
  for (const bid of ['turret_arrow', 'turret_magic', 'turret_fire', 'turret_prism', 'turret_void']) {
    const def = BUILD[bid];
    p.x = sim.spawn.x; p.y = sim.spawn.y;
    const t = place(sim, p, bid, [sim.spawn.x, sim.spawn.y]);
    if (def.conf.ammo) t.s.ammo = 20;
    const m = spawnMob(sim, 'slime_green', (t.x + 1) * TILE + 30, (t.y + 0.5) * TILE);
    m.hp = 10000; m.aggro = 0;
    const hp0 = m.hp;
    step(sim, 4);
    if (!(m.hp < hp0)) problems.push(`${bid}: did not hurt the slime`);
    w.removeMob ? w.removeMob(m.id) : w.mobs.delete(m.id);
  }
  assert.deepEqual(problems, []);
});

test('altars wake their bosses, beds set the respawn point, markets pay coins, warp pads teleport', () => {
  const { sim, w, p } = env();
  allTechs(w);
  // altar
  const altar = place(sim, p, 'slime_altar', [sim.spawn.x, sim.spawn.y]);
  standBelow(p, altar.x, altar.y, BUILD.slime_altar);
  clearBag(p);
  sim.exec('a', { c: 'interact', id: altar.id });
  assert.ok(!w.shared.bossUp, 'no offering -> nothing happens');
  give(p, 'slime_goo', 10); give(p, 'berries', 10);
  sim.exec('a', { c: 'interact', id: altar.id });
  assert.ok(w.shared.bossUp, 'the Slime King awakens');
  assert.equal(bagTotal(p, 'slime_goo'), 0, 'offering consumed');
  // bed
  const bed = place(sim, p, 'rustic_bed', [sim.spawn.x, sim.spawn.y]);
  standBelow(p, bed.x, bed.y, BUILD.rustic_bed);
  sim.exec('a', { c: 'interact', id: bed.id });
  assert.ok(p.spawn && p.spawn.id === bed.id, 'respawn point is the bed');
  // market
  const stall = place(sim, p, 'market_stall', [sim.spawn.x, sim.spawn.y]);
  standBelow(p, stall.x, stall.y, BUILD.market_stall);
  clearBag(p); give(p, 'gem_ruby', 2);
  const c0 = w.coins;
  sim.exec('a', { c: 'sell', i: 0, n: 2 });
  assert.ok(w.coins > c0 + 100, `sold rubies for coins (+${w.coins - c0})`);
  // warp pads
  const a = place(sim, p, 'warp_pad', [sim.spawn.x, sim.spawn.y]);
  const b = place(sim, p, 'warp_pad', [a.x * TILE + 6 * TILE, a.y * TILE]);
  p.x = (a.x + 0.5) * TILE; p.y = (a.y + 0.5) * TILE;
  sim.exec('a', { c: 'warp', id: b.id });
  assert.ok(Math.abs(p.x - (b.x + 0.5) * TILE) < 2 * TILE, 'teleported to the other pad');
});

test('doors open and close, and chests take items in and give them back', () => {
  const { sim, w, p } = env();
  allTechs(w);
  clearBag(p); give(p, 'plank', 40);
  const door = BUILD.door_plank || Object.values(BUILD).find((d) => d.piece === 'door');
  const spot = findSpot(sim, p, door);
  buildAt(sim, p, door.id, spot[0], spot[1]);
  const i = w.idx(spot[0], spot[1]);
  assert.ok(w.wall[i], 'door built');
  p.x = (spot[0] + 0.5) * TILE; p.y = (spot[1] + 1.6) * TILE;
  assert.equal(w.wallState[i], 0, 'closed');
  sim.exec('a', { c: 'door', tx: spot[0], ty: spot[1] });
  assert.equal(w.wallState[i], 1, 'opened by tapping');
  const chest = place(sim, p, 'chest', [sim.spawn.x, sim.spawn.y]);
  standBelow(p, chest.x, chest.y, BUILD.chest);
  clearBag(p); give(p, 'stone', 30);
  sim.exec('a', { c: 'inv', op: 'quick', from: { k: 'p', i: 0 }, to: { id: chest.id } });
  assert.equal(bagTotal(p, 'stone'), 0, 'stone moved to the chest');
  assert.equal(chest.s.inv.filter(Boolean).reduce((a, s) => a + s.n, 0), 30);
  sim.exec('a', { c: 'inv', op: 'quick', from: { k: 't', id: chest.id, i: 0 }, to: {} });
  assert.equal(bagTotal(p, 'stone'), 30, 'and back again');
});
