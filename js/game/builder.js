// Build mode controller (client side): ghost, drag-painting, rectangle tool, remove mode.
import { TILE, clamp } from '../util.js';
import { BUILD } from '../data/build.js';
import { ITEMS } from '../data/items.js';
import { wallDefOf } from '../sim/world.js';
import { placeCheck, sourcesFor, canAffordAll, buildMult, countAll } from '../sim/commands.js';
import { calcStats } from '../sim/player.js';
import { h, ic, itemIc, spriteCanvas } from '../ui/dom.js';

export class Builder {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.def = null;
    this.flip = false;
    this.remove = false;
    this.rect = false;
    this.tx = 0; this.ty = 0;
    this.ok = false;
    this.reason = '';
    this.tiles = null;
    this.drag = null; // {tx,ty} start of rectangle
    this.painted = new Set();
    this.range = 0;
    this.lastKey = '';
    this.okCache = new Map();
    this.sendQ = [];
  }

  start(id) {
    const def = BUILD[id];
    if (!def) return;
    this.def = def; this.active = true; this.remove = false; this.flip = false; this.drag = null; this.painted.clear();
    this.rect = this.rect && (def.kind === 'wall' || def.kind === 'floor');
    this.g.ui.closeAll();
    this.syncBar();
  }
  stop() { this.active = false; this.def = null; this.remove = false; this.drag = null; this.tiles = null; this.g.hud.setBuildBar(null); }
  toggleRemove() { this.remove = !this.remove; this.drag = null; this.syncBar(); if (this.remove && !this.def) this.active = true; }
  startRemove() { this.active = true; this.remove = true; this.def = null; this.drag = null; this.g.ui.closeAll(); this.syncBar(); }
  toggleRect() { if (this.def && (this.def.kind === 'wall' || this.def.kind === 'floor' || this.remove)) { this.rect = !this.rect; this.drag = null; this.syncBar(); } }
  rotate() { if (this.def && (this.def.kind === 'thing' || this.def.kind === 'flat')) { this.flip = !this.flip; this.syncBar(); this.g.audio.play('click'); } }

  anchor(wx, wy) {
    const d = this.def, w = (d && (d.kind === 'thing' || d.kind === 'flat') ? d.w : 1) || 1, hh = (d && (d.kind === 'thing' || d.kind === 'flat') ? d.h : 1) || 1;
    return [Math.round(wx / TILE - w / 2), Math.round(wy / TILE - hh / 2)];
  }

  checkAt(tx, ty) {
    const g = this.g, p = g.me, w = g.world, d = this.def;
    if (this.remove) {
      const t = w.thingAt(tx, ty) || w.flatAt(tx, ty);
      const placed = t && BUILD[t.type] && !BUILD[t.type].hidden;
      const i = w.idx(tx, ty);
      return !!(placed || w.wall[i] || w.floor[i] || w.deco[i]) && w.isTileOwned(tx, ty) && this.inRange(tx, ty, 1, 1);
    }
    if (!d) return false;
    const reason = placeCheck({ world: w }, p, d, tx, ty);
    if (reason) { this.reason = reason; return false; }
    if (!this.inRange(tx, ty, d.w || 1, d.h || 1)) { this.reason = 'Too far away'; return false; }
    return true;
  }
  inRange(tx, ty, tw, th) {
    const p = this.g.me; if (!p) return false;
    const st = calcStats(this.g.world, p);
    return Math.hypot(p.x - (tx + tw / 2) * TILE, p.y - (ty + th / 2) * TILE) <= (st.buildReach + 1) * TILE;
  }
  affordable() {
    const g = this.g, p = g.me, d = this.def;
    if (!d) return true;
    const mult = buildMult({ world: g.world }, p, d);
    if (mult === 0) return true;
    return canAffordAll(sourcesFor({ world: g.world }, p), d.cost, mult);
  }

  /** compute the rectangle tile list between a and b for the current def/mode */
  rectTiles(a, b) {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const out = [];
    const outline = !this.remove && this.def && this.def.kind === 'wall';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (outline && !(x === x0 || x === x1 || y === y0 || y === y1)) continue;
      out.push([x, y]);
    }
    return out;
  }

  /** called every frame with pointer info {wx, wy, down, pressed, released, valid} */
  update(dt, ptr) {
    if (!this.active || !ptr || !ptr.valid) { this.tiles = null; return; }
    const g = this.g;
    const [tx, ty] = this.anchor(ptr.wx, ptr.wy);
    this.tx = tx; this.ty = ty;
    const multi = this.def && (this.def.kind === 'thing' || this.def.kind === 'flat');
    const okHere = this.checkAt(tx, ty);
    this.ok = okHere && (this.remove || this.affordable());
    if (okHere && !this.remove && !this.affordable()) this.reason = 'Need materials';

    if (this.rect && !multi) {
      if (ptr.pressed) { this.drag = [tx, ty]; }
      if (this.drag) {
        const list = this.rectTiles(this.drag, [tx, ty]);
        this.tiles = list;
        if (ptr.released) { this.commitTiles(list); this.drag = null; this.tiles = null; }
      } else this.tiles = [[tx, ty]];
      this.okAt = (x, y) => this.checkAt(x, y);
      return;
    }
    this.tiles = multi ? null : [[tx, ty]];
    this.okAt = (x, y) => (this.remove || !this.def ? this.checkAt(x, y) : this.checkAt(x, y) && this.affordable());
    if (ptr.pressed) { this.painted.clear(); }
    if (ptr.down) {
      const key = tx + ',' + ty;
      if (multi) { if (ptr.pressed) this.commitTiles([[tx, ty]]); }
      else if (!this.painted.has(key)) { this.painted.add(key); this.commitTiles([[tx, ty]]); }
    } else if (ptr.released) this.painted.clear();
  }

  commitTiles(list) {
    const g = this.g;
    const tiles = list.filter((t) => g.world.inb(t[0], t[1]));
    if (!tiles.length) return;
    if (this.remove) {
      g.cmd(tiles.length === 1 ? { c: 'unbuild', tx: tiles[0][0], ty: tiles[0][1] } : { c: 'unbuildMany', tiles });
      return;
    }
    if (!this.def) return;
    if (tiles.length === 1) g.cmd({ c: 'build', bid: this.def.id, tx: tiles[0][0], ty: tiles[0][1], flip: this.flip });
    else g.cmd({ c: 'buildMany', bid: this.def.id, tiles, flip: this.flip });
  }

  syncBar() {
    const g = this.g;
    if (!this.active) return g.hud.setBuildBar(null);
    const d = this.def;
    const wrap = h('div', { class: 'row', style: 'flex-wrap:wrap;justify-content:center' });
    const info = h('div', { class: 'panel', style: 'padding:4px 10px' });
    if (this.remove) info.append(ic('ui_trash', 2), h('b', null, ' Remove mode'), h('span', { class: 'small muted' }, ' tap or drag over pieces'));
    else if (d) {
      const thumb = spriteName(d);
      info.append(spriteCanvas(thumb, 40, 40), h('b', { style: 'margin:0 6px' }, d.name));
      const mult = buildMult({ world: g.world }, g.me, d);
      const cost = h('span', { class: 'cost', style: 'justify-content:flex-start' });
      if (mult === 0) cost.append(h('span', { class: 'chip ok' }, 'Free!'));
      else { const src = sourcesFor({ world: g.world }, g.me); for (const k in d.cost) { const need = Math.ceil(d.cost[k] * mult - 1e-9), have = countAll(src, k); cost.append(h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, itemIc(k, 1), `${have >= 99 ? '99+' : have}/${need}`)); } }
      info.append(cost);
    }
    const btns = h('div', { class: 'panel row', style: 'padding:4px 6px' });
    const b = (icon, label, fn, on) => h('button', { class: 'btn small' + (on ? ' good' : ''), onclick: () => { g.audio.play('click'); fn(); } }, ic(icon, 1), label);
    if (d && (d.kind === 'thing' || d.kind === 'flat')) btns.append(b('ui_arrow', 'Flip', () => this.rotate(), false));
    if ((d && (d.kind === 'wall' || d.kind === 'floor')) || this.remove) btns.append(b('ui_sort', 'Rect', () => this.toggleRect(), this.rect));
    btns.append(b('ui_house', 'Pieces', () => g.ui.open('build'), false), b('ui_trash', 'Remove', () => this.toggleRemove(), this.remove), b('ui_check', 'Done', () => this.stop(), false));
    wrap.append(info, btns);
    g.hud.setBuildBar(wrap);
  }
}

export function spriteName(d) {
  if (d.kind === 'wall') return 'wp_' + (d.piece === 'fence' || d.piece === 'gate' ? `${d.piece}_${d.mat}` : `${d.mat}_${d.piece}`);
  if (d.kind === 'floor') return 'f_' + d.id.replace(/^floor_/, '');
  if (d.kind === 'walldeco') return 'd_' + d.id;
  return 't_' + d.id;
}
