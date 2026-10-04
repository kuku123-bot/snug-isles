// World state: tile layers, things (resources/structures/furniture), mobs, drops, players and shared progress.
// All mutations go through the mutator methods below so they can be replicated to the other player as events.
import { TILE } from '../util.js';
import { BUILD, WALL_IDS, FLOOR_IDS, WALLDECO_IDS } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { BIOMES, GROUND_IDS } from '../data/biomes.js';

export const LAND = 20; // tiles per land side
export const PAD = 6; // water margin around the land grid

const WALL_DEFS = [null, ...WALL_IDS.map((id) => BUILD[id])];
const FLOOR_DEFS = [null, ...FLOOR_IDS.map((id) => BUILD[id])];
const DECO_DEFS = [null, ...WALLDECO_IDS.map((id) => BUILD[id])];
export const wallDefOf = (code) => WALL_DEFS[code];
export const floorDefOf = (code) => FLOOR_DEFS[code];
export const decoDefOf = (code) => DECO_DEFS[code];
export const wallCodeOf = (id) => WALL_IDS.indexOf(id) + 1;
export const floorCodeOf = (id) => FLOOR_IDS.indexOf(id) + 1;
export const decoCodeOf = (id) => WALLDECO_IDS.indexOf(id) + 1;

export const thingDef = (type) => NODES[type] || BUILD[type] || null;

/** blocks movement? doors/gates only when closed */
export function wallBlocks(code, state) {
  const d = WALL_DEFS[code];
  if (!d) return false;
  if (d.piece === 'door' || d.piece === 'gate') return !state;
  return true;
}

export class World {
  constructor(o = {}) {
    this.gw = o.gw || 9;
    this.gh = o.gh || this.gw;
    this.W = this.gw * LAND + PAD * 2;
    this.H = this.gh * LAND + PAD * 2;
    const n = this.W * this.H;
    this.seed = o.seed >>> 0;
    this.settings = o.settings || {};
    this.ground = new Uint8Array(n);
    this.floor = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.wallState = new Uint8Array(n);
    this.deco = new Uint8Array(n);
    this.occ = new Int32Array(n); // thing id covering the tile (solid-ish things and nodes)
    this.occFlat = new Int32Array(n); // flat decor (rugs) id
    this.solid = new Uint8Array(n).fill(1); // bit0 blocks walkers, bit1 blocks flyers (everything starts as open sea = blocked)
    this.owned = new Uint8Array(this.gw * this.gh);
    this.biomeMap = new Array(this.gw * this.gh).fill('meadow');
    this.things = new Map();
    this.mobs = new Map();
    this.drops = new Map();
    this.projs = new Map();
    this.players = new Map(); // pid -> player
    this.buckets = new Map(); // spatial buckets of thing ids
    this.nextId = 1;
    this.time = 0; // world seconds
    this.day = 0;
    this.coins = 0;
    this.techs = new Set();
    this.shared = { weather: 0, wetUntil: 0, bossUp: null, market: {}, flags: {} };
    this.rev = 0; // bumped on structural changes (UI refresh)
    this.landRev = 0;
    // replication
    this.record = false;
    this.events = [];
    this.hooks = { fx: null, tell: null, thingChanged: null };
    this.tileDirty = []; // indices to re-render (renderer consumes)
  }

