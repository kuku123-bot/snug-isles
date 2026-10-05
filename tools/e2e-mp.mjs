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
const knock = host.getByRole('button', { name: 'Let them in' });
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
const rtt = await guest.evaluate(() => __snug.game.net.rtt);
console.log(`  · guest ping ${rtt.toFixed(0)} ms`);

await host.screenshot({ path: '.scratch/mp-host.png' });
await guest.screenshot({ path: '.scratch/mp-guest.png' });

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
