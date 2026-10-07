// Lighthouses (host side). Everything natural inside the circle of a lighthouse gives more when you gather it, grows back faster, and now and then a new
// resource pops up on a free tile of the land (never beside your buildings or on top of you). Overlapping lighthouses stack up: every lighthouse whose circle covers a tile adds its bonus (up to a generous limit).
import { TILE, TAU } from '../util.js';
import { BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { BIOMES } from '../data/biomes.js';
import { paceOf } from '../data/difficulty.js';

const NONE = { yield: 0, regrow: 1, n: 0 };
const centerOf = (t) => [t.x + t.w / 2, t.y + t.h / 2];

export const MAX_YIELD = 5, MAX_REGROW = 12; // however many lighthouses pile up: at most six times the drops and twelve times as fast
/**
 * what a set of lighthouses (things) gives at tile (tx, ty): { yield: extra share of the drops (0.5 = half more), regrow: how many times faster it grows back, n: how many cover it }.
 * They stack: the yields add up, and so do the extra speeds (two lighthouses that each make it 2x faster make it 3x faster).
 */
export function boostAt(things, tx, ty) {
  let y = 0, r = 0, n = 0;
  for (const t of things) {
    if (!t || t.dep) continue;
    const c = BUILD[t.type] && BUILD[t.type].conf;
    if (!c || !c.radius) continue;
    const [cx, cy] = centerOf(t);
    if (Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) > c.radius) continue;
    y += c.yield; r += c.regrow - 1; n++;
  }
  return n ? { yield: Math.min(MAX_YIELD, y), regrow: Math.min(MAX_REGROW, 1 + r), n } : NONE;
}
/** the same for the lighthouses standing in the world (host side) */
export function beaconAt(sim, tx, ty) {
  if (!sim.beaconIds || !sim.beaconIds.size) return NONE;
  const w = sim.world, list = [];
  for (const id of sim.beaconIds) list.push(w.things.get(id));
  return boostAt(list, tx, ty);
}

const isGrowable = (id) => { const nd = NODES[id]; return !!nd && nd.kind === 'node' && !/grass|tombstone/.test(id); };
/** natural resources (trees, rocks, bushes, flowers...: not the plain grass) standing inside a lighthouse's circle */
export function resourcesInCircle(w, t, radiusTiles) {
  const [cx, cy] = centerOf(t);
  let n = 0;
  for (const o of w.thingsNear(cx * TILE, cy * TILE, radiusTiles * TILE, (q) => isGrowable(q.type))) { if (o !== t) n++; }
  return n;
}

/** which things may pop up here: what the land's biome grows, without the plain grass and the grave stones */
function growable(w, tx, ty) {
  const b = w.biomeAtTile(tx, ty) || BIOMES.meadow;
  return b.res.filter(([id]) => isGrowable(id));
}

/** is this tile fine for a new resource: your land, open ground, nothing built close by, nobody standing there */
function openForGrowth(w, tx, ty) {
  if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) return false;
  if (w.placeProblem({ w: 1, h: 1, kind: 'thing' }, tx, ty)) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = tx + dx, y = ty + dy;
    if (!w.inb(x, y)) continue;
    const i = w.idx(x, y);
    if (w.floor[i] || w.wall[i] || w.occFlat[i]) return false;
    const o = w.occ[i];
    if (o) { const t = w.things.get(o); if (t && BUILD[t.type] && !BUILD[t.type].hidden) return false; } // a piece of yours next to it
  }
  for (const p of w.players.values()) if (p.online && Math.hypot(p.x - (tx + 0.5) * TILE, p.y - (ty + 0.5) * TILE) < 2.6 * TILE) return false;
  for (const m of w.mobs.values()) if (Math.hypot(m.x - (tx + 0.5) * TILE, m.y - (ty + 0.5) * TILE) < 1.5 * TILE) return false;
  return true;
}

/** the lighthouse works on its own: every so often (while someone is near) one new resource appears in its circle, up to a limit */
export function beaconTick(sim, t, d, dt) {
  const w = sim.world, c = d.conf, s = t.s;
  if (s.sp === undefined) s.sp = c.spawn * (0.3 + sim.rng.next() * 0.7);
  s.sp -= dt;
  if (s.sp > 0) return;
  s.sp = (c.spawn / paceOf(w.settings)) * (0.8 + sim.rng.next() * 0.4);
  const [cx, cy] = centerOf(t);
  let near = false; // nothing grows for nobody
  for (const p of w.players.values()) if (p.online && p.dead <= 0 && Math.hypot(p.x - cx * TILE, p.y - cy * TILE) < (c.radius + 12) * TILE) near = true;
  if (!near || resourcesInCircle(w, t, c.radius) >= c.cap) return;
  for (let k = 0; k < 14; k++) {
    const a = sim.rng.next() * TAU, r = 2 + sim.rng.next() * (c.radius - 2);
    const tx = Math.floor(cx + Math.cos(a) * r), ty = Math.floor(cy + Math.sin(a) * r);
    if (Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) > c.radius || !openForGrowth(w, tx, ty)) continue;
    const list = growable(w, tx, ty);
    if (!list.length) continue;
    const id = sim.rng.weighted(list), nd = NODES[id];
    w.addThing(id, tx, ty, { hp: nd.hp });
    w.fx('beaconspawn', (tx + 0.5) * TILE, (ty + 0.6) * TILE, 0);
    return;
  }
}

/** pressing E on a lighthouse: what it does for you */
export function beaconInfo(sim, p, t, d) {
  const c = d.conf, n = resourcesInCircle(sim.world, t, c.radius), here = beaconAt(sim, t.x, t.y);
  const stack = here.n > 1 ? ` Together with the other lighthouses around, it is ${Math.round(here.yield * 100)}% more and ${+here.regrow.toFixed(1)}x faster here (they stack up).` : '';
  sim.toast(p.pid, `${d.name}: gathering within ${c.radius} tiles gives ${Math.round(c.yield * 100)}% more and grows back ${c.regrow}x faster. ${n} resource${n === 1 ? '' : 's'} in the circle now, and new ones pop up (up to ${c.cap}).${stack}`, 'info');
}
