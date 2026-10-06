// Host side of a multiplayer session. Owns the authoritative Sim; talks to any number of client links (normally one partner).
// Transport-agnostic: a "conn" is { send(str), close(), onmessage, onclose, open, buffered }.
import { clamp, TILE } from '../util.js';
import { serializeWorld } from '../sim/serialize.js';
import { PROTOCOL, BUILD_ID, MAX_PLAYERS, ST_HZ, EV_HZ, sendMsg, Reader, packJSON, buildStateMsg, buildPrivateMsg, publicPlayer, interpolate } from './protocol.js';
import { standUp } from '../sim/furniture.js';

const BACKUP_EVERY = 240;
const TIMEOUT = 14;
const ASK_TIMEOUT = 90; // seconds the host has to let a new player in

export class HostLink {
  constructor(sim, o = {}) {
    this.sim = sim;
    this.world = sim.world;
    this.o = { localPid: null, saveName: 'Our Isles', worldId: null, now: () => performance.now() / 1000, onJoin() {}, onLeave() {}, onStatus() {}, approve: null, onMismatch() {}, ...o };
    this.links = new Map();
    this.pending = new Set();
    this.evAcc = 0; this.stAcc = 0; this.backupAcc = 0;
    this.stats = { sent: 0, recv: 0 };
    this.world.record = true;
    this.closed = false;
  }
  get clientCount() { let n = 0; for (const l of this.links.values()) if (l.ready) n++; return n; }

  attach(conn) {
    const link = { conn, reader: new Reader(), pid: null, ready: false, backlog: [], psRev: -1, lastRx: this.o.now(), rtt: 0 };
    this.pending.add(link);
    conn.onmessage = (s) => { link.lastRx = this.o.now(); const m = link.reader.feed(s); if (m) { try { this.handle(link, m); } catch (e) { console.error('host handle error', e); } } };
    conn.onclose = () => this.drop(link);
    return link;
  }

  send(link, obj) { try { sendMsg(link.conn, obj); this.stats.sent++; } catch (e) { /* closing */ } }

  handle(link, m) {
    const sim = this.sim, w = this.world;
    switch (m.t) {
      case 'hello': {
        if (m.v !== PROTOCOL) return this.kick(link, 'Your two devices run different versions of the game. Reload the page on both and try again.');
        if (typeof m.pid !== 'string' || m.pid.length < 4) return this.kick(link, 'Bad player id.');
        if (m.pid === this.o.localPid) return this.kick(link, 'You are already in this world on another device — close it first.');
        if (link.asking || link.pid) return;
        // strangers must be let in by the host (room codes are short); players already in this world walk straight back in
        if (!w.players.has(m.pid) && this.o.approve) {
          if (this.links.size + 1 >= MAX_PLAYERS && !this.links.has(m.pid)) return this.kick(link, 'This world is full.');
          link.asking = true;
          this.send(link, { t: 'wait' });
          const claim = [...w.players.values()].filter((q) => !q.online && q.pid !== this.o.localPid).map((q) => ({ pid: q.pid, name: q.name, level: q.level }));
          let done = false;
          const finish = (d) => {
            if (done) return; done = true; clearTimeout(timer); link.asking = false; link.cancelAsk = null;
            if (!d || !d.allow) return this.kick(link, 'Your partner did not let you in this time.');
            if (link.conn.open === false) return;
            this.admit(link, m, d.as);
          };
          const timer = setTimeout(() => finish(null), ASK_TIMEOUT * 1000);
          link.cancelAsk = () => { if (done) return; done = true; clearTimeout(timer); link.asking = false; link.cancelAsk = null; if (this.o.onAskCancel) this.o.onAskCancel(link); };
          this.o.approve({ name: String(m.name || 'Friend').slice(0, 14), look: m.look || {}, claim }, finish, link);
          return;
        }
        this.admit(link, m, null);
        break;
      }
      case 'pos': {
        const p = link.pid && w.players.get(link.pid);
        if (!p || !link.ready) return;
        const x = clamp(+m.x || 0, 0, w.pxW()), y = clamp(+m.y || 0, 0, w.pxH());
        p.x = x; p.y = y; p.ix = m.ix | 0; p.iy = m.iy | 0;
        if ((p.ix || p.iy) && (p.sleeping || p.sit)) standUp(this.sim, p, false); // they already stepped out on their own screen
        const buf = p.buf || (p.buf = []);
        buf.push({ t: this.o.now(), x, y });
        while (buf.length > 6) buf.shift();
        break;
      }
      case 'cmd': {
        if (!link.pid || !link.ready || !m.c || typeof m.c !== 'object') return;
        this.sim.exec(link.pid, m.c);
        break;
      }
      case 'ping': this.send(link, { t: 'pong', c: m.c }); break;
      case 'rtt': link.rtt = +m.v || 0; break;
      case 'bye': this.drop(link); break;
      default: break;
    }
  }

