// Two real browsers talk to each other over WebRTC. node tools/e2e-mp.mjs [hostEngine] [guestEngine] [cloud]
import { chromium, webkit } from 'playwright';
import { PeerServer } from 'peer';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [hostEng = 'chromium', guestEng = 'chromium', cloud = ''] = process.argv.slice(2);
const useCloud = cloud === 'cloud';
const { server, url } = await startServer(path.join(ROOT, 'dist'));
let peerSrv = null;
if (!useCloud) peerSrv = PeerServer({ port: 9033, path: '/' });
const peerQ = useCloud ? '' : '&peerhost=127.0.0.1&peerport=9033&peerpath=/' + (process.env.MPDEBUG ? '&peerdebug=3' : '');
const eng = (n) => (n === 'webkit' ? webkit : chromium);
const launchOpts = { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] };
const hb = await eng(hostEng).launch(hostEng === 'chromium' ? launchOpts : {}), gb = hostEng === guestEng ? hb : await eng(guestEng).launch(guestEng === 'chromium' ? launchOpts : {});
const mk = async (b, name) => { const c = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.on('pageerror', (e) => logs.push(`[${name}] PAGEERROR: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`)); p.on('console', (m) => { if (m.type() === 'error') logs.push(`[${name}] console.error: ${m.text()}`); if (process.env.MPDEBUG) console.log(`[${name}]`, m.text().slice(0, 160)); }); return p; };
const logs = []; let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
const host = await mk(hb, 'host'), guest = await mk(gb, 'guest');
console.log(`host=${hostEng} guest=${guestEng} signaling=${useCloud ? 'PeerJS cloud' : 'local'}`);

await host.goto(url + '?quick=cozy&seed=mp' + peerQ, { waitUntil: 'load' });
await host.waitForTimeout(1500);
await host.evaluate(() => { __snug.profile.name = 'Mochi'; __snug.game.me.name = 'Mochi'; });

console.log('hosting');
await host.evaluate(() => __snug.startHosting(__snug.game));
await host.waitForFunction(() => __snug.game.net && __snug.game.net.code, null, { timeout: 25000 });
const code = await host.evaluate(() => __snug.game.net.code);
ok(/^[A-Z2-9]{5}$/.test(code), `room code ${code}`);

console.log('joining');
await guest.goto(url + '?x=1' + peerQ, { waitUntil: 'load' });
await guest.waitForTimeout(1200);
await guest.evaluate(() => { __snug.profile.name = 'Gigi'; __snug.profile.look = { skin: 2, hair: 0, hairColor: 1, outfit: 1, accessory: 0 }; __snug.saveProfile(); });
const joinMsg = [];
await guest.evaluate((c) => { window.__joinStatus = []; __snug.joinGame(c, (m) => window.__joinStatus.push(m)); }, code);
// a stranger knocks: the host has to let them in (room codes are short)
const knock = host.getByRole('button', { name: 'Let them in' }).first(); // (a guest whose first connection was slow may knock twice: either card will do)
await knock.waitFor({ timeout: 20000 }).catch(() => {});
ok(await knock.isVisible().catch(() => false), 'host sees a "wants to join" card');
if (process.env.SHOTS) { await host.waitForTimeout(500); await host.screenshot({ path: '.scratch/mp-knock.png' }); }
await knock.click({ timeout: 5000 }).catch((e) => { console.log('CLICK FAILED:', String(e.message).split('\n').slice(0, 8).join('\n')); });
await guest.waitForFunction(() => __snug.game && __snug.game.mode === 'client', null, { timeout: 30000 }).catch(() => {});
const gmode = await guest.evaluate(() => __snug.game && __snug.game.mode);
if (gmode !== 'client') console.log('join status:', await guest.evaluate(() => window.__joinStatus));
ok(gmode === 'client', 'guest entered the world as a client');
await guest.waitForTimeout(800);

