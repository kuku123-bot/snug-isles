// Gameplay smoke tests driven through real input events. node tools/e2e.mjs [engine]
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv[2] || 'chromium';
const { server, url } = await startServer(path.join(ROOT, 'dist'));
const browser = await (engine === 'webkit' ? webkit : chromium).launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
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
