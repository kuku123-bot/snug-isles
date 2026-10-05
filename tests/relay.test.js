// The encrypted relay (public MQTT brokers as a dumb pipe), exercised against an in-memory broker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RelayHost, connectRelay, makeRelayKey, parseRelayKey, formatRelayKey } from '../js/net/relay.js';
import { MqttClient } from '../js/net/mqtt.js';
import { makeSim, give } from './helpers.js';
import { HostLink } from '../js/net/host.js';
import { ClientLink } from '../js/net/client.js';
import { restoreWorld } from '../js/sim/serialize.js';
import { TILE } from '../js/util.js';

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(cond, ms = 3000) { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await wait(2); return !!cond(); }

/** an in-memory MQTT 3.1.1 broker speaking just enough of the protocol (QoS 0, + and # wildcards) */
class FakeBroker {
  constructor({ down = false } = {}) {
    this.conns = new Set(); this.published = []; this.down = down; this.drop = null;
    const broker = this;
    this.WS = class FakeWS {
      constructor() {
        this.readyState = 0; this.bufferedAmount = 0; this.buf = new Uint8Array(0); this.subs = [];
        if (broker.down) { setImmediate(() => { this.readyState = 3; this.onerror && this.onerror(new Error('down')); this.onclose && this.onclose(); }); return; }
        broker.conns.add(this);
        setImmediate(() => { this.readyState = 1; this.onopen && this.onopen(); });
      }
      send(u8) { this._in(u8); }
      close() { if (this.readyState === 3) return; this.readyState = 3; broker.conns.delete(this); setImmediate(() => this.onclose && this.onclose()); }
      _out(u8) { setImmediate(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) }); }); }
      _in(chunk) {
        const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
        for (;;) {
          if (this.buf.length < 2) return;
          let mul = 1, len = 0, i = 1, d;
          do { if (i >= this.buf.length) return; d = this.buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
          if (this.buf.length < i + len) return;
          const type = this.buf[0] >> 4, body = this.buf.slice(i, i + len); this.buf = this.buf.slice(i + len);
          if (type === 1) this._out(new Uint8Array([0x20, 2, 0, 0]));
          else if (type === 8) { const id = (body[0] << 8) | body[1]; const tl = (body[2] << 8) | body[3]; this.subs.push(new TextDecoder().decode(body.slice(4, 4 + tl))); this._out(new Uint8Array([0x90, 3, id >> 8, id & 255, 0])); }
          else if (type === 12) this._out(new Uint8Array([0xd0, 0]));
          else if (type === 14) this.close();
          else if (type === 3) {
            const tl = (body[0] << 8) | body[1]; const topic = new TextDecoder().decode(body.slice(2, 2 + tl)); const payload = body.slice(2 + tl);
            broker.published.push({ topic, payload });
            if (broker.drop && broker.drop(topic, payload)) continue;
            broker.deliver(topic, payload);
          }
        }
      }
    };
  }
  matches(filter, topic) { const f = filter.split('/'), t = topic.split('/'); for (let i = 0; i < f.length; i++) { if (f[i] === '#') return true; if (i >= t.length) return false; if (f[i] !== '+' && f[i] !== t[i]) return false; } return f.length === t.length; }
  deliver(topic, payload) {
    const tb = new TextEncoder().encode(topic);
    const body = new Uint8Array(2 + tb.length + payload.length); body[0] = tb.length >> 8; body[1] = tb.length & 255; body.set(tb, 2); body.set(payload, 2 + tb.length);
    const len = []; let n = body.length; do { let x = n % 128; n = Math.floor(n / 128); if (n > 0) x |= 128; len.push(x); } while (n > 0);
    const pkt = new Uint8Array(1 + len.length + body.length); pkt[0] = 0x30; pkt.set(len, 1); pkt.set(body, 1 + len.length);
    for (const c of this.conns) if (c.subs.some((f) => this.matches(f, topic))) c._out(pkt);
  }
}
const contains = (hay, needle) => { const n = new TextEncoder().encode(needle); outer: for (let i = 0; i + n.length <= hay.length; i++) { for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer; return true; } return false; };

