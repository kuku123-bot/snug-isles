// The running game session (solo / host / client). Owns the world mirror, local player control, camera, fx, HUD and UI.
import { TILE, clamp, TAU, hash32 } from '../util.js';
import { GOAL_BY_ID } from '../data/goals.js';
import { FX } from './fx.js';
import { Builder } from './builder.js';
import { HUD } from '../ui/hud.js';
import { UI } from '../ui/ui.js';
import { TouchControls } from '../ui/touch.js';
import { ITEMS } from '../data/items.js';
import { NODES } from '../data/nodes.js';
import { BUILD, BUILD_CATS } from '../data/build.js';
import { MOBS } from '../data/mobs.js';
import { BIOMES } from '../data/biomes.js';
import { calcStats, HOTBAR } from '../sim/player.js';
import { landPrice } from '../sim/worldgen.js';
import { wallDefOf } from '../sim/world.js';
import { nightness, phaseOf } from '../sim/daynight.js';
import { renderText } from '../gfx/bitfont.js';
import { hex, INK } from '../gfx/pixmap.js';
import { h } from '../ui/dom.js';

const INTERACTIVE = new Set(['storage', 'station', 'research', 'processor', 'market', 'bed', 'seat', 'farm', 'producer', 'drill', 'turret', 'warp', 'altar', 'piano', 'monument']);
const SWING_DUR = { 0: 0.26, 1: 0.3, 2: 0.18, 3: 0.2, 4: 0.3, 5: 0.25 };

export class Game {
  constructor(app, o) {
    this.app = app;
    this.sprites = app.sprites; this.book = app.book; this.audio = app.audio; this.view = app.view; this.input = app.input; this.renderer = app.renderer;
    this.settings = app.settings;
    this.mode = o.mode; // 'solo' | 'host' | 'client'
    this.sim = o.sim || null;
    this.world = o.world || o.sim.world;
    this.net = o.net || null;
    this.localPid = o.pid;
    this.saveId = o.saveId || null;
    this.saveName = o.saveName || 'Our Isles';
    this.t = 0;
    this.cam = { x: 0, y: 0 };
    this.camX = 0; this.camY = 0;
    this.pstates = new Map();
    this.hover = null;
    this.landTags = [];
    this.fadeWalls = true;
    this.showNames = true;
    this.kb = { vx: 0, vy: 0 };
    this.dashT = 0; this.dashDir = [0, 1]; this.useAcc = 0; this.stepT = 0;
    this.saveT = 0; this.autosaveEvery = 25;
    this.paused = false;
    this.night = 0;
    this.pointer = { wx: 0, wy: 0, cx: 0, cy: 0, down: false, pressed: false, released: false, valid: false, type: 'mouse', id: -1, sx: 0, sy: 0, st: 0, moved: false };
    this.fx = new FX(this);
    this.textCache = new Map();
    this.destroyed = false;
    this.tapQueue = [];
    this.landRevSeen = -1;
    this.coinsSeen = -1;
    this.moodSeen = '';
  }

