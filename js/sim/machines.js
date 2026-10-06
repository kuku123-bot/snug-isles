// Machines: furnaces/mills, farms, animal pens/bees/traps, drills, turrets. Host-side ticking.
import { TILE } from '../util.js';
import { BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { MOBS } from '../data/mobs.js';
import { ITEMS, fuelValue } from '../data/items.js';
import { PROCESS, PROC_CHAIN, PROC_SPEED } from '../data/recipes.js';
import { CROPS, cropStage } from '../data/crops.js';
import { invAdd, stackMax, invCount } from './inventory.js';
import { shoot } from './combat.js';
import { lootFish } from './loot.js';
import { calcStats, techFx, skillFx } from './player.js';
import { rollNodeDrops } from './gather.js';

export const MACHINE_BEHAVIORS = new Set(['processor', 'farm', 'producer', 'drill', 'turret', 'sprinkler']);

export function newState(behavior, conf) {
  switch (behavior) {
    case 'processor': return { inp: null, fuel: null, out: null, heat: 0, prog: 0, w: 0 };
    case 'farm': return { c: null, g: 0, st: 0, by: null };
    case 'producer': return { feed: 0, stock: 0, p: 0, by: null };
    case 'drill': return { heat: 0, t: 0, buf: [], w: 0 };
    case 'turret': return { ammo: 0, t: 0 };
    case 'storage': return { inv: new Array((conf && conf.slots) || 20).fill(null) };
    default: return {};
  }
}
/** extra slots every chest, barrel and cupboard gets: the best Warehouse Keeper of anyone in the world (plus any technology that adds some) */
export function storageBonus(world) {
  let skill = 0;
  for (const p of world.players.values()) skill = Math.max(skill, skillFx(p, 'chestSlots'));
  return Math.round(skill + techFx(world, 'chestSlots'));
}
/** top up storage to its normal size + the bonus (only ever grows, so nothing is lost). `only` = just that one thing. Returns true if anything grew. */
export function growStorage(world, only) {
  const bonus = storageBonus(world);
  if (bonus <= 0) return false;
  let changed = false;
  for (const t of only ? [only] : world.things.values()) {
    const d = BUILD[t.type];
    if (!d || d.behavior !== 'storage' || (d.conf && d.conf.grave) || !t.s || !t.s.inv) continue;
    const want = ((d.conf && d.conf.slots) || 20) + bonus;
    if (t.s.inv.length >= want) continue;
    while (t.s.inv.length < want) t.s.inv.push(null);
    world.patchThing(t.id, { s: t.s });
    changed = true;
  }
  return changed;
}
export function ensureState(t) {
  const d = BUILD[t.type];
  if (!d) return null;
  if (!t.s || (d.behavior === 'storage' && !t.s.inv)) t.s = newState(d.behavior, d.conf);
  return t.s;
}

/** First storage thing touching the footprint of t (4-neighbour). */
export function adjacentStorage(w, t) {
  for (let yy = -1; yy <= t.h; yy++) for (let xx = -1; xx <= t.w; xx++) {
    const edge = (xx === -1 || xx === t.w) !== (yy === -1 || yy === t.h);
    if (!edge) continue;
    const x = t.x + xx, y = t.y + yy;
    if (!w.inb(x, y)) continue;
    const o = w.thingAt(x, y);
    if (o && o !== t) { const d = BUILD[o.type]; if (d && d.behavior === 'storage' && !d.conf.grave) return o; }
  }
  return null;
}

function sprinklerBoost(sim, t) {
  let boost = 1;
  for (const o of sim.world.thingsNear((t.x + 0.5) * TILE, (t.y + 0.5) * TILE, 3.6 * TILE)) {
    const d = BUILD[o.type];
    if (d && d.behavior === 'sprinkler') boost = Math.max(boost, d.conf.boost);
  }
  return boost;
}

const procCache = new Map();
function recipesFor(w, kind) {
  const key = kind + ':' + w.techs.size;
  let r = procCache.get(key);
  if (!r) {
    const chain = PROC_CHAIN[kind];
    r = PROCESS.filter((p) => chain.includes(p.kind) && w.techs.has(p.tech));
    procCache.clear();
    procCache.set(key, r);
  }
  return r;
}
export const processRecipes = recipesFor;

export function updateMachines(sim, dt) {
  const w = sim.world;
  for (const id of sim.machineIds) {
    const t = w.things.get(id);
    if (!t) { sim.machineIds.delete(id); continue; }
    const d = BUILD[t.type];
    if (!d) continue;
    ensureState(t);
    switch (d.behavior) {
      case 'processor': procTick(sim, t, d, dt); break;
      case 'farm': farmTick(sim, t, d, dt); break;
      case 'producer': producerTick(sim, t, d, dt); break;
      case 'drill': drillTick(sim, t, d, dt); break;
      case 'turret': turretTick(sim, t, d, dt); break;
    }
  }
}

// ------------------------------------------------------------------ processors
function procTick(sim, t, d, dt) {
  const w = sim.world, s = t.s, kind = d.conf.kind;
  const recipes = recipesFor(w, kind);
  const mm = 1 + techFx(w, 'machine');
  let changed = false;
  // pull from / push to a neighbouring chest
  const chest = adjacentStorage(w, t);
  if (chest) {
    ensureState(chest);
    const cinv = chest.s.inv;
    if (s.out) {
      const left = invAdd(cinv, s.out.id, s.out.n);
      if (left !== s.out.n) { s.out = left > 0 ? { id: s.out.id, n: left } : null; changed = true; }
    }
    if (!s.inp || s.inp.n < 10) {
      for (let i = 0; i < cinv.length; i++) {
        const c = cinv[i];
        if (!c) continue;
        const rec = recipes.find((r) => r.input === c.id);
        if (!rec || (s.inp && s.inp.id !== c.id)) continue;
        const take = Math.min(c.n, 20 - (s.inp ? s.inp.n : 0));
        if (take <= 0) continue;
        s.inp = { id: c.id, n: (s.inp ? s.inp.n : 0) + take };
        c.n -= take; if (c.n <= 0) cinv[i] = null;
        changed = true; chest.s = { ...chest.s }; w.patchThing(chest.id, { s: chest.s });
        break;
      }
    }
    if (!d.conf.noFuel && (!s.fuel || s.fuel.n < 5)) {
      for (let i = 0; i < cinv.length; i++) {
        const c = cinv[i];
        if (!c || !fuelValue(c.id) || (s.fuel && s.fuel.id !== c.id)) continue;
        const take = Math.min(c.n, 20 - (s.fuel ? s.fuel.n : 0));
        if (take <= 0) continue;
        s.fuel = { id: c.id, n: (s.fuel ? s.fuel.n : 0) + take };
        c.n -= take; if (c.n <= 0) cinv[i] = null;
        changed = true; w.patchThing(chest.id, { s: chest.s });
        break;
      }
    }
  }
  const rec = s.inp ? recipes.find((r) => r.input === s.inp.id && s.inp.n >= r.n) : null;
  const room = rec && (!s.out || (s.out.id === rec.out && s.out.n + rec.on <= stackMax(rec.out)));
  let working = false;
  if (rec && room) {
    let hot = d.conf.noFuel || s.heat > 0;
    if (!hot && s.fuel && fuelValue(s.fuel.id) > 0) {
      s.heat = fuelValue(s.fuel.id);
      s.fuel.n--; if (s.fuel.n <= 0) s.fuel = null;
      hot = true; changed = true;
    }
    if (hot) {
      working = true;
      if (!d.conf.noFuel) s.heat -= dt;
      s.prog += dt * PROC_SPEED[kind] * mm;
      if (s.prog >= rec.t) {
        s.prog = 0;
        s.inp.n -= rec.n; if (s.inp.n <= 0) s.inp = null;
        s.out = s.out ? { id: rec.out, n: s.out.n + rec.on } : { id: rec.out, n: rec.on };
        sim.bump('made_' + rec.out, rec.on);
        changed = true;
        w.fx('puff', (t.x + t.w / 2) * TILE, t.y * TILE, 0);
      }
    }
  } else s.prog = 0;
  if ((working ? 1 : 0) !== s.w) { s.w = working ? 1 : 0; changed = true; }
  if (changed) { s.ps = Math.round(s.prog * 10) / 10; s.pt = Math.round(w.time * 10) / 10; w.patchThing(t.id, { s }); }
}

// ------------------------------------------------------------------ farms
function farmTick(sim, t, d, dt) {
  const w = sim.world, s = t.s;
  if (!s.c) return;
  const crop = CROPS[s.c];
  let mult = d.conf.speed;
  if (w.shared.weather > 0 && !d.conf.indoor) mult *= 1.4;
  mult *= sprinklerBoost(sim, t);
  const owner = s.by ? w.players.get(s.by) : null;
  if (owner) mult *= 1 + calcStats(w, owner).cropGrowth;
  if (sim.nightness() > 0.7 && !d.conf.indoor) mult *= 0.6;
  const wasStage = cropStage(s.c, s.g);
  s.g = Math.min(crop.time, s.g + dt * mult);
  const st = cropStage(s.c, s.g);
  if (st !== wasStage) { s.st = st; w.patchThing(t.id, { s }); }
}

// ------------------------------------------------------------------ producers (animals, bees, traps)
function flowersNear(sim, t) {
  let n = 0;
  const w = sim.world;
  for (const o of w.thingsNear((t.x + 0.5) * TILE, (t.y + 0.5) * TILE, 7 * TILE)) {
    if (o.dep) continue;
    if (o.type.startsWith('flower_') || o.type === 'flower_bed' || o.type === 'plant_flowerpot' || o.type === 'plant_sunflower' || o.type === 'plant_tulips' || o.type === 'bloom') n++;
  }
  return n;
}
function producerTick(sim, t, d, dt) {
  const w = sim.world, s = t.s, c = d.conf;
  let rate = 1;
  const owner = s.by ? w.players.get(s.by) : null;
  if (owner) rate *= 1 + calcStats(w, owner).animal;
  rate *= 1 + techFx(w, 'machine');
  if (c.flowers) { const f = flowersNear(sim, t); if (f < 2) return; rate *= 1 + Math.min(f, 8) * 0.08; }
  if (c.feed) { if (s.feed <= 0) return; }
  if (s.stock >= c.cap) return;
  s.p += dt * rate;
  if (s.p >= c.every) {
    s.p = 0;
    if (c.feed) s.feed--;
    s.stock++;
    if (c.out !== '@fishpick') sim.bump('made_' + c.out);
    if (c.out === '@fishpick') { (s.fish || (s.fish = [])).push(lootFish(sim.rng, w.biomeAtTile(t.x, t.y).id, 2, 0, 0)); }
    w.patchThing(t.id, { s });
  }
}

// ------------------------------------------------------------------ drills
function drillTick(sim, t, d, dt) {
  const w = sim.world, s = t.s, c = d.conf;
  const mm = 1 + techFx(w, 'machine');
  const chest = adjacentStorage(w, t);
  let changed = false;
  if (c.fuel && s.heat <= 0 && chest) {
    ensureState(chest);
    const cinv = chest.s.inv;
    for (let i = 0; i < cinv.length; i++) {
      const it = cinv[i];
      if (it && fuelValue(it.id) > 0) { s.heat = fuelValue(it.id); it.n--; if (it.n <= 0) cinv[i] = null; w.patchThing(chest.id, { s: chest.s }); changed = true; break; }
    }
  }
  if (c.fuel && s.heat <= 0) { if (s.w) { s.w = 0; w.patchThing(t.id, { s }); } return; }
  if (c.solar && sim.nightness() > 0.55) { if (s.w) { s.w = 0; w.patchThing(t.id, { s }); } return; }
  if (!s.w) { s.w = 1; changed = true; }
  if (c.fuel) s.heat -= dt;
  s.t += dt * mm;
  if (s.t >= c.every) {
    s.t = 0;
    const cx = (t.x + t.w / 2) * TILE, cy = (t.y + t.h / 2) * TILE;
    let best = null, bd = Infinity;
    for (const o of w.thingsNear(cx, cy, c.r * TILE)) {
      const nd = NODES[o.type];
      if (!nd || nd.kind !== 'node' || o.dep || nd.hard > c.tier) continue;
      const dd = Math.hypot((o.x + 0.5) * TILE - cx, (o.y + 0.5) * TILE - cy);
      // prefer solid resources over grass
      const score = dd + (nd.solid ? 0 : 40);
      if (score < bd) { bd = score; best = o; }
    }
    if (best) {
      const nd = NODES[best.type];
      best.hp -= c.dmg;
      w.fx('hit', (best.x + 0.5) * TILE, (best.y + 0.4) * TILE, nd.fx, 0);
      w.patchThing(best.id, { hp: best.hp }, true);
      if (best.hp <= 0) {
        const items = rollNodeDrops(sim, nd, null, 1);
        for (const it of items) {
          let left = it.n;
          if (chest) { ensureState(chest); left = invAdd(chest.s.inv, it.id, it.n); if (left !== it.n) w.patchThing(chest.id, { s: chest.s }); }
          if (left > 0) {
            // internal buffer, else pop onto the ground
            let b = s.buf.find((x) => x.id === it.id && x.n < 99);
            if (b && s.buf.length) { const k = Math.min(left, 99 - b.n); b.n += k; left -= k; }
            if (left > 0 && s.buf.length < 8) { s.buf.push({ id: it.id, n: left }); left = 0; }
            if (left > 0) sim.spawnDrop(it.id, left, cx, (t.y + t.h) * TILE + 4);
          }
        }
        sim.breakNodeAfterDrill(best, nd);
        w.fx('poof', (best.x + 0.5) * TILE, (best.y + 0.5) * TILE, 0);
      }
      changed = true;
    }
  }
  if (changed) w.patchThing(t.id, { s });
}

// ------------------------------------------------------------------ turrets
function turretTick(sim, t, d, dt) {
  const w = sim.world, s = t.s, c = d.conf;
  s.t -= dt;
  if (s.t > 0) return;
  const cx = (t.x + t.w / 2) * TILE, cy = (t.y + t.h / 2) * TILE;
  let best = null, bd = c.range * c.range;
  for (const m of w.mobs.values()) {
    const def = MOBS[m.type];
    if (!def.hostile || m.hp <= 0) continue;
    const dx = m.x - cx, dy = m.y - cy, dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = m; }
  }
  if (!best) { s.t = 0.25; return; }
  if (c.ammo) {
    if (s.ammo <= 0) {
      const chest = adjacentStorage(w, t);
      if (chest) {
        ensureState(chest);
        const cinv = chest.s.inv;
        for (let i = 0; i < cinv.length; i++) { const it = cinv[i]; if (it && it.id === c.ammo) { const take = Math.min(it.n, 20); s.ammo += take; it.n -= take; if (it.n <= 0) cinv[i] = null; w.patchThing(chest.id, { s: chest.s }); break; } }
      }
      if (s.ammo <= 0) { s.t = 1; return; }
    }
    s.ammo--;
    w.patchThing(t.id, { s }, true);
  }
  s.t = c.cd / (1 + techFx(w, 'machine'));
  shoot(sim, { x: cx, y: cy - 8, tx: best.x, ty: best.y - MOBS[best.type].h * 0.4, spd: 190, dmg: c.dmg, range: c.range + 20, from: 't', color: c.proj, r: 3, kind: 'bolt' });
  w.fx('turret', cx, cy - 8, 0);
}

export const cropOf = (id) => CROPS[id];
