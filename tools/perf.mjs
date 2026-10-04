// Frame-time stress test under CPU throttling (iPad-class). node tools/perf.mjs [throttleRate=4] [width=1180] [height=820]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [rate = '4', W = '1180', H = '820'] = process.argv.slice(2);
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(url + '?quick=nightmare&seed=perf', { waitUntil: 'load' });
await page.waitForTimeout(1500);

// ---- build a late-game scene: big lit base, furniture, farms, creatures, night + rain
const scene = await page.evaluate(() => {
  const A = __snug, g = A.game, sim = g.sim, w = g.world, me = g.me;
  w.settings.buildCost = 0; w.settings.enemyDamage = 0.5;
  for (const id of Object.keys(sim.world.techs.constructor === Set ? {} : {})) { /* noop */ }
  // unlock the tree
  const T = [...document.querySelectorAll('x')]; // placeholder to keep minifier honest
  let start = null;
  for (let gx = 0; gx < w.gw; gx++) for (let gy = 0; gy < w.gh; gy++) if (w.isLandOwned(gx, gy)) start = [gx, gy];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const gx = start[0] + dx, gy = start[1] + dy; if (gx >= 0 && gy >= 0 && gx < w.gw && gy < w.gh && !w.isLandOwned(gx, gy)) sim.claimLand(gx, gy); }
  const unlocked = [];
  return { start };
});
// unlock every tech through the real list exposed by the panels
await page.evaluate(async () => { const m = await import('./' + [...document.scripts].find((s) => s.type === 'module').src.split('/').pop()).catch(() => null); });
const info = await page.evaluate(() => {
  const A = __snug, g = A.game, sim = g.sim, w = g.world, me = g.me;
  const rng = (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const cmd = (c) => sim.exec(me.pid, c);
  const tx0 = Math.floor(me.x / 16), ty0 = Math.floor(me.y / 16);
  const at = (x, y) => { me.x = (x + 0.5) * 16; me.y = (y + 3.5) * 16; };
  // all techs (the tech ids are discoverable from the research panel's data in the sim: use a big list of ids from recipes/blueprints)
  const tryTechs = ['carpentry', 'cottage_style', 'lighting', 'storage', 'stonecraft', 'weaving', 'gardening', 'masonry', 'glassmaking', 'smelting', 'metalworking', 'modern_style', 'elegant_style', 'gothic_style', 'garden_design', 'optics', 'fortification', 'arcana', 'mycology', 'irrigation', 'greenhouse', 'frostcraft', 'desertcraft', 'prism_style', 'celestial_style', 'crystal_craft', 'star_forging', 'ironworking', 'goldsmithing', 'apiary', 'husbandry', 'bridges', 'cooking', 'kitchen', 'trade', 'fishing', 'automation', 'mechanics', 'steelmaking', 'forging', 'obsidian_craft', 'fire_arts', 'volcanic_decor', 'sky_garden'];
  for (const t of tryTechs) w.techs.add(t);
  w.shared.flags.statsRev = (w.shared.flags.statsRev || 0) + 1;
  for (const p of w.players.values()) p.stats = null;
  let placed = 0;
  const put = (bid, x, y, extra = {}) => { at(x, y); const before = w.things.size + w.wall.reduce((a, v) => a + (v ? 1 : 0), 0) + w.floor.reduce((a, v) => a + (v ? 1 : 0), 0); cmd({ c: 'build', bid, tx: x, ty: y, ...extra }); const after = w.things.size + w.wall.reduce((a, v) => a + (v ? 1 : 0), 0) + w.floor.reduce((a, v) => a + (v ? 1 : 0), 0); if (after > before) placed++; };
  // a 6 x 3 district of rooms
  const furn = ['rustic_bed', 'cottage_table', 'cottage_chair', 'modern_sofa', 'elegant_wardrobe', 'gothic_bookshelf', 'rainbow_stool', 'lamp_post', 'torch', 'campfire', 'potted_plant', 'rug_round', 'chest', 'workbench'];
  const ids = furn.filter((f) => true);
  for (let ry = 0; ry < 3; ry++) for (let rx = 0; rx < 6; rx++) {
    const x0 = tx0 - 20 + rx * 8, y0 = ty0 - 12 + ry * 8;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const edge = x === 0 || y === 0 || x === 6 || y === 6;
      if (edge) { const door = (x === 3 && y === 6); put(door ? 'door_plank' : (x + y) % 3 === 0 && !door ? 'window_plank' : 'wall_plank', x0 + x, y0 + y); }
      else put(((rx + ry) % 2) ? 'floor_parquet' : 'floor_carpet_pink', x0 + x, y0 + y);
    }
    for (let k = 0; k < 6; k++) { const f = ids[Math.floor(rng() * ids.length)]; put(f, x0 + 1 + Math.floor(rng() * 4), y0 + 1 + Math.floor(rng() * 4)); }
  }
  // enemies everywhere around
  let mobs = 0;
  for (let i = 0; i < 36; i++) { const a = rng() * 6.283, r = 30 + rng() * 130; const m = A.dbg.spawnMob(sim, ['slime_green', 'bat', 'slime_green', 'skeleton'][i % 4], me.x + Math.cos(a) * r, me.y + Math.sin(a) * r); if (m) { mobs++; m.hp = 99999; } }
  me.x = (tx0 + 0.5) * 16; me.y = (ty0 + 2.5) * 16;
  me.hp = 9999;
  w.time = w.settings.dayLength * 0.80; // night
  w.shared.weather = 2; // storm
  return { placed, things: w.things.size, walls: w.wall.reduce((a, v) => a + (v ? 1 : 0), 0), floors: w.floor.reduce((a, v) => a + (v ? 1 : 0), 0), mobs };
});
console.log('scene:', JSON.stringify(info));
await page.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(page);
const measure = async (label, r, secs, move) => {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: r });
  await page.evaluate(() => {
    const g = __snug.game;
    window.__st = { upd: [], ren: [], raf: [] };
    if (!window.__wrapped) {
      window.__wrapped = true;
      const ou = g.update.bind(g), or = g.render.bind(g);
      g.update = (dt) => { const t = performance.now(); ou(dt); window.__st.upd.push(performance.now() - t); };
      g.render = () => { const t = performance.now(); or(); window.__st.ren.push(performance.now() - t); };
      let last = performance.now();
      const tick = (t) => { window.__st.raf.push(t - last); last = t; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__st.upd.length = window.__st.ren.length = window.__st.raf.length = 0; });
  if (move) await page.keyboard.down('KeyD');
  await page.waitForTimeout(secs * 1000);
  if (move) await page.keyboard.up('KeyD');
  const s = await page.evaluate(() => window.__st);
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))] || 0; };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const fps = 1000 / avg(s.raf);
  console.log(`${label.padEnd(26)} cpu x${r}: update avg ${avg(s.upd).toFixed(2)} p95 ${q(s.upd, .95).toFixed(2)}ms | render avg ${avg(s.ren).toFixed(2)} p95 ${q(s.ren, .95).toFixed(2)} max ${Math.max(...s.ren).toFixed(1)}ms | frame p95 ${q(s.raf, .95).toFixed(1)}ms, ${fps.toFixed(0)} fps, ${s.raf.filter((x) => x > 25).length} slow frames of ${s.raf.length}`);
  return { fps, renP95: q(s.ren, .95), updP95: q(s.upd, .95) };
};
const res = {};
res.x1 = await measure('night+storm, 36 mobs', 1, 6, true);
res[`x${rate}`] = await measure('night+storm, 36 mobs', +rate, 8, true);
res.x8 = await measure('night+storm, 36 mobs', 8, 8, true);
const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1);
console.log('JS heap:', mem, 'MB');
await page.screenshot({ path: '.scratch/perf-scene.png' });
console.log('errors:', logs.length ? logs.join('\n') : 'none');
const okFps = res[`x${rate}`].fps >= 50;
console.log(okFps ? `PASS: ${res[`x${rate}`].fps.toFixed(0)} fps at ${rate}x slowdown` : `FAIL: only ${res[`x${rate}`].fps.toFixed(0)} fps at ${rate}x slowdown`);
await browser.close(); server.close();
process.exit(okFps && !logs.length ? 0 : 1);