  // ------------------------------------------------------------------ setup
  init() {
    const w = this.world, app = this.app;
    w.hooks.fx = (k, x, y, a, b, c) => this.fx.onEvent(k, x, y, a, b, c);
    w.hooks.tell = (pid, ev) => { if (pid === this.localPid) this.onTell(ev); else if (this.net) this.net.tellRemote(pid, ev); };
    this.renderer.setWorld(w);
    const hudRoot = document.getElementById('hud');
    hudRoot.classList.remove('hidden');
    this.ui = new UI(this);
    this.hud = new HUD(this, hudRoot);
    this.builder = new Builder(this);
    const touchRoot = document.getElementById('touch');
    this.touch = new TouchControls(this, touchRoot);
    this.attachPointer();
    const me = this.me;
    if (me) { this.cam.x = me.x - this.view.w / 2; this.cam.y = me.y - this.view.h / 2 - 8; }
    this.onVis = () => {
      if (document.hidden) { this.save(); return; }
      this.requestWake(); // the browser drops the screen lock whenever the tab is hidden
      this.audio.unlock();
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.onHide = () => this.save();
    window.addEventListener('pagehide', this.onHide);
    this.audio.startMusic();
    this.requestWake();
    this.view.onResize(() => { this.touch && this.touch.layout(); });
    this.hud.refreshAll();
    this.touch.layout();
  }
  requestWake() {
    if (this.destroyed || !this.settings.wakeLock || !navigator.wakeLock || (this.wake && !this.wake.released)) return;
    navigator.wakeLock.request('screen').then((l) => { this.wake = l; if (this.destroyed) { try { l.release(); } catch (e) { /* ignore */ } } }).catch(() => {});
  }
  destroy() {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('pagehide', this.onHide);
    if (this.wake) { try { this.wake.release(); } catch (e) { /* ignore */ } }
    this.audio.stopMusic(); this.audio.setRain(false);
    this.world.hooks.fx = null; this.world.hooks.tell = null;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('touch').classList.add('hidden');
    this.ui.closeAll(true);
    if (this.net) this.net.close();
    this.input.joy.x = this.input.joy.y = 0;
  }

  /** replace the world mirror after a reconnect */
  swapWorld(world, link) {
    this.world = world;
    world.hooks.fx = (k, x, y, a, b, c) => this.fx.onEvent(k, x, y, a, b, c);
    world.hooks.tell = (pid, ev) => { if (pid === this.localPid) this.onTell(ev); };
    this.renderer.setWorld(world);
    this.net = link; link.attach(this);
    this.landRevSeen = -1; this.pstates.clear(); this.hover = null;
    this.hud.refreshAll();
  }
  get me() { return this.world.players.get(this.localPid); }
  partner() { for (const p of this.world.players.values()) if (p.pid !== this.localPid && p.online) return p; return null; }
  pstate(pid) {
    let s = this.pstates.get(pid);
    if (!s) { s = { dir: 0, flip: false, moving: false, walkT: 0, swing: null, hurt: 0, lx: 0, ly: 0, init: false }; this.pstates.set(pid, s); }
    return s;
  }
  playerByEntity(id) { for (const p of this.world.players.values()) if (p.id === id) return p; return null; }
  makeText(str, color, outline = '#2a1f3d') {
    const pm = renderText(str, hex(color), { outline: outline.startsWith('rgba') ? null : hex(outline) });
    const c = document.createElement('canvas'); c.width = pm.w; c.height = pm.h;
    c.getContext('2d').putImageData(new ImageData(pm.bytes(), pm.w, pm.h), 0, 0);
    return c;
  }
  toast(text, kind = 'info') {
    const box = document.getElementById('toasts');
    const el = h('div', { class: 'toast ' + kind }, text);
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 3100);
    if (kind === 'warn') this.audio.play('error');
  }

  // ------------------------------------------------------------------ commands
  cmd(c) {
    if (this.mode === 'client') this.net.sendCmd(c);
    else this.sim.exec(this.localPid, c);
  }
  selectSlot(i) { const me = this.me; if (!me) return; me.sel = clamp(i, 0, HOTBAR - 1); this.cmd({ c: 'sel', i: me.sel }); this.audio.play('click'); }

  // ------------------------------------------------------------------ tells (private host->player messages)
  onTell(ev) {
    switch (ev.t) {
      case 'toast': this.toast(ev.text, ev.kind); break;
      case 'kb': this.kb.vx = ev.vx; this.kb.vy = ev.vy; break;
      case 'teleport': { const me = this.me; if (me) { me.x = ev.x; me.y = ev.y; this.cam.x = me.x - this.view.w / 2; this.cam.y = me.y - this.view.h / 2 - 8; } break; }
      case 'goal': {
        const gd = GOAL_BY_ID[ev.id]; if (!gd) break;
        const f = this.world.shared.flags; const l = f.goals || (f.goals = []); if (!l.includes(ev.id)) l.push(ev.id); // solo/host already has it; harmless
        this.hud.refreshGoal();
        if (ev.late === 2) break;
        const me = this.me;
        if (me) { this.fx.ring(me.x, me.y - 6, 22, '#ffe066', 0.8); this.fx.burst(me.x, me.y - 14, 16, ['#ffe066', '#ffffff', '#ff9fd0'], { speed: 58, up: 34, life: 0.9 }); }
        this.audio.play('research');
        if (ev.late === 1) { this.toast('More goals complete! Open the goal list to see them.', 'good'); break; }
        this.toast(`Goal complete: ${gd.title}${gd.reward.coins ? '   +' + gd.reward.coins + ' coins' : ''}`, 'good');
        break;
      }
      case 'dead': this.ui.open('dead'); break;
      case 'ui': {
        const t = this.world.things.get(ev.id);
        if (t && ev.s !== undefined) t.s = ev.s;
        this.ui.open(ev.kind, ev);
        break;
      }
    }
  }
  onSwing(entityId, ang, itemId) {
    const p = this.playerByEntity(entityId);
    if (!p) return;
    const st = this.pstate(p.pid);
    const it = ITEMS[itemId];
    const kind = !it ? 0 : it.weapon === 'sword' ? 1 : it.weapon === 'bow' ? 2 : it.weapon === 'staff' ? 3 : it.tool === 'shovel' ? 4 : it.tool === 'rod' ? 5 : 0;
    if (p.pid === this.localPid && st.swing && st.swing.t < 0.12) return;
    st.swing = { t: 0, dur: SWING_DUR[kind] || 0.26, ang, kind, item: itemId };
    this.faceAngle(st, ang);
    if (kind === 1) this.audio.play('swish', { vol: 0.5 });
    if (kind === 2) this.audio.play('shoot', { vol: 0.5 });
    if (kind === 3) this.audio.play('squee', { vol: 0.35, pitch: 1.4 });
  }
  onHurt(entityId) { const p = this.playerByEntity(entityId); if (p) this.pstate(p.pid).hurt = 0.5; }
  onLandRise(gx, gy) { this.landRiseT = this.t; }
  faceAngle(st, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    if (Math.abs(c) > Math.abs(s)) { st.dir = 2; st.flip = c < 0; } else if (s < 0) st.dir = 1; else st.dir = 0;
  }

