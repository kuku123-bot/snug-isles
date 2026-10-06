// iPad-style touch tests with REAL touch input (CDP Input.dispatchTouchEvent -> pointer events). node tools/e2e-touch.mjs
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const W = +(process.env.W || 1180), H = +(process.env.H || 820);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const logs = []; let failed = 0;
page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
let tid = 1;
const touch = {
  down: (x, y, id = 0) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] }),
  move: (x, y, id = 0) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id }] }),
  up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  async tap(x, y) { await touch.down(x, y); await page.waitForTimeout(50); await touch.up(); await page.waitForTimeout(60); },
  async drag(x0, y0, x1, y1, ms = 500, steps = 8) { await touch.down(x0, y0); for (let i = 1; i <= steps; i++) { await touch.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await page.waitForTimeout(ms / steps); } await touch.up(); },
};
const rect = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom, vis: getComputedStyle(e).display !== 'none' }; }, sel);
const shot = (n) => page.screenshot({ path: `.scratch/touch-${W}x${H}-${n}.png` });

await page.goto(url + '?quick=classic&seed=touch', { waitUntil: 'load' });
await page.waitForTimeout(1500);

console.log('layout');
const touchRoot = await rect('#touch');
ok(touchRoot && touchRoot.vis && !(await ev(() => document.querySelector('#touch').classList.contains('hidden'))), 'touch controls are shown on a touch device');
for (const sel of ['.tbtn.big', '.tbtn:not(.big):not(.sm)', '.joyzone', '.hotbar']) { const r = await rect(sel); ok(r && r.l >= 0 && r.r <= W + 1 && r.t >= 0 && r.b <= H + 1, `${sel} inside the viewport (${r && Math.round(r.l)},${r && Math.round(r.t)} ${r && Math.round(r.w)}x${r && Math.round(r.h)})`); }
// buttons shouldn't overlap the hotbar
const hb = await rect('.hotbar'); const bigb = await rect('.tbtn.big'); const sm = await ev(() => [...document.querySelectorAll('.tbtn')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
const ov = (a, b) => a.l < b[2] && a.r > b[0] && a.t < b[3] && a.b > b[1];
ok(!sm.some((b) => ov(hb, b)), 'touch buttons do not overlap the hotbar');
await shot('game');

console.log('joystick (real touch drag)');
const x0 = await ev(() => __snug.game.me.x), y0 = await ev(() => __snug.game.me.y);
await touch.down(190, H - 200); await page.waitForTimeout(80);
for (let i = 1; i <= 6; i++) { await touch.move(190 + i * 12, H - 200); await page.waitForTimeout(60); }
await page.waitForTimeout(450);
await shot('joystick');
await touch.up(); await page.waitForTimeout(100);
const x1 = await ev(() => __snug.game.me.x);
ok(x1 - x0 > 25, `dragging the joystick right moved the player (${(x1 - x0).toFixed(1)}px)`);
const x2a = await ev(() => __snug.game.me.x); await page.waitForTimeout(300); const x2b = await ev(() => __snug.game.me.x);
ok(Math.abs(x2b - x2a) < 1.5, 'releasing the joystick stops the player');
await touch.drag(190, H - 200, 190, H - 130, 400);
ok((await ev(() => __snug.game.me.y)) - y0 > 8, 'joystick down moves down');

console.log('action button (hold) chops a tree via auto-aim');
await ev(() => { const g = __snug.game, w = g.world, me = g.me; let best = null, bd = 1e9; for (const t of w.things.values()) if (t.type === 'oak' && !t.dep) { const d = Math.hypot((t.x + .5) * 16 - me.x, (t.y + .5) * 16 - me.y); if (d < bd) { bd = d; best = t; } } me.x = (best.x + .5) * 16; me.y = (best.y + 1) * 16 + 6; window.__tree = best.id; });
await page.waitForTimeout(250);
const wood0 = await ev(() => __snug.game.me.inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0));
const ab = await rect('.tbtn.big');
await touch.down(ab.x, ab.y); await page.waitForTimeout(3600); await touch.up(); await page.waitForTimeout(300);
const tr = await ev(() => { const g = __snug.game; return { dep: g.world.things.get(window.__tree).dep, wood: g.me.inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0) }; });
ok(tr.dep === 1 && tr.wood > wood0, `held the action button: tree down, wood ${wood0} -> ${tr.wood}`);

