// Update safety check: a world saved by an OLDER version of the game (a git ref, default: what is live on origin/main) must open in
// THIS version with nothing lost or changed, play on, and the old version must still open what this one saves.
//   node tools/compat.mjs [git-ref]
// The old version is unpacked into a temp folder and driven with its own code (it builds a rich world: every kind of piece, bags full of items,
// skills, a pet, someone asleep in a bed, someone on a sofa); then this tree's code loads that save. Exit code 1 on any problem.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NEW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] || 'origin/main';
const OLD = fs.mkdtempSync(path.join(os.tmpdir(), 'snug-old-'));
execFileSync('sh', ['-c', `git -C "${NEW}" archive "${ref}" | tar -x -C "${OLD}"`], { stdio: 'inherit' });
fs.symlinkSync(path.join(NEW, 'node_modules'), path.join(OLD, 'node_modules'));
const I = (root, f) => import(path.join(root, f));
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
console.log(`the version being checked: ${ref} (${execFileSync('git', ['-C', NEW, 'rev-parse', '--short', ref]).toString().trim()})`);

// ------------------------------------------------------------------ nothing the old version knows may disappear
console.log('content: everything the old version knows still exists');
for (const [f, names] of Object.entries({
  'items.js': ['ITEMS'], 'build.js': ['BUILD', 'WALL_IDS', 'FLOOR_IDS', 'WALLDECO_IDS'], 'nodes.js': ['NODES'], 'techs.js': ['TECHS'], 'skills.js': ['SKILLS'],
  'recipes.js': ['RECIPES'], 'goals.js': ['GOAL_BY_ID'], 'mobs.js': ['MOBS'], 'biomes.js': ['BIOMES', 'GROUND_IDS'], 'crops.js': ['CROPS'],
})) {
  const o = await I(OLD, 'js/data/' + f), n = await I(NEW, 'js/data/' + f);
  for (const name of names) {
    const keys = (v) => (Array.isArray(v) ? v.map((r, i) => (r && r.id) || String(i)) : Object.keys(v));
    const ov = o[name], nv = n[name];
    if (!ov) continue; // the old version did not have it
    if (!nv) { ok(false, `${f} ${name} is gone`); continue; }
    const gone = keys(ov).filter((k) => !keys(nv).includes(k));
    const reordered = Array.isArray(ov) && typeof ov[0] === 'string' ? ov.filter((k, i) => nv[i] !== k) : []; // saved by position: removing or reordering would shift every piece after it
    ok(!gone.length && !reordered.length, `${f.padEnd(11)} ${name.padEnd(13)} ${keys(ov).length} -> ${keys(nv).length}${gone.length ? '  REMOVED: ' + gone.join(',') : ''}${reordered.length ? '  REORDERED' : ''}`);
  }
}