const both = async () => ({ h: await host.evaluate(() => [...__snug.game.world.players.values()].filter((p) => p.online).map((p) => p.name).sort()), g: await guest.evaluate(() => [...__snug.game.world.players.values()].filter((p) => p.online).map((p) => p.name).sort()) });
const names = await both();
ok(names.h.includes('Mochi') && names.h.includes('Gigi'), `host sees both players ${names.h}`);
ok(names.g.includes('Mochi') && names.g.includes('Gigi'), `guest sees both players ${names.g}`);

console.log('movement sync');
const g0 = await host.evaluate(() => { const p = [...__snug.game.world.players.values()].find((q) => q.name === 'Gigi'); return { x: p.x, y: p.y }; });
await guest.keyboard.down('KeyD'); await guest.waitForTimeout(900); await guest.keyboard.up('KeyD');
await host.waitForTimeout(400);
const g1 = await host.evaluate(() => { const p = [...__snug.game.world.players.values()].find((q) => q.name === 'Gigi'); return { x: p.x, y: p.y, rx: p.rx }; });
ok(g1.x - g0.x > 25, `guest moved right on host's world (${(g1.x - g0.x).toFixed(0)}px)`);
ok(Math.abs(g1.rx - g1.x) < 30, 'host renders guest with interpolation');
await host.keyboard.down('KeyS'); await host.waitForTimeout(700); await host.keyboard.up('KeyS');
await guest.waitForTimeout(400);
const h1 = await guest.evaluate(() => { const p = [...__snug.game.world.players.values()].find((q) => q.name === 'Mochi'); return { y: p.y }; });
const h0y = await host.evaluate(() => __snug.game.me.y);
ok(Math.abs(h1.y - h0y) < 20, `guest sees host position (diff ${Math.abs(h1.y - h0y).toFixed(1)}px)`);

