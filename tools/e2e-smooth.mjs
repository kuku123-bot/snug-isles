// The smooth look on a real GPU path: the shader matches the CPU reference, stays out of the way (clicks, photo, settings, resize),
// and falls back safely (context loss, slow GPU). node tools/e2e-smooth.mjs [chromium] [webkit]     SITE=https://… tests a deployed copy
import { chromium, webkit } from 'playwright';
import esbuild from 'esbuild';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.SITE ? null : await startServer(path.join(ROOT, 'dist'));
const server = local ? local.server : { close() {} }, url = process.env.SITE || local.url;
const cpuBundle = (await esbuild.build({ entryPoints: [path.join(ROOT, 'js/gfx/smooth.js')], bundle: true, format: 'iife', globalName: 'SM', write: false })).outputFiles[0].text;
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'webkit'];

for (const name of engines) {
  const eng = name === 'webkit' ? webkit : chromium;
  // chromium in tests renders WebGL in software (slow): keep its window small; WebKit has the real GPU: use a real iPad size
  const real = name === 'webkit';
  const vp = real ? { width: 1180, height: 820 } : { width: 640, height: 420 }, dpr = real ? 2 : 1;
  console.log(`\n== ${name} (${vp.width}x${vp.height} @${dpr}x)`);
  const browser = await eng.launch();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) errs.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  const open = async (q) => { await page.goto(url + (url.includes('?') ? '&' : '?') + q, { waitUntil: 'load' }); await page.waitForFunction(() => window.__snug && window.__snug.game, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1200); };

  // ---------------------------------------------------------------- 1. what a player gets by default on this machine
  await open('quick=cozy&seed=smooth');
  const dflt = await page.evaluate(() => { const a = __snug, p = a.presenter; return { has: !!p, active: !!(p && p.active), why: a.lookFailed || '', renderer: p ? p.renderer : '', glShown: p ? getComputedStyle(p.canvas).display !== 'none' : false }; });
  if (real) ok(dflt.has && dflt.active && dflt.glShown, `a real GPU gets the smooth look by default (${dflt.renderer})`);
  else ok(!dflt.has && /software/i.test(dflt.why), `a software renderer quietly keeps the pixel look (${dflt.why})`);

  // ---------------------------------------------------------------- 2. forced on: the real game through the shader
  await open('quick=cozy&seed=smooth&look=smooth&force=1');
  const st = await page.evaluate(() => { const a = __snug, p = a.presenter; const v = a.view, c = a.canvas; return { active: p.active, frames: p.frames, gl: [p.canvas.width, p.canvas.height], expect: [Math.round(v.w * v.scale * p.rs), Math.round(v.h * v.scale * p.rs)], css: [p.canvas.style.width, p.canvas.style.height], cssArt: [c.style.width, c.style.height] }; });
  ok(st.active && st.frames > 3, `presenter running (${st.frames} frames)`);
  ok(st.gl[0] === st.expect[0] && st.gl[1] === st.expect[1], `GL canvas is the art size x zoom (${st.gl.join('x')})`);
  ok(st.css[0] === st.cssArt[0] && st.css[1] === st.cssArt[1], 'GL canvas covers exactly the same box as the art canvas');
  const pick = await page.evaluate(() => { const x = innerWidth / 2, y = innerHeight / 2 + 40; const el = document.elementFromPoint(x, y); return el ? el.id || el.tagName : ''; });
  ok(pick === 'game', `clicks and touches still reach the game canvas (${pick})`);

  // ---------------------------------------------------------------- 3. GPU output == CPU reference (the real current picture, two strengths, whole + fractional zoom)
  await page.addScriptTag({ content: cpuBundle });
  const parity = await page.evaluate(async () => {
    const out = [];
    const art = __snug.canvas, w = art.width, h = art.height;
    const src = document.createElement('canvas'); src.width = w; src.height = h; src.getContext('2d').drawImage(art, 0, 0);
    const holder = document.createElement('div'); holder.appendChild(src);
    const pixels = src.getContext('2d').getImageData(0, 0, w, h).data;
    for (const [look, k] of [['smooth', 4], ['soft', 4], ['smooth', 2.5]]) {
      const gp = new __snug.dbg.Presenter(src, { force: true });
      const W = Math.round(w * k), H = Math.round(h * k);
      gp.resize({ w, h, scale: k, cssW: W + 'px', cssH: H + 'px' }); gp.setLook(look); gp.present();
      const o2 = document.createElement('canvas'); o2.width = W; o2.height = H; const c2 = o2.getContext('2d'); c2.drawImage(gp.canvas, 0, 0);
      const gpu = c2.getImageData(0, 0, W, H).data;
      const cpu = SM.smoothUpscale(pixels, w, h, k, k, { look });
      let sum = 0, big = 0, max = 0, n = 0;
      for (let i = 0; i < cpu.data.length; i += 4) for (let c = 0; c < 3; c++) { const d = Math.abs(cpu.data[i + c] - gpu[i + c]); sum += d; n++; if (d > 12) big++; if (d > max) max = d; }
      out.push({ look, k, mean: sum / n, bigFrac: big / (n / 3), max, size: [W, H], same: cpu.w === W && cpu.h === H });
      gp.destroy();
    }
    return out;
  });
  for (const r of parity) ok(r.same && r.mean < 0.35 && r.bigFrac < 0.004, `${r.look} @${r.k}x: GPU matches the CPU reference (mean error ${r.mean.toFixed(3)}, ${(r.bigFrac * 100).toFixed(3)}% of pixels differ by >12, worst ${r.max})`);

  // ---------------------------------------------------------------- 3b. name tags and numbers are real smooth text on their own layer
  const lab = await page.evaluate(async () => {
    const a = __snug, tl = a.textLayer, g = a.game; await document.fonts.load('700 20px Fredoka');
    g.fx.pops.push({ text: '+12', color: '#ffe066', x: g.me.x, y: g.me.y - 30, vy: -8, t: 0, life: 5, big: true });
    await new Promise((r) => setTimeout(r, 300));
    const c = tl.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return { shown: getComputedStyle(c).display !== 'none', size: [c.width, c.height], gl: [a.presenter.canvas.width, a.presenter.canvas.height], ink: n, font: document.fonts.check('700 16px Fredoka'), ui: getComputedStyle(document.body).fontFamily, look: document.documentElement.dataset.look };
  });
  ok(lab.shown && lab.ink > 200, `in-world text is drawn on the label layer (${lab.ink} text pixels)`);
  ok(lab.size[0] === lab.gl[0] && lab.size[1] === lab.gl[1], 'the label layer is as sharp as the picture (full screen resolution)');
  ok(lab.font && /Fredoka/.test(lab.ui) && lab.look === 'smooth', `the menus use the round font (${lab.ui.split(',')[0]})`);

  // ---------------------------------------------------------------- 4. photo is the picture as shown
  const photo = await page.evaluate(async () => {
    const a = __snug, g = a.game; let file = null; a.deliverFile = async (f) => { file = f; return 'saved'; };
    await g.photo(); if (!file) return null;
    const bm = await createImageBitmap(file); return { type: file.type, w: bm.width, h: bm.height, gl: [a.presenter.canvas.width, a.presenter.canvas.height] };
  });
  ok(photo && photo.type === 'image/png' && photo.w === photo.gl[0] && photo.h === photo.gl[1], `photo mode saves the smooth picture at screen resolution (${photo && photo.w}x${photo && photo.h})`);

  // ---------------------------------------------------------------- 5. settings: Pixel / Soft / Smooth
  const sw = await page.evaluate(async () => {
    const a = __snug, p = a.presenter, r = {};
    a.settings.look = 'pixel'; a.applyLook(); await new Promise((x) => setTimeout(x, 150));
    r.pixelHidden = getComputedStyle(p.canvas).display === 'none'; r.pixelInactive = !p.active;
    const f0 = p.frames; await new Promise((x) => setTimeout(x, 200)); r.pixelFrozen = p.frames === f0;
    a.settings.look = 'soft'; a.applyLook(); await new Promise((x) => setTimeout(x, 200));
    r.softShown = getComputedStyle(p.canvas).display !== 'none'; r.softLook = p.look; r.softRuns = p.frames > f0;
    a.settings.look = 'smooth'; a.applyLook(); await new Promise((x) => setTimeout(x, 150));
    r.smoothLook = p.look; r.smoothShown = getComputedStyle(p.canvas).display !== 'none';
    return r;
  });
  ok(sw.pixelHidden && sw.pixelInactive && sw.pixelFrozen, 'Pixel look hides the GL canvas and stops drawing it');
  const pf = await page.evaluate(async () => { const a = __snug; a.settings.look = 'pixel'; a.applyLook(); await new Promise((r) => setTimeout(r, 200)); const tl = a.textLayer, d = tl.canvas.getContext('2d').getImageData(0, 0, tl.canvas.width, tl.canvas.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; const r = { labelsHidden: getComputedStyle(tl.canvas).display === 'none', labelInk: n, font: getComputedStyle(document.body).fontFamily, look: document.documentElement.dataset.look }; a.settings.look = 'smooth'; a.applyLook(); return r; });
  ok(pf.labelsHidden && pf.labelInk === 0 && /Pixelify/.test(pf.font) && pf.look === 'pixel', 'Pixel look: pixel font in the menus and the pixel text in the world (label layer empty and hidden)');
  ok(sw.softShown && sw.softLook === 'soft' && sw.softRuns && sw.smoothLook === 'smooth' && sw.smoothShown, 'Soft and Smooth switch back and forth live');
  // the settings panel offers it
  await page.evaluate(() => __snug.game.ui.open('settings')); await page.waitForTimeout(300);
  const hasChoice = await page.evaluate(() => [...document.querySelectorAll('.field')].some((f) => /Picture/.test(f.textContent) && /Smooth/.test(f.textContent) && /Soft/.test(f.textContent) && /Pixel/.test(f.textContent)));
  ok(hasChoice, 'the Settings menu has a Picture choice (Smooth / Soft / Pixel)');
  await page.evaluate(() => __snug.game.ui.closeAll(true));

  // ---------------------------------------------------------------- 6. window changes keep the GL canvas glued to the art canvas
  await page.setViewportSize({ width: vp.width + 40, height: vp.height + 30 }); await page.waitForTimeout(500);
  const rs = await page.evaluate(() => { const a = __snug, p = a.presenter, v = a.view; return { gl: [p.canvas.width, p.canvas.height], expect: [Math.round(v.w * v.scale * p.rs), Math.round(v.h * v.scale * p.rs)], css: [p.canvas.style.width, a.canvas.style.width] }; });
  ok(rs.gl[0] === rs.expect[0] && rs.gl[1] === rs.expect[1] && rs.css[0] === rs.css[1], `after a window resize the GL canvas follows (${rs.gl.join('x')})`);
  await page.setViewportSize(vp); await page.waitForTimeout(400);

  // ---------------------------------------------------------------- 7. a lost GPU context: pixel look takes over, smooth look returns by itself
  const lost = await page.evaluate(async () => {
    const p = __snug.presenter, ext = p.gl.getExtension('WEBGL_lose_context'), r = { ext: !!ext };
    if (!ext) return r;
    ext.loseContext(); await new Promise((x) => setTimeout(x, 300));
    r.lostOk = !p.ok; r.lostHidden = getComputedStyle(p.canvas).display === 'none';
    ext.restoreContext(); await new Promise((x) => setTimeout(x, 600));
    const f0 = p.frames; await new Promise((x) => setTimeout(x, 400));
    r.backOk = p.ok && p.active && getComputedStyle(p.canvas).display !== 'none' && p.frames > f0;
    return r;
  });
  if (lost.ext) ok(lost.lostOk && lost.lostHidden && lost.backOk, 'a lost GPU context falls back to the pixel canvas and recovers on its own');
  else console.log('  · (this browser has no WEBGL_lose_context, skipped)');

  // ---------------------------------------------------------------- 8. a slow GPU: draws fewer pixels first, then gives up on smoothing (the game stays smooth)
  const slow = await page.evaluate(() => {
    const a = __snug, p = a.presenter, r = {}; p.force = false; p.tier = undefined; p.nextCheck = 0; p.benchmark = () => 30;
    p.frames = 100; a.checkLookSpeed(); r.s1 = p.rs; p.frames += 100; a.checkLookSpeed(); r.s2 = p.rs; p.frames += 100; a.checkLookSpeed();
    r.off = !p.active && !!a.lookFailed && a.renderer.presenter === null; r.why = a.lookFailed;
    return r;
  });
  ok(slow.s1 === 0.75 && slow.s2 === 0.55 && slow.off, `a slow GPU: 100% → 75% → 55% of the pixels → pixel look (${slow.why})`);

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
}
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall smooth-look checks passed');
process.exit(failed ? 1 : 0);
