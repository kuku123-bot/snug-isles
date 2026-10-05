import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give, freeSpot, findThing } from './helpers.js';
import { HostLink } from '../js/net/host.js';
import { ClientLink } from '../js/net/client.js';
import { restoreWorld } from '../js/sim/serialize.js';
import { TILE } from '../js/util.js';
import { invCount } from '../js/sim/inventory.js';
import { spawnMob } from '../js/sim/combat.js';
import { PROTOCOL } from '../js/net/protocol.js';

const tick = () => new Promise((r) => setImmediate(r));
async function pump(n = 8) { for (let i = 0; i < n; i++) await tick(); }
async function waitFor(cond, ms = 3000) { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 2)); return !!cond(); }
function connPair() {
  const a = { open: true, buffered: 0, onmessage: null, onclose: null, send(s) { setImmediate(() => b.open && b.onmessage && b.onmessage(s)); }, close() { if (!a.open) return; a.open = false; b.open = false; setImmediate(() => { a.onclose && a.onclose(); b.onclose && b.onclose(); }); } };
  const b = { open: true, buffered: 0, onmessage: null, onclose: null, send(s) { setImmediate(() => a.open && a.onmessage && a.onmessage(s)); }, close() { a.close(); } };
  return [a, b];
}
const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

async function join(sim, clock, name = 'Gigi', pid = 'guest-0001') {
  const host = sim._host;
  const [hc, cc] = connPair();
  host.attach(hc);
  let world = null, got = null;
  const link = new ClientLink(cc, {
    pid, name, look: { hair: 1 }, now: () => clock.t,
    onSnapshot: (data) => { got = data; const r = restoreWorld(data, { withSim: false }); world = r.world; for (const q of data.online) { const p = world.players.get(q); if (p) p.online = true; } link.attachWorld(world); },
    onKick: (r) => { throw new Error('kicked: ' + r); },
  });
  link.start();
  await waitFor(() => world, 5000);
  assert.ok(world, 'client received the snapshot');
  return { link, world, data: got, conn: cc };
}
function setup() {
  const clock = { t: 100 };
  const sim = makeSim('dreamy', { enemyDensity: 1 });
  sim.addPlayer('host-0001', 'Mochi');
  const host = new HostLink(sim, { localPid: 'host-0001', saveName: 'Test', worldId: 'w1', now: () => clock.t });
  sim._host = host;
  return { sim, host, clock };
}
function advance(sim, host, links, clock, secs, dt = 1 / 30) {
  for (let t = 0; t < secs; t += dt) { clock.t += dt; sim.update(dt); host.tick(dt); for (const l of links) l.tick(dt); }
}

test('join: client mirror matches the host world and shows both players', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  const p = w.players.get('host-0001');
  give(p, 'plank', 20);
  const [fx, fy] = freeSpot(sim, p, 8); p.x = (fx + .5) * TILE; p.y = (fy + 3) * TILE;
  sim.exec('host-0001', { c: 'build', bid: 'wall_plank', tx: fx, ty: fy });
  const { link, world } = await join(sim, clock);
  assert.ok(same(world.ground, w.ground), 'ground');
  assert.ok(same(world.wall, w.wall), 'walls');
  assert.equal(world.things.size, w.things.size);
  assert.equal(world.coins, w.coins);
  assert.ok(world.players.get('host-0001') && world.players.get('guest-0001'));
  assert.ok(world.players.get('guest-0001').online);
  assert.ok(w.players.get('guest-0001').online);
  advance(sim, host, [link], clock, 0.5);
  await pump();
  assert.equal(host.clientCount, 1);
});