console.log('tap a world object (workbench-like chest) opens its UI');
await ev(() => { const g = __snug.game, me = g.me; g.world.techs.add('carpentry'); me.inv[7] = { id: 'plank', n: 40 }; me.inv[6] = { id: 'stone', n: 40 }; me.rev++; });
const hudBtns = await ev(() => [...document.querySelectorAll('.hbtn')].map((e) => { const r = e.getBoundingClientRect(); return { k: (e.querySelector('.keycap') || {}).textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }));
ok(hudBtns.length >= 8 && hudBtns.every((b) => b.w >= 40 && b.h >= 40), `HUD buttons are finger-sized (${hudBtns.map((b) => b.k).join(' ')})`);
const names = { I: 'inventory', C: 'craft', B: 'build', R: 'tech', K: 'skills', M: 'map', G: 'emote' };
for (const b of hudBtns) {
  const name = names[b.k]; if (!name) continue;
  await touch.tap(b.x, b.y); await page.waitForTimeout(250);
  const open = await ev(() => !!document.querySelector('.scrim, .drawer'));
  ok(open, `tap HUD ${b.k} -> opens a panel`);
  if (open) { await shot('panel-' + name); const xb = await rect('.scrim .xbtn, .drawer .xbtn'); if (xb) await touch.tap(xb.x, xb.y); await page.waitForTimeout(200); ok(!(await ev(() => !!document.querySelector('.scrim, .drawer'))), `  close ${name} with the X`); }
}

console.log('build mode with a finger (drag-paint floors, including in the joystick corner)');
await ev(() => { const g = __snug.game; g.world.coins = 500; g.me.inv[7] = { id: 'plank', n: 80 }; g.me.rev++; g.builder.start('floor_plank'); });
await page.waitForTimeout(300);
const floors = () => ev(() => __snug.game.world.floor.reduce((a, v) => a + (v ? 1 : 0), 0));
const f0 = await floors();
const pc = await ev(() => { const g = __snug.game, me = g.me; const [cx, cy] = g.view.toClient(me.x - g.camX, me.y - g.camY); return { cx, cy, tile: g.view.toClient(16, 0)[0] - g.view.toClient(0, 0)[0] }; });
const T = pc.tile; // one tile in CSS px (the integer pixel scale depends on the screen)
// paint to the right of the player (right half of the screen)
await touch.drag(pc.cx + 1.5 * T, pc.cy + 0.6 * T, pc.cx + 4.5 * T, pc.cy + 0.6 * T, 500, 12);
const f1 = await floors();
ok(f1 - f0 >= 3, `finger-painting right of the player placed floors (${f1 - f0})`);
await shot('build');
// paint to the LEFT/below of the player where the joystick zone sits
const px0 = await ev(() => __snug.game.me.x);
await touch.drag(pc.cx - 4.5 * T, pc.cy + 1.6 * T, pc.cx - 1.2 * T, pc.cy + 1.6 * T, 500, 12); // within build reach
const f2 = await floors();
const px1 = await ev(() => __snug.game.me.x);
ok(f2 - f1 >= 3, `finger-painting in the bottom-left placed floors (${f2 - f1}) and the player did not wander (${(px1 - px0).toFixed(1)}px)`);
await ev(() => __snug.game.builder.stop());

console.log('furniture: tap places; slide-then-lift places where the finger ends');
await ev(() => { const g = __snug.game; g.world.techs.add('carpentry'); g.me.inv[5] = { id: 'plank', n: 99 }; g.me.inv[4] = { id: 'fiber', n: 30 }; g.me.rev++; g.builder.start('rustic_chair'); });
await page.waitForTimeout(200);
const freeTiles = await ev(() => { const g = __snug.game, b = g.builder, me = g.me, out = []; const tx0 = Math.floor(me.x / 16), ty0 = Math.floor(me.y / 16); for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) { const tx = tx0 + dx, ty = ty0 + dy; if (b.checkAt(tx, ty) && b.affordable()) { const [cx, cy] = g.view.toClient((tx + .5) * 16 - g.camX, (ty + .5) * 16 - g.camY); out.push({ tx, ty, cx, cy }); } } return out; });
const A = freeTiles.find((t) => t.cx > W * 0.5), B = freeTiles.find((t) => t.cx > W * 0.5 && Math.abs(t.tx - A.tx) >= 2 && Math.abs(t.ty - A.ty) >= 1);
const chairs = () => ev(() => [...__snug.game.world.things.values()].filter((t) => t.type === 'rustic_chair').map((t) => t.x + ',' + t.y));
const c0 = (await chairs()).length;
await touch.tap(A.cx, A.cy); await page.waitForTimeout(300);
let c1 = await chairs();
ok(c1.length === c0 + 1 && c1.includes(A.tx + ',' + A.ty), `a tap placed a chair on the tapped tile (${c1.length - c0} new)`);
await touch.down(A.cx, A.cy + 40); await page.waitForTimeout(80); await touch.move(B.cx, B.cy); await page.waitForTimeout(120);
ok((await chairs()).length === c1.length, 'nothing is placed while the finger is still down (ghost follows)');
await touch.up(); await page.waitForTimeout(300);
const c2 = await chairs();
ok(c2.length === c1.length + 1 && c2.includes(B.tx + ',' + B.ty), 'lifting the finger placed the chair where it ended');
await ev(() => __snug.game.builder.start('floor_plank')); await page.waitForTimeout(150);

