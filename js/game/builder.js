// Build mode controller (client side): ghost, drag-painting, rectangle tool, remove mode.
import { TILE, clamp } from '../util.js';
import { BUILD } from '../data/build.js';
import { ITEMS } from '../data/items.js';
import { wallDefOf } from '../sim/world.js';
import { placeCheck, sourcesFor, canAffordAll, buildMult, countAll, clearableNode, paintTarget, colorAt } from '../sim/commands.js';
import { calcStats } from '../sim/player.js';
import { turnable, normRot, footprintFor } from '../data/facing.js';
import { h, ic, itemIc, spriteCanvas } from '../ui/dom.js';
import { normColor, colorHex } from '../data/paint.js';
import { createColorPicker } from '../ui/colorpicker.js';
import { lsGet, lsSet } from '../engine/storage.js';

/** every tile on the straight line from a to b, both ends included (so a fast stroke across the screen cannot skip tiles between two frames) */
export function lineTiles(a, b) {
  const out = [];
  let [x, y] = a;
  const dx = Math.abs(b[0] - x), dy = -Math.abs(b[1] - y), sx = x < b[0] ? 1 : -1, sy = y < b[1] ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    out.push([x, y]);
    if (x === b[0] && y === b[1]) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

export class Builder {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.def = null;
    this.flip = false;
    this.rot = 0; // which way a turnable piece faces (0 down, 1 right, 2 up, 3 left)
    this.remove = false;
    this.paint = false; // the brush: recolor what is already built
    this.pick = false; // the dropper: the next tap copies a piece's color
    this.col = normColor((lsGet('snug.paint', {}) || {}).col); // the paint color pieces are built in (0 = as drawn); remembered on this device
    this.colorOpen = false;
    this.picker = null;
    this.rect = false;
    this.tx = 0; this.ty = 0;
    this.ok = false;
    this.reason = '';
    this.tiles = null;
    this.drag = null; // {tx,ty} start of rectangle
    this.painted = new Set();
    this.stroke = null; // the last tile of the stroke being dragged
    this.range = 0;
    this.lastKey = '';
    this.okCache = new Map();
    this.sendQ = [];
  }

  start(id) {
    const def = BUILD[id];
    if (!def) return;
    if (!this.def || this.def.id !== id) this.rot = 0;
    this.def = def; this.active = true; this.remove = false; this.paint = false; this.pick = false; this.flip = false; this.drag = null; this.painted.clear();
    this.rect = this.rect && (def.kind === 'wall' || def.kind === 'floor');
    this.g.ui.closeAll();
    this.syncBar();
  }
  stop() { this.active = false; this.def = null; this.remove = false; this.paint = false; this.pick = false; this.colorOpen = false; this.drag = null; this.tiles = null; this.g.hud.setBuildBar(null); this.g.hud.setBuildSide(null); }
  toggleRemove() { this.remove = !this.remove; this.paint = false; this.pick = false; this.drag = null; this.syncBar(); if (this.remove && !this.def) this.active = true; }
  startRemove() { this.active = true; this.remove = true; this.paint = false; this.pick = false; this.def = null; this.drag = null; this.g.ui.closeAll(); this.syncBar(); }
  /** the brush: tap or drag over pieces that are already built to give them the chosen color (free) */
  togglePaint() { this.paint = !this.paint; this.remove = false; this.pick = false; this.drag = null; this.painted.clear(); if (this.paint) { this.active = true; this.colorOpen = true; } this.syncBar(); }
  startPaint() { this.active = true; this.paint = true; this.remove = false; this.pick = false; this.def = null; this.drag = null; this.painted.clear(); this.colorOpen = true; this.g.ui.closeAll(); this.syncBar(); }
  toggleRect() { if (this.def && (this.def.kind === 'wall' || this.def.kind === 'floor') || this.remove || this.paint) { this.rect = !this.rect; this.drag = null; this.syncBar(); } }
  /** choose the paint color (0 = as drawn). final = the person let go of a slider / tapped a swatch (so it is worth remembering) */
  setColor(col, final = true) {
    this.col = normColor(col);
    if (final) lsSet('snug.paint', { col: this.col });
    const sw = this.g.hud.buildBar && this.g.hud.buildBar.querySelector('.cp-chip');
    if (sw) { sw.style.background = this.col ? colorHex(this.col) : ''; sw.classList.toggle('none', !this.col); }
  }
  /** the dropper: the next tap on a built piece copies its color */
  startPick() { this.pick = !this.pick; this.drag = null; this.syncBar(); if (this.pick) this.g.toast('Tap a piece to copy its color.', 'info'); }
  toggleColor() { this.colorOpen = !this.colorOpen; this.syncBar(); }
  /** turn the piece a quarter (dir = 1 clockwise, -1 back); pieces that cannot turn are mirrored instead */
  rotate(dir = 1) {
    const d = this.def;
    if (!d || this.remove || this.paint || this.pick) return;
    this.rot = normRot(this.rot + dir); // everything turns: furniture, stations, windows, doors, floors, decorations...
    this.syncBar(); this.g.audio.play('click');
  }
  /** footprint [w, h] of the current piece as turned */
  footprint() { const d = this.def; return d && (d.kind === 'thing' || d.kind === 'flat') ? footprintFor(d, this.rot) : [1, 1]; }
  /** touch: put the piece down where the ghost is now */
  placeHere() {
    if (!this.active || !this.def || this.remove) return;
    if (this.ok) this.commitTiles([[this.tx, this.ty]]);
    else this.g.toast(this.reason || 'It does not fit there.', 'warn');
  }

  anchor(wx, wy) {
    const [w, hh] = this.footprint();
    return [Math.round(wx / TILE - w / 2), Math.round(wy / TILE - hh / 2)];
  }

  checkAt(tx, ty) {
    const g = this.g, p = g.me, w = g.world, d = this.def;
    if (this.remove) {
      const t = w.thingAt(tx, ty) || w.flatAt(tx, ty);
      const placed = t && ((BUILD[t.type] && !BUILD[t.type].hidden) || clearableNode(t));
      const i = w.idx(tx, ty);
      return !!(placed || w.wall[i] || w.floor[i] || w.deco[i]) && w.isTileOwned(tx, ty) && this.inRange(tx, ty, 1, 1);
    }
    if (this.paint) {
      const tg = paintTarget(w, tx, ty, this.col);
      return !!tg && tg.has !== this.col && w.isTileOwned(tx, ty) && this.inRange(tx, ty, 1, 1);
    }
    if (!d) return false;
    const reason = placeCheck({ world: w }, p, d, tx, ty, this.rot);
    if (reason) { this.reason = reason; return false; }
    const [fw, fh] = this.footprint();
    if (!this.inRange(tx, ty, fw, fh)) { this.reason = 'Too far away'; return false; }
    this.reason = '';
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
    const outline = !this.remove && !this.paint && this.def && this.def.kind === 'wall';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (outline && !(x === x0 || x === x1 || y === y0 || y === y1)) continue;
      out.push([x, y]);
    }
    return out;
  }

  /** called every frame with pointer info {wx, wy, down, pressed, released, valid} */
  update(dt, ptr0) {
    if (!this.active) { this.tiles = null; return; }
    const g = this.g;
    if (this.pick) {
      // the dropper follows the pointer only (no resting ghost): a tap on a built piece copies its color
      this.tiles = null; this.okAt = null;
      if (!ptr0 || !ptr0.valid) return;
      this.tx = Math.floor(ptr0.wx / TILE); this.ty = Math.floor(ptr0.wy / TILE);
      if (ptr0.pressed || (ptr0.touch && ptr0.released)) {
        const hit = colorAt(g.world, this.tx, this.ty);
        if (hit) {
          this.pick = false; this.setColor(hit.col, true);
          g.toast(hit.col ? `Copied the color of ${hit.name}.` : `${hit.name} is not painted, so the color is Original.`, 'good');
          g.audio.play('click'); this.syncBar();
        } else g.toast('Nothing built there.', 'info');
      }
      return;
    }
    let ptr = ptr0;
    if (!ptr || !ptr.valid || (ptr.touch && !ptr.down && !ptr.pressed && !ptr.released)) {
      // no pointer to follow: a tablet before the first touch, or between touches. The ghost rests in front of the player (the Place button puts it there)
      const me = g.me, st = g.pstate(me.pid), a = [[0, 1], [0, -1], [st.flip ? -1 : 1, 0]][st.dir];
      ptr = { wx: me.x + a[0] * TILE * 1.8, wy: me.y - 6 + a[1] * TILE * 1.8, down: false, pressed: false, released: false, valid: true, touch: true };
    }
    const [tx, ty] = this.anchor(ptr.wx, ptr.wy);
    this.tx = tx; this.ty = ty;
    this.range = g.me ? (calcStats(g.world, g.me).buildReach + 1) * TILE : 0;
    const multi = this.def && (this.def.kind === 'thing' || this.def.kind === 'flat');
    const okHere = this.checkAt(tx, ty);
    this.ok = okHere && (this.remove || this.paint || this.affordable());
    if (okHere && !this.remove && !this.paint && !this.affordable()) this.reason = 'Need materials';

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
    this.okAt = (x, y) => (this.remove || this.paint || !this.def ? this.checkAt(x, y) : this.checkAt(x, y) && this.affordable());
    if (ptr.pressed) { this.painted.clear(); this.stroke = null; }
    const touch = ptr.touch, hot = ptr.down || ptr.pressed; // a tap shorter than one frame still counts
    if (hot) {
      // furniture: mouse places on press; a finger can slide the ghost around and places on lift
      if (multi) { if (!touch && ptr.pressed) this.commitTiles([[tx, ty]]); }
      else {
        // a stroke: every tile the pointer crossed since the last frame (a fast sweep would otherwise jump over some)
        const fresh = [];
        for (const t of this.stroke ? lineTiles(this.stroke, [tx, ty]) : [[tx, ty]]) { const k = t[0] + ',' + t[1]; if (!this.painted.has(k)) { this.painted.add(k); fresh.push(t); } }
        this.stroke = [tx, ty];
        if (fresh.length) this.commitTiles(fresh);
      }
    }
    if (multi && touch && ptr.released) this.commitTiles([[tx, ty]]);
    if (!hot && ptr.released) { this.painted.clear(); this.stroke = null; }
  }

  commitTiles(list) {
    const g = this.g;
    const tiles = list.filter((t) => g.world.inb(t[0], t[1]));
    if (!tiles.length) return;
    if (this.paint) {
      g.cmd(tiles.length === 1 ? { c: 'paint', tx: tiles[0][0], ty: tiles[0][1], col: this.col } : { c: 'paint', tiles, col: this.col });
      return;
    }
    if (this.remove) {
      g.cmd(tiles.length === 1 ? { c: 'unbuild', tx: tiles[0][0], ty: tiles[0][1] } : { c: 'unbuildMany', tiles });
      return;
    }
    if (!this.def) return;
    if (tiles.length === 1) g.cmd({ c: 'build', bid: this.def.id, tx: tiles[0][0], ty: tiles[0][1], flip: this.flip, rot: this.rot, col: this.col });
    else g.cmd({ c: 'buildMany', bid: this.def.id, tiles, flip: this.flip, rot: this.rot, col: this.col });
  }

  syncBar() {
    const g = this.g;
    if (!this.active) { g.hud.setBuildSide(null); return g.hud.setBuildBar(null); }
    const d = this.def;
    const wrap = h('div', { class: 'row', style: 'flex-wrap:wrap;justify-content:center' });
    const info = h('div', { class: 'panel', style: 'padding:4px 10px' });
    if (this.remove) info.append(ic('ui_trash', 2), h('b', null, ' Remove mode'), h('span', { class: 'small muted' }, ' tap or drag over pieces, berry bushes, opened chests and stumps'));
    else if (this.pick) info.append(ic('ui_dropper', 2), h('b', null, ' Pick a color'), h('span', { class: 'small muted' }, ' tap a piece to copy its color'));
    else if (this.paint) info.append(ic('ui_palette', 2), h('b', null, ' Paint mode'), h('span', { class: 'small muted' }, ' tap or drag over pieces to color them (Original takes the paint off)'));
    else if (d) {
      const thumb = spriteName(d);
      info.append(spriteCanvas(thumb, 40, 40), h('b', { style: 'margin:0 6px' }, d.name));
      const mult = buildMult({ world: g.world }, g.me, d);
      const cost = h('span', { class: 'cost', style: 'justify-content:flex-start' });
      if (mult === 0) cost.append(h('span', { class: 'chip ok' }, 'Free!'));
      else { const src = sourcesFor({ world: g.world }, g.me); for (const k in d.cost) { const need = Math.ceil(d.cost[k] * mult - 1e-9), have = countAll(src, k); cost.append(h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, itemIc(k, 1), `${have}/${need}`)); } }
      info.append(cost);
    }
    const btns = h('div', { class: 'panel row', style: 'padding:4px 6px;flex-wrap:wrap;justify-content:center' });
    const b = (icon, label, fn, on) => h('button', { class: 'btn small' + (on ? ' good' : ''), onclick: () => { g.audio.play('click'); fn(); } }, ic(icon, 1), label);
    if (d && !this.remove && !this.paint && !this.pick) btns.append(b('ui_arrow', 'Rotate', () => this.rotate(1), false));
    if (d && (d.kind === 'thing' || d.kind === 'flat') && navigator.maxTouchPoints > 0 && !this.remove && !this.paint && !this.pick) btns.append(b('ui_check', 'Place', () => this.placeHere(), true));
    if ((d && (d.kind === 'wall' || d.kind === 'floor')) || this.remove || this.paint) btns.append(b('ui_sort', 'Rect', () => this.toggleRect(), this.rect));
    if (!this.remove) {
      // the color pieces are built in (and painted with): a swatch of it on the button, the picker opens above the bar
      const chip = h('span', { class: 'cp-chip' + (this.col ? '' : ' none'), style: this.col ? `background:${colorHex(this.col)}` : '' });
      btns.append(h('button', { class: 'btn small' + (this.colorOpen ? ' good' : ''), title: 'Choose any color', onclick: () => { g.audio.play('click'); this.toggleColor(); } }, chip, 'Color'));
    }
    btns.append(b('ui_palette', 'Paint', () => this.togglePaint(), this.paint), b('ui_house', 'Pieces', () => g.ui.open('build'), false), b('ui_trash', 'Remove', () => this.toggleRemove(), this.remove), b('ui_check', 'Done', () => this.stop(), false));
    if (this.colorOpen && !this.remove) {
      if (!this.picker) this.picker = createColorPicker({ get: () => this.col, set: (c, f) => this.setColor(c, f), pick: () => this.startPick(), picking: () => this.pick, changed: () => g.hud.layoutBuildSide() });
      this.picker.sync();
      if (this.picker.el.parentNode !== g.hud.buildSide) g.hud.setBuildSide(this.picker.el); // already there: keep it (a slider may be mid-drag)
    } else g.hud.setBuildSide(null);
    wrap.append(info, btns);
    g.hud.setBuildBar(wrap);
    g.hud.layoutBuildSide(); // the bar's size changed
  }
}

export function spriteName(d) {
  if (d.kind === 'wall') return 'wp_' + (d.piece === 'fence' || d.piece === 'gate' ? `${d.piece}_${d.mat}` : `${d.mat}_${d.piece}`);
  if (d.kind === 'floor') return 'f_' + d.id.replace(/^floor_/, '');
  if (d.kind === 'walldeco') return 'd_' + d.id;
  return 't_' + d.id;
}
