// Gameplay smoke tests driven through real input events. node tools/e2e.mjs [engine]
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv[2] || 'chromium';
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
const logs = []; let failed = 0;
page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) failed++; };
const ev = (fn, arg) => page.evaluate(fn, arg);

await page.goto(url + '?quick=classic&seed=e2e', { waitUntil: 'load' });
await page.waitForTimeout(1200);

console.log('movement');
const p0 = await ev(() => ({ x: __snug.game.me.x, y: __snug.game.me.y }));
await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
const p1 = await ev(() => ({ x: __snug.game.me.x, y: __snug.game.me.y }));
ok(p1.x - p0.x > 20, `moved right with D (${(p1.x - p0.x).toFixed(1)}px)`);
await page.keyboard.down('KeyS'); await page.waitForTimeout(400); await page.keyboard.up('KeyS');
const p2 = await ev(() => ({ x: __snug.game.me.x, y: __snug.game.me.y }));
ok(p2.y - p1.y > 10, `moved down with S (${(p2.y - p1.y).toFixed(1)}px)`);

console.log('chopping a tree with the mouse');
const tree = await ev(() => {
  const g = __snug.game, w = g.world, me = g.me;
  let best = null, bd = 1e9;
  for (const t of w.things.values()) if (t.type === 'oak' && !t.dep) { const d = Math.hypot((t.x + .5) * 16 - me.x, (t.y + .5) * 16 - me.y); if (d < bd) { bd = d; best = t; } }
  // stand 12px below the tree
  me.x = (best.x + 0.5) * 16; me.y = (best.y + 1) * 16 + 6;
  return { id: best.id, x: best.x, y: best.y };
});
await page.waitForTimeout(200);
const woodBefore = await ev(() => __snug.game.me.inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0));
const scr = await ev((t) => { const g = __snug.game; const [cx, cy] = g.view.toClient((t.x + 0.5) * 16 - g.camX, (t.y + 0.5) * 16 - 6 - g.camY); return { cx, cy }; }, tree);
await page.mouse.move(scr.cx, scr.cy);
await page.mouse.down();
await page.waitForTimeout(3500);
await page.mouse.up();
const after = await ev((id) => { const g = __snug.game; const t = g.world.things.get(id); return { dep: t.dep, hp: t.hp, wood: g.me.inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0), xp: g.me.xp, lvl: g.me.level }; }, tree.id);
ok(after.dep === 1, 'tree was chopped down (depleted)');
ok(after.wood > woodBefore, `collected wood ${woodBefore} -> ${after.wood}`);
ok(after.xp > 0 || after.lvl > 1, 'gained xp');