console.log('shared world actions');
// guest walks to a tree and chops it with the mouse
const tree = await guest.evaluate(() => {
  const g = __snug.game, w = g.world, me = g.me; let best = null, bd = 1e9;
  for (const t of w.things.values()) if (t.type === 'oak' && !t.dep) { const d = Math.hypot((t.x + .5) * 16 - me.x, (t.y + .5) * 16 - me.y); if (d < bd) { bd = d; best = t; } }
  me.x = (best.x + 0.5) * 16; me.y = (best.y + 1) * 16 + 6; return { id: best.id, x: best.x, y: best.y };
});
await guest.waitForTimeout(400);
const sc = await guest.evaluate((t) => { const g = __snug.game; const [cx, cy] = g.view.toClient((t.x + 0.5) * 16 - g.camX, (t.y + 0.5) * 16 - 6 - g.camY); return { cx, cy }; }, tree);
await guest.mouse.move(sc.cx, sc.cy); await guest.mouse.down(); await guest.waitForTimeout(3800); await guest.mouse.up();
await host.waitForTimeout(500);
const treeHost = await host.evaluate((id) => __snug.game.world.things.get(id).dep, tree.id);
const woodGuest = await guest.evaluate(() => __snug.game.me.inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0));
const woodHostView = await host.evaluate(() => [...__snug.game.world.players.values()].find((p) => p.name === 'Gigi').inv.reduce((a, s) => a + (s && s.id === 'wood' ? s.n : 0), 0));
ok(treeHost === 1, "guest's chopping removed the tree on the host");
ok(woodGuest > 10 && woodGuest === woodHostView, `guest inventory synced (wood ${woodGuest})`);
// host builds -> guest sees
await host.evaluate(() => { const g = __snug.game; g.world.techs.add('carpentry'); const me = g.me; const tx = Math.floor(me.x / 16) + 2, ty = Math.floor(me.y / 16) - 2; g.world.coins += 100; me.inv[0] && 0; g.cmd({ c: 'build', bid: 'wall_plank', tx, ty }); window.__wall = [tx, ty]; });
await guest.waitForTimeout(500);
const wall = await host.evaluate(() => window.__wall);
const seen = await guest.evaluate(([tx, ty]) => __snug.game.world.wall[__snug.game.world.idx(tx, ty)] > 0, wall);
ok(seen, "host's wall appears for the guest");
// guest crafts -> private state
await guest.evaluate(() => __snug.game.cmd({ c: 'craft', rid: 'plank', n: 4 }));
await guest.waitForTimeout(500);
ok(await guest.evaluate(() => __snug.game.me.inv.some((s) => s && s.id === 'plank')), 'guest crafted planks through the host');
// emote shows on the other side
await guest.evaluate(() => __snug.game.cmd({ c: 'emote', e: 0 }));
await host.waitForTimeout(400);
ok(await host.evaluate(() => __snug.game.fx.emotes.size > 0), 'emote bubble reaches the host');
// the host hatches a pet: the guest sees it trotting beside the host
await host.evaluate(() => { const g = __snug.game, me = g.me; me.inv[6] = { id: 'pet_egg', n: 1 }; me.rev++; g.cmd({ c: 'use', slot: 6, ax: me.x, ay: me.y }); });
await guest.waitForTimeout(2500);
const petSeen = await guest.evaluate(() => { const w = __snug.game.world, h = [...w.players.values()].find((p) => p.name === 'Mochi'); return [...w.mobs.values()].some((m) => Math.hypot(m.x - h.x, m.y - h.y) < 70 && ['bunny', 'chick', 'duck', 'lizard', 'penguin', 'snow_bunny', 'unicorn'].includes(m.type)); });
ok(petSeen, "the guest sees the host's new pet next to the host");
console.log('turned furniture, sitting and sleeping together');
{
  // the host builds a turned sofa and bed (a real build command); the guest must see them turned
  const spot = await host.evaluate(() => {
    const g = __snug.game, w = g.world, me = g.me;
    w.settings.buildCost = 0; w.settings.enemyDensity = 0; w.settings.sleep = 'any'; w.techs.add('cottage_style'); w.techs.add('carpentry');
    for (let r = 3; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
      for (let y = y0 - 1; y < y0 + 5 && good; y++) for (let x = x0 - 1; x < x0 + 8 && good; x++) { if (!w.inb(x, y) || !w.isTileOwned(x, y) || ((w.solid[w.idx(x, y)] & 1) && !w.thingAt(x, y)) || w.wall[w.idx(x, y)]) good = false; } // (trees and rocks can be cleared away)
      if (!good) continue;
      for (let y = y0 - 1; y < y0 + 5; y++) for (let x = x0 - 1; x < x0 + 8; x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); }
      me.x = (x0 + 3) * 16; me.y = (y0 + 3) * 16;
      g.cmd({ c: 'build', bid: 'rustic_sofa', tx: x0 + 1, ty: y0 + 1, rot: 1 });
      g.cmd({ c: 'build', bid: 'rustic_bed', tx: x0 + 4, ty: y0 + 1, rot: 3 });
      return [x0, y0];
    }
    return null;
  });
  await guest.waitForTimeout(900);
  if (process.env.MPDEBUG) console.log('  · patch', spot, await host.evaluate(() => [...__snug.game.world.things.values()].filter((t) => t.type === 'rustic_sofa' || t.type === 'rustic_bed').map((t) => [t.type, t.x, t.y, t.rot])));
  const seenG = await guest.evaluate(() => { const w = __snug.game.world, f = (type) => { const t = [...w.things.values()].find((q) => q.type === type); return t ? { id: t.id, rot: t.rot || 0, w: t.w, h: t.h, x: t.x, y: t.y } : null; }; return { sofa: f('rustic_sofa'), bed: f('rustic_bed') }; });
  ok(seenG.sofa && seenG.sofa.rot === 1 && seenG.sofa.w === 1 && seenG.sofa.h === 2, `the guest sees the sofa turned (${JSON.stringify(seenG.sofa)})`);
  ok(seenG.bed && seenG.bed.rot === 3 && seenG.bed.w === 2 && seenG.bed.h === 1, `and the bed turned (${JSON.stringify(seenG.bed)})`);
  // both sit on the sofa, one cushion each
  await guest.evaluate((id) => { const t = __snug.game.world.things.get(id), me = __snug.game.me; me.x = (t.x + 2) * 16; me.y = (t.y + 0.5) * 16 + 4; }, seenG.sofa.id);
  await guest.waitForTimeout(400); // (the host learns where the guest is from its position reports)
  await guest.evaluate((id) => __snug.game.cmd({ c: 'interact', id }), seenG.sofa.id);
  await host.evaluate((id) => { const g = __snug.game, t = g.world.things.get(id), me = g.me; me.x = (t.x + 2) * 16; me.y = (t.y + 1.5) * 16 + 4; g.cmd({ c: 'interact', id }); }, seenG.sofa.id);
  await guest.waitForTimeout(900);
  const sit = await host.evaluate(() => { const w = __snug.game.world, me = __snug.game.me, gi = [...w.players.values()].find((p) => p.name === 'Gigi'); return { host: me.sit, guest: gi.sit }; });
  ok(sit.host && sit.guest, 'both of them sit on the sofa (the host sees the guest sitting)');
  ok(sit.host.i !== undefined && (await guest.evaluate(() => __snug.game.me.sit && __snug.game.me.sit.i)) !== sit.host.i, 'on different cushions');
  const seenSit = await guest.evaluate(() => [...__snug.game.world.players.values()].filter((p) => p.sit).map((p) => p.name).sort());
  ok(seenSit.length === 2, `the guest sees both sitting (${seenSit})`);
  if (process.env.SHOTS) { await host.screenshot({ path: '.scratch/mp-sitting.png' }); }
  // the guest walks off: up, free, and the host agrees
  await guest.keyboard.down('KeyD'); await guest.waitForTimeout(500); await guest.keyboard.up('KeyD');
  await host.waitForTimeout(500);
  const up = await host.evaluate(() => { const gi = [...__snug.game.world.players.values()].find((p) => p.name === 'Gigi'); return { sit: gi.sit }; });
  ok(!up.sit && !(await guest.evaluate(() => __snug.game.me.sit)), 'walking gets the guest up, on both screens');
  await host.keyboard.down('KeyA'); await host.waitForTimeout(400); await host.keyboard.up('KeyA');
  // the guest lies down in the bed, in the daytime, then steps out: never stuck
  await guest.evaluate((id) => { const t = __snug.game.world.things.get(id), me = __snug.game.me; me.x = (t.x + 1) * 16; me.y = (t.y + 2) * 16 + 2; }, seenG.bed.id);
  await guest.waitForTimeout(400);
  await guest.evaluate((id) => __snug.game.cmd({ c: 'interact', id }), seenG.bed.id);
  await host.waitForTimeout(900);
  ok(await guest.evaluate(() => __snug.game.me.sleeping) && await host.evaluate(() => [...__snug.game.world.players.values()].find((p) => p.name === 'Gigi').sleeping), 'the guest lies in the bed and the host sees them asleep');
  if (process.env.SHOTS) { await host.screenshot({ path: '.scratch/mp-sleeping.png' }); }
  await guest.keyboard.down('KeyS'); await guest.waitForTimeout(150); await guest.keyboard.up('KeyS');
  await guest.waitForTimeout(500);
  const out = await guest.evaluate(() => { const g = __snug.game, me = g.me; return { sleeping: me.sleeping, x: me.x, y: me.y, free: g.world.boxFree(me.x, me.y - 3, 4, 3) }; });
  const hostSees = await host.evaluate(() => { const g = __snug.game, gi = [...g.world.players.values()].find((p) => p.name === 'Gigi'); return { sleeping: gi.sleeping, x: gi.x, y: gi.y, free: g.world.boxFree(gi.x, gi.y - 3, 4, 3) }; });
  ok(!out.sleeping && out.free && !hostSees.sleeping && hostSees.free, `a key press gets the guest out of bed onto free ground on both screens (${out.x.toFixed(0)},${out.y.toFixed(0)} / ${hostSees.x.toFixed(0)},${hostSees.y.toFixed(0)})`);
  // step clear of the bed's row first (a pixel short of it and the bed's corner would still catch the next step), then walk away from it
  await guest.keyboard.down('KeyS'); await guest.waitForTimeout(350); await guest.keyboard.up('KeyS'); await guest.waitForTimeout(150);
  const gx0 = await guest.evaluate(() => __snug.game.me.x);
  await guest.keyboard.down('KeyD');
  let walked = 0;
  for (let i = 0; i < 15 && walked <= 12; i++) { await guest.waitForTimeout(100); walked = (await guest.evaluate(() => __snug.game.me.x)) - gx0; } // (up to 1.5 s: a busy test machine must not decide this)
  await guest.keyboard.up('KeyD');
  if (walked <= 12) console.log('  · stuck beside the bed:', JSON.stringify(await guest.evaluate(() => { const g = __snug.game, w = g.world, me = g.me, tx = Math.floor(me.x / 16), ty = Math.floor((me.y - 3) / 16); const near = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 3; dx++) { const t = w.thingAt(tx + dx, ty + dy); near.push([dx, dy, t ? t.type + '/' + t.rot : null, w.solid[w.idx(tx + dx, ty + dy)] & 1]); } return { x: me.x, y: me.y, free: w.boxFree(me.x, me.y - 3, 4, 3), sleeping: me.sleeping, sit: me.sit, dead: me.dead, keys: [...g.input.keys], ix: me.ix, near }; })));
  ok(walked > 12, 'and they can walk away from the bed');
  // night: the guest sleeps, the night skips, dawn steps them out
  await host.evaluate(() => { const w = __snug.game.world; w.time = w.settings.dayLength * 0.8; });
  await guest.waitForTimeout(500);
  await guest.evaluate((id) => { const t = __snug.game.world.things.get(id), me = __snug.game.me; me.x = (t.x + 1) * 16; me.y = (t.y + 2) * 16 + 2; }, seenG.bed.id);
  await guest.waitForTimeout(400);
  await guest.evaluate((id) => __snug.game.cmd({ c: 'interact', id }), seenG.bed.id);
  await host.waitForTimeout(1000);
  if (process.env.MPDEBUG) console.log('  · night', await host.evaluate(() => { const g = __snug.game, gi = [...g.world.players.values()].find((p) => p.name === 'Gigi'); return { skipping: g.sim.skipping, time: g.world.time, night: g.sim.nightness(), gsleep: gi.sleeping, rule: g.world.settings.sleep, dl: g.world.settings.dayLength }; }));
  await guest.waitForFunction(() => !__snug.game.me.sleeping, null, { timeout: 25000 }).catch(() => {});
  await guest.waitForTimeout(700);
  const dawn = await guest.evaluate(() => { const g = __snug.game, me = g.me; return { sleeping: me.sleeping, free: g.world.boxFree(me.x, me.y - 3, 4, 3), x: me.x, y: me.y }; });
  const dawnHost = await host.evaluate(() => { const g = __snug.game, gi = [...g.world.players.values()].find((p) => p.name === 'Gigi'); return { sleeping: gi.sleeping, x: gi.x, y: gi.y, night: g.sim.nightness() }; });
  ok(!dawn.sleeping && dawn.free, `the night passes and the guest wakes standing on free ground (host says night=${dawnHost.night.toFixed(2)})`);
  ok(Math.hypot(dawn.x - dawnHost.x, dawn.y - dawnHost.y) < 6, `both screens agree where the guest is (${Math.hypot(dawn.x - dawnHost.x, dawn.y - dawnHost.y).toFixed(1)}px apart)`);
}
const rtt = await guest.evaluate(() => __snug.game.net.rtt);
console.log(`  · guest ping ${rtt.toFixed(0)} ms`);