test('world changes replicate: host builds, client sees it', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world, p = w.players.get('host-0001');
  const { link, world } = await join(sim, clock);
  give(p, 'plank', 40);
  const [fx, fy] = freeSpot(sim, p, 8); p.x = (fx + .5) * TILE; p.y = (fy + 3) * TILE;
  sim.exec('host-0001', { c: 'build', bid: 'wall_plank', tx: fx, ty: fy });
  sim.exec('host-0001', { c: 'build', bid: 'floor_plank', tx: fx + 1, ty: fy });
  sim.exec('host-0001', { c: 'build', bid: 'rustic_chair', tx: fx + 2, ty: fy });
  advance(sim, host, [link], clock, 0.3);
  await pump();
  assert.ok(same(world.wall, w.wall), 'wall replicated');
  assert.ok(same(world.floor, w.floor), 'floor replicated');
  assert.ok(world.thingAt(fx + 2, fy), 'chair replicated');
  assert.ok(same(world.solid, w.solid), 'collision map replicated');
  sim.exec('host-0001', { c: 'unbuild', tx: fx, ty: fy });
  advance(sim, host, [link], clock, 0.2); await pump();
  assert.equal(world.wall[world.idx(fx, fy)], 0);
});

test('client commands: chop a tree, get drops + private inventory back', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  const { link, world } = await join(sim, clock);
  const gp = w.players.get('guest-0001');
  const tree = findThing(sim, 'oak', gp);
  const me = world.players.get('guest-0001');
  me.x = (tree.x + .5) * TILE; me.y = (tree.y + 1) * TILE + 6;
  advance(sim, host, [link], clock, 0.2); await pump();
  assert.ok(Math.abs(gp.x - me.x) < 1, 'host sees the client position');
  const woodBefore = invCount(gp.inv, 'wood');
  for (let i = 0; i < 50 && !w.things.get(tree.id).dep; i++) {
    gp.cd = 0;
    link.sendCmd({ c: 'use', slot: 0, ax: (tree.x + .5) * TILE, ay: (tree.y + .5) * TILE });
    await pump(2); advance(sim, host, [link], clock, 0.1); await pump(2);
  }
  assert.ok(w.things.get(tree.id).dep, 'host: tree chopped');
  advance(sim, host, [link], clock, 2); await pump(6);
  assert.equal(world.things.get(tree.id).dep, 1, 'client mirror: tree depleted');
  assert.ok(invCount(gp.inv, 'wood') > woodBefore, 'host: client picked up wood');
  assert.equal(invCount(me.inv, 'wood'), invCount(gp.inv, 'wood'), 'client private inventory synced');
  assert.ok(me.xp > 0 || me.level > 1, 'xp synced');
});

test('creatures, drops and coins stream to the client', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  const { link, world } = await join(sim, clock);
  const gp = w.players.get('guest-0001');
  const m = spawnMob(sim, 'slime_green', gp.x + 60, gp.y);
  advance(sim, host, [link], clock, 0.5); await pump(4);
  assert.ok(world.mobs.get(m.id), 'mob appears on the client');
  const cm = world.mobs.get(m.id);
  assert.ok(Math.abs(cm.rx - cm.x) < 40, 'interpolated position exists');
  sim.spawnDrop('coin', 5, gp.x + 40, gp.y);
  advance(sim, host, [link], clock, 0.2); await pump(4);
  assert.ok([...world.drops.values()].some((d) => d.item === 'coin'), 'drop appears');
  advance(sim, host, [link], clock, 1.5); await pump(4);
  assert.equal(world.coins, w.coins, 'coins synced after pickup');
});

test('land purchase replicates ground, ownership and resources', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  const { link, world } = await join(sim, clock);
  w.coins = 5000; w.emit(['coins', 5000]);
  link.sendCmd({ c: 'buyLand', gx: 4, gy: 3 });
  await pump(3); advance(sim, host, [link], clock, 0.4); await pump(6);
  assert.ok(w.isLandOwned(4, 3), 'host bought');
  assert.ok(world.isLandOwned(4, 3), 'client sees ownership');
  assert.ok(same(world.ground, w.ground), 'ground identical after purchase');
  assert.equal(world.things.size, w.things.size, 'same resources');
  assert.ok(same(world.solid, w.solid), 'collision identical');
});