console.log('build mode with the mouse');
await ev(() => { const g = __snug.game; g.world.coins = 500; for (const t of ['carpentry']) g.world.techs.add(t); g.me.inv[7] = { id: 'plank', n: 60 }; g.me.rev++; });
await ev(() => __snug.game.builder.start('floor_plank'));
const spot = await ev(() => { const g = __snug.game; const me = g.me; return { x: Math.floor(me.x / 16) + 2, y: Math.floor(me.y / 16) }; });
// find a free tile row to the right of the player
const placed0 = await ev(() => __snug.game.world.floor.reduce((a, v) => a + (v ? 1 : 0), 0));
const sc = await ev((s) => { const g = __snug.game; const [cx, cy] = g.view.toClient((s.x + 0.5) * 16 - g.camX, (s.y + 0.5) * 16 - g.camY); return { cx, cy }; }, spot);
await page.mouse.move(sc.cx, sc.cy); await page.waitForTimeout(150);
await page.mouse.down(); await page.mouse.move(sc.cx + 40, sc.cy, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(300);
const placed1 = await ev(() => __snug.game.world.floor.reduce((a, v) => a + (v ? 1 : 0), 0));
ok(placed1 > placed0, `painted floor tiles by dragging (${placed0} -> ${placed1})`);
await ev(() => __snug.game.builder.start('wall_plank'));
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
ok(await ev(() => !__snug.game.builder.active), 'Esc leaves build mode');

console.log('panels via keyboard');
for (const [key, name] of [['KeyI', 'inventory'], ['KeyC', 'craft'], ['KeyB', 'build'], ['KeyT', 'tech'], ['KeyK', 'skills'], ['KeyM', 'map']]) {
  await page.keyboard.press(key); await page.waitForTimeout(200);
  ok(await ev((n) => __snug.game.ui.name === n, name), `${key} opens ${name}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  ok(await ev(() => !__snug.game.ui.isOpen), `Esc closes ${name}`);
}

console.log('crafting through the UI command path');
await ev(() => { const g = __snug.game; g.cmd({ c: 'craft', rid: 'plank', n: 3 }); });
await page.waitForTimeout(100);
ok(await ev(() => __snug.game.me.inv.some((s) => s && s.id === 'plank')), 'crafted planks by hand');

console.log('building: the preview, turning, placing');
{
  // a clear patch of ground near the player for the furniture tests below
  await ev(() => {
    const g = __snug.game, w = g.world, me = g.me;
    g.world.settings.buildCost = 0; w.settings.enemyDensity = 0; w.techs.add('cottage_style'); w.techs.add('carpentry');
    window.__clear = (cw, ch) => {
      for (let r = 3; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
        for (let y = y0 - 1; y < y0 + ch + 1 && good; y++) for (let x = x0 - 1; x < x0 + cw + 1 && good; x++) { if (!w.inb(x, y) || !w.isTileOwned(x, y) || w.ground[w.idx(x, y)] === 0) good = false; } // trees, rocks, floors and walls of earlier steps do not count: they are cleared below
        if (!good) continue;
        for (let y = y0 - 1; y < y0 + ch + 1; y++) for (let x = x0 - 1; x < x0 + cw + 1; x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); const f = w.flatAt(x, y); if (f) w.removeThing(f.id); const i = w.idx(x, y); if (w.wall[i]) w.setWall(x, y, 0, 0, true); if (w.floor[i]) w.setFloor(x, y, 0, true); }
        return [x0, y0];
      }
      return null;
    };
  });
  const [px, py] = await ev(() => window.__clear(6, 6));
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 3) * 16; me.y = (y + 5) * 16; }, [px, py]);
  await page.waitForTimeout(200);
  await ev(() => __snug.game.builder.start('rustic_sofa'));
  const pt = (tx, ty) => ev(([x, y]) => { const g = __snug.game; const [cx, cy] = g.view.toClient((x + 1) * 16 - g.camX, (y + 0.5) * 16 - g.camY); return { cx, cy }; }, [tx, ty]);
  let c = await pt(px + 2, py + 2);
  await page.mouse.move(c.cx, c.cy); await page.waitForTimeout(250);
  let b = await ev(() => { const g = __snug.game, b = g.builder; return { ok: b.ok, reason: b.reason, rot: b.rot, fp: b.footprint(), tx: b.tx, ty: b.ty }; });
  ok(b.ok && b.fp[0] === 2 && b.fp[1] === 1, `the preview is green over free ground and 2x1 (${JSON.stringify(b)})`);
  // the picture itself: the ghost changes pixels of the world (this is what was missing: it was never drawn)
  const diff = await ev(() => {
    const g = __snug.game, bd = g.builder, c2 = g.renderer.canvas.getContext('2d');
    g.render();
    const x = Math.round(bd.tx * 16 - g.camX), y = Math.round(bd.ty * 16 - g.camY) - 8;
    const A = c2.getImageData(x, y, 32, 26).data;
    bd.active = false; g.render(); const B = c2.getImageData(x, y, 32, 26).data; bd.active = true;
    let n = 0; for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) n++;
    return n;
  });
  ok(diff > 150, `the see-through preview is really drawn on the picture (${diff} pixels differ)`);
  await page.keyboard.press('KeyR'); await page.waitForTimeout(150);
  b = await ev(() => { const bd = __snug.game.builder; return { rot: bd.rot, fp: bd.footprint() }; });
  ok(b.rot === 1 && b.fp[0] === 1 && b.fp[1] === 2, `R turns it a quarter and the footprint turns with it (${JSON.stringify(b)})`);
  await page.keyboard.press('Shift+KeyR'); await page.waitForTimeout(150);
  ok((await ev(() => __snug.game.builder.rot)) === 0, 'Shift+R turns it back');
  const sel0 = await ev(() => __snug.game.me.sel);
  await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  ok((await ev(() => __snug.game.builder.rot)) === 1 && (await ev(() => __snug.game.me.sel)) === sel0, 'the mouse wheel turns the piece (and does not change the hotbar)');
  await page.getByRole('button', { name: 'Rotate' }).click(); await page.waitForTimeout(150);
  ok((await ev(() => __snug.game.builder.rot)) === 2, 'the Rotate button turns it too');
  // red when it cannot go, and it says why
  await page.keyboard.press('KeyR'); await page.waitForTimeout(100); await page.keyboard.press('KeyR'); await page.waitForTimeout(100);
  c = await pt(px + 2, py + 2);
  await page.mouse.move(c.cx + 3, c.cy + 3); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  const placed = await ev(() => { const w = __snug.game.world; const t = [...w.things.values()].find((q) => q.type === 'rustic_sofa'); return t ? { rot: t.rot || 0, w: t.w, h: t.h, x: t.x, y: t.y } : null; });
  ok(placed && placed.rot === 0 && placed.w === 2 && placed.h === 1, `a click puts it down turned the way the preview showed (${JSON.stringify(placed)})`);
  const here = await ev(() => { const bd = __snug.game.builder; return { ok: bd.ok, reason: bd.reason }; });
  ok(!here.ok && here.reason, `on top of itself the preview is red and says why ("${here.reason}")`);
  await ev(() => __snug.game.builder.startRemove());
  await page.waitForTimeout(150);
  ok(await ev(() => __snug.game.builder.active && __snug.game.builder.remove), 'the remove tool shows what it would take away');
  await ev(() => __snug.game.builder.stop());
}

console.log('furniture: sitting on a sofa, lying in a bed, getting up');
{
  const [fx, fy] = await ev(() => window.__clear(8, 6));
  const ids = await ev(([x, y]) => {
    const g = __snug.game, w = g.world;
    const sofa = w.addThing('rustic_sofa', x + 1, y + 1, { rot: 0 });
    const bed = w.addThing('rustic_bed', x + 5, y + 1, { rot: 1 });
    return { sofa: sofa.id, bed: bed.id };
  }, [fx, fy]);
  // walk up to the sofa and press E
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 1.5) * 16; me.y = (y + 3) * 16; }, [fx, fy]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  let st = await ev(() => { const me = __snug.game.me; return { sit: me.sit, sleeping: me.sleeping, x: me.x, y: me.y }; });
  ok(st.sit && st.sit.id === ids.sofa, `E sits you on the sofa (${JSON.stringify(st.sit)})`);
  const shotDir = '.scratch'; 
  await page.screenshot({ path: `${shotDir}/e2e-sitting.png` }).catch(() => {});
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  st = await ev(() => { const g = __snug.game, me = g.me; return { sit: me.sit, x: me.x, free: g.world.boxFree(me.x, me.y - 3, 4, 3) }; });
  ok(!st.sit && st.free, 'walking gets you up and you are on free ground');
  // the bed
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 5.5) * 16; me.y = (y + 3) * 16; }, [fx, fy]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  st = await ev(() => { const me = __snug.game.me; return { sleeping: me.sleeping, x: me.x, y: me.y }; });
  ok(st.sleeping, 'E lies you down in the bed (in the daytime too)');
  await page.screenshot({ path: `${shotDir}/e2e-sleeping.png` }).catch(() => {});
  const bx = st.x;
  await page.keyboard.down('KeyS'); await page.waitForTimeout(120); await page.keyboard.up('KeyS');
  await page.waitForTimeout(150);
  st = await ev(() => { const g = __snug.game, me = g.me; return { sleeping: me.sleeping, x: me.x, y: me.y, free: g.world.boxFree(me.x, me.y - 3, 4, 3) }; });
  ok(!st.sleeping && st.free, 'pressing a key gets you out of bed onto free ground (no more stuck in the bed)');
  const y1 = st.y;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  const x2 = await ev(() => __snug.game.me.x);
  ok(x2 - st.x > 15, `and you can walk away from it (${(x2 - st.x).toFixed(1)}px)`);
  // lying down and pressing E again also gets you up
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 5.5) * 16; me.y = (y + 3) * 16; }, [fx, fy]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  ok(await ev(() => __snug.game.me.sleeping), 'lying down again');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  st = await ev(() => { const g = __snug.game, me = g.me; return { sleeping: me.sleeping, free: g.world.boxFree(me.x, me.y - 3, 4, 3) }; });
  ok(!st.sleeping && st.free, 'E on the bed again gets you up');
}

console.log('painting: the Color picker, building in a color, the brush, the dropper');
{
  const [px, py] = await ev(() => window.__clear(8, 6));
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 2.5) * 16; me.y = (y + 4) * 16; me.x = Math.round(me.x); }, [px, py]);
  await page.waitForTimeout(250);
  const colorOf = (hx) => ev((hx) => { const n = parseInt(hx.slice(1), 16), q = (v) => Math.round(v * 31 / 255); return 0x8000 | (q(n >> 16 & 255) << 10) | (q(n >> 8 & 255) << 5) | q(n & 255); }, hx);
  const tileXY = (tx, ty) => ev(([x, y]) => { const g = __snug.game; const [cx, cy] = g.view.toClient((x + 0.5) * 16 - g.camX, (y + 0.5) * 16 - g.camY); return { x: cx, y: cy }; }, [tx, ty]);
  const box = async (sel) => { const r = await page.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, w: r.width }; };
  const swatch = async (title) => { const c = await box(`.cp-sw[title="${title}"]`); await page.mouse.click(c.x, c.y); await page.waitForTimeout(150); };
  const tap = async (p) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(220); };
  const sweep = async (a, b, steps = 12) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(40); for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await page.waitForTimeout(25); } await page.mouse.up(); await page.waitForTimeout(250); };
  const floorCol = (dx, dy) => ev(([x, y]) => { const w = __snug.game.world; return w.floorCol[w.idx(x, y)]; }, [px + dx, py + dy]);
  const col = () => ev(() => __snug.game.builder.col);
  await ev(() => { localStorage.removeItem('snug.paint'); localStorage.removeItem('snug.paint.recent'); __snug.game.builder.setColor(0, false); __snug.game.builder.start('floor_plank'); });
  await page.waitForTimeout(200);
  ok(await page.locator('.buildbar .cp, .buildside .cp').count() === 0, 'the picker is closed to begin with');
  await page.getByRole('button', { name: 'Color' }).click(); await page.waitForTimeout(250);
  ok(await page.locator('.buildside .cp').isVisible(), 'the Color button opens the picker beside the world');
  const pb = await page.locator('.buildside .cp').boundingBox(), vp = page.viewportSize();
  ok(pb.x >= 0 && pb.y >= 0 && pb.x + pb.width <= vp.width && pb.y + pb.height <= vp.height, `it fits on the screen (${Math.round(pb.width)}x${Math.round(pb.height)})`);
  const mid = await tileXY(px + 2, py + 2);
  ok(!(mid.x > pb.x && mid.x < pb.x + pb.width && mid.y > pb.y && mid.y < pb.y + pb.height), 'and it is not over the place you are building');
  const red = await colorOf('#e0525c');
  await swatch('Red');
  ok((await col()) === red, 'a swatch chooses its color');
  ok(await page.locator('.cp-sw.on[title="Red"]').count() === 1, 'and shows which one is chosen');
  await tap(await tileXY(px + 2, py + 2));
  ok((await floorCol(2, 2)) === red, 'a floor tile is built in that color');
  const rgb = await ev(([x, y]) => { const g = __snug.game, c = g.renderer.canvas.getContext('2d'); g.fx.flash = 0; g.fx.parts.length = 0; g.fx.pops.length = 0; g.builder.active = false; g.render(); g.builder.active = true; const d = c.getImageData(Math.round((x + 0.5) * 16 - g.camX), Math.round((y + 0.5) * 16 - g.camY), 1, 1).data; return [d[0], d[1], d[2]]; }, [px + 2, py + 2]);
  ok(rgb[0] > rgb[1] + 40 && rgb[0] > rgb[2] + 30, `and it is drawn red on the screen (${rgb})`);
  // the preview is in the chosen color too
  await swatch('Blue');
  const ghost = await ev(([x, y]) => { const g = __snug.game, c = g.renderer.canvas.getContext('2d'), b = g.builder; b.update(1 / 60, { wx: (x + 0.5) * 16, wy: (y + 0.5) * 16, valid: true, down: false, pressed: false, released: false, touch: false }); g.fx.flash = 0; g.fx.parts.length = 0; g.fx.pops.length = 0; g.render(); const d = c.getImageData(Math.round((x + 0.5) * 16 - g.camX), Math.round((y + 0.5) * 16 - g.camY), 1, 1).data; return [d[0], d[1], d[2]]; }, [px + 5, py + 2]);
  ok(ghost[2] > ghost[0] + 15, `the see-through preview is blue (${ghost})`);
  // sliders: a real drag on the track
  const before = await col();
  const hue = await box('.cp-slider:nth-child(1) .cp-track');
  await sweep({ x: hue.l + hue.w * 0.05, y: hue.y }, { x: hue.l + hue.w * 0.6, y: hue.y + 2 });
  ok((await col()) !== before && (await col()) > 0, 'dragging the hue slider changes the color');
  const hx = await page.locator('.cp-hex').inputValue();
  ok(/^#[0-9a-f]{6}$/.test(hx), 'and the code box follows (' + hx + ')');
  const light = await box('.cp-slider:nth-child(3) .cp-track');
  const lc = await col();
  await sweep({ x: light.l + light.w * 0.5, y: light.y }, { x: light.l + light.w + 150, y: light.y + 200 });
  ok((await col()) !== lc && (await col()) >= 0x8000, 'dragging a slider far past its end keeps a valid color');
  // typing a color
  const green = await colorOf('#33aa66');
  await page.locator('.cp-hex').fill('#33aa66'); await page.waitForTimeout(120);
  ok((await col()) === green, 'a hex code sets the color');
  await page.locator('.cp-hex').fill('#zz'); await page.waitForTimeout(100);
  ok((await col()) === green && await page.locator('.cp-hex.bad').count() === 1, 'a bad code changes nothing and is marked');
  const p0 = await ev(() => [__snug.game.me.x, __snug.game.me.y]);
  await page.locator('.cp-hex').fill(''); await page.keyboard.type('wasd'); await page.waitForTimeout(300);
  const p1 = await ev(() => [__snug.game.me.x, __snug.game.me.y]);
  ok(p0[0] === p1[0] && p0[1] === p1[1], 'typing in the box does not walk the player');
  await page.locator('.cp-hex').fill('#33aa66'); await page.locator('.cp-hex').blur();
  // the brush
  await page.getByRole('button', { name: 'Paint' }).click(); await page.waitForTimeout(250);
  ok(await ev(() => __snug.game.builder.paint), 'the Paint button turns the brush on');
  await swatch('Sky');
  const sky = await colorOf('#a9d3f2');
  await tap(await tileXY(px + 2, py + 2));
  ok((await floorCol(2, 2)) === sky, 'the brush recolors a floor tile that was already built (free)');
  await ev(([x, y]) => { const g = __snug.game; g.me.x = (x + 2.5) * 16; g.me.y = (y + 4) * 16; for (let i = 0; i < 5; i++) g.cmd({ c: 'build', bid: 'floor_plank', tx: x + i, ty: y + 1 }); g.cmd({ c: 'build', bid: 'wall_plank', tx: x + 6, ty: y + 1 }); g.cmd({ c: 'build', bid: 'rustic_sofa', tx: x + 5, ty: y + 3 }); }, [px, py]);
  await page.waitForTimeout(300);
  await swatch('Butter');
  const butter = await colorOf('#f7e08e');
  await sweep(await tileXY(px, py + 1), await tileXY(px + 4, py + 1), 14);
  const row = await ev(([x, y]) => { const w = __snug.game.world; return [0, 1, 2, 3, 4].map((i) => w.floorCol[w.idx(x + i, y + 1)]); }, [px, py]);
  ok(row.every((c) => c === butter), 'dragging the brush colors the whole row: ' + row.join(','));
  await ev(([x, y]) => { const g = __snug.game; for (let i = 0; i < 5; i++) g.cmd({ c: 'paint', tx: x + i, ty: y + 1, col: 0 }); }, [px, py]);
  await page.waitForTimeout(200);
  await ev(([x, y]) => { const b = __snug.game.builder, at = (tx) => ({ wx: (tx + 0.5) * 16, wy: (y + 1.5) * 16, valid: true, down: true, pressed: false, released: false, touch: false }); b.update(1 / 60, { ...at(x), pressed: true }); b.update(1 / 60, at(x + 4)); b.update(1 / 60, { ...at(x + 4), down: false, released: true }); }, [px, py]);
  await page.waitForTimeout(250);
  const fast = await ev(([x, y]) => { const w = __snug.game.world; return [0, 1, 2, 3, 4].map((i) => w.floorCol[w.idx(x + i, y + 1)]); }, [px, py]);
  ok(fast.every((c) => c === butter), 'a stroke that jumps four tiles in one frame still colors every tile in between');
  await swatch('Rose');
  const rose = await colorOf('#e88fb0');
  await tap(await tileXY(px + 6, py + 1)); await tap(await tileXY(px + 5, py + 3));
  const got = await ev(([x, y]) => { const w = __snug.game.world; return { wall: w.wallCol[w.idx(x + 6, y + 1)], sofa: w.thingAt(x + 5, y + 3).col }; }, [px, py]);
  ok(got.wall === rose && got.sofa === rose, 'the brush colors a wall and a sofa too');
  await page.screenshot({ path: '.scratch/e2e-paint.png' });
  // the dropper
  await swatch('Charcoal');
  await page.locator('.cp button', { hasText: 'Pick' }).click(); await page.waitForTimeout(200);
  ok(await ev(() => __snug.game.builder.pick), 'Pick arms the dropper');
  await tap(await tileXY(px + 5, py + 3));
  ok((await col()) === rose && !(await ev(() => __snug.game.builder.pick)), 'tapping the sofa copies its color and puts the dropper away');
  await page.locator('.cp-sw.none').click(); await page.waitForTimeout(150);
  ok((await col()) === 0, 'the striped swatch means Original');
  await tap(await tileXY(px + 5, py + 3));
  ok((await ev(([x, y]) => __snug.game.world.thingAt(x + 5, y + 3).col, [px, py])) === 0, 'the brush with Original takes the paint off');
  // remembered on this device, and gone with building mode
  await ev(() => __snug.game.builder.setColor(0x8000 | (3 << 10) | (20 << 5) | 9, true));
  ok((await ev(() => JSON.parse(localStorage.getItem('snug.paint')))).col === (0x8000 | (3 << 10) | (20 << 5) | 9), 'the chosen color is remembered');
  const rec = await ev(() => JSON.parse(localStorage.getItem('snug.paint.recent') || '[]'));
  ok(rec.length >= 3 && new Set(rec).size === rec.length, 'recent colors are kept, without repeats (' + rec.length + ')');
  await page.getByRole('button', { name: 'Done' }).click(); await page.waitForTimeout(200);
  ok(await page.locator('.buildside .cp').count() === 0 && !(await ev(() => __snug.game.builder.active)), 'Done closes building mode and the picker');
}

console.log('turning everything: a station, a window, a floor (R, Shift+R, wheel, the Rotate button)');
{
  const [px, py] = await ev(() => window.__clear(10, 6));
  await ev(([x, y]) => { const g = __snug.game, me = g.me; g.world.techs.add('kitchen'); g.world.settings.buildCost = 0; me.x = (x + 4) * 16; me.y = (y + 5) * 16; g.builder.stop(); }, [px, py]);
  await page.waitForTimeout(250);
  const tileXY = (tx, ty) => ev(([x, y]) => { const g = __snug.game; const [cx, cy] = g.view.toClient((x + 0.5) * 16 - g.camX, (y + 0.5) * 16 - g.camY); return { x: cx, y: cy }; }, [tx, ty]);
  const bd = () => ev(() => { const b = __snug.game.builder; return { rot: b.rot, fp: b.footprint(), ok: b.ok, reason: b.reason }; });
  // the kitchen: long, so it turns its footprint
  await ev(() => __snug.game.builder.start('kitchen'));
  let at = await tileXY(px + 3, py + 2);
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(250);
  let s = await bd();
  ok(s.rot === 0 && s.fp[0] === 2 && s.fp[1] === 1 && s.ok, `the kitchen preview is 2x1 and fits (${JSON.stringify(s)})`);
  ok(await page.getByRole('button', { name: 'Rotate' }).count() === 1, 'the bar offers Rotate for a station (it used to say Flip, or nothing)');
  await page.keyboard.press('KeyR'); await page.waitForTimeout(150);
  s = await bd();
  ok(s.rot === 1 && s.fp[0] === 1 && s.fp[1] === 2, `R turns it a quarter and the kitchen is 1x2 (${JSON.stringify(s)})`);
  await page.keyboard.press('KeyR'); await page.waitForTimeout(100); await page.keyboard.press('KeyR'); await page.waitForTimeout(100);
  ok((await bd()).rot === 3, 'two more turns: rot 3');
  await page.keyboard.press('Shift+KeyR'); await page.waitForTimeout(100);
  ok((await bd()).rot === 2, 'Shift+R turns it back');
  await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  ok((await bd()).rot === 3, 'the wheel turns it');
  await page.getByRole('button', { name: 'Rotate' }).click(); await page.waitForTimeout(150);
  ok((await bd()).rot === 0, 'the Rotate button turns it too');
  // the picture really changes between the turns
  const px4 = await ev(([x, y]) => {
    const g = __snug.game, c = g.renderer.canvas.getContext('2d'), b = g.builder, out = [];
    for (let rot = 0; rot < 4; rot++) {
      b.rot = rot; b.update(1 / 60, { wx: (x + 0.5) * 16, wy: (y + 0.5) * 16, valid: true, down: false, pressed: false, released: false, touch: false });
      g.fx.flash = 0; g.fx.parts.length = 0; g.fx.pops.length = 0; g.render();
      const d = c.getImageData(Math.round((x - 1) * 16 - g.camX), Math.round((y - 2) * 16 - g.camY), 64, 64).data;
      let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2]) >>> 0;
      out.push(h);
    }
    b.rot = 0;
    return out;
  }, [px + 3, py + 2]);
  ok(new Set(px4).size >= 3, `the preview looks different in the turns (${new Set(px4).size} different pictures of 4)`);
  // place it turned: it covers two tiles in a column, and nothing beside it
  await ev(() => { __snug.game.builder.rot = 1; });
  at = await tileXY(px + 3, py + 2);
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  const k = await ev(() => { const t = [...__snug.game.world.things.values()].find((q) => q.type === 'kitchen'); return t ? { rot: t.rot, w: t.w, h: t.h, x: t.x, y: t.y } : null; });
  ok(k && k.rot === 1 && k.w === 1 && k.h === 2, `the kitchen stands sideways, 1 wide and 2 deep (${JSON.stringify(k)})`);
  ok(await ev(([x, y, k]) => { const w = __snug.game.world; return !!w.thingAt(k.x, k.y + 1) && !w.thingAt(k.x + 1, k.y); }, [px, py, k]), 'it takes the tile below, not the one beside');
  // a window: it is part of a wall, and it turns too
  await ev(([x, y]) => { const g = __snug.game; g.cmd({ c: 'build', bid: 'wall_plank', tx: x + 6, ty: y + 1 }); g.cmd({ c: 'build', bid: 'wall_plank', tx: x + 8, ty: y + 1 }); g.builder.start('window_plank'); }, [px, py]);
  await page.waitForTimeout(250);
  ok(await page.getByRole('button', { name: 'Rotate' }).count() === 1, 'a window has a Rotate button');
  await page.keyboard.press('KeyR'); await page.waitForTimeout(150);
  ok((await bd()).rot === 1, 'R turns a window');
  at = await tileXY(px + 7, py + 1);
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  const wr = await ev(([x, y]) => { const w = __snug.game.world, i = w.idx(x + 7, y + 1); return { piece: w.wall[i], rot: w.wallRot[i] }; }, [px, py]);
  ok(wr.piece > 0 && wr.rot === 1, `the window was built turned (${JSON.stringify(wr)})`);
  const winPix = await ev(([x, y]) => {
    const g = __snug.game, c = g.renderer.canvas.getContext('2d'), w = g.world, i = w.idx(x + 7, y + 1), out = [];
    g.builder.active = false;
    for (const rot of [0, 1, 2, 3]) {
      w.wallRot[i] = rot; w.tileDirty.push(i); g.fx.flash = 0; g.fx.parts.length = 0; g.render();
      const d = c.getImageData(Math.round((x + 7) * 16 - g.camX), Math.round((y + 1) * 16 - g.camY) - 4, 16, 20).data;
      let h = 0; for (let j = 0; j < d.length; j += 4) h = (h * 31 + d[j] * 3 + d[j + 1] * 5 + d[j + 2]) >>> 0;
      out.push(h);
    }
    w.wallRot[i] = 1; w.tileDirty.push(i); g.builder.active = true;
    return out;
  }, [px, py]);
  ok(new Set(winPix).size === 4, `the window looks different in each of its four turns (${new Set(winPix).size} of 4)`);
  // a floor pattern turns like a picture
  await ev(() => __snug.game.builder.start('floor_plank'));
  await page.keyboard.press('KeyR'); await page.waitForTimeout(150);
  at = await tileXY(px + 2, py + 4);
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(200);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(300);
  ok((await ev(([x, y]) => { const w = __snug.game.world; return w.floorRot[w.idx(x + 2, y + 4)]; }, [px, py])) === 1, 'a floor tile was laid turned');
  await ev(() => __snug.game.builder.stop());
}

console.log('dragging items with the mouse');
{
  await ev(() => { const me = __snug.game.me; for (let i = 0; i < me.inv.length; i++) me.inv[i] = null; me.inv[10] = { id: 'plank', n: 50 }; me.inv[2] = { id: 'stone', n: 7 }; me.inv[3] = { id: 'plank', n: 20 }; me.inv[13] = { id: 'wood', n: 9999 }; me.rev++; });
  await page.keyboard.press('KeyI'); await page.waitForTimeout(350);
  const slot = (i) => ev((i) => { const el = [...document.querySelectorAll('#ui .slot[data-ref]')].find((e) => e.dataset.ref === JSON.stringify({ k: 'p', i })); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const drag = async (A, B) => { await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(A.x + 8, A.y + 8, { steps: 3 }); await page.mouse.move(B.x, B.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250); };
  const inv = () => ev(() => __snug.game.me.inv.map((s) => (s ? s.id + ':' + s.n : null)));
  await drag(await slot(10), await slot(2));
  let i = await inv();
  ok(i[2] === 'plank:50' && i[10] === 'stone:7', 'dragging onto another item swaps them');
  await drag(await slot(2), await slot(3));
  i = await inv();
  ok(i[3] === 'plank:70' && i[2] === null, 'dragging onto the same item merges the stacks');
  await drag(await slot(13), await slot(6));
  i = await inv();
  ok(i[6] === 'wood:9999' && i[13] === null, 'a 9999 stack goes onto a hotbar slot');
  ok((await ev(() => document.querySelectorAll('#ui .slot.sel').length)) === 0, 'letting go does not count as a tap');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const hot = (i) => ev((i) => { const r = document.querySelectorAll('.hotbar .slot')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  await drag(await hot(6), await hot(0));
  i = await inv();
  ok(i[0] === 'wood:9999' && i[6] === null, 'the hotbar can be rearranged by dragging too (no window open)');
}

console.log('photo mode');
{
  const ctx2 = page.context();
  const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await page.keyboard.press('KeyP');
  const d = await dl;
  ok(!!d && /^snug-isles-.*\.png$/.test(d.suggestedFilename()), 'P takes a photo and saves a PNG (' + (d ? d.suggestedFilename() : 'no download') + ')');
}
console.log('save + reload');
await ev(() => __snug.game.save());
await page.waitForTimeout(400);
const saves = await ev(async () => (await __snug.listWorlds()).length);
ok(saves >= 1, `world saved to IndexedDB (${saves})`);

console.log('performance (60 frames of game update+render)');
const perf = await ev(() => { const g = __snug.game; const t0 = performance.now(); for (let i = 0; i < 120; i++) { g.update(1 / 60); g.render(); } return (performance.now() - t0) / 120; });
ok(perf < 8, `avg frame (update+render) ${perf.toFixed(2)}ms`);

console.log(logs.length ? 'LOGS:\n' + logs.join('\n') : 'no console errors');
if (logs.length) failed++;
await browser.close(); server.close();
console.log(failed ? `\n${failed} problem(s)` : '\nall good');
process.exit(failed ? 1 : 0);