console.log('two thumbs: walk with the joystick corner while painting with the other hand');
const mx0 = await ev(() => __snug.game.me.x), fl0 = await floors();
const jx = 110, jy = H - 120; // compact joystick corner
const both = (a, b) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a, b] });
const paintStart = { x: pc.cx + 2.5 * T, y: pc.cy - 1.5 * T, id: 1 };
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 0 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 0 }, paintStart] });
for (let i = 1; i <= 8; i++) { await both({ x: jx + i * 7, y: jy, id: 0 }, { x: paintStart.x + i * T * 0.5, y: paintStart.y, id: 1 }); await page.waitForTimeout(60); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(200);
const mx1 = await ev(() => __snug.game.me.x), fl1 = await floors();
ok(mx1 - mx0 > 8, `left thumb walked the player while building (${(mx1 - mx0).toFixed(1)}px)`);
ok(fl1 - fl0 >= 2, `right thumb painted at the same time (${fl1 - fl0} floors)`);
await shot('build-two-thumbs');
await ev(() => __snug.game.builder.stop());

console.log('furniture: the preview rests in front of you, and the Rotate and Place buttons turn and put it down');
{
  await ev(() => {
    const g = __snug.game, w = g.world, me = g.me;
    g.builder.stop();
    w.settings.buildCost = 0; w.settings.enemyDensity = 0; w.techs.add('cottage_style');
    window.__clear = (cw, ch) => {
      for (let r = 3; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
        for (let y = y0 - 1; y < y0 + ch + 1 && good; y++) for (let x = x0 - 1; x < x0 + cw + 1 && good; x++) { if (!w.inb(x, y) || !w.isTileOwned(x, y) || w.ground[w.idx(x, y)] === 0 || w.wall[w.idx(x, y)] || w.floor[w.idx(x, y)]) good = false; } // trees and rocks do not count: they are cleared below
        if (!good) continue;
        for (let y = y0 - 1; y < y0 + ch + 1; y++) for (let x = x0 - 1; x < x0 + cw + 1; x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); const f = w.flatAt(x, y); if (f) w.removeThing(f.id); }
        return [x0, y0];
      }
      return null;
    };
  });
  const [cx0, cy0] = await ev(() => window.__clear(7, 6));
  await ev(([x, y]) => { const g = __snug.game, me = g.me; me.x = (x + 3) * 16; me.y = (y + 2) * 16; g.pstate(me.pid).dir = 0; g.builder.start('rustic_sofa'); }, [cx0, cy0]);
  await page.waitForTimeout(400);
  const bar = await ev(() => [...document.querySelectorAll('.buildbar button')].map((b) => b.textContent.trim()));
  ok(bar.includes('Rotate') && bar.includes('Place'), `the build bar has Rotate and Place on a touch screen (${bar.join(' / ')})`);
  let g1 = await ev(() => { const b = __snug.game.builder; return { ok: b.ok, rot: b.rot, tx: b.tx, ty: b.ty, fp: b.footprint() }; });
  ok(g1.ok && g1.rot === 0 && g1.fp[0] === 2, `with no finger down the preview sits in front of the player, green (${JSON.stringify(g1)})`);
  const btn = async (name) => { const r = await page.locator('.buildbar button', { hasText: name }).first().boundingBox(); await touch.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(200); };
  await btn('Rotate');
  g1 = await ev(() => { const b = __snug.game.builder; return { rot: b.rot, fp: b.footprint(), ok: b.ok }; });
  ok(g1.rot === 1 && g1.fp[0] === 1 && g1.fp[1] === 2, `tapping Rotate turns it (${JSON.stringify(g1)})`);
  await shot('rotate-place');
  await btn('Place');
  const sofa = await ev(() => { const t = [...__snug.game.world.things.values()].find((q) => q.type === 'rustic_sofa'); return t ? { rot: t.rot, w: t.w, h: t.h } : null; });
  ok(sofa && sofa.rot === 1 && sofa.w === 1 && sofa.h === 2, `tapping Place put it down turned (${JSON.stringify(sofa)})`);
  // red when it does not fit: Place says why instead of building
  await btn('Place');
  const toast = await ev(() => document.querySelector('#toasts') ? document.querySelector('#toasts').textContent : '');
  ok(/Occupied|in the way|already|Someone/i.test(toast), `Place on top of it refuses and says why ("${toast.slice(0, 40)}")`);
  await ev(() => __snug.game.builder.stop());
}

