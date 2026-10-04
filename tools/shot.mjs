// node tools/shot.mjs <outPrefix> [url-suffix] [width] [height] [engine=chromium|webkit] [waitMs] [dpr]
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [prefix, suffix = '', W = '1180', H = '820', engine = 'chromium', wait = '1500', dpr = '2'] = process.argv.slice(2);
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +dpr, hasTouch: false });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto(url + suffix, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: `.scratch/${prefix}.png` });
console.log('logs:', logs.length ? '\n' + logs.join('\n') : 'none');
await browser.close(); server.close();
