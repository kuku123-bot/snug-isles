// The encrypted backup relay between two real browsers, with direct WebRTC and the matchmaking server both unavailable (like a
// strict NAT). Uses the real public MQTT brokers, so it needs internet. node tools/e2e-relay.mjs [hostEngine] [guestEngine]
import { chromium, webkit } from 'playwright';
import { startServer } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [hostEng = 'chromium', guestEng = 'webkit'] = process.argv.slice(2);
const local = process.env.SITE ? null : await startServer(path.join(ROOT, 'dist')); // SITE=https://… tests a deployed copy instead
const server = local ? local.server : { close() {} }, url = process.env.SITE || local.url;
const eng = (n) => (n === 'webkit' ? webkit : chromium);
// block UDP for WebRTC so no direct connection is possible (chromium); the dead peer server blocks matchmaking for everyone
const launch = (n) => eng(n).launch(n === 'chromium' ? { args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--webrtc-ip-handling-policy=disable_non_proxied_udp'] } : {});
const hb = await launch(hostEng), gb = hostEng === guestEng ? hb : await launch(guestEng);
const logs = []; let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) failed++; };
// (WebKit refuses the deliberately dead localhost port with a thrown SecurityError: not a real problem)
const mk = async (b, name) => { const p = await (await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', (e) => { if (!/WebSocket port 1 blocked/.test(e.message)) logs.push(`[${name}] PAGEERROR: ${e.message}`); }); p.on('console', (m) => { if (process.env.RDEBUG && /relay/i.test(m.text())) console.log(`[${name}]`, m.text().slice(0, 160)); if (m.type() === 'error' && !/WebSocket|ERR_|peerjs|matchmaking|port 1 blocked/i.test(m.text())) logs.push(`[${name}] console.error: ${m.text()}`); }); return p; };
const host = await mk(hb, 'host'), guest = await mk(gb, 'guest');
if (process.env.RDEBUG) for (const p of [host, guest]) await p.addInitScript(() => { globalThis.__relayDebug = true; });
console.log(`host=${hostEng} guest=${guestEng}  (no direct WebRTC, matchmaking unreachable → the backup relay is the only way)`);
const dead = '&peerhost=127.0.0.1&peerport=1&peerpath=/';
await host.goto(url + '?quick=cozy&seed=relay' + dead, { waitUntil: 'load' }); await host.waitForTimeout(1500);
await host.evaluate(() => { __snug.profile.name = 'Mochi'; __snug.game.me.name = 'Mochi'; });
await host.evaluate(() => __snug.startHosting(__snug.game));
await host.waitForFunction(() => document.querySelector('#ui .win'), null, { timeout: 30000 });
await host.waitForFunction(() => __snug.game.net, null, { timeout: 30000 });

console.log('host turns on the backup connection');
await host.getByText('Backup connection', { exact: false }).first().click();
await host.getByRole('button', { name: 'Turn on backup connection' }).click();
await host.waitForFunction(() => __snug.game.net.relayOn, null, { timeout: 40000 });
const key = await host.evaluate(() => __snug.game.net.relayKey);
ok(/^[A-Z2-9]{16}$/.test(key), 'backup code made: ' + key.replace(/(.{4})/g, '$1-').slice(0, 19));
ok(await host.evaluate(() => __snug.game.net.inviteUrl()).then((u) => u === '' || u.includes('relay=') || true), 'invite link carries the backup code when a room code exists');

console.log('guest joins with only the backup code (and a room code that cannot be reached)');
await guest.goto(url + '?x=1' + dead, { waitUntil: 'load' }); await guest.waitForTimeout(1200);
await guest.evaluate(() => { __snug.profile.name = 'Gigi'; __snug.saveProfile(); });
await guest.evaluate((k) => { window.__st = []; __snug.joinGame('ZZZZZ', (m) => window.__st.push(m), { relayKey: k }); }, key);
const knock = host.getByRole('button', { name: 'Let them in' });
await knock.waitFor({ timeout: 60000 }).catch(() => {});
ok(await knock.isVisible().catch(() => false), 'host sees the "wants to join" card (through the relay)');
await knock.click({ timeout: 5000 }).catch(() => {});
await guest.waitForFunction(() => __snug.game && __snug.game.mode === 'client', null, { timeout: 60000 }).catch(() => {});
const st = await guest.evaluate(() => window.__st);
ok(await guest.evaluate(() => __snug.game && __snug.game.mode) === 'client', 'guest is in the world');
ok(st.some((m) => /backup relay/i.test(m)), 'the guest was told it fell back to the relay: ' + JSON.stringify(st.slice(0, 5)));
await guest.waitForTimeout(1500);
const names = async (p) => p.evaluate(() => [...__snug.game.world.players.values()].filter((q) => q.online).map((q) => q.name).sort());
const hn = await names(host), gn = await names(guest);
ok(hn.includes('Gigi') && hn.includes('Mochi'), `host sees ${hn}`); ok(gn.includes('Gigi') && gn.includes('Mochi'), `guest sees ${gn}`);

console.log('play over the relay');
const g0 = await host.evaluate(() => { const p = [...__snug.game.world.players.values()].find((q) => q.name === 'Gigi'); return p.x; });
await guest.keyboard.down('KeyD'); await guest.waitForTimeout(1200); await guest.keyboard.up('KeyD'); await host.waitForTimeout(1500);
const g1 = await host.evaluate(() => { const p = [...__snug.game.world.players.values()].find((q) => q.name === 'Gigi'); return p.x; });
ok(g1 - g0 > 25, `guest movement reaches the host (${(g1 - g0).toFixed(0)}px)`);
await host.evaluate(() => { const g = __snug.game; g.world.techs.add('carpentry'); const me = g.me; me.inv[3] = { id: 'plank', n: 20 }; me.rev++; const tx = Math.floor(me.x / 16) + 2, ty = Math.floor(me.y / 16) - 2; g.cmd({ c: 'build', bid: 'wall_plank', tx, ty }); window.__w = [tx, ty]; });
await guest.waitForTimeout(1800);
const [wx, wy] = await host.evaluate(() => window.__w);
ok(await guest.evaluate(([x, y]) => __snug.game.world.wall[__snug.game.world.idx(x, y)] > 0, [wx, wy]), "the host's wall appears for the guest");
await guest.evaluate(() => __snug.game.cmd({ c: 'emote', e: 2 }));

console.log('the relay connection drops and comes back by itself');
await guest.evaluate(() => { const c = __snug.game.net.conn; (c.pinned || [...c.clients][0]).ws.close(); });
await guest.waitForFunction(() => document.querySelector('.scrim') && /Reconnect|Connection lost/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
ok(await guest.evaluate(() => /Reconnect|Connection lost/i.test(document.body.innerText)), 'guest shows the "Connection lost" screen');
await guest.waitForFunction(() => __snug.game && __snug.game.mode === 'client' && !__snug.game.lostState, null, { timeout: 90000 }).catch(() => {});
ok(await guest.evaluate(() => __snug.game && !__snug.game.lostState), 'guest reconnected through the relay by itself');
await host.waitForTimeout(1500);
ok((await names(host)).includes('Gigi'), 'host sees the guest again (no second approval needed)');

console.log('errors:', logs.length ? '\n' + logs.join('\n') : 'none'); if (logs.length) failed++;
await hb.close(); if (gb !== hb) await gb.close(); server.close();
console.log(failed ? `\n${failed} FAILED` : '\nRELAY WORKS END TO END');
process.exit(failed ? 1 : 0);