  // ------------------------------------------------------------------ pointer
  attachPointer() {
    const cv = this.app.canvas, ptr = this.pointer;
    const upd = (e) => {
      ptr.cx = e.clientX; ptr.cy = e.clientY; ptr.type = e.pointerType; ptr.valid = true;
      const [ax, ay] = this.view.toArt(e.clientX, e.clientY);
      ptr.wx = ax + this.camX; ptr.wy = ay + this.camY;
    };
    this._pd = (e) => {
      if (this.ui.blocking) return;
      if (e.pointerType === 'touch' && ptr.id >= 0 && ptr.id !== e.pointerId) return;
      upd(e);
      ptr.id = e.pointerId; ptr.down = true; ptr.pressed = true; ptr.moved = false; ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.st = performance.now(); ptr.button = e.button;
      this.app.audio.unlock();
      if (e.pointerType === 'mouse') this.onClick(e.button);
    };
    this._pm = (e) => {
      if (e.pointerType === 'mouse' || e.pointerId === ptr.id) upd(e);
      if (e.pointerId === ptr.id && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 10) ptr.moved = true;
    };
    this._pu = (e) => {
      if (e.pointerId !== ptr.id && e.pointerType !== 'mouse') return;
      if (e.pointerType !== 'mouse' && ptr.down && !ptr.moved && performance.now() - ptr.st < 380 && !this.ui.blocking) this.onTap(e.clientX, e.clientY);
      ptr.down = false; ptr.released = true; if (e.pointerType !== 'mouse') ptr.id = -1;
    };
    cv.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    window.addEventListener('pointercancel', this._pu);
  }

  /** pointer world position for mouse; for touch = last touch */
  aimWorld() {
    const me = this.me, inp = this.input;
    if (inp.lastInputKind === 'pad' && inp.padAim.active) return [me.x + inp.padAim.x * 30, me.y - 6 + inp.padAim.y * 30];
    if (inp.lastInputKind === 'mouse' && this.pointer.valid) return [this.pointer.wx, this.pointer.wy];
    return this.autoAim();
  }
  autoAim() {
    const me = this.me, st = this.pstate(me.pid);
    const t = this.nearestTarget(46);
    if (t) return [t.x, t.y];
    const a = [[0, 1], [0, -1], [st.flip ? -1 : 1, 0]][st.dir];
    return [me.x + a[0] * 22, me.y - 6 + a[1] * 22];
  }
  /** nearest hittable thing/mob around the player (for touch/gamepad auto-aim) */
  nearestTarget(range) {
    const me = this.me, w = this.world;
    const px = me.x, py = me.y - 6;
    let best = null, bd = range * range;
    for (const m of w.mobs.values()) {
      const d = MOBS[m.type]; if (!d.hostile || m.hp <= 0) continue;
      const dx = m.x - px, dy = m.y - d.h * 0.4 - py, dd = dx * dx + dy * dy - 120; // prefer mobs
      if (dd < bd) { bd = dd; best = { x: m.x, y: m.y - d.h * 0.4, kind: 'mob' }; }
    }
    for (const t of w.thingsNear(px, py, range)) {
      const nd = NODES[t.type];
      if (!nd || nd.kind !== 'node' || t.dep) continue;
      const cx = (t.x + 0.5) * TILE, cy = (t.y + 0.5) * TILE - (nd.tree ? 4 : 0);
      const dd = (cx - px) ** 2 + (cy - py) ** 2;
      if (dd < bd) { bd = dd; best = { x: cx, y: cy, kind: nd.kind }; }
    }
    return best;
  }

