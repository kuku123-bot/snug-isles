// The authoritative simulation (runs on the host / in single player). Clients only mirror its results.
import { RNG, TILE, clamp, dist2, hash32, stochRound } from '../util.js';
import { World, LAND, PAD, thingDef, wallDefOf } from './world.js';
import { assignBiomes, genLand, seamFill, landPrice } from './worldgen.js';
import { goalsTick, bump } from './goals.js';
import { ensurePets } from './pets.js';
import { ITEMS } from '../data/items.js';
import { NODES } from '../data/nodes.js';
import { BUILD } from '../data/build.js';
import { BIOMES, GROUND_CODE } from '../data/biomes.js';
import { sanitizeSettings, START_KITS, DEFAULTS } from '../data/difficulty.js';
import { makePlayer, calcStats, touch, addXp, giveItem, syncSlots, HOTBAR } from './player.js';
import { invAdd } from './inventory.js';
import { updateMobs, spawnTick, updateProjectiles, hurtPlayer } from './combat.js';
import { updateMachines, MACHINE_BEHAVIORS } from './machines.js';
import { depleteNode } from './gather.js';
import { exec as execCommand } from './commands.js';
import { standUp, exitSpot, exitFrom } from './furniture.js';
import { nightness } from './daynight.js';

export const PICKUP_DELAY = 0.45;

export class Sim {
  constructor(world) {
    this.world = world;
    this.rng = new RNG((world.seed ^ 0x9e3779b9) >>> 0);
    this.depleted = new Set(); // ids of depleted nodes awaiting regrowth
    this.machineIds = new Set(); // ids of things that tick (processors, farms, drills...)
    this.acc = { slow: 0, cozy: 0, spawn: 0, weather: 0, doors: 0, goals: 0 };
    this.openDoors = new Map(); // tile idx -> seconds since someone was near
    this.sleepFade = 0;
    this.skipping = false;
    this.spawn = { x: 0, y: 0 };
    world.hooks.thingChanged = (t, why) => this._thingChanged(t, why);
  }

  // ------------------------------------------------------------------ creation
  static create(opts = {}) {
    const settings = sanitizeSettings(opts.settings || DEFAULTS);
    const seed = (opts.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : opts.seed) >>> 0;
    const gw = settings.worldSize;
    const world = new World({ gw, gh: gw, seed, settings });
    world.biomeMap = assignBiomes(gw, gw, seed);
    const sim = new Sim(world);
    const c = gw >> 1;
    world.biomeMap[c * gw + c] = 'meadow';
    sim.claimLand(c, c, true, true);
    const [ox, oy] = world.landOrigin(c, c);
    sim.spawn = { x: (ox + LAND / 2) * TILE, y: (oy + LAND / 2) * TILE };
    world.time = world.settings.dayLength * 0.12;
    world.shared.flags.created = Date.now();
    world.shared.flags.goals = [];
    world.shared.flags.age = 0; // seconds actually played: a brand-new world starts peaceful (see spawnTick)
    return sim;
  }

  /** Bring a land out of the sea: generate terrain + nodes. free => no price check. */
  claimLand(gx, gy, free = false, isStart = false) {
    const w = this.world;
    const gen = genLand(w, gx, gy, isStart);
    const fills = seamFill(w, gx, gy);
    w.setLandGround(gx, gy, gen.ground, gen.biome);
    for (const [tx, ty, code] of fills) { w.setGroundTile(tx, ty, code); w.emit(['g', w.idx(tx, ty), code]); }
    w.emit(['land', gx, gy, gen.biome, bytesToB64(gen.ground)]);
    const [ox, oy] = w.landOrigin(gx, gy);
    for (const t of gen.things) {
      const d = thingDef(t.type);
      const opts = {};
      if (d.kind === 'dig' || d.kind === 'treasure') opts.hp = 1;
      const th = w.addThing(t.type, ox + t.x, oy + t.y, opts);
      if (d.respawn) th.hp = d.hp;
    }
    w.fx('land', (ox + LAND / 2) * TILE, (oy + LAND / 2) * TILE, gx, gy);
    return gen;
  }

  priceOf(gx, gy, p) {
    const disc = p ? calcStats(this.world, p).landDiscount : 0;
    return landPrice(this.world, gx, gy, disc);
  }
  /** lands that can be bought: unowned and touching an owned land (4-neighbour) */
  buyableLands() {
    const w = this.world, out = [];
    for (let gy = 0; gy < w.gh; gy++) for (let gx = 0; gx < w.gw; gx++) {
      if (w.isLandOwned(gx, gy)) continue;
      if (w.isLandOwned(gx + 1, gy) || w.isLandOwned(gx - 1, gy) || w.isLandOwned(gx, gy + 1) || w.isLandOwned(gx, gy - 1)) out.push([gx, gy]);
    }
    return out;
  }