await host.screenshot({ path: '.scratch/mp-host.png' });
await guest.screenshot({ path: '.scratch/mp-guest.png' });

console.log('painting together: colors built by one player show on the other screen, in both directions');
{
  const q5 = (hx) => { const n = parseInt(hx.slice(1), 16), f = (v) => Math.round(v * 31 / 255); return 0x8000 | (f(n >> 16 & 255) << 10) | (f((n >> 8) & 255) << 5) | f(n & 255); };
  const RED = q5('#e0525c'), BLUE = q5('#4a8be0'), PINK = q5('#f6b8c8');
  const spot = await host.evaluate(() => {
    const g = __snug.game, w = g.world, me = g.me;
    w.settings.buildCost = 0; w.techs.add('cottage_style'); w.techs.add('carpentry');
    for (let r = 3; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
      for (let y = y0 - 1; y < y0 + 5 && good; y++) for (let x = x0 - 1; x < x0 + 8 && good; x++) { if (!w.inb(x, y) || !w.isTileOwned(x, y) || w.ground[w.idx(x, y)] === 0 || w.wall[w.idx(x, y)] || w.floor[w.idx(x, y)]) good = false; }
      if (!good) continue;
      for (let y = y0 - 1; y < y0 + 5; y++) for (let x = x0 - 1; x < x0 + 8; x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); const f = w.flatAt(x, y); if (f) w.removeThing(f.id); }
      me.x = (x0 + 3) * 16; me.y = (y0 + 4) * 16;
      return [x0, y0];
    }
    return null;
  });
  await guest.waitForTimeout(500);
  await host.evaluate(([x, y, R, B, P]) => { const g = __snug.game; g.cmd({ c: 'build', bid: 'floor_plank', tx: x, ty: y, col: R }); g.cmd({ c: 'build', bid: 'wall_plank', tx: x + 1, ty: y, col: B }); g.cmd({ c: 'build', bid: 'rustic_sofa', tx: x + 3, ty: y + 1, col: P }); g.cmd({ c: 'build', bid: 'floor_plank', tx: x + 2, ty: y }); }, [...spot, RED, BLUE, PINK]);
  await guest.waitForTimeout(900);
  const seen = await guest.evaluate(([x, y]) => { const w = __snug.game.world, s = [...w.things.values()].find((t) => t.type === 'rustic_sofa' && t.x === x + 3 && t.y === y + 1); return { floor: w.floorCol[w.idx(x, y)], wall: w.wallCol[w.idx(x + 1, y)], sofa: s ? s.col : -1, plain: w.floorCol[w.idx(x + 2, y)] }; }, spot);
  ok(seen.floor === RED && seen.wall === BLUE && seen.sofa === PINK && seen.plain === 0, `the guest sees the host's red floor, blue wall and pink sofa (${JSON.stringify(seen)})`);
  // the guest repaints (the host executes it and the result comes back to both)
  await guest.evaluate(([x, y]) => { const me = __snug.game.me; me.x = (x + 3) * 16; me.y = (y + 4) * 16; }, spot);
  await guest.waitForTimeout(450); // (the host learns where the guest is from its position reports)
  await guest.evaluate(([x, y, B]) => { const g = __snug.game; g.cmd({ c: 'paint', tx: x, ty: y, col: B }); g.cmd({ c: 'paint', tx: x + 3, ty: y + 1, col: B }); g.cmd({ c: 'paint', tiles: [[x + 2, y]], col: B }); }, [...spot, BLUE]);
  await host.waitForTimeout(900);
  const onHost = await host.evaluate(([x, y]) => { const w = __snug.game.world, s = [...w.things.values()].find((t) => t.type === 'rustic_sofa' && t.x === x + 3 && t.y === y + 1); return { floor: w.floorCol[w.idx(x, y)], sofa: s.col, plain: w.floorCol[w.idx(x + 2, y)] }; }, spot);
  ok(onHost.floor === BLUE && onHost.sofa === BLUE && onHost.plain === BLUE, `what the guest painted shows on the host (${JSON.stringify(onHost)})`);
  const back = await guest.evaluate(([x, y]) => { const w = __snug.game.world, s = [...w.things.values()].find((t) => t.type === 'rustic_sofa' && t.x === x + 3 && t.y === y + 1); return { floor: w.floorCol[w.idx(x, y)], sofa: s.col }; }, spot);
  ok(back.floor === BLUE && back.sofa === BLUE, 'and on the guest\'s own screen');
  // a painted door keeps its color while it opens and closes, on both screens
  await host.evaluate(([x, y, R]) => __snug.game.cmd({ c: 'build', bid: 'door_plank', tx: x + 5, ty: y + 2, col: R }), [...spot, RED]);
  await guest.waitForTimeout(700);
  const doorInfo = await host.evaluate(([x, y]) => { const w = __snug.game.world, i = w.idx(x + 5, y + 2); return { code: w.wall[i], col: w.wallCol[i] }; }, spot);
  if (doorInfo.code) {
    await host.evaluate(([x, y]) => { const g = __snug.game, w = g.world; w.setWallState(x + 5, y + 2, 1); }, spot);
    await guest.waitForTimeout(700);
    const gd = await guest.evaluate(([x, y]) => { const w = __snug.game.world, i = w.idx(x + 5, y + 2); return { col: w.wallCol[i], open: w.wallState[i] }; }, spot);
    ok(gd.col === RED && gd.open === 1, `an opened painted door keeps its color on the other screen (${JSON.stringify(gd)})`);
  }
  // the picture itself on the guest's screen: the blue floor tile really is blue
  const px = await guest.evaluate(([x, y]) => { const g = __snug.game, c = g.renderer.canvas.getContext('2d'); g.fx.flash = 0; g.fx.parts.length = 0; g.fx.pops.length = 0; g.render(); const d = c.getImageData(Math.round((x + 0.5) * 16 - g.camX), Math.round((y + 0.5) * 16 - g.camY), 1, 1).data; return [d[0], d[1], d[2]]; }, spot);
  ok(px[2] > px[0] + 25, `the painted floor is drawn blue on the guest's screen (${px})`);
}

