// Client-side visual effects: particles, floating text, rings, screen shake. Driven by world 'fx' events (same on host and client).
import { TILE, clamp, TAU } from '../util.js';
import { ITEMS } from '../data/items.js';
import { hex, css, R, G, B } from '../gfx/pixmap.js';
import { colorHex, colorRGB } from '../data/paint.js';

const PAL = {
  chip: ['#d8dce8', '#b3b8cc', '#8a90a8', '#ffffff'], leaf: ['#7fe068', '#58b84a', '#3f9a45', '#a8f08a'], snow: ['#ffffff', '#dff0ff', '#bcdcff'],
  dust: ['#e8d09a', '#c8a870', '#f4e4b8'], ember: ['#ff7a3d', '#ffb347', '#ffe066', '#ff5a2e'], spark: ['#ffffff', '#fff3a8', '#ffe066', '#cfeeff'],
  void: ['#b79cff', '#8a6cff', '#fffbd0', '#ffb3e6'], petal: ['#ff9fc0', '#ffd0e0', '#fff0a0', '#ffffff'], spirit: ['#c8ecff', '#a8d8ff', '#ffffff'],
  mob: ['#ff6b7a', '#ffffff', '#ffd0d8'], star: ['#ffe066', '#fff3a8', '#ffffff'], heart: ['#ff5f8a', '#ff9fb8'], water: ['#bfeaff', '#ffffff', '#8fd0ff'],
  puff: ['#ffffff', '#f0ecff', '#d8d4f0'], gold: ['#ffd84a', '#fff3a8', '#ffb347'],
};

export class FX {
  constructor(game) {
    this.g = game;
    this.parts = [];
    this.pops = [];
    this.rings = [];
    this.shakes = new Map(); // thing id -> seconds
    this.shake = 0; // camera shake magnitude
    this.flash = 0; // white flash (lightning etc)
    this.bobbers = new Map(); // entity id -> {x,y,t,bite}
    this.emotes = new Map(); // entity id -> {e,t}
    this.pings = [];
    this.text = new Map();
  }

