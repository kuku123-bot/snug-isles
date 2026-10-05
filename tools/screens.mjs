// Screenshot every menu screen at iPad/Mac sizes for a visual check. node tools/screens.mjs [outDir=.scratch/screens]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, '.scratch/screens'));
fs.mkdirSync(out, { recursive: true });
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await chromium.launch();
const sizes = [[1180, 820], [944, 656], [820, 1180]];
const screens = [['title', 'showTitle()'], ['together', 'screens.together()'], ['worlds', 'screens.worlds()'], ['newworld', 'screens.newWorld()'], ['character', 'screens.character()'], ['join', 'screens.join()'], ['settings', 'screens.settingsScreen()'], ['help', 'screens.help()']];
const errs = [];
for (const [W, H] of sizes) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true })).newPage();
  page.on('pageerror', (e) => errs.push(`${W}x${H}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errs.push(`${W}x${H}: ${m.text()}`); });
  await page.goto(url + '?x=1'); await page.waitForTimeout(1500);
  for (const [name, call] of screens) {
    await page.evaluate((c) => { const A = __snug; new Function('A', `with (A) { return ${c}; }`)(A); }, call);
    await page.waitForTimeout(450);
    // does anything spill outside the viewport?
    const over = await page.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('#ui *, .title-wrap *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > innerWidth + 2 || r.left < -2)) { const cs = getComputedStyle(e); if (cs.position !== 'fixed') bad.push((e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); } } return bad.slice(0, 4); });
    if (over.length) errs.push(`${W}x${H} ${name}: spills horizontally: ${over.join('; ')}`);
    await page.screenshot({ path: path.join(out, `${name}-${W}x${H}.png`) });
  }
  await page.close();
}
console.log('screens saved to', out);
console.log('problems:', errs.length ? '\n' + errs.join('\n') : 'none');
await browser.close(); server.close();
process.exit(errs.length ? 1 : 0);
