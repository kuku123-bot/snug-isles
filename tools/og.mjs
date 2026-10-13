// Makes the picture shown when the game's link is shared (static/og.png, 1200x630): a pretty corner of an island under the title. node tools/og.mjs
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.goto(url + '?quick=classic&seed=hello&look=pixel&force=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__snug && window.__snug.game);
await page.waitForTimeout(900);
await page.evaluate(() => {
  const g = __snug.game, w = g.world, me = g.me, tx = Math.floor(me.x / 16), ty = Math.floor(me.y / 16);
  for (const t of [...w.things.values()]) if (Math.hypot((t.x + 0.5) * 16 - me.x, (t.y + 0.5) * 16 - me.y) < 120) w.removeThing(t.id);
  const put = (type, dx, dy) => { try { w.addThing(type, tx + dx, ty + dy); } catch (e) { /* skip */ } };
  put('lighthouse', 4, -4); put('marketplace', -6, -3); put('oak', -2, -5); put('oak', 8, 0); put('berry_bush', 1, 3); put('rock', -4, 3); put('tent', 3, 2); put('campfire', 1, 1);
  document.getElementById('hud').style.display = 'none'; document.getElementById('touch').style.display = 'none';
  g.view.zoom(1); // a little closer, so the picture is mostly island
  document.getElementById('toasts').style.display = 'none'; document.getElementById('tip').style.display = 'none';
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;left:0;right:0;top:34px;text-align:center;font:700 92px Fredoka, system-ui, sans-serif;color:#fff;-webkit-text-stroke:10px #3a2848;paint-order:stroke fill;letter-spacing:2px;text-shadow:0 8px 0 #3a2848;z-index:50';
  tag.textContent = 'Snug Isles';
  const sub = document.createElement('div');
  sub.style.cssText = 'position:fixed;left:0;right:0;bottom:30px;text-align:center;font:700 34px Fredoka, system-ui, sans-serif;color:#fff;-webkit-text-stroke:7px #3a2848;paint-order:stroke fill;z-index:50';
  sub.textContent = 'A cozy island game to play together';
  document.body.append(tag, sub);
});
await page.evaluate(() => { const g = __snug.game; g.me.name = ''; g.fx.pops.length = 0; g.fx.parts.length = 0; });
await page.waitForTimeout(250);
await page.evaluate(() => { const g = __snug.game; g.fx.pops.length = 0; g.fx.parts.length = 0; });
await page.screenshot({ path: path.join(ROOT, 'static/og.png') });
await browser.close(); server.close();
console.log('wrote static/og.png');