  // ------------------------------------------------------------ particle helpers
  burst(x, y, n, cols, o = {}) {
    const sp = o.speed || 40, up = o.up === undefined ? 20 : o.up;
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 600) break;
      const a = Math.random() * TAU, s = (0.3 + Math.random() * 0.7) * sp;
      this.parts.push({ x: x + (Math.random() - 0.5) * (o.spread || 4), y: y + (Math.random() - 0.5) * (o.spread || 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: (o.life || 0.5) * (0.6 + Math.random() * 0.6), max: o.life || 0.5, c: cols[(Math.random() * cols.length) | 0], size: o.size || (Math.random() < 0.3 ? 2 : 1), g: o.grav === undefined ? 160 : o.grav, drag: o.drag || 0, fade: o.fade !== false });
    }
  }
  pop(x, y, text, color = '#ffffff', o = {}) {
    if (this.pops.length > 60) this.pops.shift();
    this.pops.push({ x, y, vy: o.vy === undefined ? -18 : o.vy, t: 0, life: o.life || 0.9, text: String(text), color, icon: o.icon || null, big: !!o.big, ox: 0 });
  }
  ring(x, y, r, color = '#ffffff', life = 0.45) { this.rings.push({ x, y, r, t: 0, life, color }); }

  // ------------------------------------------------------------ event mapping
  onEvent(kind, x, y, a, b, c) {
    const g = this.g, au = g.audio;
    const near = g.me ? Math.hypot(x - g.me.x, y - g.me.y) < 260 : true;
    switch (kind) {
      case 'hit': {
        const cols = PAL[a] || PAL.chip;
        this.burst(x, y, b ? 9 : 5, cols, { speed: 46, up: 24, life: 0.45 });
        if (a === 'mob') au.play('hit', { vol: 0.6 });
        break;
      }
      case 'break': {
        const cols = PAL[a] || PAL.chip;
        this.burst(x, y, b ? 16 : 12, cols, { speed: 62, up: 34, life: 0.7, spread: 8 });
        if (b) this.burst(x, y - 14, 8, PAL.leaf, { speed: 30, up: 10, grav: 60, life: 1.0, spread: 14 });
        this.shake = Math.max(this.shake, 1.2);
        au.play(b ? 'treefall' : 'rockbreak');
        break;
      }
      case 'nodehit': { this.shakes.set(a, 0.22); if (near) au.play(b ? 'chop' : 'mine', { vol: 0.9 }); break; }
      case 'clink': { this.burst(x, y, 4, PAL.spark, { speed: 40, up: 10, life: 0.3 }); au.play('clink'); break; }
      case 'dmg': {
        const col = b === 1 ? '#ffe066' : b === 2 ? '#ff6b7a' : b === 4 ? '#7fe08a' : b === 3 ? '#e8e8f0' : '#ffffff';
        this.pop(x, y, (b === 4 ? '+' : '') + a, col, { big: b === 1 || b === 2, life: b === 1 ? 1.1 : 0.8 });
        if (b === 2) { this.shake = Math.max(this.shake, 2.5); }
        break;
      }
      case 'swing': g.onSwing(a, b / 100, c || 0); break;
      case 'got': {
        const it = ITEMS[a];
        if (!g.me || Math.hypot(x - g.me.x, y - g.me.y) > 40) { /* partner's pickup: small visual only */ this.pop(x, y - 6, `+${b}`, '#cfeeff', { icon: a, life: 0.7 }); break; }
        this.pop(x, y, `+${b}`, '#ffffff', { icon: a, life: 0.9, vy: -22 });
        g.hud.logPickup(a, b);
        au.play('pickup', { pitch: 1 + Math.min(0.5, this.recentPickups() * 0.04) });
        break;
      }
      case 'levelup': {
        this.ring(x, y, 22, '#ffe066', 0.7); this.ring(x, y, 14, '#ffffff', 0.5);
        this.burst(x, y, 22, PAL.star, { speed: 70, up: 40, grav: 80, life: 1.0, spread: 6 });
        this.pop(x, y - 10, `LEVEL ${a}!`, '#ffe066', { big: true, life: 1.8, vy: -10 });
        au.play('levelup'); this.shake = Math.max(this.shake, 1.5);
        break;
      }
      case 'poof': { this.burst(x, y, a ? 14 : 8, PAL.puff, { speed: 28, up: 6, grav: -10, life: 0.6, size: 2, spread: 6 }); au.play(a ? 'poof' : 'pop', { vol: 0.7 }); break; }
      case 'puff': { this.burst(x, y, 2, PAL.puff, { speed: 8, up: 18, grav: -20, life: 0.9, size: 2 }); break; }
      case 'coin': { this.pop(x, y, `+${a}`, '#ffd84a', { icon: 'coin', big: a >= 20, life: 1.1 }); au.play('coin'); this.burst(x, y, 6, PAL.gold, { speed: 36, up: 30, life: 0.6 }); break; }
      case 'heart': { this.burst(x, y, 4, PAL.heart, { speed: 14, up: 30, grav: -30, life: 1.0, size: 2 }); au.play('squee', { vol: 0.6 }); break; }
      case 'emote': { this.emotes.set(a, { e: b, t: 0 }); au.play('emote'); break; }
      case 'door': au.play(a ? 'dooropen' : 'doorclose', { vol: 0.7 }); break;
      case 'build': { this.burst(x, y - 6, 8, PAL.puff, { speed: 26, up: 8, grav: 20, life: 0.5, size: 2 }); au.play(a ? 'placewall' : 'place'); break; }
      case 'paint': { // a few drops of the new color (a is the color; 0 = back to the original look)
        const base = a ? colorHex(a) : '#ffffff', lite = a ? '#' + colorRGB(a).map((v) => Math.round(v + (255 - v) * 0.45).toString(16).padStart(2, '0')).join('') : '#f0ecff';
        this.burst(x, y - 2, 6, [base, base, lite], { speed: 22, up: 16, grav: 50, life: 0.55, size: 2 });
        if (!this._paintSfx || g.t - this._paintSfx > 0.09) { this._paintSfx = g.t; au.play('place', { vol: 0.3 }); }
        break;
      }
      case 'unbuild': { this.burst(x, y, 7, PAL.dust, { speed: 30, up: 12, life: 0.5 }); au.play('remove'); break; }
      case 'craft': { this.burst(x, y, 8, PAL.spark, { speed: 30, up: 28, life: 0.6 }); au.play('craft'); break; }
      case 'research': { this.ring(x, y, 20, '#a77bff', 0.7); this.burst(x, y, 24, PAL.void, { speed: 60, up: 30, life: 1.0 }); au.play('research'); break; }
      case 'skill': { this.burst(x, y, 12, PAL.star, { speed: 40, up: 30, life: 0.7 }); au.play('skill'); break; }
      case 'land': { this.shake = Math.max(this.shake, 4); this.ring(x, y, 60, '#ffffff', 0.9); this.burst(x, y, 40, PAL.puff, { speed: 90, up: 10, grav: -8, life: 1.2, size: 2, spread: 80 }); au.play('land'); g.onLandRise(a, b); break; }
      case 'cast': { this.bobbers.set(a, { x, y, t: 0, bite: false }); this.burst(x, y, 6, PAL.water, { speed: 24, up: 18, life: 0.5 }); au.play('splash', { vol: 0.7 }); break; }
      case 'bite': { const b0 = this.bobbers.get(a); if (b0) b0.bite = true; au.play('bite'); this.burst(x, y, 6, PAL.water, { speed: 26, up: 22, life: 0.5 }); break; }
      case 'fishend': { for (const [k, v] of this.bobbers) if (Math.hypot(v.x - x, v.y - y) < 4) this.bobbers.delete(k); break; }
      case 'catch': { this.burst(x, y, 10, PAL.water, { speed: 40, up: 40, life: 0.7 }); this.pop(x, y - 8, ITEMS[a] ? ITEMS[a].name : 'Fish!', '#ffe066', { icon: a, big: true, life: 1.4 }); au.play('catch'); for (const [k, v] of this.bobbers) if (Math.hypot(v.x - x, v.y - y) < 4) this.bobbers.delete(k); break; }
      case 'harvest': { this.burst(x, y, 8, PAL.leaf, { speed: 30, up: 24, life: 0.6 }); au.play('harvest'); break; }
      case 'plant': { this.burst(x, y, 5, PAL.dust, { speed: 20, up: 14, life: 0.5 }); au.play('plant'); break; }
      case 'eat': { this.burst(x, y, 5, PAL.heart, { speed: 16, up: 20, grav: -10, life: 0.7, size: 2 }); au.play('eat'); break; }
      case 'equip': { this.burst(x, y, 6, PAL.spark, { speed: 24, up: 12, life: 0.5 }); au.play('equip'); break; }
      case 'faint': { this.burst(x, y, 12, PAL.star, { speed: 50, up: 30, life: 1.0 }); au.play('faint'); break; }
      case 'hurt': { g.onHurt(a); au.play('hurt'); break; }
      case 'shock': { this.ring(x, y, a, '#ffb347', 0.5); this.shake = Math.max(this.shake, 3); au.play('boom'); break; }
      case 'bosswarn': { this.pop(x, y, '!', '#ff6b7a', { big: true, life: 0.9, vy: -8 }); au.play('warn'); break; }
      case 'bossspawn': { this.shake = Math.max(this.shake, 5); this.ring(x, y, 70, '#ff6b7a', 1.0); this.burst(x, y, 30, PAL.ember, { speed: 90, up: 30, life: 1.2, spread: 20 }); au.play('bossspawn'); break; }
      case 'bossdead': { this.shake = Math.max(this.shake, 6); this.ring(x, y, 80, '#ffe066', 1.2); this.burst(x, y, 50, PAL.star, { speed: 110, up: 50, life: 1.5, spread: 24 }); au.play('victory'); break; }
      case 'turret': { this.burst(x, y, 3, PAL.spark, { speed: 22, up: 6, life: 0.2 }); au.play('shoot', { vol: 0.35 }); break; }
      case 'piano': { const notes = [0, 2, 4, 5, 7, 9, 11]; au.note(60 + notes[a % 7] + 12 * (a > 3 ? 0 : 0), 0.6); this.burst(x, y - 12, 1, PAL.void, { speed: 8, up: 24, grav: -20, life: 1.0, size: 2 }); break; }
      case 'dig': { this.burst(x, y, 14, PAL.dust, { speed: 50, up: 40, life: 0.7 }); au.play('dig'); break; }
      case 'chestopen': { this.burst(x, y - 4, 20, PAL.gold, { speed: 60, up: 50, life: 0.9 }); au.play('chest'); break; }
      case 'zzz': { this.emotes.set(a, { e: 6, t: 0, long: true }); break; }
      case 'ping': { this.pings.push({ x, y, t: 0 }); au.play('ping'); break; }
      case 'secondwind': { this.ring(x, y, 24, '#7fe08a', 0.8); this.burst(x, y, 16, PAL.heart, { speed: 50, up: 30, life: 1 }); au.play('levelup'); break; }
    }
  }
  recentPickups() { const t = performance.now(); this._pk = (this._pk || []).filter((v) => t - v < 700); this._pk.push(t); return this._pk.length; }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy += p.g * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 1 - 2.2 * dt;
      if (p.t > p.life) this.pops.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t += dt; if (this.rings[i].t > this.rings[i].life) this.rings.splice(i, 1); }
    for (const [k, v] of this.shakes) { const n = v - dt; if (n <= 0) this.shakes.delete(k); else this.shakes.set(k, n); }
    for (const [k, v] of this.emotes) { v.t += dt; if (v.t > (v.long ? 2.5 : 2.2)) this.emotes.delete(k); }
    for (const b of this.bobbers.values()) b.t += dt;
    for (let i = this.pings.length - 1; i >= 0; i--) { this.pings[i].t += dt; if (this.pings[i].t > 2) this.pings.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 8);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  textSprite(str, color, outline = '#2a1f3d') {
    const key = str + '|' + color + '|' + outline;
    let c = this.text.get(key);
    if (c) return c;
    c = this.g.makeText(str, color, outline);
    if (this.text.size > 400) this.text.clear();
    this.text.set(key, c);
    return c;
  }

  /** draw world-space particles; ox/oy = -camera */
  drawParticles(ctx, ox, oy) {
    for (const p of this.parts) {
      const a = p.fade ? Math.min(1, p.life / (p.max * 0.5)) : 1;
      if (a < 1) ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillRect((p.x + ox) | 0, (p.y + oy) | 0, p.size, p.size);
      if (a < 1) ctx.globalAlpha = 1;
    }
    for (const r of this.rings) {
      const t = r.t / r.life, rad = r.r * (0.2 + 0.8 * Math.sin(t * Math.PI / 2));
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = r.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc((r.x + ox) | 0, (r.y + oy) | 0, rad, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  drawPopups(ctx, ox, oy, sprites, labels = null) {
    for (const p of this.pops) {
      const t = p.t / p.life;
      const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      if (labels) { // smooth look: the text is drawn crisp by the label layer, the little item icon stays in the picture
        const k = p.big ? 1.15 : 1, tw = labels.measure(p.text, k), cx = Math.round(p.x + ox), y = Math.round(p.y + oy);
        if (p.icon) { const s = sprites.get('i_' + p.icon); if (s) { ctx.globalAlpha = a; sprites.drawS(ctx, s, Math.round(cx - tw / 2 - 15), y - 6); ctx.globalAlpha = 1; } }
        labels.add(p.text, p.color, cx + (p.icon ? 1 : 0), y + 3.5, { a, k });
        continue;
      }
      const spr = this.textSprite(p.text, p.color);
      let x = Math.round(p.x + ox - spr.width / 2), y = Math.round(p.y + oy);
      if (p.icon) { const s = sprites.get('i_' + p.icon); if (s) { x -= 5; ctx.globalAlpha = a; sprites.drawS(ctx, s, x - 14 + 6, y - 6); } }
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x + (p.icon ? 6 : 0), y);
      ctx.globalAlpha = 1;
    }
  }
}