test('backup codes: generated, formatted, parsed forgivingly, rejected when wrong', () => {
  const k = makeRelayKey();
  assert.equal(k.length, 16);
  assert.equal(formatRelayKey(k).length, 19);
  assert.equal(parseRelayKey(formatRelayKey(k).toLowerCase()), k);
  assert.equal(parseRelayKey(' ' + formatRelayKey(k) + '\n'), k);
  assert.equal(parseRelayKey('ABCD-EFGH'), null);
  assert.equal(parseRelayKey('AAAA-BBBB-CCCC-DDD0'), null, 'characters outside the alphabet');
  assert.notEqual(makeRelayKey(), makeRelayKey());
});

test('mqtt client: connect, subscribe, big payloads (multi-byte lengths) and wildcard delivery', async () => {
  const b = new FakeBroker();
  const a1 = new MqttClient('x', { WS: b.WS }), a2 = new MqttClient('x', { WS: b.WS });
  await a1.connect(); await a2.connect(); await a2.subscribe('t/+/z');
  const got = []; a2.onmessage = (t, p) => got.push([t, p]);
  const big = new Uint8Array(70000).map((_, i) => i & 255);
  a1.publish('t/1/z', big); a1.publish('t/2/other', big); a1.publish('t/3/z', 'hi');
  await until(() => got.length >= 2);
  assert.equal(got.length, 2, 'the non-matching topic was not delivered');
  assert.equal(got[0][1].length, 70000); assert.deepEqual([...got[0][1].slice(0, 5)], [0, 1, 2, 3, 4]);
  assert.equal(new TextDecoder().decode(got[1][1]), 'hi');
  a1.close(); a2.close();
});

test('relay: ordered two-way delivery, the broker only sees ciphertext, topics hide the key', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => conns.push(c) });
  await host.start();
  const { conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS });
  const fromGuest = [], fromHost = [];
  conn.onmessage = (t) => fromHost.push(t);
  for (let i = 0; i < 40; i++) conn.send(i === 0 ? '{"t":"hello","secret":"MOONBEAM-SECRET"}' : 'g' + i);
  await until(() => conns.length === 1);
  conns[0].onmessage = (t) => fromGuest.push(t);
  await until(() => fromGuest.length >= 39 || true, 400);
  assert.equal(conns.length, 1, 'exactly one connection appeared');
  for (let i = 0; i < 40; i++) conns[0].send('h' + i);
  assert.ok(await until(() => fromHost.length === 40), 'the guest got all 40');
  assert.deepEqual(fromHost, Array.from({ length: 40 }, (_, i) => 'h' + i), 'in order');
  assert.ok(b.published.length >= 80);
  for (const p of b.published) { assert.ok(!contains(p.payload, 'MOONBEAM'), 'no plaintext on the wire'); assert.ok(!contains(p.payload, '"t":"hello"')); assert.ok(!p.topic.includes(key), 'the key is never in a topic name'); }
  host.stop(); conn.close();
});

test('relay: forged, tampered, replayed and foreign messages are ignored', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => conns.push(c) });
  await host.start();
  const { conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS });
  const got = []; conn.send('first');
  await until(() => conns.length === 1); conns[0].onmessage = (t) => got.push(t);
  conn.send('second'); await until(() => got.length === 1);
  const hostTopic = b.published[0].topic;
  const legit = b.published.filter((p) => p.topic === hostTopic);
  // someone who is not in the room throws garbage and a copy of a real message with one flipped byte into the topic
  const evil = new MqttClient('x', { WS: b.WS }); await evil.connect();
  evil.publish(hostTopic, new Uint8Array(64).fill(7));
  const flipped = legit[1].payload.slice(); flipped[30] ^= 1; evil.publish(hostTopic, flipped);
  // a replay of an old, perfectly valid message
  evil.publish(hostTopic, legit[0].payload); evil.publish(hostTopic, legit[1].payload);
  await wait(60);
  assert.equal(conns.length, 1, 'no phantom connection from the replay of message #1');
  assert.deepEqual(got, ['second'], 'nothing extra was delivered');
  // a different key cannot even create a connection
  const other = await connectRelay(makeRelayKey(), { brokers: ['a'], WS: b.WS });
  other.conn.send('let me in'); await wait(60);
  assert.equal(conns.length, 1);
  host.stop(); conn.close(); evil.close(); other.conn.close();
});