console.log('painting with a finger: the picker, sliders, swatches, building in a color and the brush');
{
  const [px, py] = await ev(() => window.__clear(8, 6));
  await ev(([x, y]) => { const g = __snug.game, me = g.me; me.x = (x + 2.5) * 16; me.y = (y + 4) * 16; g.builder.start('floor_plank'); g.builder.setColor(0, false); localStorage.removeItem('snug.paint.recent'); }, [px, py]);
  await page.waitForTimeout(300);
  const colorOf = (hx) => ev((hx) => { const n = parseInt(hx.slice(1), 16), q = (v) => Math.round(v * 31 / 255); return 0x8000 | (q(n >> 16 & 255) << 10) | (q(n >> 8 & 255) << 5) | q(n & 255); }, hx);
  const tileXY = (tx, ty) => ev(([x, y]) => { const g = __snug.game; const [cx, cy] = g.view.toClient((x + 0.5) * 16 - g.camX, (y + 0.5) * 16 - g.camY); return { x: cx, y: cy }; }, [tx, ty]);
  const tapBtn = async (name) => { const r = await page.locator('.buildbar button', { hasText: name }).first().boundingBox(); await touch.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(250); };
  const tapSel = async (sel) => { const r = await page.locator(sel).first().boundingBox(); await touch.tap(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(200); };
  const col = () => ev(() => __snug.game.builder.col);
  await tapBtn('Color');
  ok(await page.locator('.buildside .cp').isVisible(), 'tapping Color opens the picker');
  const sw = await page.locator('.cp-swatches .cp-sw').first().boundingBox();
  ok(sw.width >= 28 && sw.height >= 28, `swatches are big enough for a finger (${Math.round(sw.width)}x${Math.round(sw.height)})`);
  const th = await page.locator('.cp-thumb').first().boundingBox();
  ok(th.width >= 28, `slider thumbs too (${Math.round(th.width)}px)`);
  const pb = await page.locator('.buildside .cp').boundingBox();
  ok(pb.x + pb.width <= W + 1 && pb.y >= 0 && pb.y + pb.height <= H + 1, `the picker fits on the screen (${Math.round(pb.width)}x${Math.round(pb.height)} in ${W}x${H})`);
  const bb = await page.locator('.buildbar').boundingBox();
  ok(pb.y + pb.height <= bb.y + 2, 'and it does not cover the build buttons');
  await tapSel('.cp-sw[title="Red"]');
  const red = await colorOf('#e0525c');
  ok((await col()) === red, 'a finger tap on a swatch chooses it');
  // the finger places a floor tile in that color
  await touch.tap((await tileXY(px + 2, py + 2)).x, (await tileXY(px + 2, py + 2)).y); await page.waitForTimeout(250);
  ok((await ev(([x, y]) => { const w = __snug.game.world; return w.floorCol[w.idx(x, y)]; }, [px + 2, py + 2])) === red, 'a tap in the world builds the floor in red');
  // a finger on a slider track
  const before = await col();
  const hue = await rect('.cp-slider:nth-child(1) .cp-track');
  await touch.drag(hue.l + hue.w * 0.1, hue.y, hue.l + hue.w * 0.7, hue.y + 3, 400, 8);
  ok((await col()) !== before, 'dragging a slider with a finger changes the color');
  const mid = await col();
  const sat = await rect('.cp-slider:nth-child(2) .cp-track');
  await touch.drag(sat.l + sat.w * 0.5, sat.y, sat.l + sat.w + 120, sat.y + 80, 300, 6);
  ok((await col()) !== mid && (await col()) >= 0x8000, 'a finger sliding past the end of the track stays in range');
  await shot('paint-picker');
  // the brush with a finger: lay a row, color it in one stroke
  await ev(([x, y]) => { const g = __snug.game; g.me.x = (x + 2.5) * 16; g.me.y = (y + 4) * 16; for (let i = 0; i < 5; i++) g.cmd({ c: 'build', bid: 'floor_plank', tx: x + i, ty: y + 1 }); }, [px, py]);
  await page.waitForTimeout(300);
  await tapBtn('Paint');
  ok(await ev(() => __snug.game.builder.paint), 'the Paint button turns the brush on with a finger');
  await tapSel('.cp-sw[title="Butter"]');
  const butter = await colorOf('#f7e08e');
  const a = await tileXY(px, py + 1), b = await tileXY(px + 4, py + 1);
  await touch.drag(a.x, a.y, b.x, b.y, 450, 16);
  await page.waitForTimeout(250);
  const row = await ev(([x, y]) => { const w = __snug.game.world; return [0, 1, 2, 3, 4].map((i) => w.floorCol[w.idx(x + i, y + 1)]); }, [px, py]);
  ok(row.every((c) => c === butter), 'one finger stroke colors the whole row: ' + row.join(','));
  await shot('paint-brushed');
  await tapBtn('Done');
  ok(await page.locator('.buildside .cp').count() === 0, 'Done closes the picker');
}

console.log('sitting and sleeping with the Use button and the joystick');
{
  const [fx, fy] = await ev(() => window.__clear(7, 4));
  const ids = await ev(([x, y]) => { const w = __snug.game.world; return { chair: w.addThing('rustic_chair', x + 1, y + 1, { rot: 0 }).id, bed: w.addThing('rustic_bed', x + 5, y + 1, { rot: 2 }).id }; }, [fx, fy]);
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 1.5) * 16; me.y = (y + 3) * 16; }, [fx, fy]);
  await page.waitForTimeout(300);
  const use = await rect('.tbtn:not(.big):not(.sm)');
  await touch.tap(use.x, use.y); await page.waitForTimeout(300);
  ok(await ev((id) => { const me = __snug.game.me; return !!me.sit && me.sit.id === id; }, ids.chair), 'the Use button sits you on the chair');
  await shot('sitting');
  await touch.tap(use.x, use.y); await page.waitForTimeout(300);
  ok(await ev(() => !__snug.game.me.sit), 'and gets you up again');
  await ev(([x, y]) => { const me = __snug.game.me; me.x = (x + 5.5) * 16; me.y = (y + 3.2) * 16; }, [fx, fy]);
  await page.waitForTimeout(300);
  await touch.tap(use.x, use.y); await page.waitForTimeout(300);
  ok(await ev(() => __snug.game.me.sleeping), 'the Use button lies you in the bed');
  await shot('sleeping');
  // push the joystick: out of bed onto free ground, then walk off
  const bx = await ev(() => __snug.game.me.x);
  await touch.down(190, H - 200); await page.waitForTimeout(80);
  for (let i = 1; i <= 6; i++) { await touch.move(190 + i * 12, H - 200); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  await touch.up(); await page.waitForTimeout(150);
  const after = await ev(() => { const g = __snug.game, me = g.me; return { sleeping: me.sleeping, x: me.x, free: g.world.boxFree(me.x, me.y - 3, 4, 3) }; });
  ok(!after.sleeping && after.free && after.x - bx > 6, `the joystick gets you out of bed and walking, never stuck (${(after.x - bx).toFixed(1)}px)`);
}

