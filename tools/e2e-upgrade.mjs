// Update safety in a real browser: the OLD version (a git ref, default origin/main = what is live) creates and saves an island; then THIS build opens it
// from the very same browser storage, the way your own browser meets an update; then the old version opens what this one saved (a way back).
//   node tools/e2e-upgrade.mjs [git-ref] [chromium|webkit]
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import { build } from './build.mjs';
import { SAVE_EPOCH } from '../js/sim/serialize.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2] || 'origin/main', engine = process.argv[3] || 'webkit';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'snug-upgrade-'));
const OLD = path.join(TMP, 'old');
fs.mkdirSync(OLD);
execFileSync('sh', ['-c', `git -C "${ROOT}" archive "${ref}" | tar -x -C "${OLD}"`], { stdio: 'inherit' });
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(OLD, 'node_modules'));
const oldBuilt = await (await import(path.join(OLD, 'tools/build.mjs'))).build({ outdir: path.join(OLD, 'dist') });
const newBuilt = await build({ outdir: path.join(TMP, 'new') });
console.log(`old = ${ref} (${oldBuilt.hash}), new = this tree (${newBuilt.hash}), ${engine}`);

let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const logs = [];
const first = await startServer(path.join(OLD, 'dist'));
const port = first.port, origin = `http://127.0.0.1:${port}/`;
let server = first.server;
const swap = async (dir) => { await new Promise((r) => server.close(r)); server = (await startServer(dir, port)).server; };
const browser = await (engine === 'chromium' ? chromium : webkit).launch();
const open = async (state) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, ...(state ? { storageState: state } : {}) });
  // older builds do not know how to stay quiet under a test program: take their AudioContext away (they treat that as "no sound on this device")
  await ctx.addInitScript(() => { for (const k of ['AudioContext', 'webkitAudioContext']) { try { Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); } catch (e) { /* fine */ } } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
  return { ctx, page };
};
const rawDB = (page) => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('snug-isles');
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction(['worlds', 'meta']), out = { keys: [], worlds: [], meta: [] };
    const k = tx.objectStore('worlds').getAllKeys(), a = tx.objectStore('worlds').getAll(), m = tx.objectStore('meta').getAll();
    tx.oncomplete = () => { out.keys = k.result; out.worlds = a.result; out.meta = m.result; db.close(); res(out); };
    tx.onerror = () => rej(tx.error);
  };
  r.onerror = () => rej(r.error);
}));

// ------------------------------------------------------------------ 1. the old version makes an island worth keeping
console.log('1. the old version builds an island and saves it');
let A = await open();
await A.page.goto(origin + '?quick=dreamy&seed=upgrade-test', { waitUntil: 'load' });
await A.page.waitForTimeout(1800);
const made = await A.page.evaluate(async () => {
  const g = __snug.game, w = g.world, me = g.me;
  w.settings.buildCost = 0; w.settings.enemyDensity = 0;
  for (const t of ['carpentry', 'cottage_style', 'stonecraft', 'smelting']) w.techs.add(t);
  let at = null;
  for (let r = 3; r < 40 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) {
    const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
    for (let y = y0 - 1; y < y0 + 8 && good; y++) for (let x = x0 - 1; x < x0 + 9 && good; x++) if (!w.inb(x, y) || !w.isTileOwned(x, y) || w.ground[w.idx(x, y)] === 0 || w.wall[w.idx(x, y)] || w.floor[w.idx(x, y)]) good = false;
    if (good) at = [x0, y0];
  }
  const [x, y] = at;
  for (let yy = y - 1; yy < y + 8; yy++) for (let xx = x - 1; xx < x + 9; xx++) { const t = w.thingAt(xx, yy); if (t) w.removeThing(t.id); }
  me.x = (x + 4) * 16; me.y = (y + 5) * 16;
  const cmds = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) cmds.push({ c: 'build', bid: 'floor_plank', tx: x + i, ty: y + j });
  for (let i = 0; i < 8; i++) { cmds.push({ c: 'build', bid: 'wall_plank', tx: x + i, ty: y }); if (i !== 4) cmds.push({ c: 'build', bid: 'wall_plank', tx: x + i, ty: y + 5 }); }
  cmds.push({ c: 'build', bid: 'door_plank', tx: x + 4, ty: y + 5 }, { c: 'build', bid: 'rustic_bed', tx: x + 1, ty: y + 1 }, { c: 'build', bid: 'rustic_sofa', tx: x + 4, ty: y + 2 }, { c: 'build', bid: 'chest', tx: x + 6, ty: y + 1 }, { c: 'build', bid: 'furnace', tx: x + 6, ty: y + 3 }, { c: 'build', bid: 'rustic_table', tx: x + 3, ty: y + 3 });
  for (const c of cmds) g.cmd(c);
  await new Promise((r) => setTimeout(r, 400));
  me.inv.fill(null);
  const bag = ['wood', 'stone', 'plank', 'berries', 'cloth', 'copper_ore', 'fiber', 'clay'];
  bag.forEach((id, i) => { me.inv[i + 1] = { id, n: 7 + i * 11 }; });
  me.inv[0] = { id: 'pickaxe_wood', n: 1 }; me.rev++;
  const chest = [...w.things.values()].find((t) => t.type === 'chest');
  chest.s.inv[0] = { id: 'wood', n: 77 }; chest.s.inv[3] = { id: 'plank', n: 31 }; w.patchThing(chest.id, { s: chest.s });
  w.coins = 777;
  // a night in the bed: this is what used to leave you stuck inside it
  const bed = [...w.things.values()].find((t) => t.type === 'rustic_bed');
  w.time = (w.settings.dayLength || 600) * 0.8;
  me.x = (bed.x + bed.w / 2) * 16; me.y = (bed.y + bed.h) * 16 - 4;
  g.cmd({ c: 'interact', id: bed.id });
  await new Promise((r) => setTimeout(r, 500));
  await g.save();
  return { things: w.things.size, bed: bed.id, sleeping: me.sleeping, at };
});
console.log('  ', JSON.stringify(made));
const before = await rawDB(A.page);
ok(before.worlds.length === 1 && before.meta.length === 1, 'the old version saved one world');
const oldSave = JSON.parse(before.worlds[0]), oldMeta = before.meta[0], worldId = before.keys[0];
// a copy is kept only when the old version is an older generation than this one (a same-generation update must not make needless copies)
const needsCopy = (oldMeta.epoch || 1) < SAVE_EPOCH;
ok(oldSave.things.length >= 30 && !('floorCol' in oldSave), `it has ${oldSave.things.length} things and is not painted (the old version's generation: ${oldMeta.epoch || 1}, this one: ${SAVE_EPOCH}, so ${needsCopy ? 'a copy is expected' : 'no copy is expected'})`);
const state1 = await A.ctx.storageState({ indexedDB: true });
await A.ctx.close();