  // ------------------------------------------------------------------ players
  addPlayer(pid, name, look) {
    const w = this.world;
    let p = w.players.get(pid);
    if (p) { p.online = true; if (name) p.name = name.slice(0, 14); if (look) p.look = { ...p.look, ...look }; touch(p); return p; }
    p = makePlayer(w, pid, name, look);
    p.id = w.nextId++;
    p.x = this.spawn.x + (w.players.size % 2 ? 14 : -14);
    p.y = this.spawn.y;
    p.spawn = null;
    const kit = START_KITS[w.settings.startKit] || START_KITS.standard;
    for (const id in kit) if (kit[id] > 0) invAdd(p.inv, id, kit[id]);
    p.hp = calcStats(w, p).maxHp;
    w.players.set(pid, p);
    touch(p);
    if (w.players.size === 1 && w.settings.startKit !== 'bare') w.coins += w.settings.startKit === 'generous' ? 120 : 25;
    return p;
  }
  removePlayer(pid) { const p = this.world.players.get(pid); if (p) { standUp(this, p); p.online = false; } }

  toast(pid, text, kind = 'info') { this.world.tell(pid, { t: 'toast', text, kind }); }

  // ------------------------------------------------------------------ drops
  spawnDrop(item, n, x, y, o = {}) {
    if (n <= 0) return null;
    const w = this.world;
    const id = w.nextId++;
    const a = this.rng.next() * Math.PI * 2, r = o.exact ? 0 : 4 + this.rng.next() * 8;
    let dx = x + Math.cos(a) * r, dy = y + Math.sin(a) * r * 0.7;
    if (!w.boxFree(dx, dy, 2, 2, true) || (w.solid[w.idx(Math.floor(dx / TILE), Math.floor(dy / TILE))] & 1 && w.groundAt(Math.floor(dx / TILE), Math.floor(dy / TILE)) === 0)) { dx = x; dy = y; }
    const d = { id, item, n, x: dx, y: dy, ox: x, oy: y, age: 0, ttl: 600, pid: o.pid || null };
    w.drops.set(id, d);
    w.emit(['da', id, item, n, Math.round(x), Math.round(y), Math.round(dx), Math.round(dy)]);
    return d;
  }
  /** Give an item to the player (straight to bag); anything that doesn't fit is dropped. */
  award(p, item, n) {
    const left = giveItem(p, item, n);
    if (left > 0) this.spawnDrop(item, left, p.x, p.y - 4, { pid: p.pid });
    if (n - left > 0) this.world.fx('got', p.x, p.y - 12, item, n - left);
    return left;
  }