  // ---------------------------------------------------------------- coordinates
  idx(x, y) { return y * this.W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  landOf(tx, ty) {
    const gx = Math.floor((tx - PAD) / LAND), gy = Math.floor((ty - PAD) / LAND);
    if (gx < 0 || gy < 0 || gx >= this.gw || gy >= this.gh) return null;
    return [gx, gy];
  }
  landIndex(gx, gy) { return gy * this.gw + gx; }
  isLandOwned(gx, gy) { return gx >= 0 && gy >= 0 && gx < this.gw && gy < this.gh && this.owned[gy * this.gw + gx] === 1; }
  isTileOwned(tx, ty) { const l = this.landOf(tx, ty); return !!l && this.owned[l[1] * this.gw + l[0]] === 1; }
  landOrigin(gx, gy) { return [PAD + gx * LAND, PAD + gy * LAND]; }
  pxW() { return this.W * TILE; }
  pxH() { return this.H * TILE; }
  groundAt(tx, ty) { return this.inb(tx, ty) ? this.ground[this.idx(tx, ty)] : 0; }
  isLand(tx, ty) { return this.inb(tx, ty) && this.ground[this.idx(tx, ty)] !== 0; }
  isWalkableGround(tx, ty) { return this.inb(tx, ty) && (this.solid[this.idx(tx, ty)] & 1) === 0; }
  hasBridge(i) { const f = this.floor[i]; return f !== 0 && FLOOR_DEFS[f].water === true; }

  // ---------------------------------------------------------------- events
  emit(ev) { if (this.record) this.events.push(ev); }
  fx(kind, x, y, a, b, c) {
    if (this.hooks.fx) this.hooks.fx(kind, x, y, a, b, c);
    if (this.record) this.events.push(['fx', kind, Math.round(x * 10) / 10, Math.round(y * 10) / 10, a === undefined ? 0 : a, b === undefined ? 0 : b, c === undefined ? 0 : c]);
  }
  /** message/ui event for one player */
  tell(pid, ev) { if (this.hooks.tell) this.hooks.tell(pid, ev); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------------------------------------------------------------- tile recompute
  recalcSolid(i) {
    let s = 0;
    if (this.ground[i] === 0 && !this.hasBridge(i)) s |= 1;
    const wc = this.wall[i];
    if (wc && wallBlocks(wc, this.wallState[i])) s |= 3;
    const oid = this.occ[i];
    if (oid) {
      const t = this.things.get(oid);
      if (t && this.thingSolid(t)) s |= 1;
    }
    this.solid[i] = s;
  }
  thingSolid(t) {
    const d = thingDef(t.type);
    if (!d) return false;
    if (t.dep) return false;
    return d.solid !== false;
  }

  setGroundTile(x, y, g) {
    const i = this.idx(x, y);
    this.ground[i] = g;
    this.recalcSolid(i);
    this.tileDirty.push(i);
  }
  /** set a whole land's ground from a Uint8Array(LAND*LAND) and mark it owned */
  setLandGround(gx, gy, arr, biome) {
    const [ox, oy] = this.landOrigin(gx, gy);
    for (let y = 0; y < LAND; y++) for (let x = 0; x < LAND; x++) this.setGroundTile(ox + x, oy + y, arr[y * LAND + x]);
    this.owned[this.landIndex(gx, gy)] = 1;
    if (biome) this.biomeMap[this.landIndex(gx, gy)] = biome;
    // repaint neighbours too (shoreline edges change)
    for (let y = -1; y <= LAND; y++) for (let x = -1; x <= LAND; x++) { if (this.inb(ox + x, oy + y)) this.tileDirty.push(this.idx(ox + x, oy + y)); }
    this.landRev++; this.rev++;
  }

  setFloor(x, y, code, silent = false) {
    const i = this.idx(x, y);
    if (this.floor[i] === code) return;
    this.floor[i] = code;
    this.recalcSolid(i);
    this.tileDirty.push(i);
    this.rev++;
    if (!silent) this.emit(['f', i, code]);
  }
  setWall(x, y, code, state = 0, silent = false) {
    const i = this.idx(x, y);
    this.wall[i] = code;
    this.wallState[i] = code ? state : 0;
    if (!code) this.deco[i] = 0;
    this.recalcSolid(i);
    this.tileDirty.push(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inb(x + dx, y + dy)) this.tileDirty.push(this.idx(x + dx, y + dy));
    this.rev++;
    if (!silent) this.emit(['w', i, code, this.wallState[i]]);
  }
  setWallState(x, y, state, silent = false) {
    const i = this.idx(x, y);
    this.wallState[i] = state;
    this.recalcSolid(i);
    this.tileDirty.push(i);
    if (!silent) this.emit(['w', i, this.wall[i], state]);
  }
  setDeco(x, y, code, silent = false) {
    const i = this.idx(x, y);
    this.deco[i] = code;
    this.tileDirty.push(i);
    this.rev++;
    if (!silent) this.emit(['d', i, code]);
  }

  // ---------------------------------------------------------------- things
  bucketKey(bx, by) { return by * 4096 + bx; }
  _bucketAdd(t) {
    for (let y = t.y >> 3; y <= (t.y + t.h - 1) >> 3; y++) for (let x = t.x >> 3; x <= (t.x + t.w - 1) >> 3; x++) {
      const k = this.bucketKey(x, y);
      let b = this.buckets.get(k);
      if (!b) { b = new Set(); this.buckets.set(k, b); }
      b.add(t.id);
    }
  }
  _bucketDel(t) {
    for (let y = t.y >> 3; y <= (t.y + t.h - 1) >> 3; y++) for (let x = t.x >> 3; x <= (t.x + t.w - 1) >> 3; x++) {
      const b = this.buckets.get(this.bucketKey(x, y));
      if (b) b.delete(t.id);
    }
  }
  /** Create a thing. opts: {id?, flip, hp, s, dep, silent}. */
  addThing(type, x, y, opts = {}) {
    const d = thingDef(type);
    if (!d) throw new Error('unknown thing ' + type);
    const id = opts.id || this.nextId++;
    if (id >= this.nextId) this.nextId = id + 1;
    const t = { id, type, x, y, w: d.w || 1, h: d.h || 1, flip: opts.flip ? 1 : 0, hp: opts.hp !== undefined ? opts.hp : (d.hp || 0), dep: opts.dep ? 1 : 0, s: opts.s || null, t: 0 };
    this.things.set(id, t);
    const flat = d.kind === 'flat';
    for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) {
      const i = this.idx(x + xx, y + yy);
      if (flat) this.occFlat[i] = id; else { this.occ[i] = id; this.recalcSolid(i); }
      this.tileDirty.push(i);
    }
    this._bucketAdd(t);
    this.rev++;
    if (!opts.silent) this.emit(['ta', id, type, x, y, t.flip, t.hp, t.dep, t.s]);
    if (this.hooks.thingChanged) this.hooks.thingChanged(t, 'add');
    return t;
  }
  removeThing(id, silent = false) {
    const t = this.things.get(id);
    if (!t) return null;
    const d = thingDef(t.type);
    const flat = d && d.kind === 'flat';
    for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) {
      const i = this.idx(t.x + xx, t.y + yy);
      if (flat) { if (this.occFlat[i] === id) this.occFlat[i] = 0; } else if (this.occ[i] === id) { this.occ[i] = 0; }
      this.things.delete(id);
      this.recalcSolid(i);
      this.tileDirty.push(i);
    }
    this.things.delete(id);
    this._bucketDel(t);
    this.rev++;
    if (!silent) this.emit(['tr', id]);
    if (this.hooks.thingChanged) this.hooks.thingChanged(t, 'remove');
    return t;
  }
  /** patch fields of a thing: {hp, dep, s, flip}. Replicated. */
  patchThing(id, patch, silent = false) {
    const t = this.things.get(id);
    if (!t) return null;
    let solidChange = false;
    if (patch.hp !== undefined) t.hp = patch.hp;
    if (patch.dep !== undefined) { if (!!patch.dep !== !!t.dep) solidChange = true; t.dep = patch.dep ? 1 : 0; }
    if (patch.s !== undefined) t.s = patch.s;
    if (patch.flip !== undefined) t.flip = patch.flip ? 1 : 0;
    if (solidChange) {
      const d = thingDef(t.type);
      if (!(d && d.kind === 'flat')) for (let yy = 0; yy < t.h; yy++) for (let xx = 0; xx < t.w; xx++) this.recalcSolid(this.idx(t.x + xx, t.y + yy));
    }
    this.rev++;
    if (!silent) this.emit(['tu', id, patch]);
    if (this.hooks.thingChanged) this.hooks.thingChanged(t, 'patch');
    return t;
  }
  thingAt(tx, ty) { const id = this.occ[this.idx(tx, ty)]; return id ? this.things.get(id) : null; }
  flatAt(tx, ty) { const id = this.occFlat[this.idx(tx, ty)]; return id ? this.things.get(id) : null; }
  /** things whose footprint intersects the tile rect */
  thingsInRect(x0, y0, x1, y1, out = []) {
    for (let by = y0 >> 3; by <= y1 >> 3; by++) for (let bx = x0 >> 3; bx <= x1 >> 3; bx++) {
      const b = this.buckets.get(this.bucketKey(bx, by));
      if (!b) continue;
      for (const id of b) {
        const t = this.things.get(id);
        if (t && t.x <= x1 && t.x + t.w - 1 >= x0 && t.y <= y1 && t.y + t.h - 1 >= y0 && !out.includes(t)) out.push(t);
      }
    }
    return out;
  }
  /** things within pixel radius r of a point (by footprint center) */
  thingsNear(px, py, r, filter) {
    const out = [];
    const tx0 = Math.floor((px - r) / TILE) - 1, ty0 = Math.floor((py - r) / TILE) - 1, tx1 = Math.floor((px + r) / TILE) + 1, ty1 = Math.floor((py + r) / TILE) + 1;
    const seen = new Set();
    for (let by = Math.max(0, ty0) >> 3; by <= Math.max(0, ty1) >> 3; by++) for (let bx = Math.max(0, tx0) >> 3; bx <= Math.max(0, tx1) >> 3; bx++) {
      const b = this.buckets.get(this.bucketKey(bx, by));
      if (!b) continue;
      for (const id of b) {
        if (seen.has(id)) continue;
        seen.add(id);
        const t = this.things.get(id);
        if (!t) continue;
        const cx = (t.x + t.w / 2) * TILE, cy = (t.y + t.h / 2) * TILE;
        const dx = cx - px, dy = cy - py;
        if (dx * dx + dy * dy <= r * r && (!filter || filter(t))) out.push(t);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- placement rules
  /**
   * Can this blueprint be placed here? Returns null if OK, else a short reason string.
   * Walls/floors/deco have single-tile footprints.
   */
  placeProblem(def, tx, ty) {
    const w = def.w || 1, h = def.h || 1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const x = tx + xx, y = ty + yy;
      if (!this.inb(x, y)) return 'Out of bounds';
      const i = this.idx(x, y);
      if (!this.isTileOwned(x, y)) return 'Not your land yet';
      const g = this.ground[i];
      const onWater = g === 0;
      if (def.kind === 'floor') {
        if (def.water) { if (!onWater) return 'Bridges go over water'; }
        else if (onWater && !this.hasBridge(i)) return 'Needs solid ground';
        if (this.occ[i] && this.thingSolid(this.things.get(this.occ[i]))) return 'Something is in the way';
        continue;
      }
      if (def.kind === 'walldeco') {
        if (!this.wall[i]) return 'Hang it on a wall';
        const wd = WALL_DEFS[this.wall[i]];
        if (wd.piece === 'fence' || wd.piece === 'gate') return 'Needs a full wall';
        if (this.deco[i]) return 'Already decorated';
        continue;
      }
      if (def.water) {
        if (!onWater) return 'Place on water next to land';
        if (this.floor[i]) return 'Not on a bridge';
        if (this.occ[i]) return 'Occupied';
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.isLand(x + dx, y + dy)) near = true;
        if (!near) return 'Must touch land';
        continue;
      }
      if (onWater && !this.hasBridge(i)) return 'Needs solid ground';
      if (this.wall[i]) return 'A wall is there';
      if (def.kind === 'flat') { if (this.occFlat[i]) return 'Another rug is there'; continue; }
      if (this.occ[i]) {
        const o = this.things.get(this.occ[i]);
        if (def.kind === 'wall') { if (o && this.thingSolid(o)) return 'Something is in the way'; }
        else return 'Occupied';
      }
    }
    return null;
  }
  /** Does any entity (player/mob) overlap this tile rect? Used to avoid walling someone in. */
  entityBlocks(tx, ty, w, h, ignorePid) {
    const x0 = tx * TILE, y0 = ty * TILE, x1 = (tx + w) * TILE, y1 = (ty + h) * TILE;
    for (const p of this.players.values()) {
      if (p.pid === ignorePid || p.dead) continue;
      if (p.x > x0 - 4 && p.x < x1 + 4 && p.y > y0 - 2 && p.y < y1 + 5) return true;
    }
    for (const m of this.mobs.values()) {
      if (m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- collision (pixel space)
  /** Is the box centered (x,y) with half-size (hw,hh) free for a walker/flyer? */
  boxFree(x, y, hw, hh, flyer = false) {
    const mask = flyer ? 2 : 1;
    const tx0 = Math.floor((x - hw) / TILE), tx1 = Math.floor((x + hw - 0.001) / TILE);
    const ty0 = Math.floor((y - hh) / TILE), ty1 = Math.floor((y + hh - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.inb(tx, ty)) return false;
      if (this.solid[ty * this.W + tx] & mask) return false;
    }
    return true;
  }
  /** Move a box with axis separation; returns {x, y, hitX, hitY}. */
  moveBox(x, y, dx, dy, hw, hh, flyer = false) {
    let hitX = false, hitY = false;
    // step in small increments so we never tunnel through 1-tile walls at high speed
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) { if (this.boxFree(x + sx, y, hw, hh, flyer)) x += sx; else hitX = true; }
      if (sy !== 0) { if (this.boxFree(x, y + sy, hw, hh, flyer)) y += sy; else hitY = true; }
    }
    return { x, y, hitX, hitY };
  }

  // ---------------------------------------------------------------- misc queries
  nearestStationDist(px, py, stationKey, maxPx) {
    let best = Infinity;
    for (const t of this.thingsNear(px, py, maxPx)) {
      const d = BUILD[t.type];
      if (d && d.behavior === 'station' && d.conf.station === stationKey) {
        const dd = Math.hypot((t.x + t.w / 2) * TILE - px, (t.y + t.h / 2) * TILE - py);
        if (dd < best) best = dd;
      }
    }
    return best;
  }
  biomeOfLand(gx, gy) { return BIOMES[this.biomeMap[this.landIndex(gx, gy)]] || BIOMES.meadow; }
  biomeAtTile(tx, ty) { const l = this.landOf(tx, ty); return l ? this.biomeOfLand(l[0], l[1]) : BIOMES.meadow; }
  ownedCount() { let n = 0; for (const o of this.owned) n += o; return n; }
  hasTech(id) { return this.techs.has(id); }
  groundName(tx, ty) { return GROUND_IDS[this.groundAt(tx, ty)]; }
}