// ------------------------------------------------------------------ a lived-in world made by the old code
console.log('a lived-in world, made by the old version itself');
const old = { sim: await I(OLD, 'js/sim/sim.js'), ser: await I(OLD, 'js/sim/serialize.js'), diff: await I(OLD, 'js/data/difficulty.js'), build: await I(OLD, 'js/data/build.js'), items: await I(OLD, 'js/data/items.js'), util: await I(OLD, 'js/util.js'), skills: await I(OLD, 'js/data/skills.js'), techs: await I(OLD, 'js/data/techs.js') };
const nu = { ser: await I(NEW, 'js/sim/serialize.js'), fur: await I(NEW, 'js/sim/furniture.js'), build: await I(NEW, 'js/data/build.js') };
const { TILE } = old.util;
const sim = old.sim.Sim.create({ seed: 4242, settings: { ...old.diff.presetSettings('dreamy') } });
const w = sim.world;
w.hooks.tell = () => {};
const a = sim.addPlayer('alice-pid', 'Alice', { skin: 2, hair: 3 }), b = sim.addPlayer('gigi-pid', 'Gigi', { skin: 1, hair: 5, hairColor: 4 });
for (const t of Object.keys(old.techs.TECHS)) w.techs.add(t);
w.settings.buildCost = 0; w.coins = 4321;
let slot = 0;
for (const id of Object.keys(old.items.ITEMS)) { if (slot >= a.inv.length) break; a.inv[slot++] = { id, n: Math.min(99, old.items.ITEMS[id].stack || 99) }; }
for (let i = 0; i < b.inv.length; i += 2) b.inv[i] = { id: ['wood', 'stone', 'plank', 'berries', 'cloth'][i % 5], n: 1 + ((i * 7) % 99) };
a.equip.body = { id: 'tunic_cloth', n: 1 }; a.equip.head = { id: 'hat_cloth', n: 1 };
a.xp = 123.4; a.level = 9; a.sp = 4; b.xp = 55; b.level = 5; b.sp = 2;
for (const sid of Object.keys(old.skills.SKILLS).slice(0, 8)) a.skills[sid] = 1;
a.pet = 'pet_cat'; a.buffs = { speed: { t: 120, pow: 2 } };
const cx = Math.floor(a.x / TILE), cy = Math.floor(a.y / TILE);
let n = 0;
for (const id of Object.keys(old.build.BUILD)) {
  const d = old.build.BUILD[id];
  if (d.kind === 'wall' || d.kind === 'floor' || d.kind === 'walldeco') continue;
  const tx = cx - 20 + (n % 14) * 3, ty = cy - 20 + Math.floor(n / 14) * 3; n++;
  if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) continue;
  for (let y = ty; y < ty + (d.h || 1); y++) for (let x = tx; x < tx + (d.w || 1); x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); const f = w.flatAt(x, y); if (f) w.removeThing(f.id); }
  a.x = (tx + 0.5) * TILE; a.y = (ty + 2) * TILE;
  try { sim.exec('alice-pid', { c: 'build', bid: id, tx, ty }); } catch (e) { /* the old version's own rules */ }
}
// walls, floors and decorations too (one of each kind near the start)
let k = 0;
for (const id of Object.keys(old.build.BUILD)) {
  const d = old.build.BUILD[id];
  if (!(d.kind === 'wall' || d.kind === 'floor' || d.kind === 'walldeco')) continue;
  const tx = cx - 20 + (k % 40), ty = cy + 6 + Math.floor(k / 40) * 2; k++;
  if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) continue;
  a.x = (tx + 0.5) * TILE; a.y = (ty + 2) * TILE;
  try { sim.exec('alice-pid', { c: 'build', bid: id, tx, ty }); } catch (e) { /* ignore */ }
}
const bed = [...w.things.values()].find((t) => old.build.BUILD[t.type] && old.build.BUILD[t.type].behavior === 'bed');
const sofa = [...w.things.values()].find((t) => old.build.BUILD[t.type] && old.build.BUILD[t.type].behavior === 'seat');
const chest = [...w.things.values()].find((t) => t.type === 'chest');
if (chest) { chest.s = { inv: Array(8).fill(null) }; chest.s.inv[0] = { id: 'wood', n: 77 }; chest.s.inv[5] = { id: 'plank', n: 31 }; }
const furnace = [...w.things.values()].find((t) => t.type === 'furnace');
if (furnace) furnace.s = { inp: { id: 'copper_ore', n: 6 }, fuel: { id: 'wood', n: 9 }, out: { id: 'copper_bar', n: 2 }, t: 3 };
if (bed) { a.x = (bed.x + bed.w / 2) * TILE; a.y = (bed.y + bed.h) * TILE - 5; w.time = 0.95; sim.exec('alice-pid', { c: 'interact', id: bed.id }); }
if (sofa) { b.x = (sofa.x + sofa.w / 2) * TILE; b.y = (sofa.y + sofa.h) * TILE - 2; sim.exec('gigi-pid', { c: 'interact', id: sofa.id }); }
for (let i = 0; i < 30 * 20; i++) sim.update(1 / 30);
const raw = JSON.stringify(old.ser.serializeWorld(sim));
console.log(`  ${w.things.size} things, ${(raw.length / 1024).toFixed(0)} KB save, save version ${JSON.parse(raw).v}; Alice asleep: ${a.sleeping}, Gigi sitting: ${!!b.sit}`);

// ------------------------------------------------------------------ this version opens it
console.log('this version opens it');
const data = JSON.parse(raw);
const { world: w2, sim: sim2 } = nu.ser.restoreWorld(data);
ok(w2.things.size === w.things.size, `every thing is back (${w2.things.size} of ${w.things.size})`);
ok(w2.coins === w.coins && w2.day === w.day && w2.time === w.time, 'coins, day and time');
ok(w2.techs.size === w.techs.size, `all ${w.techs.size} technologies`);
let bad = 0;
for (const [id, t] of w.things) {
  const t2 = w2.things.get(id);
  const same = t2 && t2.type === t.type && t2.x === t.x && t2.y === t.y && t2.w === t.w && t2.h === t.h && t2.flip === t.flip && t2.dep === t.dep && JSON.stringify(t2.s) === JSON.stringify(t.s) && Math.abs(t2.hp - t.hp) < 0.06 && !(t2.rot || 0) && !(t2.col || 0);
  if (!same) { bad++; console.log('    changed:', id, t.type); }
}
ok(!bad, 'every thing: same kind, place, size and state; none turned or painted');
for (const key of ['ground', 'owned', 'floor', 'wall', 'deco']) ok(Buffer.compare(Buffer.from(w2[key]), Buffer.from(w[key])) === 0, key + ' layer identical');
ok(![...w2.floorCol, ...w2.wallCol, ...w2.decoCol, ...w2.floorRot, ...w2.wallRot, ...w2.decoRot].some(Boolean), 'nothing is painted or turned');
ok(JSON.stringify([...w2.drops.values()].map((d) => [d.id, d.item, d.n])) === JSON.stringify([...w.drops.values()].map((d) => [d.id, d.item, d.n])), 'dropped items');
for (const pid of ['alice-pid', 'gigi-pid']) {
  const p0 = w.players.get(pid), p1 = w2.players.get(pid);
  ok(!!p1 && JSON.stringify(p1.inv) === JSON.stringify(p0.inv), pid + ': bag identical');
  ok(JSON.stringify(p1.equip) === JSON.stringify(p0.equip) && p1.level === p0.level && p1.sp === p0.sp && JSON.stringify(p1.skills) === JSON.stringify(p0.skills), pid + ': wearing, level, skill points, skills');
  ok(JSON.stringify(p1.spawn) === JSON.stringify(p0.spawn), pid + ': the bed they respawn at ' + JSON.stringify(p1.spawn));
}
ok(w2.players.get('alice-pid').pet === a.pet, 'pet');
const re = JSON.parse(JSON.stringify(nu.ser.serializeWorld(sim2)));
const strip = (d) => { const c = JSON.parse(JSON.stringify(d)); c.things = c.things.map((r) => r.slice(0, 9)); for (const p of c.players) { delete p.x; delete p.y; } return c; };
const A = strip(data), B = strip(re);
for (const key of Object.keys(A)) { if (key === 'players' || key === 'things') continue; try { assert.deepEqual(B[key], A[key]); } catch (e) { ok(false, 'saved field changed: ' + key); } }
ok(JSON.stringify(B.things) === JSON.stringify(A.things) && JSON.stringify(B.players) === JSON.stringify(A.players), 'saving it again changes nothing (apart from the new trailing columns)');
ok(Object.keys(re).every((k) => k in data || ['floorCol', 'wallCol', 'decoCol', 'floorRot', 'wallRot', 'decoRot'].includes(k)), 'no new top-level fields appear in a world nobody painted or turned');
ok(re.v === data.v, `the save version stays ${re.v}, so the OLD version can still open a world this one saved`);
const back = old.ser.restoreWorld(JSON.parse(JSON.stringify(re)));
ok(back.world.things.size === w.things.size, `the old version opens what this one saved (${back.world.things.size} things)`);