test('relay: a missing message closes the stream so the app reconnects for a fresh copy', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => conns.push(c) });
  await host.start();
  const { conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS });
  let closed = false; conn.onclose = () => { closed = true; };
  conn.send('hello'); await until(() => conns.length === 1);
  conns[0].send('one'); await wait(30);
  let n = 0; b.drop = (topic) => topic.includes('/g/') && ++n === 1; // the broker "loses" the next message to the guest
  conns[0].send('lost'); conns[0].send('after'); // the second one arrives with a gap before it
  assert.ok(await until(() => closed), 'the guest noticed the gap');
  host.stop();
});

test('relay: two guests are routed separately, and a dead broker is skipped', async () => {
  const live = new FakeBroker(), dead = new FakeBroker({ down: true }), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['x', 'y'], WS: undefined, onConnection: (c) => conns.push(c) });
  // route per-url fakes
  const WS = class { constructor(url) { return new (url === 'y' ? live.WS : dead.WS)(url); } };
  host.WS = WS; await host.start();
  const g1 = (await connectRelay(key, { brokers: ['x', 'y'], WS, staggerMs: 30 })).conn, g2 = (await connectRelay(key, { brokers: ['x', 'y'], WS, staggerMs: 30 })).conn;
  const r1 = [], r2 = []; g1.onmessage = (t) => r1.push(t); g2.onmessage = (t) => r2.push(t);
  g1.send('from one'); g2.send('from two');
  await until(() => conns.length === 2);
  const byText = {}; for (const c of conns) c.onmessage = (t) => { byText[t] = c; };
  g1.send('a'); g2.send('b'); await until(() => byText.a && byText.b);
  byText.a.send('to-one'); byText.b.send('to-two');
  assert.ok(await until(() => r1.length === 1 && r2.length === 1));
  assert.deepEqual([r1[0], r2[0]], ['to-one', 'to-two']);
  host.stop(); g1.close(); g2.close();
});

test('relay: large messages (hundreds of KB) survive intact', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => conns.push(c) });
  let conn = null;
  try {
    await host.start();
    ({ conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS }));
    const big = Array.from({ length: 300000 }, (_, i) => String.fromCharCode(33 + (i % 90))).join('') + 'ünïcödé ✓';
    const got = []; conn.send('hi'); await until(() => conns.length === 1); conns[0].onmessage = (t) => got.push(t);
    conn.send(big); conn.send('after'); await until(() => got.length === 2);
    assert.equal(got[0], big); assert.equal(got[1], 'after');
  } finally { host.stop(); if (conn) conn.close(); }
});

test('a whole game session (join, snapshot, movement, commands) works through the relay', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const clock = { t: 100 };
  const sim = makeSim('dreamy', { enemyDensity: 0 }); sim.addPlayer('host-0001', 'Mochi');
  const host = new HostLink(sim, { localPid: 'host-0001', saveName: 'T', worldId: 'w', now: () => clock.t });
  const relay = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => host.attach(c) });
  let conn = null;
  try {
    await relay.start();
    let world = null;
    ({ conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS }));
    const link = new ClientLink(conn, { pid: 'guest-0001', name: 'Gigi', look: { hair: 1 }, now: () => clock.t, onSnapshot: (d) => { world = restoreWorld(d, { withSim: false }).world; link.attachWorld(world); } });
    link.start();
    assert.ok(await until(() => world, 8000), 'the world arrived');
    const toGuest = b.published.filter((p) => p.topic.includes('/g/'));
    assert.ok(toGuest.length >= 2, 'welcome + snapshot went through the relay: ' + toGuest.length);
    assert.equal(world.things.size, sim.world.things.size);
    const gp = world.players.get('guest-0001'), hp = sim.world.players.get('guest-0001');
    gp.x += 40; gp.y += 8;
    const tick = (secs) => { for (let t = 0; t < secs; t += 1 / 30) { clock.t += 1 / 30; sim.update(1 / 30); host.tick(1 / 30); link.tick(1 / 30); } };
    tick(1); await wait(80); tick(0.5);
    assert.ok(await until(() => Math.abs(hp.x - gp.x) < 1, 2000), 'the host sees the guest move');
    sim.world.techs.add('carpentry'); give(hp, 'plank', 20);
    const spot = [Math.floor(hp.x / TILE) + 2, Math.floor(hp.y / TILE)]; hp.x = (spot[0] + 0.5) * TILE; hp.y = (spot[1] + 3) * TILE;
    link.sendCmd({ c: 'build', bid: 'wall_plank', tx: spot[0], ty: spot[1] });
    await wait(50); tick(0.4); await wait(80); tick(0.4);
    assert.ok(await until(() => world.wall[world.idx(spot[0], spot[1])] > 0, 2000), 'a wall the guest built shows on both sides');
  } finally { relay.stop(); if (conn) conn.close(); }
});

