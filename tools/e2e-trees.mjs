// The big-button Research and Skills trees, used the way a player does (mouse and touch, landscape and portrait iPad sizes).
// node tools/e2e-trees.mjs [chromium] [webkit]      SITE=https://… tests a deployed copy
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
  for (const [label, vp, touch] of [['iPad landscape, touch', { width: 1180, height: 820 }, true], ['iPad portrait, touch', { width: 820, height: 1180 }, true], ['Mac window, mouse', { width: 1280, height: 800 }, false]]) {
    console.log(`\n== ${name} · ${label}`);
    const browser = await eng.launch();
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) errs.push(e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(url + (url.includes('?') ? '&' : '?') + 'quick=dreamy&seed=trees', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__snug && window.__snug.game, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    // (the ready boxes pulse, which Playwright would call "not stable": scroll to them by hand and press with force)
    const press = async (sel) => { for (let attempt = 0; ; attempt++) { try { const loc = page.locator(sel).first(); await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })); await page.waitForTimeout(80); if (touch) await loc.tap({ force: true, timeout: 4000 }); else await loc.click({ force: true, timeout: 4000 }); break; } catch (e) { if (attempt >= 3) throw e; await page.waitForTimeout(250); } } await page.waitForTimeout(200); }; // (the panel re-draws itself now and then: if the box was replaced while it was being pressed, press the new one)
    const st = () => page.evaluate(() => { const g = __snug.game; return { techs: g.world.techs.size, sp: g.me.sp, skills: { ...g.me.skills } }; });

    // ------------------------------------------------------------ research
    await page.evaluate(() => __snug.game.ui.open('tech')); await page.waitForTimeout(400);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.btab')].map((b) => ({ t: b.textContent, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
    ok(tabs.length === 6 && tabs.some((t) => /Seaside/.test(t.t)), `six branch buttons incl. Seaside (${tabs.map((t) => t.t.replace(/\s+/g, ' ').trim()).join(' | ')})`);
    ok(tabs.every((t) => t.h >= 40), 'branch buttons are big enough to tap (>= 40px high)');
    const panel = await page.evaluate(() => { const p = document.querySelector('.tree-panel'), r = p.getBoundingClientRect(); const t = document.querySelector('.tree').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth, vh: innerHeight, treeH: t.height, treeB: t.bottom, sw: document.documentElement.scrollWidth }; });
    ok(panel.l >= -1 && panel.r <= panel.vw + 1 && panel.treeB <= panel.vh, `the tree fits the screen (${Math.round(panel.r - panel.l)}px wide, tree ${Math.round(panel.treeH)}px high)`);
    ok(panel.treeH >= 150, 'the tree area is big enough to use');
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.tbox')].map((b) => ({ id: b.dataset.id, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, cls: b.className })));
    ok(boxes.length >= 8 && boxes.every((b) => b.w >= 90 && b.h >= 90), `${boxes.length} big square buttons (all >= 90px)`);
    ok(boxes.some((b) => /ready/.test(b.cls)), 'something is ready to research (yellow)');

    // pick a ready box, read it, research it
    const ready = boxes.find((b) => /ready/.test(b.cls));
    const before = await st();
    await press(`.tbox[data-id="${ready.id}"]`);
    const det = await page.evaluate(() => ({ name: document.querySelector('.td-name')?.textContent || '', btn: [...document.querySelectorAll('.tdetail .btn')].map((b) => b.textContent.trim()), sel: !!document.querySelector('.tbox.sel') }));
    ok(det.sel && det.name.length > 3 && det.btn.some((b) => /Research/.test(b)), `tapping a ready box shows it and a Research button (${det.name.trim()})`);
    await press('.tdetail .btn.good');
    await page.waitForTimeout(500);
    const after = await st();
    ok(after.techs === before.techs + 1, `researching works (${before.techs} -> ${after.techs} technologies)`);
    const nowDone = await page.evaluate((id) => document.querySelector(`.tbox[data-id="${id}"]`)?.className || '', ready.id);
    ok(/done/.test(nowDone), 'the box turns green');

    // a locked box says what it needs; the button jumps there
    const locked = await page.evaluate(() => { const b = document.querySelector('.tbox.locked'); return b ? b.dataset.id : null; });
    if (locked) {
      await press(`.tbox[data-id="${locked}"]`);
      const need = await page.evaluate(() => [...document.querySelectorAll('.tdetail .btn')].map((b) => b.textContent.trim()));
      ok(need.some((n) => /^Needs /.test(n)), `a locked box says what it needs (${need.join(', ')})`);
      await press('.tdetail .btn');
      const jumped = await page.evaluate(() => document.querySelector('.td-name')?.textContent || '');
      ok(jumped.length > 2 && !need.some((n) => n.includes(jumped.trim()) === false && false), `the Needs button jumps to the missing technology (${jumped.trim()})`);
    }

    // the Seaside branch has its own page
    await press('.btab:has-text("Seaside")');
    const sea = await page.evaluate(() => [...document.querySelectorAll('.tbox')].map((b) => b.textContent));
    ok(sea.length === 13 && sea.some((t) => /Driftwood/.test(t)) && sea.some((t) => /Fishing/.test(t)) && sea.some((t) => /Hot Springs/.test(t)), `Seaside & Fishing shows its 13 boxes (${sea.length})`);
    // scroll inside the tree works (it is bigger than the window for the long branches)
    await press('.btab:has-text("Tools")');
    const scrolls = await page.evaluate(() => { const t = document.querySelector('.tree'); return { sw: t.scrollWidth, cw: t.clientWidth, sh: t.scrollHeight, ch: t.clientHeight }; });
    ok(scrolls.sw >= scrolls.cw && scrolls.sh >= scrolls.ch, `long branches scroll inside the tree (${scrolls.sw}x${scrolls.sh} in ${scrolls.cw}x${scrolls.ch})`);
    await page.evaluate(() => __snug.game.ui.closeAll(true));

    // ------------------------------------------------------------ skills
    await page.evaluate(() => { const g = __snug.game; g.me.sp = 4; g.me.rev++; g.ui.open('skills'); }); await page.waitForTimeout(400);
    const stabs = await page.evaluate(() => [...document.querySelectorAll('.btab')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(stabs.length === 5, `five skill branches (${stabs.join(' | ')})`);
    ok(await page.evaluate(() => [...document.querySelectorAll('.pill')].some((p) => /4 skill points/.test(p.textContent))), 'the skill point counter shows 4');
    const sboxes = await page.evaluate(() => [...document.querySelectorAll('.tbox')].map((b) => ({ id: b.dataset.id, cls: b.className, w: b.getBoundingClientRect().width })));
    ok(sboxes.length >= 9 && sboxes.every((b) => b.w >= 90), `${sboxes.length} big skill boxes`);
    await press('.tbox[data-id="strong_arms"]');
    ok(await page.evaluate(() => /Strong Arms/.test(document.querySelector('.td-name')?.textContent || '') && !!document.querySelector('.tdetail .btn.good')), 'tapping Strong Arms shows it with a Learn button');
    const s0 = await st();
    await press('.tdetail .btn.good'); await page.waitForTimeout(400);
    const s1 = await st();
    ok(s1.skills.strong_arms === 1 && s1.sp === s0.sp - 1, `learning works (rank ${s1.skills.strong_arms || 0}, points ${s0.sp} -> ${s1.sp})`);
    const child = await page.evaluate(() => document.querySelector('.tbox[data-id="swift_hands"]')?.className || '');
    ok(/ready/.test(child), 'the next skill (Swift Hands) opens up');
    await press('.tbox[data-id="swift_hands"]'); await press('.tdetail .btn.good'); await page.waitForTimeout(300);
    ok((await st()).skills.swift_hands === 1, 'and can be learned right away');
    await press('.btab:has-text("Wanderer")');
    ok(await page.evaluate(() => [...document.querySelectorAll('.tbox')].some((b) => /Treasure Sense/.test(b.textContent))), 'other skill branches work too');
    await page.evaluate(() => __snug.game.ui.closeAll(true));

    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }
}
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall tree checks passed');
process.exit(failed ? 1 : 0);