  /** what is under the pointer? thing / mob / door / land tag */
  computeHover() {
    const me = this.me, ptr = this.pointer, w = this.world;
    if (this.ui.blocking || this.builder.active || this.input.lastInputKind !== 'mouse' || !ptr.valid) { this.hover = null; return; }
    const wx = ptr.wx, wy = ptr.wy;
    const hov = { thingId: 0, mobId: 0, wallI: -1, landKey: null, kind: null, interactive: false };
    // land tags
    for (const tg of this.landTags) if (Math.abs(wx - tg.x) < 13 && Math.abs(wy - tg.y) < 10) { hov.landKey = tg.gx + ',' + tg.gy; hov.kind = 'land'; hov.tag = tg; this.hover = hov; return; }
    let best = 18 * 18;
    for (const m of w.mobs.values()) {
      const d = MOBS[m.type];
      const dd = (m.x - wx) ** 2 + (m.y - d.h * 0.45 - wy) ** 2;
      if (dd < best && (d.hostile || true)) { best = dd; hov.mobId = m.id; hov.kind = d.hostile ? 'mob' : 'pet'; hov.mob = m; }
    }
    if (hov.mobId) { this.hover = hov; return; }
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (w.inb(tx, ty)) {
      const i = w.idx(tx, ty);
      const wc = w.wall[i];
      if (wc) { const wd = wallDefOf(wc); if (wd.piece === 'door' || wd.piece === 'gate') { hov.wallI = i; hov.kind = 'door'; hov.tx = tx; hov.ty = ty; this.hover = hov; return; } }
    }
    // things (tall sprites: also look a tile below the cursor)
    for (const t of w.thingsInRect(tx - 1, ty - 1, tx + 1, ty + 3)) {
      const nd = NODES[t.type], bd = BUILD[t.type];
      const inter = (bd && INTERACTIVE.has(bd.behavior)) || (nd && (nd.kind === 'treasure'));
      const hit = nd && nd.kind === 'node' && !t.dep;
      if (!inter && !hit) continue;
      const sprH = this.sprites.size('t_' + t.type)[1], sprW = this.sprites.size('t_' + t.type)[0];
      const x0 = t.x * TILE + (t.w * TILE - sprW) / 2, x1 = x0 + sprW, y1 = (t.y + t.h) * TILE, y0 = y1 - Math.min(sprH, 34);
      if (wx >= x0 + 2 && wx <= x1 - 2 && wy >= y0 && wy <= y1) {
        if (inter) { hov.thingId = t.id; hov.kind = 'thing'; hov.interactive = true; hov.thing = t; this.hover = hov; return; }
        hov.kind = 'node'; hov.thing = t;
      }
    }
    this.hover = hov.kind ? hov : null;
  }

  onClick(button) {
    const me = this.me;
    if (!me || me.dead > 0) return;
    this.audio.unlock();
    if (this.builder.active) return; // builder reads pointer state
    if (button === 2) { this.tryInteract(); return; }
    this.computeHover();
    const hv = this.hover;
    if (hv) {
      if (hv.kind === 'land') { this.ui.open('landbuy', { gx: hv.tag.gx, gy: hv.tag.gy }); return; }
      if (hv.kind === 'thing' && hv.interactive) { this.tryInteract(hv.thing); this.suppressUse = true; return; }
      if (hv.kind === 'door') { this.cmd({ c: 'door', tx: hv.tx, ty: hv.ty }); this.suppressUse = true; return; }
      if (hv.kind === 'pet') { this.cmd({ c: 'pet', id: hv.mobId }); this.suppressUse = true; return; }
    }
    this.suppressUse = false;
  }
  onTap(cx, cy) {
    const me = this.me; if (!me || me.dead > 0) return;
    const [ax, ay] = this.view.toArt(cx, cy);
    const wx = ax + this.camX, wy = ay + this.camY;
    // 1) land tag
    for (const tg of this.landTags) if (Math.abs(wx - tg.x) < 18 && Math.abs(wy - tg.y) < 14) { this.ui.open('landbuy', { gx: tg.gx, gy: tg.gy }); return; }
    if (this.builder.active) return;
    // 2) door
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (this.world.inb(tx, ty)) { const i = this.world.idx(tx, ty), wc = this.world.wall[i]; if (wc) { const wd = wallDefOf(wc); if (wd.piece === 'door' || wd.piece === 'gate') { this.cmd({ c: 'door', tx, ty }); return; } } }
    // 3) interactive thing
    let best = null, bd = 26 * 26;
    for (const t of this.world.thingsInRect(tx - 2, ty - 2, tx + 2, ty + 3)) {
      const nd = NODES[t.type], bdf = BUILD[t.type];
      const inter = (bdf && INTERACTIVE.has(bdf.behavior)) || (nd && nd.kind === 'treasure');
      if (!inter) continue;
      const dd = ((t.x + t.w / 2) * TILE - wx) ** 2 + ((t.y + t.h / 2) * TILE - wy + 4) ** 2;
      if (dd < bd) { bd = dd; best = t; }
    }
    if (best) { this.tryInteract(best); return; }
    // 4) passive critter
    for (const m of this.world.mobs.values()) { if (!MOBS[m.type].hostile && Math.hypot(m.x - wx, m.y - 6 - wy) < 14) { this.cmd({ c: 'pet', id: m.id }); return; } }
    // 5) tap on a resource/enemy = one swing toward it
    this.cmd({ c: 'use', slot: this.chooseSlot([wx, wy]), ax: wx, ay: wy });
  }