  /** let a player in: create/resume their character, send the world */
  admit(link, m, as) {
    const sim = this.sim, w = this.world;
    const existing = this.links.get(m.pid);
    if (!existing && this.links.size + 1 >= MAX_PLAYERS) return this.kick(link, 'This world is full.');
    if (existing && existing !== link) { this.links.delete(m.pid); try { existing.conn.close(); } catch (e) { /* ignore */ } }
    if (as && !w.players.has(m.pid)) this.adopt(as, m.pid);
    this.flush(); // drain events so the snapshot below is consistent with what existing clients have
    const p = sim.addPlayer(m.pid, String(m.name || 'Friend').slice(0, 14), m.look);
    p.online = true; p.shield = 3;
    if (!w.boxFree(p.x, p.y - 3, 4, 3)) { const host = w.players.get(this.o.localPid); p.x = (host ? host.x : sim.spawn.x) + 12; p.y = host ? host.y : sim.spawn.y; }
    link.pid = m.pid; link.ready = false; link.backlog = [];
    this.pending.delete(link); this.links.set(m.pid, link);
    const data = serializeWorld(sim);
    data.worldId = this.o.worldId; data.name = this.o.saveName; data.online = [...w.players.values()].filter((q) => q.online).map((q) => q.pid);
    const host = w.players.get(this.o.localPid);
    w.emit(['pj', publicPlayer(p)]);
    packJSON(data).then((pk) => {
      if (link.conn.open === false) return;
      this.send(link, { t: 'welcome', pid: p.pid, entity: p.id, host: host ? host.name : 'Host', protocol: PROTOCOL, build: BUILD_ID });
      this.send(link, { t: 'snap', ...pk });
      link.ready = true;
      if (link.backlog.length) { this.send(link, { t: 'ev', e: link.backlog }); link.backlog = []; }
      this.o.onStatus(`${p.name} joined`);
      this.o.onJoin(p);
      if (m.build && m.build !== BUILD_ID) this.o.onMismatch(m.build, BUILD_ID);
    });
  }

  /** a returning partner on a fresh device takes over their old (offline) character */
  adopt(oldPid, newPid) {
    const w = this.world, p = w.players.get(oldPid);
    if (!p || p.online || oldPid === this.o.localPid) return false;
    w.players.delete(oldPid); p.pid = newPid; w.players.set(newPid, p);
    for (const t of w.things.values()) if (t.s && t.s.by === oldPid) t.s.by = newPid;
    w.emit(['prk', oldPid, newPid]);
    return true;
  }

  kick(link, reason) {
    this.send(link, { t: 'kick', reason });
    this.pending.delete(link);
    setTimeout(() => { try { link.conn.close(); } catch (e) { /* ignore */ } }, 250);
  }

  drop(link) {
    this.pending.delete(link);
    if (link.cancelAsk) link.cancelAsk();
    if (link.pid && this.links.get(link.pid) === link) {
      this.links.delete(link.pid);
      const p = this.world.players.get(link.pid);
      this.sim.removePlayer(link.pid);
      this.world.emit(['pl', link.pid]);
      if (p) this.o.onLeave(p);
    }
  }

  flush() {
    const evs = this.world.drainEvents();
    if (!evs.length) return;
    for (const link of this.links.values()) {
      if (!link.ready) { link.backlog.push(...evs); continue; }
      if (link.conn.lowRate) { (link.slow || (link.slow = [])).push(...evs); continue; } // sent by flushSlow at a gentler pace
      this.send(link, { t: 'ev', e: evs });
    }
  }
  /** links over the backup relay get their events in batches (at most ~8 messages a second) */
  flushSlow(now) {
    for (const link of this.links.values()) {
      if (!link.ready || !link.slow || !link.slow.length || now - (link.slowAt || 0) < 0.125) continue;
      this.send(link, { t: 'ev', e: link.slow }); link.slow = []; link.slowAt = now;
    }
  }

  tellRemote(pid, ev) {
    const link = this.links.get(pid);
    if (link) this.send(link, { t: 'tell', ev });
  }
  broadcastSettings() { for (const link of this.links.values()) if (link.ready) this.send(link, { t: 'settings', s: this.world.settings }); }

  tick(dt) {
    if (this.closed) return;
    const now = this.o.now();
    this.evAcc += dt; this.stAcc += dt; this.backupAcc += dt;
    if (this.evAcc >= 1 / EV_HZ) { this.evAcc = 0; this.flush(); this.flushSlow(now); }
    if (this.stAcc >= 1 / ST_HZ) {
      this.stAcc = 0;
      for (const link of this.links.values()) {
        if (!link.ready) continue;
        if (link.conn.buffered > 300000) continue; // clog: skip this tick
        if (link.conn.lowRate && (link.stSkip = !link.stSkip)) continue; // relay: every other state update
        this.send(link, buildStateMsg(this.sim, link));
        const p = this.world.players.get(link.pid);
        if (p && p.rev !== link.psRev) { link.psRev = p.rev; this.send(link, buildPrivateMsg(p)); }
      }
    }
    if (this.backupAcc >= BACKUP_EVERY) { this.backupAcc = 0; this.sendBackup(); }
    interpolate(this.world, now, this.o.localPid);
    for (const link of [...this.links.values()]) if (now - link.lastRx > TIMEOUT) this.drop(link);
  }

  /** a full copy of the world for the partner to keep (so either device can host next time) */
  sendBackup(onlyLink) {
    const data = serializeWorld(this.sim);
    data.worldId = this.o.worldId; data.name = this.o.saveName;
    packJSON(data).then((pk) => {
      for (const link of this.links.values()) if (link.ready && (!onlyLink || link === onlyLink)) this.send(link, { t: 'backup', ...pk });
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const link of this.links.values()) { this.send(link, { t: 'bye', why: 'host-left' }); }
    setTimeout(() => { for (const link of this.links.values()) try { link.conn.close(); } catch (e) { /* ignore */ } }, 300);
    this.world.record = false;
  }
}