test('wrong protocol version is refused politely; reconnect gets a fresh snapshot', async () => {
  const { sim, host, clock } = setup();
  const [hc, cc] = connPair();
  host.attach(hc);
  let kicked = null;
  const bad = new ClientLink(cc, { pid: 'bad-0001', now: () => clock.t, onKick: (r) => { kicked = r; } });
  cc.send(JSON.stringify({ t: 'hello', v: PROTOCOL + 99, pid: 'bad-0001', name: 'x', look: {} }));
  await pump(6);
  assert.ok(kicked && /version/i.test(kicked), 'kicked with a readable reason: ' + kicked);
  const j1 = await join(sim, clock, 'Gigi', 'guest-0002');
  j1.conn.close(); await pump(6);
  assert.ok(!sim.world.players.get('guest-0002').online, 'host marks the player offline');
  const j2 = await join(sim, clock, 'Gigi', 'guest-0002');
  assert.ok(sim.world.players.get('guest-0002').online, 'back online after rejoin');
  assert.ok(j2.world.players.get('guest-0002').online);
});

test('join approval: strangers wait for the host; known players walk straight back in', async () => {
  const { sim, host, clock } = setup();
  const asked = [];
  host.o.approve = (info, decide) => { asked.push(info); setImmediate(() => decide({ allow: true })); };
  const waits = [];
  const [hc, cc] = connPair();
  host.attach(hc);
  let world = null;
  const link = new ClientLink(cc, { pid: 'guest-0007', name: 'Gigi', look: { hair: 1 }, now: () => clock.t, onWait: () => waits.push(1), onSnapshot: (d) => { world = restoreWorld(d, { withSim: false }).world; link.attachWorld(world); } });
  link.start();
  await waitFor(() => world, 5000);
  assert.equal(asked.length, 1, 'the host was asked once');
  assert.equal(asked[0].name, 'Gigi');
  assert.equal(waits.length, 1, 'the guest was told to wait');
  assert.ok(world && world.players.get('guest-0007'), 'then let in');
  // leave and come back: no second question
  cc.close(); await pump(6);
  const again = await join(sim, clock, 'Gigi', 'guest-0007');
  assert.equal(asked.length, 1, 'a known player is not asked again');
  assert.ok(again.world.players.get('guest-0007').online);
});

test('join approval: the host can say no, and a dropped request disappears', async () => {
  const { sim, host, clock } = setup();
  let decideLater = null, cancelled = 0;
  host.o.approve = (info, decide) => { decideLater = decide; };
  host.o.onAskCancel = () => { cancelled++; };
  // deny
  let kicked = null;
  const [hc, cc] = connPair(); host.attach(hc);
  const link = new ClientLink(cc, { pid: 'stranger-1', name: 'Nope', now: () => clock.t, onKick: (r) => { kicked = r; } });
  link.start(); await waitFor(() => decideLater, 2000);
  assert.ok(!sim.world.players.has('stranger-1'), 'not in the world while waiting');
  decideLater(null);
  await waitFor(() => kicked, 2000);
  assert.ok(/did not let you in/i.test(kicked), 'polite refusal: ' + kicked);
  assert.ok(!sim.world.players.has('stranger-1'), 'never added');
  // the guest gives up while the host is still deciding
  decideLater = null;
  const [hc2, cc2] = connPair(); host.attach(hc2);
  const l2 = new ClientLink(cc2, { pid: 'stranger-2', name: 'Bye', now: () => clock.t });
  l2.start(); await waitFor(() => decideLater, 2000);
  cc2.close(); await pump(6);
  assert.equal(cancelled, 1, "the host's prompt was withdrawn");
  decideLater({ allow: true }); await pump(6); // a late "yes" does nothing
  assert.ok(!sim.world.players.has('stranger-2'), 'late approval ignored');
});

