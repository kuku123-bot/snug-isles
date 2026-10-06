// Network protocol shared by host + client: message framing/chunking, compression, event application, snapshots, interpolation.
// Pure logic (no DOM) so it can be tested in Node with a loopback transport.
import { TILE, clamp } from '../util.js';
import { b64ToBytes } from '../sim/sim.js';
import { MOBS } from '../data/mobs.js';

export const PROTOCOL = 5;
/** identifies the exact build so two devices on different versions can be told so (see tools/build.mjs) */
export const BUILD_ID = typeof __BUILD__ === 'undefined' ? 'dev' : __BUILD__;
export const MAX_PLAYERS = 4;
export const CHUNK = 12000; // characters per chunk (safe for every browser's SCTP message limit)
export const ST_HZ = 15, EV_HZ = 20, POS_HZ = 20;
export const INTERP_DELAY = 0.1;
export const MOB_RANGE = 26 * TILE;

// ------------------------------------------------------------------ framing
let bigId = 1;
/** send(obj): small messages go out as one JSON string, large ones are split into chunks */
export function sendMsg(conn, obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (s.length <= CHUNK) { conn.send(s); return; }
  const id = bigId++;
  const n = Math.ceil(s.length / CHUNK);
  for (let i = 0; i < n; i++) conn.send(JSON.stringify({ t: 'big', id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
}

/** Reassembles chunked messages; call feed(string) and get back a parsed message (or null while waiting). */
export class Reader {
  constructor() { this.parts = new Map(); }
  feed(str) {
    let m;
    try { m = JSON.parse(str); } catch (e) { return null; }
    if (m && m.t === 'big') {
      // never trust sizes from the network: a few thousand chunks at most, a handful of messages in flight
      if (!Number.isInteger(m.n) || m.n < 1 || m.n > 4096 || !Number.isInteger(m.i) || m.i < 0 || m.i >= m.n || typeof m.d !== 'string' || m.d.length > CHUNK * 2) return null;
      let p = this.parts.get(m.id);
      if (!p) { if (this.parts.size >= 16) this.parts.delete(this.parts.keys().next().value); p = { n: m.n, got: 0, a: new Array(m.n) }; this.parts.set(m.id, p); }
      if (p.n !== m.n) return null;
      if (p.a[m.i] === undefined) { p.a[m.i] = m.d; p.got++; }
      if (p.got === p.n) {
        this.parts.delete(m.id);
        try { return JSON.parse(p.a.join('')); } catch (e) { return null; }
      }
      return null;
    }
    return m;
  }
}

// ------------------------------------------------------------------ compression (gzip via CompressionStream when available)
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export async function packJSON(obj) {
  const str = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return { z: 0, d: str };
  try {
    const cs = new CompressionStream('gzip');
    const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
    const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    return { z: 1, d: toB64(buf) };
  } catch (e) { return { z: 0, d: str }; }
}
export async function unpackJSON(p) {
  if (!p.z) return JSON.parse(p.d);
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter(); w.write(b64ToBytes(p.d)); w.close();
  const txt = await new Response(ds.readable).text();
  return JSON.parse(txt);
}

// ------------------------------------------------------------------ state codes for mobs
const ST_NAMES = ['idle', 'hop', 'chase', 'wander', 'run', 'windup', 'slam', 'charge', 'summon', 'ring', 'shoot'];
const ST_CODE = Object.fromEntries(ST_NAMES.map((n, i) => [n, i]));
const r1 = (v) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ host -> client snapshots
export function buildStateMsg(sim, link) {
  const w = sim.world;
  const me = w.players.get(link.pid);
  const players = [];
  for (const p of w.players.values()) {
    if (!p.online) continue;
    players.push([p.pid, r1(p.x), r1(p.y), Math.round(p.hp), p.dead > 0 ? 1 : 0, p.sleeping ? 1 : 0, p.sit ? 1 : 0, p.shield > 0 ? 1 : 0, p.ix ? Math.sign(p.ix) : 0, p.iy ? Math.sign(p.iy) : 0]);
  }
  const mobs = [];
  for (const m of w.mobs.values()) {
    if (me && Math.hypot(m.x - me.x, m.y - me.y) > MOB_RANGE && !m.boss) continue;
    mobs.push([m.id, m.type, r1(m.x), r1(m.y), Math.round(m.hp), m.maxhp, m.face > 0 ? 1 : -1, ST_CODE[m.st] || 0, Math.round(m.z || 0), m.hit > 0 ? 1 : 0]);
  }
  return { t: 'st', tm: Math.round(w.time * 20) / 20, p: players, m: mobs };
}

const PS_KEYS = ['hp', 'energy', 'hunger', 'inv', 'equip', 'xp', 'level', 'sp', 'skills', 'buffs', 'spawn', 'cozy', 'room', 'dead', 'sleeping', 'sit', 'shield', 'dashCd'];
export function buildPrivateMsg(p) {
  const o = { t: 'ps' };
  for (const k of PS_KEYS) o[k] = p[k];
  o.hp = Math.round(p.hp); o.energy = Math.round(p.energy); o.hunger = Math.round(p.hunger); o.xp = Math.round(p.xp * 10) / 10;
  return o;
}
export function applyPrivate(p, m) {
  for (const k of PS_KEYS) if (m[k] !== undefined) p[k] = m[k];
  p.rev = (p.rev || 0) + 1;
  p.stats = null;
}

// ------------------------------------------------------------------ client: apply events from the host
export function applyEvent(world, ev, ctx = {}) {
  const W = world.W;
  switch (ev[0]) {
    case 'f': world.setFloor(ev[1] % W, (ev[1] / W) | 0, ev[2], true, ev[3]); break; // ev[3]: paint color
    case 'w': world.setWall(ev[1] % W, (ev[1] / W) | 0, ev[2], ev[3], true, ev[4]); break;
    case 'd': world.setDeco(ev[1] % W, (ev[1] / W) | 0, ev[2], true, ev[3]); break;
    case 'g': world.setGroundTile(ev[1] % W, (ev[1] / W) | 0, ev[2]); break;
    case 'land': world.setLandGround(ev[1], ev[2], b64ToBytes(ev[4]), ev[3]); break;
    case 'ta': {
      const [, id, type, x, y, flip, hp, dep, s, rot, col] = ev;
      if (!world.things.has(id)) world.addThing(type, x, y, { id, flip, hp, dep, s, rot, col, silent: true });
      break;
    }
    case 'tr': world.removeThing(ev[1], true); break;
    case 'tu': world.patchThing(ev[1], ev[2], true); break;
    case 'da': {
      const [, id, item, n, ox, oy, x, y] = ev;
      if (!world.drops.has(id)) world.drops.set(id, { id, item, n, x, y, ox, oy, age: 0, ttl: 600 });
      break;
    }
    case 'du': { const d = world.drops.get(ev[1]); if (d) d.n = ev[2]; break; }
    case 'dr': world.drops.delete(ev[1]); break;
    case 'pa': {
      const [, id, x, y, vx, vy, color, life, kind] = ev;
      world.projs.set(id, { id, x, y, vx, vy, color, life, kind, r: 3 });
      break;
    }
    case 'pr': world.projs.delete(ev[1]); break;
    case 'mr': { const m = world.mobs.get(ev[1]); if (m) world.mobs.delete(ev[1]); break; }
    case 'coins': world.coins = ev[1]; world.rev++; break;
    case 'tech': {
      world.techs.add(ev[1]);
      world.shared.flags.statsRev = (world.shared.flags.statsRev || 0) + 1;
      for (const p of world.players.values()) { p.stats = null; p.rev = (p.rev || 0) + 1; }
      world.rev++;
      break;
    }
    case 'day': world.day = ev[1]; break;
    case 'market': world.shared.market = ev[1]; break;
    case 'wx': world.shared.weather = ev[1]; world.shared.storm = ev[2]; break;
    case 'boss': world.shared.bossUp = ev[1] || null; break;
    case 'fx': if (world.hooks.fx) world.hooks.fx(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]); break;
    case 'landbought': break;
    case 'wake': break;
    case 'pj': ensurePlayer(world, ev[1]); break; // [pj, {pid,id,name,look}]
    case 'pl': { const p = world.players.get(ev[1]); if (p) p.online = false; break; }
    case 'goal': { const f = world.shared.flags; const l = f.goals || (f.goals = []); if (!l.includes(ev[1])) l.push(ev[1]); world.rev++; break; }
    case 'goals': world.shared.flags.goals = [...ev[1]]; world.rev++; break;
    case 'prk': { const p = world.players.get(ev[1]); if (p) { world.players.delete(ev[1]); p.pid = ev[2]; world.players.set(ev[2], p); } break; } // a returning partner on a new device
    case 'name': { const p = world.players.get(ev[1]); if (p) { p.name = ev[2]; p.look = ev[3]; } break; }
    default: break;
  }
}

export function ensurePlayer(world, info) {
  let p = world.players.get(info.pid);
  if (!p) {
    p = { pid: info.pid, id: info.id, name: info.name, look: info.look, x: info.x || 0, y: info.y || 0, vx: 0, vy: 0, dir: 0, face: 1, hp: 20, energy: 100, hunger: 100, inv: [], equip: { head: null, body: null, feet: null, charm: null }, sel: 0, xp: 0, level: 1, sp: 0, skills: {}, buffs: {}, spawn: null, dead: 0, sleeping: false, sit: null, online: true, cd: 0, dashCd: 0, fish: null, cozy: 0, shield: 0, stats: null, rev: 1 };
    world.players.set(info.pid, p);
  } else { p.id = info.id; p.name = info.name; p.look = info.look; }
  p.online = true;
  return p;
}
export const publicPlayer = (p) => ({ pid: p.pid, id: p.id, name: p.name, look: p.look, x: p.x, y: p.y });

// ------------------------------------------------------------------ client: apply the periodic state message
export function applyState(world, m, now, localPid) {
  world.time = m.tm;
  const seen = new Set();
  for (const e of m.p) {
    const [pid, x, y, hp, dead, sleeping, sit, shield, ix, iy] = e;
    const p = world.players.get(pid);
    if (!p) continue;
    p.online = true;
    if (pid === localPid) { continue; }
    p.hp = hp; p.dead = dead ? 1 : 0; p.sleeping = !!sleeping; p.sit = sit ? { id: 0 } : null; p.shield = shield ? 1 : 0; p.ix = ix; p.iy = iy;
    pushSample(p, now, x, y);
    seen.add(pid);
  }
  for (const p of world.players.values()) if (p.pid !== localPid && !seen.has(p.pid) && p.online) { /* keep until pl event */ }
  const mseen = new Set();
  for (const e of m.m) {
    const [id, type, x, y, hp, maxhp, face, st, z, hit] = e;
    let mob = world.mobs.get(id);
    if (!mob) {
      mob = { id, type, x, y, hp, maxhp, face, st: ST_NAMES[st] || 'idle', z, hit: 0, vx: 0, vy: 0, kx: 0, ky: 0, boss: !!(MOBS[type] && MOBS[type].boss), buf: [], rx: x, ry: y };
      world.mobs.set(id, mob);
    }
    mob.hp = hp; mob.maxhp = maxhp; mob.face = face; mob.st = ST_NAMES[st] || 'idle'; mob.z = z; if (hit) mob.hit = 0.16;
    pushSample(mob, now, x, y);
    mseen.add(id);
  }
  // mobs the host no longer reports (out of range / gone): drop after a short grace
  for (const mob of world.mobs.values()) {
    if (!mseen.has(mob.id)) { mob.missing = (mob.missing || 0) + 1; if (mob.missing > 3) world.mobs.delete(mob.id); } else mob.missing = 0;
  }
}

function pushSample(o, now, x, y) {
  const buf = o.buf || (o.buf = []);
  buf.push({ t: now, x, y });
  while (buf.length > 6) buf.shift();
  o.x = x; o.y = y;
}

/** Interpolate remote entities to `now - INTERP_DELAY`. Sets rx/ry on each. */
export function interpolate(world, now, localPid) {
  const rt = now - INTERP_DELAY;
  const apply = (o) => {
    const b = o.buf;
    if (!b || !b.length) { o.rx = o.x; o.ry = o.y; return; }
    if (b.length === 1 || rt <= b[0].t) { o.rx = b[0].x; o.ry = b[0].y; if (rt <= b[0].t && b.length > 1) return; }
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t <= rt) {
        const a = b[i], c = b[i + 1];
        if (!c) { o.rx = a.x; o.ry = a.y; return; }
        const k = clamp((rt - a.t) / Math.max(0.001, c.t - a.t), 0, 1);
        // snap on teleports
        if (Math.hypot(c.x - a.x, c.y - a.y) > 90) { o.rx = c.x; o.ry = c.y; return; }
        o.rx = a.x + (c.x - a.x) * k; o.ry = a.y + (c.y - a.y) * k;
        return;
      }
    }
    o.rx = b[0].x; o.ry = b[0].y;
  };
  for (const p of world.players.values()) if (p.pid !== localPid && p.online) apply(p);
  for (const m of world.mobs.values()) apply(m);
}