  updateDrops(dt) {
    const w = this.world;
    for (const d of w.drops.values()) {
      d.age += dt;
      d.ttl -= dt;
      if (d.ttl <= 0) { w.drops.delete(d.id); w.emit(['dr', d.id, 0]); continue; }
      if (d.age < PICKUP_DELAY) continue;
      for (const p of w.players.values()) {
        if (p.dead || !p.online) continue;
        const st = calcStats(w, p);
        const r = st.magnet;
        const dx = p.x - d.x, dy = p.y - 6 - d.y;
        if (dx * dx + dy * dy > r * r) continue;
        if (d.item === 'coin') {
          w.coins += d.n;
          w.emit(['coins', w.coins]);
        } else {
          const left = giveItem(p, d.item, d.n);
          if (left === d.n) { if (!d.warned) { d.warned = true; this.toast(p.pid, 'Bag is full!', 'warn'); } continue; }
          if (left > 0) { d.n = left; w.emit(['du', d.id, left]); w.fx('got', p.x, p.y - 12, d.item, d.n - left); continue; }
        }
        w.drops.delete(d.id);
        w.emit(['dr', d.id, p.id]);
        w.fx('got', p.x, p.y - 12, d.item, d.n);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ regrowth of nodes
  _thingChanged(t, why) {
    if (why === 'add') { const d = BUILD[t.type]; if (d && MACHINE_BEHAVIORS.has(d.behavior)) this.machineIds.add(t.id); }
    if (why === 'remove') { this.depleted.delete(t.id); this.machineIds.delete(t.id); }
    else if (t.dep && NODES[t.type] && NODES[t.type].respawn) this.depleted.add(t.id);
    else this.depleted.delete(t.id);
  }
  /** register depleted nodes after loading a save */
  rebuildDepleted() {
    this.depleted.clear();
    this.machineIds.clear();
    for (const t of this.world.things.values()) {
      if (t.dep && NODES[t.type] && NODES[t.type].respawn) this.depleted.add(t.id);
      const d = BUILD[t.type];
      if (d && MACHINE_BEHAVIORS.has(d.behavior)) this.machineIds.add(t.id);
    }
  }
  breakNodeAfterDrill(t, nd) { depleteNode(this, t, nd, 0); }
  updateRegrow(dt) {
    const w = this.world;
    const wet = w.shared.weather > 0 ? 1.4 : 1;
    for (const id of this.depleted) {
      const t = w.things.get(id);
      if (!t) { this.depleted.delete(id); continue; }
      t.t -= dt * wet;
      if (t.t <= 0) {
        // can't regrow on top of a player standing there? it only matters for solid ones; push nothing, just regrow
        const d = NODES[t.type];
        w.patchThing(id, { dep: 0, hp: d.hp });
        this.depleted.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ time, weather, sleep
  dayPhase() { return (this.world.time % this.world.settings.dayLength) / this.world.settings.dayLength; }
  nightness() { return nightness(this.dayPhase()); }
  isNight() { return this.nightness() > 0.6; }

  _weatherTick() {
    const w = this.world, s = w.settings;
    if (!s.weather) { w.shared.weather = 0; return; }
    const cur = w.shared.weather;
    if (cur === 0) {
      if (this.rng.chance(s.weather === 2 ? 0.34 : 0.17)) { w.shared.weather = 1; w.shared.storm = s.weather === 2 && this.rng.chance(0.5) ? 1 : 0; w.emit(['wx', 1, w.shared.storm]); }
    } else if (this.rng.chance(0.45)) { w.shared.weather = 0; w.shared.storm = 0; w.emit(['wx', 0, 0]); }
  }

  _sleepLogic(dt) {
    const w = this.world;
    const ps = [...w.players.values()].filter((p) => p.online && !p.dead);
    if (!ps.length) return;
    const need = w.settings.sleep === 'all' ? ps.every((p) => p.sleeping) : ps.some((p) => p.sleeping);
    const night = this.nightness() > 0.3;
    if (need && (night || this.skipping)) {
      this.skipping = true;
      w.time += dt * 36;
      if (this.nightness() < 0.05 && this.dayPhase() < 0.4) {
        this.skipping = false;
        for (const p of ps) {
          if (p.sleeping) { standUp(this, p); this.onWake(p); }
        }
        this.bump('slept');
        w.emit(['wake']);
      }
      return;
    }
    this.skipping = false;
  }
  onWake(p) {
    const w = this.world, st = calcStats(w, p);
    p.hp = st.maxHp; p.energy = st.maxEnergy; p.hunger = Math.max(p.hunger, 55);
    if (p.cozy >= 10) {
      p.buffs.cozy = { t: 300, pow: 1 };
      if (st.rested) p.buffs.xp = { t: 600, pow: 2 };
      this.toast(p.pid, 'You woke up feeling cozy and rested!', 'good');
    } else this.toast(p.pid, 'Good morning!', 'info');
    touch(p);
  }

  // ------------------------------------------------------------------ player upkeep
  updatePlayers(dt) {
    const w = this.world, s = w.settings;
    for (const p of w.players.values()) {
      if (!p.online) continue;
      const st = calcStats(w, p);
      p.cd = Math.max(0, p.cd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.shield = Math.max(0, p.shield - dt);
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) this.respawn(p);
        continue;
      }
      // whatever you were lying or sitting on is gone (taken apart by your partner, say): get up
      if ((p.sleeping && p.bed && !w.things.has(p.bed)) || (p.sit && p.sit.id && !w.things.has(p.sit.id))) standUp(this, p);
      // buffs
      for (const k in p.buffs) { p.buffs[k].t -= dt; if (p.buffs[k].t <= 0) { delete p.buffs[k]; p.stats = null; touch(p); } }
      // energy
      p.energy = Math.min(st.maxEnergy, p.energy + dt * 12);
      // hunger
      if (s.hunger) {
        p.hunger = Math.max(0, p.hunger - dt * (100 / (s.dayLength * 1.1)));
        if (p.hunger <= 0) { p.starve = (p.starve || 0) + dt; if (p.starve > 4) { p.starve = 0; hurtPlayer(this, p, 2, p.x, p.y, 'hunger'); } }
        else p.starve = 0;
      }
      // regeneration (slow; cozy rooms and campfires help)
      if (p.hp < st.maxHp && st.regenMul > 0 && !(s.hunger && p.hunger < 15)) {
        const cozy = p.cozy >= 25 ? 1 + 1.4 * st.cozyMul : p.cozy >= 10 ? 1 + 0.7 * st.cozyMul : 1;
        const rb = 0.22 + (p.sleeping ? 1.2 : 0) + (p.buffs.regen ? 0.45 * p.buffs.regen.pow : 0);
        p.regenAcc = (p.regenAcc || 0) + dt * rb * st.regenMul * cozy;
        if (p.regenAcc >= 1) { const k = Math.floor(p.regenAcc); p.regenAcc -= k; p.hp = Math.min(st.maxHp, p.hp + k); touch(p); }
      }
      if (p.hp > st.maxHp) { p.hp = st.maxHp; touch(p); }
      syncSlots(w, p);
      // fishing line state
      if (p.fish) this._fishTick(p, dt);
    }
  }

  respawn(p) {
    const w = this.world, st = calcStats(w, p);
    p.dead = 0; p.hp = st.maxHp; p.energy = st.maxEnergy; p.hunger = Math.max(p.hunger, 60);
    p.sleeping = false; p.sit = null; p.bed = 0; p.shield = 3;
    let sp = null;
    if (p.spawn) { const t = w.things.get(p.spawn.id); if (t) sp = exitFrom(w, t, [t.x, t.y]); } // beside the bed you set, never inside it
    if (!sp) sp = this.spawn;
    p.x = sp.x; p.y = sp.y; p.vx = p.vy = 0;
    w.tell(p.pid, { t: 'teleport', x: p.x, y: p.y });
    w.fx('poof', p.x, p.y, 1);
    touch(p);
  }

  // ------------------------------------------------------------------ cozy rooms (flood fill)
  computeCozy(p) {
    const w = this.world;
    let at = p;
    if (p.sleeping) at = exitSpot(w, p) || p; // lying in a (solid) bed: the room is the one you would step out into
    const sx = Math.floor(at.x / TILE), sy = Math.floor((at.y - 2) / TILE);
    if (!w.inb(sx, sy) || (w.solid[w.idx(sx, sy)] & 1)) { p.cozy = 0; p.room = 0; return; }
    const LIM = 260;
    const seen = new Set([w.idx(sx, sy)]);
    const q = [[sx, sy]];
    let open = false;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.inb(nx, ny)) { open = true; continue; }
        const i = w.idx(nx, ny);
        if (seen.has(i)) continue;
        if (w.solid[i] & 1) continue; // blocked (wall, water, solid thing)
        if (!w.isTileOwned(nx, ny) || w.ground[i] === 0) { open = true; continue; }
        seen.add(i);
        if (seen.size > LIM) { open = true; break; }
        q.push([nx, ny]);
      }
      if (open) break;
    }
    if (open || seen.size < 4) { p.cozy = 0; p.room = open ? 0 : seen.size; return; }
    // sum comfort of things inside/adjacent to the room and decor on its walls
    const st = calcStats(w, p);
    let score = 0;
    const counted = new Set();
    for (const i of seen) {
      const x = i % w.W, y = (i / w.W) | 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!w.inb(nx, ny)) continue;
        const ni = w.idx(nx, ny);
        const oid = w.occ[ni] || w.occFlat[ni];
        if (oid && !counted.has(oid)) {
          counted.add(oid);
          const t = w.things.get(oid);
          const d = t && BUILD[t.type];
          if (d && d.comfort) score += d.comfort;
        }
        if (dx || dy) {
          const dc = w.deco[ni];
          if (dc && !counted.has('d' + ni)) { counted.add('d' + ni); score += 1; }
        }
      }
      if (w.floor[i]) score += 0.15;
    }
    p.cozy = Math.round(score * st.comfortMul);
    p.room = seen.size;
  }

