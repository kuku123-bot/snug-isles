// Page zoom must be impossible and focus-zoom must not trigger. node tools/e2e-zoom.mjs
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.SITE ? null : await startServer(path.join(ROOT, 'dist')); // SITE=https://… tests a deployed copy instead
const server = local ? local.server : { close() {} }, url = process.env.SITE || local.url;
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };

for (const [name, eng] of [['chromium', chromium], ['webkit', webkit]]) {
  console.log(`\n== ${name} (iPad-like, touch)`);
  const browser = await eng.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) errs.push(e.message); }); // (WebKit refuses the deliberately dead localhost port)
  // a fake visual viewport so the "snap back if zoomed" safety net can be exercised
  await page.addInitScript(() => { const L = {}; const fake = { scale: 1, addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, __fire: (t) => (L[t] || []).forEach((f) => f()) }; Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true }); });
  await page.goto(url + '?x=1', { waitUntil: 'load' }); await page.waitForTimeout(1500);

  const meta = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  ok(/maximum-scale=1/.test(meta) && /minimum-scale=1/.test(meta) && /user-scalable=no/.test(meta), 'viewport meta forbids scaling: ' + meta);
  const prevented = await page.evaluate(() => {
    const out = {};
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) { const e = new Event(t, { bubbles: true, cancelable: true }); document.dispatchEvent(e); out[t] = e.defaultPrevented; }
    const w = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true }); document.body.dispatchEvent(w); out.ctrlWheel = w.defaultPrevented;
    const w2 = new WheelEvent('wheel', { ctrlKey: false, cancelable: true, bubbles: true }); document.body.dispatchEvent(w2); out.plainWheel = w2.defaultPrevented;
    for (const [k, mod] of [['+', 'ctrlKey'], ['-', 'metaKey'], ['=', 'ctrlKey'], ['0', 'metaKey']]) { const e = new KeyboardEvent('keydown', { key: k, [mod]: true, cancelable: true, bubbles: true }); window.dispatchEvent(e); out['zoomkey ' + mod + k] = e.defaultPrevented; }
    const e = new KeyboardEvent('keydown', { key: '+', cancelable: true, bubbles: true }); window.dispatchEvent(e); out.plainPlus = e.defaultPrevented;
    return out;
  });
  ok(prevented.gesturestart && prevented.gesturechange && prevented.gestureend, 'Safari pinch (gesture events) is cancelled');
  ok(prevented.ctrlWheel && !prevented.plainWheel, 'trackpad/ctrl+wheel zoom is cancelled, normal scrolling is not');
  ok(['ctrlKey+', 'metaKey-', 'ctrlKey='].every((k) => prevented['zoomkey ' + k]) && !prevented.plainPlus, 'Ctrl/Cmd + and - browser zoom shortcuts are cancelled (the game\'s own + / - keys are not)');
  ok(!prevented['zoomkey metaKey0'], 'Ctrl/Cmd+0 (back to normal size) still works, so a browser that remembers a zoomed level can be reset');
  // (desktop WebKit drops this iOS-only property from its stylesheet model, so check the shipped CSS text)
  const tsa = await page.evaluate(async () => { const href = document.querySelector('link[rel=stylesheet]').href; const css = await (await fetch(href)).text(); return /html\s*\{[^}]*text-size-adjust:\s*100%/.test(css); });
  ok(tsa, 'text auto-inflation is switched off (text-size-adjust: 100%)');

  // the page snaps back if some browser zoomed it anyway
  const reset = await page.evaluate(async () => { const vv = window.visualViewport; vv.scale = 2.2; vv.__fire('resize'); const during = document.querySelector('meta[name=viewport]').content; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return { during, after: document.querySelector('meta[name=viewport]').content }; });
  ok(/maximum-scale=1\.0001/.test(reset.during) && /maximum-scale=1,/.test(reset.after), 'a zoomed page is snapped back (viewport re-applied)');
  await page.evaluate(() => { window.visualViewport.scale = 1; });

  // every form control on every screen is >= 16px (iOS zooms on focus below that)
  const audit = async (label) => { const bad = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')].filter((e) => e.type !== 'hidden' && e.type !== 'file' && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => `${e.tagName}${e.type ? '[' + e.type + ']' : ''}.${e.className} ${getComputedStyle(e).fontSize}`)); ok(bad.length === 0, `${label}: every field is at least 16px` + (bad.length ? ' — too small: ' + bad.join(', ') : '')); };
  const screens = [['title', 'showTitle()'], ['new world (all the rule dropdowns)', 'screens.newWorld()'], ['character creator', 'screens.character()'], ['join', 'screens.join()'], ['manual join', 'screens.manual()'], ['settings', 'screens.settingsScreen()']];
  for (const [label, call] of screens) { await page.evaluate((c) => { new Function('A', `with (A) { return ${c}; }`)(__snug); }, call); await page.waitForTimeout(350); await audit(label); }
  await page.goto(url + '?quick=classic&seed=zoom&peerhost=127.0.0.1&peerport=1&peerpath=/', { waitUntil: 'load' }); await page.waitForTimeout(1500);
  for (const panel of ['inventory', 'craft', 'build', 'tech', 'skills', 'map', 'pause', 'settings', 'rules', 'help', 'goals', 'emote']) { await page.evaluate((n) => __snug.game.ui.open(n), panel); await page.waitForTimeout(250); await audit('in game: ' + panel); }
  await page.evaluate(() => __snug.startHosting(__snug.game)); await page.waitForTimeout(1500); await audit('in game: play together (backup + manual pairing boxes)');

  // the picture does not jump between zoom levels when the window changes a little, and does move for a real change
  await page.evaluate(() => __snug.game.ui.closeAll(true));
  const sc = async () => page.evaluate(() => __snug.view.scale);
  const s0 = await sc();
  await page.setViewportSize({ width: 1180, height: 760 }); await page.waitForTimeout(300); const s1 = await sc();
  await page.setViewportSize({ width: 1180, height: 735 }); await page.waitForTimeout(300); const s2 = await sc();
  await page.setViewportSize({ width: 1180, height: 820 }); await page.waitForTimeout(300); const s3 = await sc();
  ok(s0 === s1 && s1 === s2 && s2 === s3, `small window changes keep the same zoom level (${[s0, s1, s2, s3].join(' → ')})`);
  await page.setViewportSize({ width: 1180, height: 560 }); await page.waitForTimeout(300); const s4 = await sc();
  ok(s4 < s0, `a genuinely smaller window still adapts (${s0} → ${s4})`);

  if (name === 'chromium') {
    // a real pinch and a real double tap through the browser's input pipeline
    await page.setViewportSize({ width: 1180, height: 820 }); await page.waitForTimeout(300);
    const cdp = await ctx.newCDPSession(page);
    await page.evaluate(() => { Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true }); }).catch(() => {});
    await cdp.send('Input.synthesizePinchGesture', { x: 590, y: 410, scaleFactor: 2.5, relativeSpeed: 400 }).catch((e) => console.log('   (pinch not supported here:', e.message, ')'));
    await page.waitForTimeout(300);
    const scale = await page.evaluate(() => (window.innerWidth / document.documentElement.clientWidth));
    ok(Math.abs(scale - 1) < 0.01, 'a real pinch does not zoom the page (innerWidth/clientWidth = ' + scale.toFixed(3) + ')');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    const scale2 = await page.evaluate(() => (window.innerWidth / document.documentElement.clientWidth));
    ok(Math.abs(scale2 - 1) < 0.01, 'a double tap does not zoom the page');
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await browser.close();
}
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nZOOM IS LOCKED DOWN');
process.exit(failed ? 1 : 0);
