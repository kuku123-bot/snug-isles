// World <-> plain JSON. Used for saves (IndexedDB), for joining players (network snapshot) and for the world backup copy.
import { World, LAND } from './world.js';
import { Sim, bytesToB64, b64ToBytes } from './sim.js';
import { sanitizeSettings } from '../data/difficulty.js';
import { WALL_IDS, FLOOR_IDS, WALLDECO_IDS, BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { GROUND_IDS } from '../data/biomes.js';
import { makeInv } from './inventory.js';
import { calcStats } from './player.js';

export const SAVE_VERSION = 1;

const sparse = (arr, state) => {
  const out = [];
  for (let i = 0; i < arr.length; i++) if (arr[i]) out.push(state ? [i, arr[i], state[i]] : [i, arr[i]]);
  return out;
};

export function serializePlayer(p) {
  return {
    pid: p.pid, id: p.id, name: p.name, look: p.look, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, hp: p.hp, energy: Math.round(p.energy), hunger: Math.round(p.hunger),
    inv: p.inv, equip: p.equip, sel: p.sel, xp: Math.round(p.xp * 10) / 10, level: p.level, sp: p.sp, skills: p.skills, buffs: p.buffs, spawn: p.spawn, windDay: p.windDay || 0, pet: p.pet || null,
  };
}

/** Full world state. opts.forNet strips nothing but marks the snapshot kind. */
export function serializeWorld(sim) {
  const w = sim.world;
  const things = [];
  for (const t of w.things.values()) things.push([t.id, t.type, t.x, t.y, t.flip, Math.round(t.hp * 10) / 10, t.dep, t.s, Math.round(t.t || 0)]);
  const drops = [];
  for (const d of w.drops.values()) drops.push([d.id, d.item, d.n, Math.round(d.x), Math.round(d.y), Math.round(d.ttl)]);
  return {
    v: SAVE_VERSION, seed: w.seed, gw: w.gw, settings: w.settings, time: w.time, day: w.day, coins: w.coins, techs: [...w.techs], shared: w.shared, nextId: w.nextId,
    spawn: sim.spawn, biomeMap: w.biomeMap, owned: bytesToB64(w.owned), ground: bytesToB64(w.ground),
    wallIds: WALL_IDS, floorIds: FLOOR_IDS, decoIds: WALLDECO_IDS, groundIds: GROUND_IDS,
    floor: sparse(w.floor), wall: sparse(w.wall, w.wallState), deco: sparse(w.deco),
    things, drops, players: [...w.players.values()].map(serializePlayer),
  };
}

function remapCode(oldIds, newIds, code) {
  if (!code) return 0;
  const id = oldIds[code - 1];
  const n = newIds.indexOf(id);
  return n + 1; // 0 if unknown
}

/** Rebuild a World (and optionally a Sim around it) from serialized data. */
export function restoreWorld(data, { withSim = true } = {}) {
  if (!data || typeof data !== 'object' || !(data.gw >= 3 && data.gw <= 15)) throw new Error('unreadable world data');
  if (data.v > SAVE_VERSION) throw new Error('This world was saved by a newer version of the game.');
  const settings = sanitizeSettings(data.settings);
  const world = new World({ gw: data.gw, gh: data.gw, seed: data.seed, settings });
  world.biomeMap = data.biomeMap;
  world.time = data.time; world.day = data.day; world.coins = data.coins;
  world.techs = new Set(data.techs);
  world.shared = Object.assign({ weather: 0, wetUntil: 0, bossUp: null, market: {}, flags: {} }, data.shared || {});
  world.shared.bossUp = null; // bosses are not persisted
  world.nextId = data.nextId || 1;
  const ownedB = b64ToBytes(data.owned);
  if (ownedB.length !== world.owned.length) throw new Error('damaged land ownership layer');
  world.owned.set(ownedB);
  const g = b64ToBytes(data.ground);
  if (g.length !== world.ground.length) throw new Error('damaged ground layer');
  // ground ids may have been reordered between versions: remap by name
  const gmap = data.groundIds ? data.groundIds.map((id) => GROUND_IDS.indexOf(id)) : null;
  for (let i = 0; i < g.length && i < world.ground.length; i++) world.ground[i] = gmap ? Math.max(0, gmap[g[i]] ?? 0) : g[i];
  for (const [i, c] of data.floor || []) world.floor[i] = remapCode(data.floorIds || FLOOR_IDS, FLOOR_IDS, c);
  for (const [i, c, st] of data.wall || []) { world.wall[i] = remapCode(data.wallIds || WALL_IDS, WALL_IDS, c); world.wallState[i] = st || 0; }
  for (const [i, c] of data.deco || []) world.deco[i] = remapCode(data.decoIds || WALLDECO_IDS, WALLDECO_IDS, c);
  for (let i = 0; i < world.ground.length; i++) world.recalcSolid(i);
  world.landRev++; world.rev++;
  for (const t of data.things || []) {
    const [id, type, x, y, flip, hp, dep, s, tt] = t;
    if (!NODES[type] && !BUILD[type]) continue; // unknown (removed) content
    const th = world.addThing(type, x, y, { id, flip, hp, dep, s, silent: true });
    th.t = tt || 0;
  }
  for (const d of data.drops || []) { const [id, item, n, x, y, ttl] = d; world.drops.set(id, { id, item, n, x, y, ox: x, oy: y, age: 5, ttl: ttl || 300 }); }
  for (const pd of data.players || []) {
    const p = { ...pd, vx: 0, vy: 0, dir: 0, face: 1, dead: 0, sleeping: false, sit: null, online: false, cd: 0, dashCd: 0, fish: null, cozy: 0, shield: 0, stats: null, rev: 1, buffs: pd.buffs || {}, skills: pd.skills || {}, equip: pd.equip || { head: null, body: null, feet: null, charm: null } };
    world.players.set(p.pid, p);
  }
  world.tileDirty.length = 0;
  if (!withSim) return { world, sim: null };
  const sim = new Sim(world);
  sim.spawn = data.spawn || sim.spawn;
  sim.rebuildDepleted();
  return { world, sim };
}

/** short summary stored beside the save for the world list */
export function saveMeta(sim, extra = {}) {
  const w = sim.world;
  return { lands: w.ownedCount(), day: w.day + 1, coins: w.coins, techs: w.techs.size, players: [...w.players.values()].map((p) => ({ name: p.name, level: p.level, look: p.look })), updated: Date.now(), ...extra };
}