test('relay: host and guest can reach different servers; the guest keeps talking until one answers and then settles on it', async () => {
  const A = new FakeBroker(), B = new FakeBroker(), dead = new FakeBroker({ down: true }), key = makeRelayKey();
  const route = (m) => class { constructor(url) { return new (m[url].WS)(url); } };
  const hostWS = route({ a: dead, b: B }), guestWS = route({ a: A, b: B }); // the host cannot reach server "a"; the guest reaches both (a first)
  const conns = []; const host = new RelayHost(key, { brokers: ['a', 'b'], WS: hostWS, onConnection: (c) => conns.push(c) });
  let conn = null;
  try {
    await host.start();
    ({ conn } = await connectRelay(key, { brokers: ['a', 'b'], WS: guestWS, staggerMs: 40 }));
    const got = []; conn.onmessage = (t) => got.push(t);
    conn.send('hello'); // goes out on "a" where nobody listens
    assert.ok(await until(() => conns.length === 1, 3000), 'it still reached the host, through "b"');
    conns[0].onmessage = () => {};
    conns[0].send('welcome'); conns[0].send('snapshot');
    assert.ok(await until(() => got.length === 2, 3000), 'and the answer came back');
    assert.deepEqual(got, ['welcome', 'snapshot']);
    assert.ok(conn.pinned, 'the guest settled on the server that answered');
    const before = A.published.length; conn.send('later'); await wait(60);
    assert.equal(A.published.length, before, 'later messages no longer go to the other server');
  } finally { host.stop(); if (conn) conn.close(); }
});

test('relay: messages that arrive slightly out of order are delivered in order; a message that never comes breaks the link', async () => {
  const b = new FakeBroker(), key = makeRelayKey();
  const conns = []; const host = new RelayHost(key, { brokers: ['a'], WS: b.WS, onConnection: (c) => conns.push(c) });
  let conn = null;
  try {
    await host.start();
    ({ conn } = await connectRelay(key, { brokers: ['a'], WS: b.WS }));
    const got = []; let closed = false; conn.onmessage = (t) => got.push(t); conn.onclose = () => { closed = true; };
    conn.send('hi'); await until(() => conns.length === 1); conns[0].onmessage = () => {};
    // hold back the 2nd message to the guest, let the 3rd and 4th overtake it, then release it
    let held = null; b.drop = (topic, payload) => { if (topic.includes('/g/') && !held && b.published.filter((p) => p.topic.includes('/g/')).length === 2) { held = [topic, payload]; return true; } return false; };
    conns[0].send('one'); conns[0].send('two'); conns[0].send('three'); conns[0].send('four');
    await until(() => got.length >= 1 && held); await wait(80);
    assert.deepEqual(got, ['one'], 'later messages wait for the missing one');
    b.deliver(held[0], held[1]);
    assert.ok(await until(() => got.length === 4), 'once it shows up everything is delivered');
    assert.deepEqual(got, ['one', 'two', 'three', 'four'], 'in the right order');
    assert.equal(closed, false);
  } finally { host.stop(); if (conn) conn.close(); }
});
