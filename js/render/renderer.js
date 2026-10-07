// World renderer. Draws into the low-res art-pixel canvas; everything is integer-positioned for crisp pixel art.
import { TILE, hash32, hashf, clamp, TAU } from '../util.js';
import { composeLand, NB, GROUND_VARIANTS, DECOS } from '../gfx/art/terrain.js';
import { wallSprite, fenceSprite } from '../gfx/art/walls.js';
import { playerFrame, playerSleep, playerSleepHead, lookKey } from '../gfx/art/player.js';
import { GROUND_IDS } from '../data/biomes.js';
import { BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { MOBS } from '../data/mobs.js';
import { ITEMS } from '../data/items.js';
import { CROPS } from '../data/crops.js';
import { wallDefOf, floorDefOf, decoDefOf, thingDef } from '../sim/world.js';
import { nightness, phaseOf, ambientColor } from '../sim/daynight.js';
import { turnable, turnSprite, footprintFor } from '../data/facing.js';
import { tintPixmap } from '../gfx/tint.js';
import { turnOpening } from '../gfx/art/autoturn.js';
import { colorHex } from '../data/paint.js';
import { paintTarget } from '../sim/commands.js';
import { furnitureUnder, nearestSlot, pillowAt } from '../sim/furniture.js';

const SKY_DEEP = '#3388dc';
const ANIM_RATE = { lighthouse: 2, little_lighthouse: 2, grand_lighthouse: 2, campfire: 6, torch: 7, brazier: 6, candelabra: 6, lava_lamp: 2, star_lantern: 2, warp_pad: 4, fountain: 5, fireplace: 6, cauldron: 3, crystal_ball: 2, mushroom_lamp: 2, star_orb: 2, portal_ring: 3, fairy_ring: 2, forge: 5, arcane_altar: 2, prism_workshop: 2, star_forge: 2, alchemy_table: 3, world_heart: 2, windmill: 4 };
const MULTI = ['bed', 'seat'];
const SEAT_LIP = 6; // rows of a seat's picture (from the bottom) drawn over whoever sits in it
const SIT_DY = [0, -6, 0]; // how far (px) a seated person is moved down for the front, back and side views

export class Renderer {
  constructor(canvas, sprites, book) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = sprites;
    this.book = book;
    this.world = null;
    this.textLayer = null; // smooth look: in-world text is drawn by js/render/labels.js
    this.labels = null; // = textLayer while it is in use this frame
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.lightSprites = new Map();
    this.list = [];
    this.pool = [];
    this.nPool = 0;
    this.animated = new Set();
    this.variants = new Map();
    for (const n of book.names()) {
      if (n.endsWith('_a0') && n.startsWith('t_')) this.animated.add(n.slice(0, -3));
      const m = /^(t_.+)_v(\d)$/.exec(n);
      if (m) this.variants.set(m[1], Math.max(this.variants.get(m[1]) || 1, +m[2] + 1));
    }
    this.water = [[], []];
    for (let tone = 0; tone < 2; tone++) for (let v = 0; v < 3; v++) { this.water[tone][v] = []; for (let f = 0; f < 4; f++) this.water[tone][v][f] = sprites.get(`water_${tone ? 'deep' : 'shallow'}_${v}_${f}`); }
    this.foam = {}; for (const s of ['e', 's', 'w']) this.foam[s] = [sprites.get(`foam_${s}_0`), sprites.get(`foam_${s}_1`)];
    this.fxShadow = sprites.get('fx_shadow');
  }

  setWorld(world) {
    this.world = world;
    const n = world.W * world.H;
    this.land = new Array(n); this.deco = new Array(n); this.wmeta = new Int32Array(n).fill(-1); this.cliff = new Array(n); this.wallRec = new Array(n); this.wallOpen = new Uint8Array(n);
    this.shallow = new Uint8Array(n); this.shallowRev = -1;
    this.allDirty = true;
  }

  // ------------------------------------------------------------------ tile cache
  _processDirty() {
    const w = this.world;
    if (this.shallowRev !== w.landRev) this._computeShallow();
    if (w.tileDirty.length) {
      for (const i of w.tileDirty) { this.land[i] = undefined; this.wmeta[i] = -1; this.cliff[i] = undefined; this.wallRec[i] = undefined; this.deco[i] = undefined; }
      w.tileDirty.length = 0;
    }
  }
  _computeShallow() {
    const w = this.world, W = w.W, H = w.H;
    this.shallow.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!w.ground[y * W + x]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) this.shallow[yy * W + xx] = 1; }
    }
    this.shallowRev = w.landRev;
    for (let i = 0; i < W * H; i++) { this.wmeta[i] = -1; }
  }
  _landSprite(i, x, y) {
    const w = this.world, W = w.W;
    const g = w.ground[i], kind = GROUND_IDS[g];
    const wat = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= W || yy >= w.H || w.ground[yy * W + xx] === 0; };
    let mask = 0;
    if (wat(0, -1)) mask |= NB.N; if (wat(1, 0)) mask |= NB.E; if (wat(0, 1)) mask |= NB.S; if (wat(-1, 0)) mask |= NB.W;
    if (wat(1, -1)) mask |= NB.NE; if (wat(1, 1)) mask |= NB.SE; if (wat(-1, 1)) mask |= NB.SW; if (wat(-1, -1)) mask |= NB.NW;
    const v = hash32(x, y, 3) % GROUND_VARIANTS;
    const ng = [0, 0, 0, 0];
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let k = 0; k < 4; k++) { const xx = x + dirs[k][0], yy = y + dirs[k][1]; if (xx >= 0 && yy >= 0 && xx < W && yy < w.H) { const og = w.ground[yy * W + xx]; if (og && og !== g) ng[k] = og; } }
    const key = `L${g}.${v}.${mask}.${ng.join('')}`;
    return this.sprites.dyn(key, () => {
      const nb = {};
      ['n', 'e', 's', 'w'].forEach((s, k) => { if (ng[k]) { const xx = x + dirs[k][0], yy = y + dirs[k][1]; nb[s] = this.book.get(`g_${GROUND_IDS[ng[k]]}_${hash32(xx, yy, 3) % GROUND_VARIANTS}`); } else nb[s] = null; });
      return composeLand(this.book.get(`g_${kind}_${v}`), kind, mask, ng.some(Boolean) ? nb : null);
    });
  }
  /** the picture of a wall piece (a wall, window, door, fence or gate) built with this look of its neighbours, turned: only the opening turns, the wall around it stays joined */
  _wallPiece(code, d, mask, open, rot, key0) {
    const fenceLike = d.piece === 'fence' || d.piece === 'gate', key = key0 + (rot ? '|r' + rot : '');
    return [key, this.sprites.dyn(key, () => {
      const piece = fenceLike ? fenceSprite(d.mat, d.piece === 'gate', mask, open) : wallSprite(d.mat, d.piece, mask, open);
      if (!rot) return piece;
      return turnOpening(fenceLike ? fenceSprite(d.mat, false, mask, 0) : wallSprite(d.mat, 'wall', mask, 0), piece, rot);
    })];
  }
  /** a floor or a wall decoration turned (floors turn like a picture, decorations mirror) and/or painted: made once, then reused */
  _tileVariant(nm, kind, rot, col) {
    const sp = this.sprites, base = sp.get(nm);
    if (!base) return null;
    let key = nm, rec = base;
    if (rot) {
      key = nm + '|r' + rot;
      rec = sp.dyn(key, () => {
        const pm = sp.pixmapOf(base);
        if (kind !== 'floor') return rot & 1 ? pm.flipX() : pm.clone();
        let out = pm; for (let k = 0; k < rot; k++) out = out.rot90();
        return out;
      });
    }
    return col ? this._painted(key, rec, col) : rec;
  }
  _wallSprite(i, x, y, colOver, rotOver) { // colOver / rotOver: show it in another color or turn (the brush and build previews)
    const w = this.world, W = w.W;
    const code = w.wall[i], d = wallDefOf(code);
    const fenceLike = (p) => p === 'fence' || p === 'gate';
    const same = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= W || yy >= w.H) return false; const c = w.wall[yy * W + xx]; if (!c) return false; return fenceLike(wallDefOf(c).piece) === fenceLike(d.piece); };
    const open = w.wallState[i] ? 1 : 0;
    const col = colOver === undefined ? w.wallCol[i] : colOver, rot = rotOver === undefined ? w.wallRot[i] : rotOver;
    if (fenceLike(d.piece)) {
      const mask = (same(x + 1, y) ? 2 : 0) | (same(x - 1, y) ? 4 : 0);
      const [key, rec] = this._wallPiece(code, d, mask, open, rot, `F|${code}|${mask}|${open}`);
      return col ? this._painted(key, rec, col) : rec;
    }
    const mask = (same(x, y - 1) ? 1 : 0) | (same(x + 1, y) ? 2 : 0) | (same(x - 1, y) ? 4 : 0);
    const [key, rec] = this._wallPiece(code, d, mask, open, rot, `W|${code}|${mask}|${open}`);
    return col ? this._painted(key, rec, col) : rec;
  }
  /** a sprite painted with a color: made once per (sprite, color), then reused. `key` names the sprite `rec` is (flipped ones add '|flip'). */
  _painted(key, rec, col) {
    const sp = this.sprites, k = key + '|p' + col;
    return sp.map.get(k) || sp.addPixmap(k, tintPixmap(sp.pixmapOf(rec), col));
  }

  // ------------------------------------------------------------------ pools
  _acq() { let o = this.pool[this.nPool]; if (!o) { o = {}; this.pool[this.nPool] = o; } this.nPool++; return o; }
  _push(y, kind, a, b, c) { const o = this._acq(); o.y = y; o.k = kind; o.a = a; o.b = b; o.c = c; this.list.push(o); return o; }

  // ------------------------------------------------------------------ main draw
  draw(g) {
    const w = g.world;
    if (this.world !== w) this.setWorld(w);
    const ctx = this.ctx, sp = this.sprites, view = g.view;
    const VW = view.w, VH = view.h;
    if (this.light.width !== VW || this.light.height !== VH) { this.light.width = VW; this.light.height = VH; }
    this._processDirty();
    const t = g.t;
    const pr = this.presenter;
    this.labels = pr && pr.ok && pr.active && this.textLayer ? this.textLayer : null;
    if (this.labels) this.labels.begin();
    const camX = Math.round(g.camX), camY = Math.round(g.camY);
    const ox = -camX, oy = -camY;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = SKY_DEEP;
    ctx.fillRect(0, 0, VW, VH);
    const tx0 = Math.max(0, Math.floor(camX / TILE) - 1), ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const tx1 = Math.min(w.W - 1, Math.floor((camX + VW) / TILE) + 1), ty1 = Math.min(w.H - 1, Math.floor((camY + VH) / TILE) + 1);
    const W = w.W;
    const wf = Math.floor(t * 3);

    // ---- tiles
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * W + x, px = x * TILE + ox, py = y * TILE + oy;
        if (w.ground[i] === 0) {
          const tone = this.shallow[i] ? 0 : 1;
          const v = hash32(x, y, 1) % 3;
          const ws = this.water[tone][v][(wf + (x * 3 + y * 5) % 4) & 3];
          sp.drawS(ctx, ws, px, py);
          if (this.wmeta[i] < 0) {
            let m = 0;
            if (w.isLand(x - 1, y)) m |= 1; if (w.isLand(x + 1, y)) m |= 2; if (w.isLand(x, y + 1)) m |= 4;
            this.wmeta[i] = m;
            if (w.isLand(x, y - 1)) {
              const kind = GROUND_IDS[w.ground[(y - 1) * W + x]];
              const cm = (w.isLand(x - 1, y - 1) ? 0 : 1) | (w.isLand(x + 1, y - 1) ? 0 : 2);
              this.cliff[i] = sp.get(`cliff_${kind}_${cm}`);
            } else this.cliff[i] = null;
          }
          const m = this.wmeta[i];
          if (m) { const ff = (wf >> 1) & 1; if (m & 1) sp.drawS(ctx, this.foam.w[ff], px, py); if (m & 2) sp.drawS(ctx, this.foam.e[ff], px, py); if (m & 4) sp.drawS(ctx, this.foam.s[ff], px, py); }
          const cl = this.cliff[i];
          if (cl) sp.drawS(ctx, cl, px, py);
        } else {
          let ls = this.land[i];
          if (!ls) { ls = this._landSprite(i, x, y); this.land[i] = ls; }
          sp.drawS(ctx, ls, px, py);
          let dc = this.deco[i];
          if (dc === undefined) {
            dc = null;
            if (!w.floor[i] && hashf(x, y, 5) < 0.2) dc = sp.get(`deco_${GROUND_IDS[w.ground[i]]}_${hash32(x, y, 9) % DECOS}`);
            this.deco[i] = dc;
          }
          if (dc && !w.occ[i] && !w.wall[i]) sp.drawS(ctx, dc, px, py);
        }
        const f = w.floor[i];
        if (f) {
          const nm = 'f_' + floorDefOf(f).id.replace(/^floor_/, ''), fc = w.floorCol[i], fr = w.floorRot[i];
          if (fc || fr) { const rec = this._tileVariant(nm, 'floor', fr, fc); if (rec) sp.drawS(ctx, rec, px, py); } else sp.draw(ctx, nm, px, py);
        }
      }
    }
    // flat things (rugs etc.)
    for (const th of w.thingsInRect(tx0 - 2, ty0 - 2, tx1 + 2, ty1 + 2)) {
      const d = BUILD[th.type];
      if (d && d.kind === 'flat') this._drawThing(ctx, th, d, ox, oy, t, g);
    }

    // ---- sorted drawables
    this.list.length = 0; this.nPool = 0;
    for (const th of w.thingsInRect(tx0 - 2, ty0 - 3, tx1 + 2, ty1 + 3)) {
      const d = thingDef(th.type);
      if (!d || d.kind === 'flat') continue;
      let sy = (th.y + th.h) * TILE;
      if (th.type === 'warp_pad') sy -= 8;
      this._push(sy, 0, th, d);
    }
    for (let y = ty0; y <= Math.min(w.H - 1, ty1 + 1); y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * W + x;
      if (w.wall[i]) this._push((y + 1) * TILE - 0.4, 1, i, x, y);
    }
    for (const m of w.mobs.values()) {
      const mx = m.rx === undefined ? m.x : m.rx, my = m.ry === undefined ? m.y : m.ry;
      if (mx < camX - 40 || mx > camX + VW + 40 || my < camY - 40 || my > camY + VH + 60) continue;
      this._push(my + (m.boss ? 0 : 0), 2, m);
    }
    for (const p of w.players.values()) {
      if (!p.online) continue;
      const px = p.rx === undefined ? p.x : p.rx, py = p.ry === undefined ? p.y : p.ry;
      let sy = py, furn = null;
      if (p.sleeping || p.sit) {
        furn = furnitureUnder(w, p, p.sleeping ? 'bed' : 'seat');
        if (!furn) sy += 3;
        else {
          const bottom = (furn.y + furn.h) * TILE;
          if (p.sleeping) sy = bottom + 0.3; // on top of the bed
          else if (nearestSlot(furn, p.x, p.y).dir === 2) sy = bottom - 0.3; // facing away: the backrest is in front of them
          else { sy = bottom + 0.3; this._push(bottom + 0.6, 5, furn, thingDef(furn.type)); } // the front edge of the seat goes over their legs
        }
      }
      this._push(sy, 3, p, furn);
    }
    for (const d of w.drops.values()) {
      if (d.x < camX - 20 || d.x > camX + VW + 20 || d.y < camY - 20 || d.y > camY + VH + 20) continue;
      this._push(d.y - 0.2, 4, d);
    }
    this.list.sort((a, b) => a.y - b.y);
    for (const e of this.list) {
      switch (e.k) {
        case 0: this._drawThing(ctx, e.a, e.b, ox, oy, t, g); break;
        case 1: this._drawWall(ctx, e.a, e.b, e.c, ox, oy, g); break;
        case 2: this._drawMob(ctx, e.a, ox, oy, t, g); break;
        case 3: this._drawPlayer(ctx, e.a, ox, oy, t, g, e.b); break;
        case 5: this._drawSeatLip(ctx, e.a, e.b, ox, oy, t); break;
        case 4: this._drawDrop(ctx, e.a, ox, oy, t, g); break;
      }
    }

    // ---- projectiles, bobbers, tags, ghost
    this._drawProjectiles(ctx, w, ox, oy, g);
    this._drawBobbers(ctx, g, ox, oy);
    this._drawLandTags(ctx, g, ox, oy);
    this._drawBeaconRings(ctx, g, ox, oy, t);
    if (g.builder && g.builder.active) this._drawBuildGhost(ctx, g, ox, oy, t);
    g.fx.drawBombs(ctx, ox, oy, sp);
    g.fx.drawParticles(ctx, ox, oy);

    // ---- lighting & weather
    this._drawLighting(ctx, g, ox, oy, VW, VH, tx0, ty0, tx1, ty1);
    this._drawWeather(ctx, g, VW, VH);
    g.fx.drawPopups(ctx, ox, oy, sp, this.labels);
    this._drawOverlays(ctx, g, ox, oy, VW, VH);
    if (g.fx.flash > 0) { ctx.globalAlpha = Math.min(0.7, g.fx.flash); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (this.presenter) this.presenter.present(); // smooth look: show this frame through the rounding shader
    if (this.textLayer) { if (this.labels) this.textLayer.flush(); else this.textLayer.clear(); }
  }

  // ------------------------------------------------------------------ things
  thingSpriteName(th, d, t) {
    let base = th.rot && turnable(d) ? turnSprite(d, th.rot) : 't_' + th.type;
    if (th.dep) { const dn = base + '_dep'; if (this.sprites.has(dn)) return dn; return base; }
    const s = th.s;
    if (s && s.w && this.sprites.has(base + '_on')) {
      if (this.sprites.has(base + '_on1') && d.behavior === 'drill') return Math.floor(t * 6) % 2 ? base + '_on1' : base + '_on';
      return base + '_on';
    }
    if (this.animated.has(base)) {
      const rate = ANIM_RATE[th.type] || 4;
      if (th.type === 'windmill') return base + '_a' + (Math.floor(t * (s && s.w ? 4 : 1.2)) % 4);
      if (th.type === 'campfire' || th.type === 'torch' || th.type === 'brazier' || th.type === 'candelabra' || th.type === 'fireplace' || th.type === 'lava_lamp') return base + '_a' + ((Math.floor(t * rate) + th.id) % 3);
      return base + '_a' + (Math.floor(t * rate) % 3);
    }
    const vc = this.variants.get(base);
    if (vc) { const v = hash32(th.x, th.y, 7) % vc; if (v > 0) return base + '_v' + v; }
    return base;
  }
  _drawThing(ctx, th, d, ox, oy, t, g) {
    const sp = this.sprites;
    const name = this.thingSpriteName(th, d, t);
    let spr = sp.get(name);
    if (!spr) return;
    let flip = th.flip && d.kind !== 'node' && !th.rot;
    if (flip) spr = sp.flipped(name);
    if (th.col) spr = this._painted(flip ? name + '|flip' : name, spr, th.col);
    let dx = th.x * TILE + (th.w * TILE - spr.w) / 2 + ox, dy = (th.y + th.h) * TILE - spr.h + oy;
    const sh = g.fx.shakes.get(th.id);
    if (sh) dx += Math.sin(sh * 70) * Math.min(1.4, sh * 8);
    if (d.kind === 'node' && !th.dep && d.plant && !d.solid) { dx += Math.round(Math.sin(t * 1.6 + th.x * 1.7 + th.y) * 0.6); } // gentle sway for grass/flowers
    // hover highlight (interactables)
    if (g.hover && g.hover.thingId === th.id) this._outline(ctx, name, flip, dx, dy, '#ffffff');
    sp.drawS(ctx, spr, dx, dy);
    // crops on farm plots
    if (d.behavior === 'farm' && th.s && th.s.c) sp.draw(ctx, `crop_${th.s.c}_${th.s.st || 0}`, th.x * TILE + ox, th.y * TILE + oy);
    // status icons
    if (d.behavior === 'producer' && th.s && th.s.stock > 0) this._bubble(ctx, th, ox, oy, t, d.conf.out === '@fishpick' ? 'ui_fish' : null, d.conf.out);
    if (d.behavior === 'farm' && th.s && th.s.c && CROPS[th.s.c] && th.s.g >= CROPS[th.s.c].time) this._bubble(ctx, th, ox, oy, t, null, CROPS[th.s.c].item);
    if (d.behavior === 'processor' && th.s && th.s.out) this._bubble(ctx, th, ox, oy, t, null, th.s.out.id);
    if (d.behavior === 'drill' && th.s && th.s.buf && th.s.buf.length) this._bubble(ctx, th, ox, oy, t, null, th.s.buf[0].id);
    if (d.kind === 'treasure' && !th.dep) { const a = 0.5 + 0.5 * Math.sin(t * 5); ctx.globalAlpha = a; ctx.fillStyle = '#fff6a8'; ctx.fillRect(dx + 3 + ((t * 3) | 0) % 9, dy + 2, 1, 1); ctx.globalAlpha = 1; }
    if (d.kind === 'dig' && g.me && (g.me.stats && g.me.stats.treasureSense || g.nearShovel)) { const a = 0.5 + 0.5 * Math.sin(t * 6 + th.x); ctx.globalAlpha = a; ctx.fillStyle = '#fff6a8'; ctx.fillRect(dx + 7, dy + 3 + ((t * 4) | 0) % 3, 2, 2); ctx.globalAlpha = 1; }
  }
  _bubble(ctx, th, ox, oy, t, iconName, item) {
    const sp = this.sprites;
    const x = (th.x + th.w / 2) * TILE + ox - 6, y = th.y * TILE + oy - 10 + Math.round(Math.sin(t * 4 + th.id) * 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(x - 1, y - 1, 14, 14);
    ctx.fillStyle = '#2a1f3d'; ctx.fillRect(x - 2, y, 16, 12); ctx.fillRect(x, y - 2, 12, 16);
    ctx.fillStyle = '#fff6dc'; ctx.fillRect(x - 1, y, 14, 12); ctx.fillRect(x, y - 1, 12, 14);
    const spr = sp.get(item && ITEMS[item] ? 'i_' + item : iconName || 'ui_check');
    if (spr) ctx.drawImage(spr.page.canvas, spr.x, spr.y, spr.w, spr.h, x - 1, y - 2, 14, 14 > spr.h ? spr.h : 14);
  }
  _outline(ctx, name, flip, dx, dy, color) {
    const sp = this.sprites;
    const key = flip ? sp.flipped(name) : sp.get(name);
    const sil = sp.silhouette(flip ? name + '|flip' : name, 0xffffffff);
    // silhouette is white; draw 4 offsets then the sprite on top
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sp.drawS(ctx, sil, dx + ax, dy + ay);
  }

  // ------------------------------------------------------------------ walls
  _drawWall(ctx, i, x, y, ox, oy, g) {
    const w = this.world, sp = this.sprites;
    let rec = this.wallRec[i];
    const open = w.wallState[i];
    if (!rec || this.wallOpen[i] !== open) { rec = this._wallSprite(i, x, y); this.wallRec[i] = rec; this.wallOpen[i] = open; }
    const px = x * TILE + ox, py = y * TILE - 4 + oy;
    if (g.hover && g.hover.wallI === i) { for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.globalAlpha = 0.9; sp.drawS(ctx, sp.dyn('Wsil|' + rec.x + '|' + rec.y + '|' + rec.page.canvas.id, () => sp.pixmapOf(rec).silhouette(0xffffffff)), px + ax, py + ay); ctx.globalAlpha = 1; } }
    // fade walls that would hide the local player (just north of them)
    let alpha = 1;
    const me = g.me;
    if (me && g.fadeWalls) { const dx = me.x - (x + 0.5) * TILE, dy = (y * TILE) - me.y; if (Math.abs(dx) < 20 && dy > -4 && dy < 20) alpha = 0.55; }
    if (alpha < 1) ctx.globalAlpha = alpha;
    sp.drawS(ctx, rec, px, py);
    const dc = w.deco[i];
    if (dc) {
      const nm = 'd_' + decoDefOf(dc).id, dcol = w.decoCol[i], drot = w.decoRot[i];
      if (dcol || drot) { const r = this._tileVariant(nm, 'deco', drot, dcol); if (r) sp.drawS(ctx, r, px, py + 4); } else sp.draw(ctx, nm, px, py + 4);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ mobs
  _drawMob(ctx, m, ox, oy, t, g) {
    const sp = this.sprites, def = MOBS[m.type];
    const mx = m.rx === undefined ? m.x : m.rx, my = m.ry === undefined ? m.y : m.ry;
    const nf = this.mobFrames(m.type);
    let f = 0;
    const hopper = def.ai === 'hop' || (def.ai === 'boss' && m.type === 'slime_king');
    if (hopper) { f = (m.z || 0) > 3 ? 2 : m.sq > 0 ? 1 : 0; }
    else if (nf === 4) f = m.moving ? Math.floor(t * 9 + m.id) % 4 : 0;
    else if (nf === 2) f = m.moving || def.fly || def.ai === 'fly' || def.ai === 'shoot' ? Math.floor(t * 8 + m.id) % 2 : 0;
    else if (nf === 3) f = m.moving ? ((m.z || 0) > 1 ? 1 : 0) : 0;
    const name = `m_${m.type}_${Math.min(f, nf - 1)}`;
    let spr = sp.get(name);
    if (!spr) return;
    const flip = (m.face || 1) < 0;
    // facing: art faces right except slimes (symmetric)
    const key = flip ? name + '|flip' : name;
    const s2 = flip ? sp.flipped(name) : spr;
    const z = (m.z || 0);
    const dx = Math.round(mx - s2.w / 2 + ox), dy = Math.round(my - s2.h - z + oy + (def.fly || def.ai === 'fly' ? 0 : 0));
    // shadow
    const shw = Math.max(8, Math.min(spr.w, 20));
    ctx.globalAlpha = Math.max(0.3, 1 - z / 30);
    ctx.fillStyle = 'rgba(30,20,64,0.32)';
    ctx.beginPath(); ctx.ellipse(Math.round(mx + ox), Math.round(my + oy), shw * 0.42, shw * 0.17, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (g.hover && g.hover.mobId === m.id) this._outline(ctx, name, flip, dx, dy, '#fff');
    sp.drawS(ctx, s2, dx, dy);
    const fz = m.fz || (m.frozen > 0 ? 2 : m.burn > 0 ? 1 : 0); // frozen: icy; burning: flickers orange
    if (fz === 2) { ctx.globalAlpha = 0.5; sp.drawS(ctx, sp.silhouette(flip ? name + '|flip' : name, 0xfffadc9c), dx, dy); ctx.globalAlpha = 1; }
    else if (fz === 1 && Math.floor(t * 10) % 2 === 0) { ctx.globalAlpha = 0.4; sp.drawS(ctx, sp.silhouette(flip ? name + '|flip' : name, 0xff3c8cff), dx, dy); ctx.globalAlpha = 1; }
    if (m.hit > 0) { ctx.globalAlpha = Math.min(0.85, m.hit * 6); sp.drawS(ctx, sp.silhouette(flip ? name + '|flip' : name, 0xffffffff), dx, dy); ctx.globalAlpha = 1; }
    if (m.hp < m.maxhp && def.hostile && !m.boss) this._hpBar(ctx, dx + (s2.w >> 1), dy - 3, 12, m.hp / m.maxhp);
    if (m.st === 'windup' || (m.boss && (m.st === 'slam' || m.st === 'charge' || m.st === 'summon' || m.st === 'ring' || m.st === 'hop' || m.st === 'volley' || m.st === 'spin' || m.st === 'quake'))) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20); ctx.fillStyle = '#ff6b7a'; ctx.fillRect(dx + (s2.w >> 1) - 1, dy - 8, 2, 5); ctx.fillRect(dx + (s2.w >> 1) - 1, dy - 2, 2, 2); ctx.globalAlpha = 1; }
  }
  mobFrames(type) {
    this._mf = this._mf || {};
    let n = this._mf[type];
    if (n) return n;
    n = 0; while (this.sprites.has(`m_${type}_${n}`)) n++;
    this._mf[type] = n || 1; return this._mf[type];
  }
  _hpBar(ctx, cx, y, w, frac) {
    const x = (cx - w / 2) | 0;
    ctx.fillStyle = '#2a1f3d'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#6a4a5a'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = frac > 0.5 ? '#7fe08a' : frac > 0.25 ? '#ffd84a' : '#ff6b7a';
    ctx.fillRect(x, y, Math.max(1, Math.round(w * frac)), 2);
  }

  // ------------------------------------------------------------------ players
  /** the front edge of a seat, drawn again over the people sitting in it so their legs are in the seat, not in front of it */
  _drawSeatLip(ctx, th, d, ox, oy, t) {
    const sp = this.sprites, name = this.thingSpriteName(th, d, t);
    let spr = sp.get(name);
    if (!spr) return;
    const flip = th.flip && !th.rot;
    if (flip) spr = sp.flipped(name);
    if (th.col) spr = this._painted(flip ? name + '|flip' : name, spr, th.col);
    const n = Math.min(SEAT_LIP, spr.h);
    const lip = sp.dyn(`lip|${name}${flip ? '|f' : ''}|${n}|p${th.col || 0}`, () => sp.pixmapOf(spr).crop(0, spr.h - n, spr.w, n));
    sp.drawS(ctx, lip, th.x * TILE + (th.w * TILE - spr.w) / 2 + ox, (th.y + th.h) * TILE - n + oy);
  }
  _drawPlayer(ctx, p, ox, oy, t, g, furn) {
    const sp = this.sprites;
    const st = g.pstate(p.pid);
    const px = Math.round((p.rx === undefined ? p.x : p.rx) + ox), py = Math.round((p.ry === undefined ? p.y : p.ry) + oy);
    const name = p.name;
    if (p.dead > 0) {
      const gm = sp.get('m_ghost_' + (Math.floor(t * 3) % 2));
      ctx.globalAlpha = 0.55; sp.drawS(ctx, gm, px - 8, py - 18 - Math.round(Math.sin(t * 3) * 2) - (4.5 - Math.min(4.5, p.dead)) * 3); ctx.globalAlpha = 1;
      this._nameTag(ctx, name, px, py - 36, g, p);
      return;
    }
    const look = p.look;
    if (p.sleeping) {
      if (furn) {
        // head on the pillow of the bed, turned the way the bed lies
        const pl = pillowAt(furn, thingDef(furn.type)), w = g.world;
        const spr = sp.dyn(`psh|${lookKey(look)}|${pl.head}`, () => playerSleepHead(look, pl.head));
        // two in one bed share the pillow, side by side
        let n = 0, k = 0;
        for (const q of w.players.values()) if (q.online && q.sleeping && !q.dead && furnitureUnder(w, q, 'bed') === furn) { if (q === p) k = n; n++; }
        const off = (k - (n - 1) / 2) * 5, side = pl.head === 1 || pl.head === 3;
        const hx = Math.round(pl.x + ox + (side ? 0 : off) - spr.w / 2), hy = Math.round(pl.y + oy + (side ? off : 0) - spr.h / 2);
        sp.drawS(ctx, spr, hx, hy);
        this._nameTag(ctx, name, hx + (spr.w >> 1), hy - 4 - (side ? 0 : k * 9), g, p); // (stacked, so two names in one bed stay readable)
        return;
      }
      const spr = sp.dyn('psl|' + lookKey(look), () => playerSleep(look));
      sp.drawS(ctx, spr, px - 7, py - 14);
      this._nameTag(ctx, name, px, py - 22, g, p);
      return;
    }
    if (p.sit && furn) {
      // sitting on a cushion, facing the way the seat faces
      const slot = nearestSlot(furn, p.x, p.y), view = slot.dir === 0 ? 0 : slot.dir === 2 ? 1 : 2;
      const key = `pls|${lookKey(look)}|${view}`;
      let spr = sp.dyn(key, () => playerFrame(look, view, 0, { sit: true }));
      if (slot.dir === 3) spr = sp.dyn(key + '|f', () => sp.pixmapOf(sp.map.get(key)).flipX());
      const hurtS = st.hurt > 0 && Math.floor(st.hurt * 18) % 2 === 0;
      const sx = Math.round(slot.x + ox) - 8, sy2 = Math.round(slot.y + oy) - 20 + SIT_DY[view];
      if (hurtS) ctx.globalAlpha = 0.6;
      sp.drawS(ctx, spr, sx, sy2);
      ctx.globalAlpha = 1;
      const em = g.fx.emotes.get(p.id);
      if (em) { const a = em.t > 1.8 ? 1 - (em.t - 1.8) / 0.4 : 1; ctx.globalAlpha = Math.max(0, a); const spr2 = sp.get('emote_' + ['heart', 'bang', 'ask', 'note', 'star', 'sweat', 'zzz', 'happy'][(em.e | 0) % 8]); sp.drawS(ctx, spr2, sx + 2, sy2 - 13 - Math.round(Math.sin(em.t * 6) * 1)); ctx.globalAlpha = 1; }
      this._nameTag(ctx, name, sx + 8, sy2 - 2, g, p);
      return;
    }
    const dir = st.dir, flip = st.flip;
    const moving = st.moving;
    const frame = moving ? [1, 0, 3, 0][Math.floor(st.walkT * 9) & 3] : 0;
    const key = `pl|${lookKey(look)}|${dir}|${frame}`;
    let spr = sp.dyn(key, () => playerFrame(look, dir, frame));
    if (flip && dir === 2) spr = sp.dyn(key + '|f', () => sp.pixmapOf(sp.map.get(key)).flipX());
    // shadow
    ctx.fillStyle = 'rgba(30,20,64,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py - 0.5, 5.5, 2, 0, 0, TAU); ctx.fill();
    let bob = 0;
    if (p.sit) bob = 3;
    const dy = py - 20 + bob + (moving ? 0 : 0);
    // flash when hurt
    const hurt = st.hurt > 0 && Math.floor(st.hurt * 18) % 2 === 0;
    if (p.shield > 0 && !hurt && Math.floor(t * 14) % 2 === 0 && p.shield < 3) ctx.globalAlpha = 0.5;
    sp.drawS(ctx, spr, px - 8, dy);
    ctx.globalAlpha = 1;
    if (hurt) { ctx.globalAlpha = 0.6; sp.drawS(ctx, sp.silhouette(flip && dir === 2 ? key + '|f' : key, 0xffffffff), px - 8, dy); ctx.globalAlpha = 1; }
    // held tool: swing arc or resting at side
    if (st.swing) this._drawSwing(ctx, p, st, px, py - 8, t);
    else if (p.heldTool && g.showHeld) { /* resting tool */ }
    // emote
    const em = g.fx.emotes.get(p.id);
    if (em) { const a = em.t > 1.8 ? 1 - (em.t - 1.8) / 0.4 : 1; ctx.globalAlpha = Math.max(0, a); const spr2 = sp.get('emote_' + ['heart', 'bang', 'ask', 'note', 'star', 'sweat', 'zzz', 'happy'][(em.e | 0) % 8]); sp.drawS(ctx, spr2, px - 6, py - 38 - Math.round(Math.sin(em.t * 6) * 1)); ctx.globalAlpha = 1; }
    this._nameTag(ctx, name, px, py - 25 + bob, g, p);
  }
  _nameTag(ctx, name, x, y, g, p) {
    if (!g.showNames && p.pid === g.localPid) return;
    if (this.labels) { this.labels.add(name, p.pid === g.localPid ? '#fff6dc' : '#bfeaff', x, y - 3.5, { a: 0.97 }); return; }
    const spr = g.fx.textSprite(name, p.pid === g.localPid ? '#fff6dc' : '#bfeaff');
    ctx.globalAlpha = 0.95;
    ctx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height));
    ctx.globalAlpha = 1;
  }
  _drawSwing(ctx, p, st, px, py, t) {
    const sp = this.sprites, sw = st.swing;
    const prog = clamp(sw.t / sw.dur, 0, 1);
    const sweep = (prog - 0.5) * 2.2;
    const ang = sw.ang + (sw.kind === 4 ? 0 : -sweep) * (sw.kind === 2 || sw.kind === 3 ? 0 : 1);
    const item = ITEMS[sw.item];
    if (!item) return;
    const iname = 'i_' + sw.item;
    const rot = ang + Math.PI / 4;
    const step = Math.round(((rot % TAU) + TAU) % TAU / (TAU / 24));
    const key = `rot|${iname}|${step}`;
    const spr = sp.dyn(key, () => sp.pixmapOf(sp.get(iname)).rotated(step * (TAU / 24)));
    const reach = sw.kind === 1 ? 12 : 9;
    const cx = px + Math.cos(ang) * reach, cy = py + Math.sin(ang) * reach;
    sp.drawS(ctx, spr, Math.round(cx - spr.w / 2), Math.round(cy - spr.h / 2));
    if (sw.kind === 1 && prog > 0.1 && prog < 0.7) { // slash arc
      ctx.globalAlpha = 0.55 * (1 - prog); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 17, sw.ang - 1.1, sw.ang + 1.1 * (prog * 2 - 0.4)); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ drops, projectiles
  _drawDrop(ctx, d, ox, oy, t, g) {
    const sp = this.sprites;
    let x = d.x, y = d.y, z = 0;
    const age = Math.max(0, d.age);
    if (age < 0.4) { const k = age / 0.4; x = d.ox + (d.x - d.ox) * k; y = d.oy + (d.y - d.oy) * k; z = Math.sin(k * Math.PI) * 10; }
    else z = 1 + Math.sin(t * 4 + d.id) * 1.2;
    const name = 'i_' + d.item;
    const spr = sp.get(name);
    if (!spr) return;
    ctx.fillStyle = 'rgba(30,20,64,0.28)';
    ctx.beginPath(); ctx.ellipse(Math.round(x + ox), Math.round(y + oy), 4, 1.6, 0, 0, TAU); ctx.fill();
    const blink = d.ttl < 8 && Math.floor(t * 8) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.4;
    sp.drawS(ctx, spr, Math.round(x + ox - 8), Math.round(y + oy - 13 - z));
    ctx.globalAlpha = 1;
    if (d.item !== 'coin' && d.n > 1) {
      if (this.labels) this.labels.add(String(d.n), '#ffffff', Math.round(x + ox + 2), Math.round(y + oy - 3 - z), { align: 'left', k: 0.8 });
      else { const s2 = g.fx.textSprite(String(d.n), '#ffffff'); ctx.drawImage(s2, Math.round(x + ox + 1), Math.round(y + oy - 6 - z)); }
    }
  }
  _drawProjectiles(ctx, w, ox, oy, g) {
    for (const p of w.projs.values()) {
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#d8c8a0'; ctx.fillRect(-5, 0, 8, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(3, -1, 2, 3); ctx.fillStyle = '#ff8aa8'; ctx.fillRect(-6, -1, 2, 3); ctx.restore();
      } else {
        const c = p.color;
        ctx.fillStyle = c; ctx.globalAlpha = 0.35; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.globalAlpha = 1;
        ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
        if (g.fx.parts.length < 500 && Math.random() < 0.5) g.fx.burst(p.x, p.y, 1, [c], { speed: 6, up: 0, grav: 0, life: 0.25, size: 1, spread: 2 });
      }
    }
  }
  _drawBobbers(ctx, g, ox, oy) {
    const sp = this.sprites;
    for (const [id, b] of g.fx.bobbers) {
      const owner = [...g.world.players.values()].find((p) => p.id === id);
      const bx = Math.round(b.x + ox), by = Math.round(b.y + oy + Math.sin(b.t * 3) * (b.bite ? 2 : 0.8));
      if (owner) { // line
        const sx = Math.round((owner.rx === undefined ? owner.x : owner.rx) + ox), sy = Math.round((owner.ry === undefined ? owner.y : owner.ry) + oy - 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + bx) / 2, Math.min(sy, by) - 8, bx, by); ctx.stroke();
      }
      sp.draw(ctx, 'fx_bobber', bx - 4, by - 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(bx, by + 1, 5 + (b.t * 4) % 4, 2, 0, 0, TAU); ctx.stroke();
      if (b.bite) sp.draw(ctx, 'fx_bite', bx - 4, by - 20 - Math.round(Math.sin(b.t * 14) * 2));
    }
  }
  _drawLandTags(ctx, g, ox, oy) {
    if (!g.landTags || !g.landTags.length) return;
    const sp = this.sprites;
    for (const tg of g.landTags) {
      const x = Math.round(tg.x + ox), y = Math.round(tg.y + oy + Math.sin(g.t * 2 + tg.gx) * 2);
      if (x < -40 || x > g.view.w + 40 || y < -30 || y > g.view.h + 30) continue;
      const hot = g.hover && g.hover.landKey === tg.gx + ',' + tg.gy;
      sp.draw(ctx, 'fx_tag', x - 12, y - 8);
      if (this.labels) this.labels.add(String(tg.price), tg.afford ? '#5a3a1a' : '#b83a4a', x, y + 1.5, { stroke: null, k: 0.95 });
      else { const txt = g.fx.textSprite(String(tg.price), tg.afford ? '#5a3a1a' : '#b83a4a', 'rgba(255,255,255,0)'); ctx.drawImage(txt, Math.round(x - txt.width / 2 + 0), y - 2); }
      if (hot) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 13, y - 9, 26, 18); }
      const bn = g.landBiomeIcon && g.landBiomeIcon(tg);
      if (bn) { ctx.fillStyle = bn; ctx.fillRect(x - 11, y + 8, 22, 3); ctx.fillStyle = 'rgba(42,31,61,0.6)'; ctx.fillRect(x - 11, y + 11, 22, 1); }
    }
  }
  /** a box over some tiles: green = it fits, red = blocked */
  _ghostBox(ctx, x, y, wd, ht, ok, a = 1) {
    ctx.fillStyle = ok ? `rgba(120,255,160,${0.3 * a})` : `rgba(255,90,110,${0.42 * a})`;
    ctx.fillRect(x, y, wd, ht);
    ctx.strokeStyle = ok ? `rgba(200,255,215,${0.95 * a})` : `rgba(255,160,170,${0.95 * a})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, wd - 1, ht - 1);
  }
  _ghostLabel(ctx, g, text, color, x, y) {
    if (this.labels) { this.labels.add(text, color, x, y, { k: 0.95 }); return; }
    const txt = g.fx.textSprite(text, color, '#2a1f3d');
    ctx.drawImage(txt, Math.round(x - txt.width / 2), Math.round(y - txt.height / 2));
  }
  /** the glowing circle of a lighthouse: a soft golden disc with a slowly turning dashed edge */
  _beaconRing(ctx, cx, cy, r, t, strength) {
    cx = Math.round(cx); cy = Math.round(cy);
    ctx.save();
    ctx.fillStyle = `rgba(255,236,150,${0.1 * strength})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 6;
    ctx.strokeStyle = `rgba(70,90,20,${0.35 * strength})`; ctx.beginPath(); ctx.arc(cx, cy + 1, r, 0, TAU); ctx.stroke(); // (a darker line just under it, so it shows on light ground too)
    ctx.strokeStyle = `rgba(255,250,200,${0.9 * strength})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  /** a lighthouse's circle shows while you stand near it (so you can see which resources it helps), strongest inside */
  _drawBeaconRings(ctx, g, ox, oy, t) {
    const me = g.me, w = g.world;
    if (!me || !w) return;
    if (!this._bk || t - this._bk.t > 0.4) { // (looked up a few times a second, not every frame)
      const list = [];
      for (const th of w.thingsNear(me.x, me.y, 22 * TILE)) { const d = BUILD[th.type]; if (d && d.behavior === 'beacon' && !th.dep) list.push([th, d.conf.radius]); }
      this._bk = { t, list };
    }
    for (const [th, rad] of this._bk.list) {
      const cx = (th.x + th.w / 2) * TILE, cy = (th.y + th.h / 2) * TILE, d = Math.hypot(me.x - cx, me.y - cy) / TILE;
      if (d > rad + 5) continue;
      this._beaconRing(ctx, cx + ox, cy + oy, rad * TILE, t, d <= rad ? 0.9 : 0.5);
    }
  }
  /** build mode: a see-through picture of the piece where it would go (turned the way it will face), green or red, with the reason when it will not go */
  _drawBuildGhost(ctx, g, ox, oy, t) {
    const b = g.builder, sp = this.sprites, w = g.world, me = g.me;
    const pulse = 0.8 + 0.2 * Math.sin(t * 5.5);
    // reach: a faint ring around the player
    if (me && b.range) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(me.x + ox), Math.round(me.y - 4 + oy), b.range, 0, TAU); ctx.stroke(); }
    if (b.remove) {
      // the tool shows exactly what it would take away: red over a piece, only an outline over empty ground
      for (const [tx, ty] of b.tiles || [[b.tx, b.ty]]) {
        const ok = b.okAt ? b.okAt(tx, ty) : b.ok;
        const th = ok ? w.thingAt(tx, ty) || w.flatAt(tx, ty) : null;
        if (th) this._ghostBox(ctx, th.x * TILE + ox, th.y * TILE + oy, th.w * TILE, th.h * TILE, false, pulse);
        else if (ok) this._ghostBox(ctx, tx * TILE + ox, ty * TILE + oy, TILE, TILE, false, pulse);
        else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(tx * TILE + ox + 0.5, ty * TILE + oy + 0.5, TILE - 1, TILE - 1); }
      }
      return;
    }
    if (b.pick) {
      // the color dropper: a white frame over the piece whose color it would copy
      const th = w.thingAt(b.tx, b.ty) || w.flatAt(b.tx, b.ty), pl = th && BUILD[th.type] && !BUILD[th.type].hidden ? th : null;
      const x = (pl ? pl.x : b.tx) * TILE + ox, y = (pl ? pl.y : b.ty) * TILE + oy, wd = (pl ? pl.w : 1) * TILE, ht = (pl ? pl.h : 1) * TILE;
      ctx.fillStyle = `rgba(255,255,255,${0.18 * pulse})`; ctx.fillRect(x, y, wd, ht);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, wd - 1, ht - 1);
      return;
    }
    if (b.paint) {
      // the brush shows each piece it would color, already in the new color (original look when "Original" is chosen)
      for (const [tx, ty] of b.tiles || [[b.tx, b.ty]]) {
        const ok = b.okAt ? b.okAt(tx, ty) : b.ok, tg = ok ? paintTarget(w, tx, ty, b.col) : null;
        if (!tg) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(tx * TILE + ox + 0.5, ty * TILE + oy + 0.5, TILE - 1, TILE - 1); continue; }
        const i = w.idx(tx, ty), px = tx * TILE + ox, py = ty * TILE + oy;
        let bx = px, by = py, bw = TILE, bh = TILE;
        ctx.globalAlpha = 0.85;
        if (tg.layer === 'thing') {
          const th = tg.thing, d = BUILD[th.type], name = this.thingSpriteName(th, d, t);
          let spr = sp.get(name);
          const flip = th.flip && d.kind !== 'node' && !th.rot;
          if (spr && flip) spr = sp.flipped(name);
          if (spr && b.col) spr = this._painted(flip ? name + '|flip' : name, spr, b.col);
          bx = th.x * TILE + ox; by = th.y * TILE + oy; bw = th.w * TILE; bh = th.h * TILE;
          if (spr) sp.drawS(ctx, spr, bx + (bw - spr.w) / 2, (th.y + th.h) * TILE - spr.h + oy);
        } else if (tg.layer === 'wall') sp.drawS(ctx, this._wallSprite(i, tx, ty, b.col), px, py - 4);
        else if (tg.layer === 'deco') { const r = this._tileVariant('d_' + decoDefOf(w.deco[i]).id, 'deco', w.decoRot[i], b.col); if (r) sp.drawS(ctx, r, px, py + 4); }
        else { const r = this._tileVariant('f_' + floorDefOf(w.floor[i]).id.replace(/^floor_/, ''), 'floor', w.floorRot[i], b.col); if (r) sp.drawS(ctx, r, px, py); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * pulse})`; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      }
      return;
    }
    const d = b.def;
    if (!d) return;
    if (d.kind === 'thing' || d.kind === 'flat') {
      const [fw, fh] = footprintFor(d, b.rot), px = b.tx * TILE + ox, py = b.ty * TILE + oy;
      const name = turnSprite(d, b.rot);
      let spr = sp.get(name);
      const mirrored = !!b.flip && !turnable(d);
      if (spr && mirrored) spr = sp.flipped(name);
      if (spr && b.col) spr = this._painted(mirrored ? name + '|flip' : name, spr, b.col);
      if (d.behavior === 'beacon') this._beaconRing(ctx, px + fw * TILE / 2, py + fh * TILE / 2, d.conf.radius * TILE, t, 1);
      this._ghostBox(ctx, px, py, fw * TILE, fh * TILE, b.ok, pulse * 0.8);
      if (spr) {
        ctx.globalAlpha = b.ok ? 0.72 : 0.5;
        sp.drawS(ctx, spr, px + (fw * TILE - spr.w) / 2, (b.ty + fh) * TILE - spr.h + oy);
        ctx.globalAlpha = 1;
      }
      if (!b.ok && b.reason) this._ghostLabel(ctx, g, b.reason, '#ffd0d6', px + fw * TILE / 2, py - 6);
      return;
    }
    // walls, floors and wall decorations: one ghost per tile (a rectangle while dragging)
    const tiles = b.tiles || [[b.tx, b.ty]];
    for (const [tx, ty] of tiles) {
      const ok = b.okAt ? b.okAt(tx, ty) : b.ok;
      const px = tx * TILE + ox, py = ty * TILE + oy;
      ctx.globalAlpha = ok ? 0.7 : 0.5;
      if (d.kind === 'wall') {
        const fenceLike = d.piece === 'fence' || d.piece === 'gate';
        const wallHere = (x, y) => w.inb(x, y) && w.wall[w.idx(x, y)] > 0;
        const mask = fenceLike ? (wallHere(tx + 1, ty) ? 2 : 0) | (wallHere(tx - 1, ty) ? 4 : 0) : (wallHere(tx, ty - 1) ? 1 : 0) | (wallHere(tx + 1, ty) ? 2 : 0) | (wallHere(tx - 1, ty) ? 4 : 0);
        const [wkey, wrec] = this._wallPiece(0, d, mask, 0, b.rot, `WG|${d.id}|${mask}`);
        sp.drawS(ctx, b.col ? this._painted(wkey, wrec, b.col) : wrec, px, py - 4);
      } else if (d.kind === 'floor' || d.kind === 'walldeco') {
        const r = this._tileVariant(d.kind === 'floor' ? 'f_' + d.id.replace(/^floor_/, '') : 'd_' + d.id, d.kind === 'floor' ? 'floor' : 'deco', b.rot, b.col);
        if (r) sp.drawS(ctx, r, px, py);
      }
      ctx.globalAlpha = 1;
      this._ghostBox(ctx, px, py, TILE, TILE, ok, pulse * 0.8);
    }
    if (!b.ok && b.reason && tiles.length === 1) this._ghostLabel(ctx, g, b.reason, '#ffd0d6', tiles[0][0] * TILE + TILE / 2 + ox, tiles[0][1] * TILE + oy - 6);
  }

  // ------------------------------------------------------------------ lighting & weather
  _lightSprite(r, color) {
    const key = r + '|' + color;
    let c = this.lightSprites.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = r * 2 + 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(r + 1, r + 1, 1, r + 1, r + 1, r);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace('1)', '0.55)')); gr.addColorStop(1, color.replace('1)', '0)'));
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    this.lightSprites.set(key, c);
    return c;
  }
  _hexRgba(hexs) { const n = parseInt(hexs.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1)`; }
  _drawLighting(ctx, g, ox, oy, VW, VH, tx0, ty0, tx1, ty1) {
    const w = g.world;
    const phase = phaseOf(w.time, w.settings.dayLength || 480);
    const night = nightness(phase);
    const rain = w.shared.weather ? 1 : 0, storm = w.shared.storm ? 1 : 0;
    const amb = ambientColor(phase, rain, storm);
    g.night = night;
    if (amb[0] > 250 && amb[1] > 250 && amb[2] > 250) return;
    const lc = this.lctx;
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`;
    lc.fillRect(0, 0, VW, VH);
    lc.globalCompositeOperation = 'lighter';
    const dark = clamp((255 * 3 - (amb[0] + amb[1] + amb[2])) / 400, 0, 1); // how dark it is -> lights matter more
    const addLight = (x, y, r, color, k = 1) => {
      const spr = this._lightSprite(r, color);
      lc.globalAlpha = clamp(k * (0.35 + dark * 0.65), 0, 1);
      lc.drawImage(spr, Math.round(x + ox - r - 1), Math.round(y + oy - r - 1));
    };
    const flick = g.t;
    // players carry a little warm glow
    for (const p of w.players.values()) {
      if (!p.online || p.dead > 0) continue;
      const st = p.stats; const bonus = st ? st.lightBonus : 0;
      addLight(p.rx === undefined ? p.x : p.rx, (p.ry === undefined ? p.y : p.ry) - 8, Math.round(34 * (1 + bonus)), 'rgba(255,230,190,1)', 0.85);
    }
    for (const th of w.thingsInRect(tx0 - 8, ty0 - 8, tx1 + 8, ty1 + 8)) {
      const d = BUILD[th.type];
      if (!d || !d.light) continue;
      const L = d.light;
      if (L.when === 'work' && !(th.s && th.s.w)) continue;
      const fl = L.flick ? 1 + Math.sin(flick * 9 + th.id * 1.7) * 0.07 + Math.sin(flick * 23 + th.id) * 0.04 : 1;
      const cx = (th.x + th.w / 2) * TILE, cy = (th.y + th.h / 2) * TILE - (d.h > 1 ? 0 : 4);
      addLight(cx, cy, Math.round(L.r * fl), this._hexRgba(L.c), 1);
    }
    // windows glow at night
    if (night > 0.35) {
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const i = y * w.W + x; const c = w.wall[i];
        if (!c) continue;
        const d = wallDefOf(c);
        if (d.piece === 'window') addLight((x + 0.5) * TILE, y * TILE + 6, 20, 'rgba(255,214,140,1)', 0.7 * night);
        else if (d.piece === 'door' && w.wallState[i]) addLight((x + 0.5) * TILE, y * TILE + 8, 16, 'rgba(255,214,140,1)', 0.5 * night);
      }
    }
    // fx lights (fire particles etc.)
    for (const r of g.fx.rings) { if (r.color === '#ffe066' || r.color === '#ffffff') addLight(r.x, r.y, 26, 'rgba(255,240,200,1)', 0.5 * (1 - r.t / r.life)); }
    lc.globalAlpha = 1; lc.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // warm glow bloom on top of lit areas so lamps feel luminous
    if (dark > 0.25) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12 * dark;
      ctx.drawImage(this.light, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  _drawWeather(ctx, g, VW, VH) {
    const w = g.world;
    if (!w.shared.weather) return;
    const storm = w.shared.storm ? 1 : 0, t = g.t;
    ctx.fillStyle = storm ? 'rgba(200,220,255,0.55)' : 'rgba(200,225,255,0.45)';
    const n = storm ? 140 : 80;
    for (let i = 0; i < n; i++) {
      const sp = 140 + (i * 37) % 60;
      const x = ((i * 53 + t * 36 * (storm ? 1.6 : 1)) % (VW + 40)) - 20, y = ((i * 29 + t * sp) % (VH + 30)) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, storm ? 5 : 4);
    }
    if (storm && Math.random() < 0.0015) { g.fx.flash = 0.6; g.audio.play('thunder'); }
  }
  _drawOverlays(ctx, g, ox, oy, VW, VH) {
    // map pings
    for (const p of g.fx.pings) {
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1; ctx.globalAlpha = Math.max(0, 1 - p.t / 2);
      ctx.beginPath(); ctx.arc(x, y, 4 + p.t * 14, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2 + p.t * 8, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      this.sprites.draw(ctx, 'ui_pin', x - 8, y - 24 + Math.round(Math.sin(p.t * 8) * 2));
    }
    // off-screen partner arrow
    if (g.partnerArrow) {
      const a = g.partnerArrow; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2a1f3d'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
}