// ------------------------------------------------------------------ 2. this build opens it
console.log('2. this build opens that very island');
await swap(path.join(TMP, 'new'));
const B = await open(state1);
await B.page.goto(origin, { waitUntil: 'load' });
await B.page.waitForTimeout(1800);
const listed = await B.page.evaluate(() => __snug.listWorlds());
ok(listed.length === 1 && listed[0].id === worldId, 'the island is in the world list after the update');
await B.page.evaluate(() => __snug.screens.worlds({}));
await B.page.waitForTimeout(500);
ok(await B.page.locator('.save-card').count() === 1, 'one island card on the Your worlds screen');
await B.page.locator('.save-card button', { hasText: 'Play' }).first().click();
await B.page.waitForTimeout(2200);
const st = await B.page.evaluate((oldSaveThings) => {
  const g = __snug.game, w = g.world, me = g.me;
  const things = oldSaveThings.map((r) => { const t = w.things.get(r[0]); return !!(t && t.type === r[1] && t.x === r[2] && t.y === r[3] && !t.rot && !t.col); });
  const chest = [...w.things.values()].find((t) => t.type === 'chest');
  return { count: w.things.size, things, inv: me.inv.map((s) => s && s.id + ':' + s.n), chest: chest && chest.s.inv.map((s) => s && s.id + ':' + s.n), coins: w.coins, free: w.boxFree(me.x, me.y - 3, 4, 3), sleeping: me.sleeping, bed: me.bed, mode: g.mode, rotated: [...w.things.values()].filter((t) => t.rot).length };
}, oldSave.things);
ok(st.things.every(Boolean) && st.count === oldSave.things.length, `all ${st.count} things are where they were`);
ok(JSON.stringify(st.inv) === JSON.stringify(oldSave.players[0].inv.map((s) => s && s.id + ':' + s.n)), 'the bag is exactly as it was');
ok(st.chest && st.chest[0] === 'wood:77' && st.chest[3] === 'plank:31', 'the chest still holds its things');
ok(st.coins >= oldSave.coins, `coins (${oldSave.coins} saved, ${st.coins} now: goals the old version had not yet noticed pay out when the game wakes up)`);
ok(st.free, 'the player is standing on free ground (not stuck inside the bed they saved in)');
const after = await rawDB(B.page);
const copyKey = 'before-' + worldId;
if (needsCopy) {
  ok(after.keys.includes(copyKey) && after.keys.includes(worldId) && after.keys.length === 2, `a copy was kept next to the island (${after.keys.join(', ')})`);
  let same = false; try { assert.deepEqual(JSON.parse(after.worlds[after.keys.indexOf(copyKey)]), oldSave); same = true; } catch (e) { /* reported below */ }
  ok(same, 'and the copy is byte-for-byte the island as the old version saved it');
} else ok(after.keys.length === 1 && after.keys[0] === worldId, `no needless copy: the old version was already this generation (${after.keys.join(', ')})`);
const metaNow = after.meta.map((m, i) => ({ key: i, ...m }));
const lst = await B.page.evaluate(() => __snug.listWorlds());
ok(needsCopy ? lst.length === 2 && lst.some((m) => m.id === copyKey && /before the update/.test(m.name)) && lst.some((m) => m.id === worldId && m.epoch >= SAVE_EPOCH) : lst.length === 1 && lst[0].epoch >= SAVE_EPOCH, needsCopy ? 'the world list shows the island and "(before the update)", and the island is now stamped' : 'the world list shows just the island, stamped with this generation');
void metaNow;
// use the furniture of the old island
const use = await B.page.evaluate(async () => {
  const g = __snug.game, w = g.world, me = g.me;
  const bed = [...w.things.values()].find((t) => t.type === 'rustic_bed'), sofa = [...w.things.values()].find((t) => t.type === 'rustic_sofa');
  w.settings.sleep = 'any'; w.time = (w.settings.dayLength || 600) * 0.8;
  me.x = (bed.x + bed.w / 2) * 16; me.y = (bed.y + bed.h + 1) * 16;
  g.cmd({ c: 'interact', id: bed.id }); await new Promise((r) => setTimeout(r, 500));
  const slept = me.sleeping;
  // getting up: a direction press (what the game does when a key goes down while lying in a bed)
  g.input.keys.add('KeyD'); await new Promise((r) => setTimeout(r, 400)); g.input.keys.delete('KeyD');
  await new Promise((r) => setTimeout(r, 300));
  const up = !me.sleeping && w.boxFree(me.x, me.y - 3, 4, 3);
  me.x = (sofa.x + 0.5) * 16; me.y = (sofa.y + sofa.h + 1) * 16;
  g.cmd({ c: 'interact', id: sofa.id }); await new Promise((r) => setTimeout(r, 400));
  const sat = !!me.sit;
  g.input.keys.add('KeyS'); await new Promise((r) => setTimeout(r, 400)); g.input.keys.delete('KeyS');
  return { slept, up, sat };
});
ok(use.slept && use.up, 'a bed from the old version can be slept in, and getting up leaves you beside it, free to walk');
ok(use.sat, 'a sofa from the old version can be sat on');
// paint something old, keep playing, save
const painted = await B.page.evaluate(async () => {
  const g = __snug.game, w = g.world, me = g.me, sofa = [...w.things.values()].find((t) => t.type === 'rustic_sofa');
  me.x = (sofa.x + 0.5) * 16; me.y = (sofa.y + sofa.h + 1) * 16;
  g.cmd({ c: 'paint', tx: sofa.x, ty: sofa.y, col: 0x8000 | (28 << 10) | (10 << 5) | 11 });
  await new Promise((r) => setTimeout(r, 400));
  await g.save();
  return w.things.get(sofa.id).col;
});
ok(painted > 0, 'the old sofa can be painted');
// a reload of the page must not make another copy
await B.page.reload({ waitUntil: 'load' }); await B.page.waitForTimeout(1500);
await B.page.evaluate((id) => __snug.startSaved(id, 'solo'), worldId); await B.page.waitForTimeout(1800);
const keys3 = (await rawDB(B.page)).keys;
ok(keys3.length === (needsCopy ? 2 : 1), `opening it again does not make more copies (${keys3.length} records)`);
const state2 = await B.ctx.storageState({ indexedDB: true });
await B.ctx.close();