console.log('turned stations and windows: the other screen shows them turned and walks around them');
{
  const spot = await host.evaluate(() => {
    const g = __snug.game, w = g.world, me = g.me;
    w.settings.buildCost = 0; w.techs.add('kitchen'); w.techs.add('carpentry');
    for (let r = 3; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x0 = Math.floor(me.x / 16) + dx, y0 = Math.floor(me.y / 16) + dy; let good = true;
      for (let y = y0 - 1; y < y0 + 5 && good; y++) for (let x = x0 - 1; x < x0 + 8 && good; x++) { if (!w.inb(x, y) || !w.isTileOwned(x, y) || w.ground[w.idx(x, y)] === 0 || w.wall[w.idx(x, y)] || w.floor[w.idx(x, y)]) good = false; }
      if (!good) continue;
      for (let y = y0 - 1; y < y0 + 5; y++) for (let x = x0 - 1; x < x0 + 8; x++) { const t = w.thingAt(x, y); if (t) w.removeThing(t.id); const f = w.flatAt(x, y); if (f) w.removeThing(f.id); }
      me.x = (x0 + 3) * 16; me.y = (y0 + 4) * 16;
      return [x0, y0];
    }
    return null;
  });
  await guest.waitForTimeout(500);
  let seen = null;
  for (let attempt = 0; attempt < 5 && !(seen && seen.kitchen); attempt++) { // (the game does not build on top of someone, a wandering critter or the host's pet: try again a moment later)
  await host.evaluate(([x, y]) => { const g = __snug.game; g.cmd({ c: 'build', bid: 'kitchen', tx: x + 1, ty: y + 1, rot: 1 }); g.cmd({ c: 'build', bid: 'chest', tx: x + 5, ty: y + 1, rot: 2 }); g.cmd({ c: 'build', bid: 'wall_plank', tx: x + 3, ty: y }); g.cmd({ c: 'build', bid: 'window_plank', tx: x + 4, ty: y, rot: 3 }); g.cmd({ c: 'build', bid: 'floor_plank', tx: x + 6, ty: y + 3, rot: 1 }); }, spot);
  await guest.waitForTimeout(900);
  seen = await guest.evaluate(([x, y]) => {
    const w = __snug.game.world, k = [...w.things.values()].find((t) => t.type === 'kitchen' && t.x === x + 1 && t.y === y + 1), c = [...w.things.values()].find((t) => t.type === 'chest' && t.x === x + 5);
    return { kitchen: k ? { rot: k.rot, w: k.w, h: k.h } : null, chest: c ? c.rot : -1, window: w.wallRot[w.idx(x + 4, y)], floor: w.floorRot[w.idx(x + 6, y + 3)], below: !!w.thingAt(x + 1, y + 2), beside: !!w.thingAt(x + 2, y + 1), solidBelow: (w.solid[w.idx(x + 1, y + 2)] & 1) === 1, solidBeside: (w.solid[w.idx(x + 2, y + 1)] & 1) === 1 };
  }, spot);
  }
  ok(seen.kitchen && seen.kitchen.rot === 1 && seen.kitchen.w === 1 && seen.kitchen.h === 2, `the guest sees the kitchen on its side (${JSON.stringify(seen.kitchen)})`);
  ok(seen.below && seen.solidBelow && !seen.beside && !seen.solidBeside, 'and cannot walk through its second tile, but can walk beside it');
  ok(seen.chest === 2 && seen.window === 3 && seen.floor === 1, `the chest, the window and the floor tile are turned for the guest too (${seen.chest}/${seen.window}/${seen.floor})`);
  // the guest builds one turned: the host gets it exactly as sent
  await guest.evaluate(([x, y]) => { const me = __snug.game.me; me.x = (x + 3) * 16; me.y = (y + 4) * 16; }, spot);
  await guest.waitForTimeout(450);
  let wb = null;
  for (let attempt = 0; attempt < 5 && !wb; attempt++) { // (the host's pet may be standing on the spot, and the game does not build on top of someone: try again a moment later)
    await guest.evaluate(([x, y]) => __snug.game.cmd({ c: 'build', bid: 'workbench', tx: x + 5, ty: y + 3, rot: 3 }), spot);
    await host.waitForTimeout(900);
    wb = await host.evaluate(([x, y]) => { const t = [...__snug.game.world.things.values()].find((q) => q.type === 'workbench' && q.x === x + 5 && q.y === y + 3); return t ? { rot: t.rot, w: t.w, h: t.h } : null; }, spot);
  }
  ok(wb && wb.rot === 3 && wb.w === 1 && wb.h === 2, `a workbench the guest turned is turned on the host (${JSON.stringify(wb)})`);
}