  // ------------------------------------------------------------------ doors
  updateDoors(dt) {
    const w = this.world;
    // open when someone walks into a closed door; close when nobody is near
    for (const p of w.players.values()) {
      if (!p.online || p.dead) continue;
      const ix = p.ix || 0, iy = p.iy || 0;
      if (!ix && !iy) continue;
      const px = p.x + Math.sign(ix) * 8, py = p.y - 3 + Math.sign(iy) * 6;
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      for (const [x, y] of [[tx, ty], [Math.floor((p.x + Math.sign(ix) * 8) / TILE), Math.floor((p.y - 3) / TILE)]]) {
        if (!w.inb(x, y)) continue;
        const i = w.idx(x, y), wc = w.wall[i];
        if (wc && !w.wallState[i]) {
          const d = wallDefOf(wc);
          if (d.piece === 'door' || d.piece === 'gate') { w.setWallState(x, y, 1); this.openDoors.set(i, 0); w.fx('door', (x + 0.5) * TILE, (y + 0.5) * TILE, 1); }
        }
      }
    }
    for (const [i, t] of this.openDoors) {
      const x = i % w.W, y = (i / w.W) | 0;
      let near = false;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      for (const p of w.players.values()) if (p.online && !p.dead && Math.abs(p.x - cx) < 14 && Math.abs(p.y - 4 - cy) < 16) near = true;
      if (!near) for (const m of w.mobs.values()) if (Math.abs(m.x - cx) < 12 && Math.abs(m.y - cy) < 12) { near = true; break; }
      if (near) { this.openDoors.set(i, 0); continue; }
      const nt = t + dt;
      if (nt > 0.9) {
        this.openDoors.delete(i);
        if (w.wall[i]) { w.setWallState(x, y, 0); w.fx('door', cx, cy, 0); }
      } else this.openDoors.set(i, nt);
    }
  }