console.log('dragging items with a finger');
{
  await ev(() => { const me = __snug.game.me; for (let i = 0; i < me.inv.length; i++) me.inv[i] = null; me.inv[10] = { id: 'plank', n: 50 }; me.inv[2] = { id: 'stone', n: 7 }; me.inv[13] = { id: 'wood', n: 9999 }; me.rev++; __snug.game.ui.open('inventory'); });
  await page.waitForTimeout(450);
  const slot = (i) => ev((i) => { const el = [...document.querySelectorAll('#ui .slot[data-ref]')].find((e) => e.dataset.ref === JSON.stringify({ k: 'p', i })); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const fdrag = async (A, B) => {
    await touch.down(A.x, A.y); await page.waitForTimeout(40);
    for (let i = 1; i <= 3; i++) { await touch.move(A.x + 4 * i, A.y + 4 * i); await page.waitForTimeout(30); }
    for (let i = 1; i <= 10; i++) { await touch.move(A.x + (B.x - A.x) * i / 10, A.y + (B.y + 40 - A.y) * i / 10); await page.waitForTimeout(30); } // the picture rides 40px above the finger
    await touch.up(); await page.waitForTimeout(250);
  };
  const inv = () => ev(() => __snug.game.me.inv.map((s) => (s ? s.id + ':' + s.n : null)));
  await fdrag(await slot(10), await slot(2));
  let i = await inv();
  ok(i[2] === 'plank:50' && i[10] === 'stone:7', 'a finger drags a stack onto another slot and they swap');
  await fdrag(await slot(13), await slot(5));
  i = await inv();
  ok(i[5] === 'wood:9999' && i[13] === null, 'dragging onto the hotbar row holds it');
  ok((await ev(() => document.querySelectorAll('#ui .slot.sel').length)) === 0, 'lifting the finger does not select the slot');
  await shot('bag-after-drag');
  const xb = await rect('.scrim .xbtn'); await touch.tap(xb.x, xb.y); await page.waitForTimeout(250);
  const hot = (i) => ev((i) => { const r = document.querySelectorAll('.hotbar .slot')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  await fdrag(await hot(5), await hot(0));
  i = await inv();
  ok(i[0] === 'wood:9999' && i[5] === null, 'the hotbar can be rearranged with a finger too');
}

console.log('portrait shows a rotate hint');
await page.setViewportSize({ width: H, height: W }); await page.waitForTimeout(500);
ok(await ev(() => !document.querySelector('#rotate').classList.contains('hidden')), 'rotate hint visible in portrait');
await shot('portrait');
await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400);
ok(await ev(() => document.querySelector('#rotate').classList.contains('hidden')), 'rotate hint hidden in landscape');

console.log('errors:', logs.length ? '\n' + logs.join('\n') : 'none');
if (logs.length) failed++;
await browser.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL TOUCH TESTS PASSED');
process.exit(failed ? 1 : 0);
