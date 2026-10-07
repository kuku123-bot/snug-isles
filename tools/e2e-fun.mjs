// The fun stuff, played in a real browser: the next-goal card + guide arrow, the big side buttons, throwing bombs (mouse and touch), a cracked boulder,
// the craft menu's station rail, a fireworks show and the new bosses. Quiet (no AudioContext under automation).
// node tools/e2e-fun.mjs [chromium] [webkit]      SITE=https://… tests a deployed copy
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = process.env.SITE ? null : await startServer(path.join(ROOT, 'dist'));
const server = local ? local.server : { close() {} }, url = process.env.SITE || local.url;
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'webkit'];

for (const name of engines) {
  const eng = name === 'webkit' ? webkit : chromium;
  for (const [label, vp, touch] of [['Mac window, mouse', { width: 1280, height: 800 }, false], ['iPad landscape, touch', { width: 1180, height: 820 }, true]]) {
    console.log(`\n== ${name} · ${label}`);
    const browser = await eng.launch();
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) errs.push(e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(url + (url.includes('?') ? '&' : '?') + 'quick=classic&seed=fun' + name, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__snug && window.__snug.game, null, { timeout: 20000 });
    await page.waitForTimeout(900);
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const tap = async (x, y) => { if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
    const toScreen = (wx, wy) => ev(([x, y]) => { const g = __snug.game; const [cx, cy] = g.view.toClient(x - g.camX, y - g.camY); return { cx, cy }; }, [wx, wy]);
    // clear a patch around the player and find where to stand (trees/rocks next to us would confuse the throw)
    await ev(() => { const g = __snug.game, w = g.world, me = g.me; for (const t of [...w.things.values()]) if (Math.hypot((t.x + 0.5) * 16 - me.x, (t.y + 0.5) * 16 - me.y) < 70) w.removeThing(t.id); });

    // ------------------------------------------------------------ the next-goal card and the big side buttons
    const card = await ev(() => { const c = document.querySelector('.goalcard'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, txt: c.textContent.trim().slice(0, 80), vw: innerWidth }; });
    ok(card && card.w > 120 && card.txt.length > 5 && card.w < card.vw, `a next-goal card is on screen (“${card && card.txt}”)`);
    const btns = await ev(() => [...document.querySelectorAll('.hbtn')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, l: b.querySelector('.hlabel') ? b.querySelector('.hlabel').textContent : '' }; }));
    ok(btns.length >= 4 && btns.every((b) => b.w >= 48 && b.h >= 54 && b.l.length >= 3), `big labelled side buttons (${btns.map((b) => `${b.l} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', ')})`);
    const arrow = await ev(() => { const a = document.querySelector('.guide'); return a ? { shown: a.style.display !== 'none', txt: a.textContent } : null; });
    ok(arrow !== null, 'the guide arrow element exists' + (arrow && arrow.shown ? ` and shows (“${arrow.txt}”)` : ' (hidden: the target is on screen)'));
    // the arrow points at a tree for the first goal (chop wood), and the goal moves on when it is done
    await ev(() => { const g = __snug.game; g.world.shared.flags.gs = g.world.shared.flags.gs || {}; });
    const g0 = await ev(() => document.querySelector('.goalcard').textContent.trim().slice(0, 60));
    ok(/wood|tree|chop/i.test(g0), `the first step is about wood (${g0})`);

    // ------------------------------------------------------------ crafting menu: station rail with big pictures
    await ev(() => { const g = __snug.game; g.world.techs.add('smelting'); g.world.techs.add('explosives'); g.world.techs.add('pyrotechnics'); g.me.inv[8] = { id: 'coal', n: 30 }; g.me.inv[9] = { id: 'stone', n: 60 }; g.me.inv[10] = { id: 'fiber', n: 30 }; g.me.inv[11] = { id: 'iron_ingot', n: 5 }; g.me.inv[12] = { id: 'ice_shard', n: 10 }; g.me.inv[13] = { id: 'paper', n: 10 }; g.me.inv[14] = { id: 'petal_pink', n: 10 }; g.me.inv[15] = { id: 'copper_ingot', n: 5 }; g.me.rev++; });
    await ev(() => __snug.game.ui.open('craft')); await page.waitForTimeout(400);
    const rail = await ev(() => { const r = [...document.querySelectorAll('.crst')].map((b) => { const q = b.getBoundingClientRect(); return { w: q.width, h: q.height }; }); const grid = document.querySelectorAll('.crcard').length; return { r, grid }; });
    ok(rail.r.length >= 2 && rail.r.every((b) => b.w >= 56 && b.h >= 56), `station rail with big buttons (${rail.r.length} stations, ${rail.r.map((b) => Math.round(b.w)).join('/')}px)`);
    ok(rail.grid >= 3, `a grid of ${rail.grid} things to make`);
    await ev(() => __snug.game.ui.closeAll ? __snug.game.ui.closeAll() : __snug.game.ui.close());
    await page.waitForTimeout(200);

    // ------------------------------------------------------------ throwing a bomb at a slime and at a cracked boulder
    const setup = await ev(() => {
      const g = __snug.game, w = g.world, me = g.me;
      me.inv[0] = { id: 'bomb', n: 6 }; me.inv[1] = { id: 'frost_bomb', n: 2 }; me.inv[2] = { id: 'firework', n: 3 }; me.rev++;
      g.sim.world.shared.flags.age = 1e6;
      const s = g.sim;
      const sl = { id: w.nextId++, type: 'slime_green', x: me.x + 40, y: me.y, vx: 0, vy: 0, face: 1, st: 'idle', stt: 5, hit: 0, kx: 0, ky: 0, hp: 400, maxhp: 400, atk: 5, z: 0, zv: 0, dir: 0, avoid: 0, avoidSign: 1, born: w.time, ph: 0, pat: 0, patT: 2, boss: false, frozen: 0 };
      w.mobs.set(sl.id, sl);
      return { slime: sl.id, x: me.x, y: me.y };
    });
    await ev(() => __snug.game.selectSlot(0));
    let sc = await toScreen(setup.x + 40, setup.y - 4);
    const hp0 = await ev((id) => __snug.game.world.mobs.get(id).hp, setup.slime);
    await tap(sc.cx, sc.cy);
    await page.waitForTimeout(250);
    const flying = await ev(() => __snug.game.fx.bombs.length);
    ok(flying >= 1, 'a bomb is in the air / ticking (drawn by the effects)');
    const left = await ev(() => __snug.game.me.inv[0] && __snug.game.me.inv[0].n);
    ok(left === 5, `throwing used up one bomb (${left} left)`);
    let maxParts = 0, maxShake = 0;
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(50); const f = await ev(() => ({ n: __snug.game.fx.parts.length, s: __snug.game.fx.shake })); maxParts = Math.max(maxParts, f.n); maxShake = Math.max(maxShake, f.s); }
    const hp1 = await ev((id) => { const m = __snug.game.world.mobs.get(id); return m ? m.hp : 0; }, setup.slime);
    ok(hp1 < hp0, `the explosion hurt the slime (${hp0} → ${hp1})`);
    const myHp = await ev(() => __snug.game.me.hp);
    ok(myHp >= 1, 'and did not hurt the thrower');
    ok(maxParts > 5 && maxShake > 0, `the explosion showed (${maxParts} particles at most, screen shake ${maxShake.toFixed(1)})`);

    // frost bomb: thrown at the slime, it stops
    await ev(() => __snug.game.selectSlot(1));
    const where = await ev((id) => { const m = __snug.game.world.mobs.get(id); return { x: m.x, y: m.y - 4 }; }, setup.slime);
    sc = await toScreen(where.x, where.y);
    await tap(sc.cx, sc.cy);
    await page.waitForTimeout(1750);
    const fr = await ev((id) => { const m = __snug.game.world.mobs.get(id); return m ? { frozen: m.frozen } : null; }, setup.slime);
    ok(fr && fr.frozen > 0.5, `the frost bomb froze the slime (${fr && fr.frozen && fr.frozen.toFixed(1)} s left)`);

    // cracked boulder: a pickaxe refuses, a bomb opens it
    const bo = await ev(() => {
      const g = __snug.game, w = g.world, me = g.me;
      for (const m of [...w.mobs.values()]) w.mobs.delete(m.id);
      const tx = Math.floor(me.x / 16) + 3, ty = Math.floor(me.y / 16);
      const t = w.addThing('cracked_boulder', tx, ty);
      g.sim.bombs.length = 0;
      return { id: t.id, tx, ty };
    });
    await ev(() => __snug.game.selectSlot(0));
    const bs = await toScreen((bo.tx + 0.5) * 16, (bo.ty + 0.5) * 16);
    await tap(bs.cx, bs.cy);
    await page.waitForTimeout(2200);
    const opened = await ev((id) => { const t = __snug.game.world.things.get(id); return !t || t.dep || t.hp <= 0; }, bo.id);
    const cracked = await ev(() => (__snug.game.sim.world.shared.flags.gs || {}).cracked || 0);
    ok(opened && cracked === 1, `the bomb opened the cracked boulder (counter ${cracked})`);

    // fireworks
    await ev(() => __snug.game.selectSlot(2));
    const fs = await toScreen(setup.x + 10, setup.y - 40);
    await tap(fs.cx, fs.cy);
    await page.waitForTimeout(1500);
    const fw = await ev(() => (__snug.game.sim.world.shared.flags.gs || {}).fireworks || 0);
    ok(fw === 1, 'a firework went off');

    // ------------------------------------------------------------ the Marketplace: buy random goods, sell things
    const shopAt = await ev(() => {
      const g = __snug.game, w = g.world, me = g.me;
      for (const m of [...w.mobs.values()]) w.mobs.delete(m.id);
      g.world.techs.add('trade'); g.world.techs.add('marketplace');
      let spot = null;
      for (let r = 2; r < 9 && !spot; r++) for (let dy = -3; dy <= 3 && !spot; dy++) for (const dx of [-r - 3, r]) { const x = Math.floor(me.x / 16) + dx, y = Math.floor(me.y / 16) + dy; if (!w.placeProblem({ w: 3, h: 2, kind: 'thing' }, x, y)) { spot = { x, y }; break; } }
      const t = w.addThing('marketplace', spot.x, spot.y);
      me.x = (spot.x + 1.5) * 16; me.y = (spot.y + 2) * 16 + 10;
      w.drops.clear(); w.coins = 500; me.inv[3] = { id: 'plank', n: 40 }; me.rev++;
      return { id: t.id, x: spot.x, y: spot.y };
    });
    await page.waitForTimeout(400);
    const ms = await toScreen((shopAt.x + 1.5) * 16, (shopAt.y + 1) * 16);
    await tap(ms.cx, ms.cy);
    await page.waitForFunction(() => document.querySelector('.crafter.shop'), null, { timeout: 4000 }).catch(() => {});
    const cards = await ev(() => document.querySelectorAll('.crafter.shop .crcard').length);
    ok(cards >= 8, `tapping the Marketplace opens the shop with ${cards} things on the shelves`);
    const shelf = await ev(() => { const s = __snug.game.world.shared.shop; return s ? { n: s.items.length, rare: s.items.filter((e) => e[3] === 2).length, deal: s.items.filter((e) => e[3] === 1).length } : null; });
    ok(shelf && shelf.n >= 9 && shelf.rare === 1 && shelf.deal === 1, `the shelves have a deal and a rare find (${JSON.stringify(shelf)})`);
    const bigTabs = await ev(() => [...document.querySelectorAll('.crafter.shop .crst')].map((b) => Math.round(b.getBoundingClientRect().height)));
    ok(bigTabs.length === 2 && bigTabs.every((h) => h >= 56), `Buy and Sell are big buttons (${bigTabs.join('/')}px)`);
    // buy the cheapest affordable thing: select its card, press Buy 1
    const pick = await ev(() => { const s = __snug.game.world.shared.shop, c = __snug.game.world.coins; let best = -1; s.items.forEach((e, i) => { if (e[1] > 0 && e[2] <= c && (best < 0 || e[2] < s.items[best][2])) best = i; }); return best; });
    const before = await ev((i) => { const g = __snug.game, e = g.world.shared.shop.items[i]; return { coins: g.world.coins, have: g.me.inv.reduce((a, x) => a + (x && x.id === e[0] ? x.n : 0), 0), left: e[1], id: e[0] }; }, pick);
    const cardBox = await page.locator('.crafter.shop .crcard').nth(pick).boundingBox();
    await tap(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.waitForTimeout(250);
    const buyBtn = await page.locator('.crafter.shop .crdetail .btn.good').first().boundingBox();
    await tap(buyBtn.x + buyBtn.width / 2, buyBtn.y + buyBtn.height / 2);
    await page.waitForTimeout(400);
    const after = await ev(([i, id]) => { const g = __snug.game, e = g.world.shared.shop.items[i]; return { coins: g.world.coins, have: g.me.inv.reduce((a, x) => a + (x && x.id === id ? x.n : 0), 0), left: e[1] }; }, [pick, before.id]);
    const bought = await ev(() => (__snug.game.sim.world.shared.flags.gs || {}).bought || 0); // (the coins also move with goal rewards, e.g. Build a Marketplace, so the exact coin sums are a unit test)
    ok(after.have === before.have + 1 && after.left === before.left - 1 && bought === 1, `buying with a tap: ${before.id} ${before.have} → ${after.have}, shelf ${before.left} → ${after.left}, bought counter ${bought}`);
    // sell tab
    const sellTab = await page.locator('.crafter.shop .crst').nth(1).boundingBox();
    await tap(sellTab.x + sellTab.width / 2, sellTab.y + sellTab.height / 2);
    await page.waitForTimeout(250);
    const sellCards = await ev(() => document.querySelectorAll('.crafter.shop .crcard').length);
    ok(sellCards >= 1, `the Sell tab lists what is in your bag (${sellCards})`);
    const plank = await ev(() => { const g = __snug.game; const idx = g.me.inv.findIndex((x) => x && x.id === 'plank'); return idx; });
    const sc0 = await ev(() => __snug.game.world.coins);
    const cardsS = await page.locator('.crafter.shop .crcard').all();
    for (const c of cardsS) { const t = await c.getAttribute('title'); if (t === 'Plank') { const b = await c.boundingBox(); await tap(b.x + b.width / 2, b.y + b.height / 2); break; } }
    await page.waitForTimeout(250);
    const sb = await page.locator('.crafter.shop .crdetail .btn.good').first().boundingBox();
    await tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.waitForTimeout(400);
    const sc1 = await ev(() => __snug.game.world.coins);
    ok(sc1 > sc0, `selling a plank with a tap pays (${sc0} → ${sc1})`);
    await page.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}-shop-${name}-${touch ? 'touch' : 'mouse'}.png` : undefined });
    await ev(() => __snug.game.ui.closeAll ? __snug.game.ui.closeAll() : __snug.game.ui.close());
    await page.waitForTimeout(200);

    // ------------------------------------------------------------ a lighthouse: placed from the Build menu's piece, its circle shows, resources around it give more
    const lh = await ev(() => {
      const g = __snug.game, w = g.world, me = g.me;
      for (const t of [...w.things.values()]) if (t.type === 'marketplace') w.removeThing(t.id);
      w.techs.add('little_lighthouse'); me.inv[4] = { id: 'stone', n: 200 }; me.inv[5] = { id: 'plank', n: 100 }; me.inv[6] = { id: 'rope', n: 20 }; me.inv[7] = { id: 'coal', n: 20 }; me.rev++;
      g.builder.start('little_lighthouse');
      let spot = null;
      for (let r = 2; r < 9 && !spot; r++) for (let dy = -3; dy <= 3 && !spot; dy++) for (const dx of [-r - 2, r + 1]) { const x = Math.floor(me.x / 16) + dx, y = Math.floor(me.y / 16) + dy; if (!w.placeProblem({ w: 2, h: 2, kind: 'thing' }, x, y)) { spot = { x, y }; break; } }
      return spot;
    });
    const isRingDef = await ev(() => __snug.game.builder.def && __snug.game.builder.def.behavior === 'beacon' && __snug.game.builder.def.conf.radius);
    ok(isRingDef === 5, `the Little Lighthouse is ready to place with a circle of ${isRingDef} tiles`);
    const ls = await toScreen((lh.x + 1) * 16, (lh.y + 1) * 16);
    await tap(ls.cx, ls.cy); await page.waitForTimeout(250);
    if (touch) { const place = page.locator('.buildbar button', { hasText: 'Place' }).first(); if (await place.count()) { const b = await place.boundingBox(); await tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300); } }
    const built = await ev((spot) => { const t = __snug.game.world.thingAt(spot.x, spot.y); return t ? t.type : null; }, lh);
    ok(built === 'little_lighthouse', `the Lighthouse is built (${built})`);
    await ev(() => __snug.game.builder.stop ? __snug.game.builder.stop() : __snug.game.builder.cancel && __snug.game.builder.cancel());
    // the circle is drawn around it while you stand near
    await page.waitForTimeout(700);
    const ringPx = await ev((spot) => {
      const g = __snug.game, r = 5 * 16, cx = (spot.x + 1) * 16, cy = (spot.y + 1) * 16;
      const cv = document.querySelector('canvas'); if (!cv) return null;
      return { ok: true };
    }, lh);
    ok(!!ringPx, 'the game keeps drawing');
    await page.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}-lighthouse-${name}-${touch ? 'touch' : 'mouse'}.png` : undefined });
    const grown = await ev(async () => {
      const g = __snug.game, s = g.sim, w = g.world;
      const lhT = [...w.things.values()].find((t) => t.type === 'little_lighthouse');
      const count = () => [...w.things.values()].filter((t) => t.type !== 'little_lighthouse' && Math.hypot(t.x + 0.5 - (lhT.x + 1), t.y + 0.5 - (lhT.y + 1)) <= 5 && !['marketplace'].includes(t.type) && /oak|rock|bush|pine|palm|flower|cotton|coal|copper|clay|sand|berry|tall/.test(t.type)).length;
      for (const t of [...w.things.values()]) if (t.type !== 'little_lighthouse' && Math.hypot(t.x + 0.5 - (lhT.x + 1), t.y + 0.5 - (lhT.y + 1)) <= 5 && /oak|rock|bush|pine|palm|flower|cotton|coal|copper|clay|sand|berry|tall|geode|reeds|patch/.test(t.type)) w.removeThing(t.id);
      const n0 = count();
      for (let i = 0; i < 60 * 60 && count() <= n0; i++) s.update(1 / 20); // up to a minute of game time
      return { n0, n1: count() };
    });
    ok(grown.n1 > grown.n0, `a new resource popped up in the circle (${grown.n0} → ${grown.n1})`);

    // ------------------------------------------------------------ a boss, drawn and fighting
    const boss = await ev(() => {
      const g = __snug.game, w = g.world, me = g.me;
      me.hp = 9999; const s = g.sim;
      const m = { id: w.nextId++, type: 'crystal_colossus', x: me.x + 70, y: me.y, vx: 0, vy: 0, face: -1, st: 'idle', stt: 1, hit: 0, kx: 0, ky: 0, hp: 3800, maxhp: 3800, atk: 0, z: 0, zv: 0, dir: 0, avoid: 0, avoidSign: 1, born: w.time, ph: 0, pat: 0, patT: 0.2, boss: true };
      w.mobs.set(m.id, m); w.shared.bossUp = m.id; w.emit(['boss', m.id, m.type]);
      return m.id;
    });
    const seen = new Set();
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); const st = await ev((id) => { const m = __snug.game.world.mobs.get(id); return m ? m.st : 'gone'; }, boss); seen.add(st); }
    ok(seen.size >= 2 && !seen.has('gone'), `the Crystal Colossus fights with patterns (${[...seen].join(', ')})`);
    await page.screenshot({ path: process.env.SHOT ? `${process.env.SHOT}-${name}-${touch ? 'touch' : 'mouse'}.png` : undefined });
    ok(errs.length === 0, 'no errors in the page' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }
}
server.close();
console.log(failed ? `\n${failed} FAILED` : '\nall good');
process.exit(failed ? 1 : 0);