  // ------------------------------------------------------------------ fishing
  _fishTick(p, dt) {
    const f = p.fish, w = this.world;
    const st = calcStats(w, p);
    if (Math.hypot(p.x - f.x, p.y - f.y) > 130 || p.dead) { p.fish = null; w.fx('fishend', f.x, f.y, 0); return; }
    f.t += dt;
    if (f.state === 'wait' && f.t >= f.biteAt) { f.state = 'bite'; f.t = 0; w.fx('bite', f.x, f.y, p.id); }
    else if (f.state === 'bite' && f.t > 1.3) { p.fish = null; w.fx('fishend', f.x, f.y, 1); this.toast(p.pid, 'It got away...', 'info'); }
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    dt = Math.min(dt, 0.1);
    const w = this.world;
    this._sleepLogic(dt);
    if (!this.skipping) w.time += dt;
    const day = Math.floor(w.time / w.settings.dayLength);
    if (day !== w.day) { w.day = day; w.emit(['day', day]); this.onNewDay(); }
    this.updatePlayers(dt);
    this.updateDrops(dt);
    this.updateRegrow(dt);
    this.updateDoors(dt);
    updateMachines(this, dt);
    if (!this.skipping) {
      updateMobs(this, dt);
      updateProjectiles(this, dt);
      this.acc.spawn += dt;
      if (this.acc.spawn > 1.2) { this.acc.spawn = 0; spawnTick(this); }
    }
    this.acc.cozy += dt;
    if (this.acc.cozy > 1) {
      this.acc.cozy = 0;
      for (const p of w.players.values()) if (p.online && !p.dead) { const old = p.cozy; this.computeCozy(p); if (old !== p.cozy) touch(p); }
    }
    if (w.shared.flags.age !== undefined && !this.skipping) { for (const p of w.players.values()) if (p.online) { w.shared.flags.age += dt; break; } }
    this.acc.goals += dt;
    if (this.acc.goals > 1.5) { this.acc.goals = 0; goalsTick(this); ensurePets(this); }
    this.acc.weather += dt;
    if (this.acc.weather > 75) { this.acc.weather = 0; this._weatherTick(); }
  }

  onNewDay() {
    const w = this.world;
    // market prices drift daily
    const m = {};
    const r = new RNG(hash32(w.seed, w.day, 5));
    for (const id of ['wood', 'stone', 'berries', 'fiber', 'copper_ingot', 'iron_ingot', 'gold_ingot', 'honey', 'egg', 'milk', 'plank', 'glass', 'brick']) m[id] = Math.round((0.8 + r.next() * 0.7) * 100) / 100;
    w.shared.market = m;
    w.emit(['market', m]);
  }

  bump(key, n = 1) { bump(this, key, n); }

  // ------------------------------------------------------------------ commands
  exec(pid, cmd) { return execCommand(this, pid, cmd); }

  // convenience for hosts
  playerList() { return [...this.world.players.values()]; }
}

export function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
export function b64ToBytes(b64) {
  const s = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