// ------------------------------------------------------------------ playing on
console.log('playing on');
const q = sim2;
q.world.hooks.tell = () => {};
const A2 = q.addPlayer('alice-pid', 'Alice', {}), B2 = q.addPlayer('gigi-pid', 'Gigi', {});
ok(A2.inv === w2.players.get('alice-pid').inv, 'Alice rejoins her own character');
let threw = null;
try { for (let i = 0; i < 30 * 60; i++) q.update(1 / 30); } catch (e) { threw = e; }
ok(!threw, 'a minute of play' + (threw ? ': ' + threw.stack : ''));
const stuck = nu.fur.unstickSpot(w2, A2.x, A2.y);
console.log(`  Alice was saved at ${Math.round(data.players[0].x)},${Math.round(data.players[0].y)}: ${stuck ? 'inside a bed, the game moves her out to ' + Math.round(stuck.x) + ',' + Math.round(stuck.y) : 'standing free'}`);
ok(JSON.stringify(A2.inv) === JSON.stringify(w2.players.get('alice-pid').inv), 'bag untouched by a minute of play');
if (bed) {
  const bed2 = w2.things.get(bed.id);
  A2.x = (bed2.x + bed2.w / 2) * TILE; A2.y = (bed2.y + bed2.h + 1) * TILE; w2.time = 0.95;
  q.exec('alice-pid', { c: 'interact', id: bed2.id });
  ok(A2.sleeping, 'a bed the old version built can be slept in');
  const spot = nu.fur.exitSpot(w2, A2); A2.sleeping = false; if (spot) { A2.x = spot.x; A2.y = spot.y; } q.exec('alice-pid', { c: 'wake' });
  ok(!A2.sleeping && !nu.fur.unstickSpot(w2, A2.x, A2.y), 'and she gets up beside it, never inside it');
}
if (sofa) {
  const s2 = w2.things.get(sofa.id);
  B2.x = (s2.x + s2.w / 2) * TILE; B2.y = (s2.y + s2.h + 1) * TILE;
  q.exec('gigi-pid', { c: 'interact', id: s2.id });
  ok(!!B2.sit, 'a sofa the old version built can be sat on');
}
A2.hp = 0; A2.dead = 0.01; for (let i = 0; i < 40; i++) q.update(1 / 30);
ok(A2.hp > 0 && !nu.fur.unstickSpot(w2, A2.x, A2.y), 'respawning at the bed she set puts her beside it');
// painting an old building works and still saves in a way the old version opens
if (bed) {
  const bed3 = w2.things.get(bed.id);
  A2.x = (bed3.x + 0.5) * TILE; A2.y = (bed3.y + bed3.h + 1) * TILE;
  q.exec('alice-pid', { c: 'paint', tx: bed3.x, ty: bed3.y, col: 0x8000 | 20000 % 0x7fff });
  ok(bed3.col > 0, 'a bed built long ago can be painted');
  const after = JSON.parse(JSON.stringify(nu.ser.serializeWorld(q)));
  ok(!!old.ser.restoreWorld(after).world.things.get(bed.id), 'and the old version still opens that painted world');
}
fs.rmSync(OLD, { recursive: true, force: true });
console.log(failed ? `\nFAILED ${failed}` : '\nALL OK: a world saved by ' + ref + ' opens, plays and saves safely in this version');
process.exit(failed ? 1 : 0);
