// Client side of a multiplayer session: mirrors the host's world. Own movement is local (client-authoritative); everything
// else (inventory, world changes, creatures) comes from the host.
import { PROTOCOL, POS_HZ, sendMsg, Reader, unpackJSON, applyEvent, applyState, applyPrivate, interpolate } from './protocol.js';

const TIMEOUT = 10;

export class ClientLink {
  constructor(conn, o = {}) {
    this.conn = conn;
    this.o = { pid: '', name: 'Friend', look: {}, now: () => performance.now() / 1000, onSnapshot() {}, onKick() {}, onClose() {}, onBackup() {}, onHostLeft() {}, onStatus() {}, ...o };
    this.reader = new Reader();
    this.world = null; this.game = null;
    this.pendingEv = [];
    this.info = null;
    this.posAcc = 0; this.pingAcc = 0; this.lastSent = null; this.lastPosAt = 0;
    this.rtt = 0; this.lastRx = this.o.now();
    this.closed = false;
    this.status = 'Connecting…';
    this.sig = 0;
    this.hostName = '';
    conn.onmessage = (s) => { this.lastRx = this.o.now(); const m = this.reader.feed(s); if (m) { try { this.handle(m); } catch (e) { console.error('client handle error', e); } } };
    conn.onclose = () => { if (!this.closed) { this.closed = true; this.o.onClose(); } };
  }
  start() { sendMsg(this.conn, { t: 'hello', v: PROTOCOL, pid: this.o.pid, name: this.o.name, look: this.o.look }); }

  handle(m) {
    switch (m.t) {
      case 'welcome': this.info = m; this.hostName = m.host; this.status = 'Loading the world…'; this.sig++; break;
      case 'snap': unpackJSON(m).then((data) => this.o.onSnapshot(data, this.info)).catch((e) => this.o.onKick('Could not read the world: ' + e.message)); break;
      case 'ev':
        if (!this.world) { this.pendingEv.push(...m.e); break; }
        this.applyEvents(m.e);
        break;
      case 'st': if (this.world) applyState(this.world, m, this.o.now(), this.o.pid); break;
      case 'ps': { const me = this.world && this.world.players.get(this.o.pid); if (me) applyPrivate(me, m); break; }
      case 'tell': if (this.game) this.game.onTell(m.ev); break;
      case 'settings': if (this.world) { Object.assign(this.world.settings, m.s); this.world.rev++; } break;
      case 'backup': unpackJSON(m).then((data) => this.o.onBackup(data)).catch(() => {}); break;
      case 'pong': this.rtt = Math.max(0, (this.o.now() - m.c) * 1000); this.sig++; break;
      case 'kick': this.closed = true; this.o.onKick(m.reason); try { this.conn.close(); } catch (e) { /* ignore */ } break;
      case 'bye': this.closed = true; this.o.onHostLeft(); break;
      default: break;
    }
  }
  applyEvents(list) { for (const ev of list) { try { applyEvent(this.world, ev); } catch (e) { console.error('event error', ev, e); } } }

  /** called once the Game exists */
  attach(game) {
    this.game = game; this.world = game.world;
    if (this.pendingEv.length) { this.applyEvents(this.pendingEv); this.pendingEv = []; }
    this.status = 'Connected';
  }
  attachWorld(world) { this.world = world; if (this.pendingEv.length) { this.applyEvents(this.pendingEv); this.pendingEv = []; } }

  sendCmd(c) { if (!this.closed) sendMsg(this.conn, { t: 'cmd', c }); }
  tellRemote() {}
  broadcastSettings() {}

  tick(dt) {
    if (this.closed || !this.world) return;
    const now = this.o.now();
    const w = this.world;
    w.time += dt;
    // keep projectiles and drops moving locally
    for (const p of w.projs.values()) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) w.projs.delete(p.id); }
    for (const d of w.drops.values()) { d.age += dt; d.ttl -= dt; }
    interpolate(w, now, this.o.pid);
    // position updates
    this.posAcc += dt;
    const me = w.players.get(this.o.pid);
    if (me && this.posAcc >= 1 / POS_HZ) {
      this.posAcc = 0;
      const ls = this.lastSent;
      const moved = !ls || Math.abs(ls.x - me.x) > 0.15 || Math.abs(ls.y - me.y) > 0.15 || ls.ix !== (me.ix || 0) || ls.iy !== (me.iy || 0);
      if (moved || now - this.lastPosAt > 0.25) {
        this.lastPosAt = now;
        this.lastSent = { x: me.x, y: me.y, ix: me.ix || 0, iy: me.iy || 0 };
        sendMsg(this.conn, { t: 'pos', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, ix: Math.sign(me.ix || 0), iy: Math.sign(me.iy || 0) });
      }
    }
    this.pingAcc += dt;
    if (this.pingAcc > 2) { this.pingAcc = 0; sendMsg(this.conn, { t: 'ping', c: now }); }
    if (now - this.lastRx > TIMEOUT && !this.closed) { this.closed = true; this.o.onClose(); }
  }

  close() {
    if (this.closed) { try { this.conn.close(); } catch (e) { /* ignore */ } return; }
    this.closed = true;
    try { sendMsg(this.conn, { t: 'bye' }); } catch (e) { /* ignore */ }
    setTimeout(() => { try { this.conn.close(); } catch (e) { /* ignore */ } }, 200);
  }
}