// ------------------------------------------------------------------ 3. the way back
console.log('3. the way back: the old version opens what this one saved');
await swap(path.join(OLD, 'dist'));
const C = await open(state2);
await C.page.goto(origin, { waitUntil: 'load' });
await C.page.waitForTimeout(1500);
const l3 = await C.page.evaluate(() => __snug.listWorlds());
ok(l3.length === (needsCopy ? 2 : 1), needsCopy ? 'the old version lists both islands' : 'the old version lists the island');
await C.page.evaluate((id) => __snug.startSaved(id, 'solo'), worldId);
await C.page.waitForTimeout(2000);
const back = await C.page.evaluate(() => { const g = __snug.game; return g && g.world ? { things: g.world.things.size, coins: g.world.coins, ok: !!g.me } : null; });
ok(back && back.ok && back.things === oldSave.things.length && back.coins >= oldSave.coins, `the old version plays the island the new version saved (${JSON.stringify(back)})`);
await C.ctx.close();

await browser.close(); await new Promise((r) => server.close(r));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(logs.length ? 'LOGS:\n' + logs.join('\n') : 'no console errors');
if (logs.length) failed++;
console.log(failed ? `\n${failed} problem(s)` : '\nall good: an island saved by ' + ref + ' survives the update, with a copy kept and a way back');
process.exit(failed ? 1 : 0);