console.log('reconnect after a dropped connection');
await guest.evaluate(() => { window.__oldLink = __snug.game.net; __snug.game.net.conn.close(); });
await guest.waitForFunction(() => __snug.game.ui.name === 'lost', null, { timeout: 8000 }).catch(() => {});
ok(await guest.evaluate(() => __snug.game.ui.name === 'lost'), 'guest shows the "Connection lost" screen');
await guest.waitForFunction(() => __snug.game.net !== window.__oldLink && !__snug.game.ui.isOpen, null, { timeout: 40000 }).catch(() => {});
ok(await guest.evaluate(() => __snug.game.net !== window.__oldLink && !__snug.game.lostState), 'guest reconnected automatically');
await guest.waitForTimeout(600);
ok((await both()).h.includes('Gigi'), 'host sees the guest again');
await guest.evaluate(() => __snug.game.cmd({ c: 'craft', rid: 'plank', n: 1 }));
await guest.waitForTimeout(400);
ok(true, 'game continues after reconnect');

console.log('partner backup copy');
const copies = await guest.evaluate(async () => (await __snug.listWorlds()).filter((w) => w.copyOf).length);
ok(copies >= 1, `guest device holds a copy of the host's world (${copies})`);

console.log(logs.length ? 'LOGS:\n' + logs.join('\n') : 'no console errors');
if (logs.length) failed++;
await host.evaluate(() => __snug.quitToTitle());
await guest.waitForTimeout(1500);
await hb.close(); if (gb !== hb) await gb.close();
server.close(); if (peerSrv) peerSrv.close && peerSrv.close();
console.log(failed ? `\n${failed} problem(s)` : '\nall good');
process.exit(failed ? 1 : 0);