test('join approval: a returning partner on a new device gets their old character back', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  // first life of the partner
  const first = await join(sim, clock, 'Gigi', 'old-device-1');
  const gp = w.players.get('old-device-1');
  give(gp, 'gem_ruby', 3); gp.level = 7; gp.xp = 123;
  // a farm plot she owns
  const [fx, fy] = freeSpot(sim, gp, 8);
  const plot = w.addThing('farm_plot', fx, fy); plot.s = { c: null, g: 0, st: 0, by: 'old-device-1' };
  first.conn.close(); await pump(6);
  assert.ok(!gp.online);
  // she comes back from a phone with a fresh profile
  host.o.approve = (info, decide) => { assert.deepEqual(info.claim.map((c) => c.name), ['Gigi']); setImmediate(() => decide({ allow: true, as: 'old-device-1' })); };
  const back = await join(sim, clock, 'Gigi', 'new-device-2');
  assert.ok(!w.players.has('old-device-1'), 'old identity retired');
  const np = w.players.get('new-device-2');
  assert.equal(np.level, 7, 'level kept');
  assert.equal(np.inv.filter((s) => s && s.id === 'gem_ruby').reduce((a, s) => a + s.n, 0), 3, 'inventory kept');
  assert.equal(plot.s.by, 'new-device-2', 'her farm still counts as hers');
  assert.ok(back.world.players.get('new-device-2') && !back.world.players.has('old-device-1'), 'her device sees the same');
});

test('island goals replicate: the partner sees the same list and gets the toast', async () => {
  const { sim, host, clock } = setup();
  const w = sim.world;
  const { link, world } = await join(sim, clock);
  const tells = []; link.game = { onTell: (ev) => tells.push(ev) };
  w.hooks.tell = (pid, ev) => host.tellRemote(pid, ev); // route private messages the way the real game does
  w.shared.flags.gs = { chop: 1 };
  const { goalsTick } = await import('../js/sim/goals.js');
  goalsTick(sim);
  advance(sim, host, [link], clock, 0.3); await pump(6);
  assert.ok(w.shared.flags.goals.includes('chop'));
  assert.ok((world.shared.flags.goals || []).includes('chop'), "the partner's mirror has it");
  assert.ok(tells.some((e) => e.t === 'goal' && e.id === 'chop'), 'the partner was told');
  // a late joiner receives the whole list in the snapshot
  const late = await join(sim, clock, 'Zed', 'guest-0009');
  assert.ok((late.world.shared.flags.goals || []).includes('chop'));
});

test('framing never trusts sizes from the network', async () => {
  const { Reader, CHUNK, sendMsg } = await import('../js/net/protocol.js');
  const r = new Reader();
  assert.equal(r.feed(JSON.stringify({ t: 'big', id: 1, i: 0, n: 1e9, d: 'x' })), null, 'a billion chunks is refused');
  assert.equal(r.feed(JSON.stringify({ t: 'big', id: 2, i: 5, n: 3, d: 'x' })), null, 'index outside the message');
  assert.equal(r.feed(JSON.stringify({ t: 'big', id: 3, i: 0, n: 2, d: 'x'.repeat(CHUNK * 3) })), null, 'oversized chunk');
  assert.equal(r.parts.size, 0, 'nothing was kept for the bad ones');
  for (let id = 100; id < 140; id++) r.feed(JSON.stringify({ t: 'big', id, i: 0, n: 2, d: 'a' }));
  assert.ok(r.parts.size <= 16, 'only a handful of half-received messages are remembered');
  // a normal big message still works
  const sent = []; const big = { t: 'x', pad: 'y'.repeat(CHUNK * 3 + 50) };
  sendMsg({ send: (s) => sent.push(s) }, big);
  const r2 = new Reader(); let out = null; for (const s of sent) out = r2.feed(s) || out;
  assert.deepEqual(out, big);
});