  // ------------------------------------------------------------------ interaction
  tryInteract(target) {
    const me = this.me, w = this.world;
    if (!me || me.dead > 0) return;
    if (target) {
      const nd = NODES[target.type];
      this.cmd({ c: 'interact', id: target.id });
      return;
    }
    const px = me.x, py = me.y - 6;
    let best = null, bd = (3.3 * TILE) ** 2;
    const [ax, ay] = this.aimWorld();
    for (const t of w.thingsNear(px, py, 3.6 * TILE + 16)) {
      const nd = NODES[t.type], bdf = BUILD[t.type];
      const inter = (bdf && INTERACTIVE.has(bdf.behavior)) || (nd && nd.kind === 'treasure');
      if (!inter) continue;
      const cx = (t.x + t.w / 2) * TILE, cy = (t.y + t.h / 2) * TILE;
      const dd = (cx - px) ** 2 + (cy - py) ** 2 + ((cx - ax) ** 2 + (cy - ay) ** 2) * 0.15;
      if (dd < bd) { bd = dd; best = { kind: 'thing', t }; }
    }
    // doors
    const tx0 = Math.floor(px / TILE), ty0 = Math.floor(py / TILE);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx0 + dx, y = ty0 + dy; if (!w.inb(x, y)) continue;
      const wc = w.wall[w.idx(x, y)]; if (!wc) continue;
      const wd = wallDefOf(wc); if (wd.piece !== 'door' && wd.piece !== 'gate') continue;
      const dd = ((x + 0.5) * TILE - px) ** 2 + ((y + 0.5) * TILE - py) ** 2;
      if (dd < bd) { bd = dd; best = { kind: 'door', x, y }; }
    }
    for (const m of w.mobs.values()) { if (MOBS[m.type].hostile) continue; const dd = (m.x - px) ** 2 + (m.y - 6 - py) ** 2; if (dd < 28 * 28 && dd < bd) { bd = dd; best = { kind: 'pet', m }; } }
    if (!best) { this.toast('Nothing to interact with here.', 'info'); return; }
    if (best.kind === 'thing') this.cmd({ c: 'interact', id: best.t.id });
    else if (best.kind === 'door') this.cmd({ c: 'door', tx: best.x, ty: best.y });
    else this.cmd({ c: 'pet', id: best.m.id });
  }
  /** nearest interactable for the touch "interact" button label */
  nearbyInteractable() {
    const me = this.me, w = this.world;
    if (!me) return null;
    const px = me.x, py = me.y - 6;
    let best = null, bd = (3.3 * TILE) ** 2;
    for (const t of w.thingsNear(px, py, 3.6 * TILE + 16)) {
      const nd = NODES[t.type], bdf = BUILD[t.type];
      const inter = (bdf && INTERACTIVE.has(bdf.behavior)) || (nd && nd.kind === 'treasure');
      if (!inter) continue;
      const dd = ((t.x + t.w / 2) * TILE - px) ** 2 + ((t.y + t.h / 2) * TILE - py) ** 2;
      if (dd < bd) { bd = dd; best = t; }
    }
    return best;
  }

  /** choose the hotbar slot to use for the target near `aim` (smart tools) */
  chooseSlot(aim) {
    const me = this.me;
    const sel = me.inv[me.sel], sit = sel && ITEMS[sel.id];
    if (!this.settings.smartTools || !sit || !(sit.tool === 'pick' || sit.weapon)) return me.sel;
    const w = this.world;
    let kind = null;
    let bestMob = 28 * 28;
    for (const m of w.mobs.values()) { const d = MOBS[m.type]; if (!d.hostile) continue; const dd = (m.x - aim[0]) ** 2 + (m.y - d.h * 0.4 - aim[1]) ** 2; if (dd < bestMob) { bestMob = dd; kind = 'mob'; } }
    if (!kind) {
      for (const t of w.thingsNear(aim[0], aim[1], 26)) { const nd = NODES[t.type]; if (nd && nd.kind === 'node' && !t.dep) { kind = 'node'; break; } if (nd && nd.kind === 'dig') kind = 'dig'; }
    }
    if (!kind) return me.sel;
    let best = -1, bs = -1;
    for (let i = 0; i < HOTBAR; i++) {
      const s = me.inv[i]; if (!s) continue; const it = ITEMS[s.id];
      let score = -1;
      if (kind === 'node' && it.tool === 'pick') score = it.tier * 10 + it.power;
      else if (kind === 'dig' && it.tool === 'shovel') score = it.tier;
      else if (kind === 'mob') {
        const close = Math.sqrt(bestMob) < 34;
        if (it.weapon === 'sword') score = it.dmg + (close ? 30 : 0);
        else if (it.weapon === 'bow') score = (close ? 0 : 40) + it.dmg * 0.5 + (me.inv.some((x) => x && x.id === 'arrow') ? 0 : -100);
        else if (it.weapon === 'staff') score = (close ? 0 : 36) + it.dmg * 0.5;
        else if (it.tool === 'pick') score = it.power * 0.2;
      }
      if (score > bs) { bs = score; best = i; }
    }
    return best >= 0 ? best : me.sel;
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    if (this.destroyed) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const inp = this.input, ui = this.ui, w = this.world;
    inp.pollGamepad();
    const me = this.me;
    this.handleGlobalKeys();
    if (me) {
      this.computeHover();
      this.updateLocalPlayer(dt);
      this.updateBuilder(dt);
    }
    if (this.mode !== 'client' && !(this.mode === 'solo' && this.paused)) this.sim.update(dt);
    if (this.net) this.net.tick(dt);
    this.fx.update(dt);
    this.updateEntities(dt);
    this.updateCamera(dt);
    this.updateLandTags();
    this.hud.update(dt);
    ui.update(dt);
    this.touch.update(dt);
    this.updateAudioMood();
    this.saveT += dt;
    if (this.saveT > this.autosaveEvery) { this.saveT = 0; this.save(); }
    inp.endFrame();
    const ptr = this.pointer; ptr.pressed = false; ptr.released = false;
  }

  handleGlobalKeys() {
    const inp = this.input, ui = this.ui;
    const me = this.me;
    if (inp.pressed('menu')) {
      if (ui.isOpen) ui.close();
      else if (this.builder.active) this.builder.stop();
      else ui.open('pause');
    }
    if (ui.blocking && !ui.isOpen) return;
    for (const [act, panel] of [['inventory', 'inventory'], ['craft', 'craft'], ['build', 'build'], ['tech', 'tech'], ['skills', 'skills'], ['map', 'map'], ['emote', 'emote']]) {
      if (inp.pressed(act)) ui.toggle(panel);
    }
    if (ui.blocking) return;
    if (inp.pressed('interact')) this.tryInteract();
    if (inp.pressed('rotate')) this.builder.rotate();
    if (inp.pressed('remove')) { if (this.builder.active) this.builder.toggleRemove(); else this.builder.startRemove(); }
    if (inp.pressed('zoomIn')) this.zoom(1);
    if (inp.pressed('zoomOut')) this.zoom(-1);
    if (me) {
      if (inp.digitPressed >= 0) this.selectSlot(inp.digitPressed);
      if (inp.wheel) this.selectSlot((me.sel + (inp.wheel > 0 ? 1 : -1) + HOTBAR) % HOTBAR);
      if (inp.pressed('nextSlot')) this.selectSlot((me.sel + 1) % HOTBAR);
      if (inp.pressed('prevSlot')) this.selectSlot((me.sel + HOTBAR - 1) % HOTBAR);
    }
  }
  zoom(d) { this.view.zoom(d); this.settings.zoomBias = this.view.bias; this.app.saveSettings(); }

  updateLocalPlayer(dt) {
    const me = this.me, w = this.world, inp = this.input;
    const st = this.pstate(me.pid);
    const stats = calcStats(w, me);
    const blocked = this.ui.blocking;
    let [ix, iy] = blocked ? [0, 0] : inp.moveVec();
    me.ix = ix; me.iy = iy;
    if (me.dead > 0) { ix = iy = 0; }
    if ((me.sleeping || me.sit) && (ix || iy)) { me.sleeping = false; me.sit = null; this.cmd({ c: 'wake' }); }
    if (me.sleeping || me.sit) { ix = iy = 0; }
    // dash
    if (!blocked && me.dead <= 0 && (inp.pressed('dash') || this.touch.dashPressed) && this.dashT <= 0 && me.energy >= 25 && me.dashCd <= 0.05 && !this.builder.active) {
      this.touch.dashPressed = false;
      let dx = ix, dy = iy;
      if (!dx && !dy) { const a = [[0, 1], [0, -1], [st.flip ? -1 : 1, 0]][st.dir]; dx = a[0]; dy = a[1]; }
      const l = Math.hypot(dx, dy) || 1;
      this.dashDir = [dx / l, dy / l]; this.dashT = 0.16;
      me.energy -= 25; me.dashCd = stats.dashCd;
      this.cmd({ c: 'dash' });
      this.fx.burst(me.x, me.y - 2, 6, ['#ffffff', '#cfeeff'], { speed: 24, up: 4, life: 0.35, size: 2 });
      this.audio.play('poof', { vol: 0.45 });
    }
    me.dashCd = Math.max(0, me.dashCd - dt);
    let vx = ix * stats.speed, vy = iy * stats.speed;
    if (this.dashT > 0) { this.dashT -= dt; vx = this.dashDir[0] * 175; vy = this.dashDir[1] * 175; }
    if (this.kb.vx || this.kb.vy) { vx += this.kb.vx; vy += this.kb.vy; const k = Math.max(0, 1 - 9 * dt); this.kb.vx *= k; this.kb.vy *= k; if (Math.abs(this.kb.vx) < 3 && Math.abs(this.kb.vy) < 3) this.kb.vx = this.kb.vy = 0; }
    const ox = me.x, oy = me.y;
    if (vx || vy) {
      const r = w.moveBox(me.x, me.y - 3, vx * dt, vy * dt, 4, 3);
      me.x = r.x; me.y = r.y + 3;
    }
    // keep inside the world
    me.x = clamp(me.x, 8, w.pxW() - 8); me.y = clamp(me.y, 8, w.pxH() - 4);
    // anim state
    const moved = Math.hypot(me.x - ox, me.y - oy);
    st.moving = moved > 0.15 && !me.sleeping;
    if (st.moving) { st.walkT += dt; this.faceFromMove(st, ix || vx, iy || vy); this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.26; this.fx.burst(me.x, me.y - 1, 1, ['#ffffff', '#e8e0d0'], { speed: 6, up: 6, life: 0.3, size: 1, grav: 0 }); } }
    // using tools
    if (!blocked && me.dead <= 0 && !this.builder.active && !me.sleeping) {
      if (inp.useHeld && !this.suppressUse) {
        this.useAcc -= dt;
        if (this.useAcc <= 0) {
          this.useAcc = 0.085;
          const aim = this.aimWorld();
          const slot = this.chooseSlot(aim);
          this.faceAngle(st, Math.atan2(aim[1] - (me.y - 6), aim[0] - me.x));
          this.cmd({ c: 'use', slot, ax: aim[0], ay: aim[1] });
          if (this.mode === 'client') this.optimisticSwing(me, slot, aim);
        }
      } else { this.useAcc = 0; if (!inp.mouse.down) this.suppressUse = false; }
    }
    // pad dash/interact handled via edges
    if (st.swing) { st.swing.t += dt; if (st.swing.t > st.swing.dur) st.swing = null; }
    st.hurt = Math.max(0, st.hurt - dt);
    // partner arrow
    const part = this.partner();
    this.partnerArrow = null;
    if (part) {
      const sx = (part.rx === undefined ? part.x : part.rx) - this.camX, sy = (part.ry === undefined ? part.y : part.ry) - 8 - this.camY;
      const W = this.view.w, H = this.view.h;
      if (sx < 6 || sy < 6 || sx > W - 6 || sy > H - 6) {
        const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((W / 2 - 14) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - 22) / Math.abs(Math.sin(ang) || 1e-6));
        this.partnerArrow = { x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k, ang };
      }
    }
  }
  optimisticSwing(me, slot, aim) {
    const s = me.inv[slot]; if (!s) return;
    const st = this.pstate(me.pid);
    if (!st.swing) this.onSwing(me.id, Math.atan2(aim[1] - (me.y - 6), aim[0] - me.x), s.id);
  }
  faceFromMove(st, ix, iy) {
    if (Math.abs(ix) > Math.abs(iy) * 0.8) { st.dir = 2; st.flip = ix < 0; } else if (iy < 0) st.dir = 1; else st.dir = 0;
  }

  updateBuilder(dt) {
    const b = this.builder;
    if (!b.active) return;
    const ptr = this.pointer;
    if (this.ui.blocking) return;
    const me = this.me;
    const st = calcStats(this.world, me);
    b.range = (st.buildReach + 1) * TILE;
    // mouse: LMB places, RMB removes; touch: finger
    let down = ptr.down && ptr.type !== 'mouse' || (this.input.mouse.down), pressed = ptr.pressed, released = ptr.released;
    if (ptr.type === 'mouse' && this.input.mouse.right && b.def) { /* temporary remove with RMB */ }
    if (this.input.lastInputKind === 'pad') { const a = this.aimWorld(); ptr.wx = a[0]; ptr.wy = a[1]; ptr.valid = true; down = this.input.useHeld; }
    b.update(dt, { wx: ptr.wx, wy: ptr.wy, down, pressed, released, valid: ptr.valid, touch: ptr.type !== 'mouse' && ptr.type !== 'pen' });
    if (ptr.type === 'mouse' && this.input.mouse.right && ptr.pressed === false && this._rmbT === undefined) this._rmbT = 0;
  }

  updateEntities(dt) {
    const w = this.world;
    for (const p of w.players.values()) {
      if (!p.online) continue;
      const st = this.pstate(p.pid);
      if (p.pid !== this.localPid) {
        const px = p.rx === undefined ? p.x : p.rx, py = p.ry === undefined ? p.y : p.ry;
        if (!st.init) { st.lx = px; st.ly = py; st.init = true; }
        const dx = px - st.lx, dy = py - st.ly;
        st.moving = Math.hypot(dx, dy) > 0.1;
        if (st.moving) { st.walkT += dt; this.faceFromMove(st, dx, dy); }
        st.lx = px; st.ly = py;
        if (st.swing) { st.swing.t += dt; if (st.swing.t > st.swing.dur) st.swing = null; }
        st.hurt = Math.max(0, st.hurt - dt);
        p.stats = p.stats || null;
      }
    }
    for (const m of w.mobs.values()) {
      if (this.mode !== 'client') { m.rx = m.x; m.ry = m.y; }
      const rx = m.rx === undefined ? m.x : m.rx, ry = m.ry === undefined ? m.y : m.ry;
      if (m.lrx !== undefined) m.moving = Math.hypot(rx - m.lrx, ry - m.lry) > 0.05; else m.moving = false;
      m.lrx = rx; m.lry = ry;
      if (m.hit > 0 && this.mode === 'client') m.hit = Math.max(0, m.hit - dt);
      if (m.sq > 0) m.sq -= dt;
      if ((m.pz || 0) > 2 && (m.z || 0) <= 0.5) m.sq = 0.12;
      m.pz = m.z || 0;
    }
  }

  updateCamera(dt) {
    const me = this.me; if (!me) return;
    const view = this.view, w = this.world;
    const px = me.rx === undefined ? me.x : me.rx, py = (me.ry === undefined ? me.y : me.ry) - 8;
    let tx = px - view.w / 2, ty = py - view.h / 2;
    // look ahead a little in the move direction
    const st = this.pstate(me.pid);
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.cam.x = clamp(this.cam.x, -view.w * 0.35, w.pxW() - view.w * 0.65); this.cam.y = clamp(this.cam.y, -view.h * 0.35, w.pxH() - view.h * 0.65);
    let sx = 0, sy = 0;
    if (this.fx.shake > 0.05 && this.settings.screenShake !== false) { sx = (Math.random() - 0.5) * this.fx.shake * 1.6; sy = (Math.random() - 0.5) * this.fx.shake * 1.6; }
    this.camX = this.cam.x + sx; this.camY = this.cam.y + sy;
  }

  updateLandTags() {
    const w = this.world;
    if (this.landRevSeen === w.landRev && this.coinsSeen === w.coins) return;
    this.landRevSeen = w.landRev; this.coinsSeen = w.coins;
    const out = [];
    const me = this.me;
    const disc = me ? calcStats(w, me).landDiscount : 0;
    for (let gy = 0; gy < w.gh; gy++) for (let gx = 0; gx < w.gw; gx++) {
      if (w.isLandOwned(gx, gy)) continue;
      if (!(w.isLandOwned(gx + 1, gy) || w.isLandOwned(gx - 1, gy) || w.isLandOwned(gx, gy + 1) || w.isLandOwned(gx, gy - 1))) continue;
      const [ox, oy] = w.landOrigin(gx, gy);
      const price = landPrice(w, gx, gy, disc);
      out.push({ gx, gy, x: (ox + 10) * TILE, y: (oy + 10) * TILE, price, afford: w.coins >= price, biome: w.biomeMap[w.landIndex(gx, gy)] });
    }
    this.landTags = out;
  }
  landBiomeIcon(tg) { const b = BIOMES[tg.biome]; return b ? b.color : null; }

  updateAudioMood() {
    const w = this.world;
    const night = nightness(phaseOf(w.time, w.settings.dayLength || 480)) > 0.55;
    const mood = night ? 'night' : 'day';
    if (mood !== this.moodSeen) { this.moodSeen = mood; this.audio.setMood(mood); }
    this.audio.setRain(!!w.shared.weather);
  }

  render() {
    if (this.destroyed || !this.me) return;
    this.renderer.draw(this);
  }

  // ------------------------------------------------------------------ saving
  async save() {
    if (this.mode === 'client' || !this.saveId || this.destroyed) return;
    try { await this.app.saveWorld(this); } catch (e) { console.warn('save failed', e); }
  }
}
