// Player commands (host-side validation + execution). The same entry point serves local play and remote players.
import { TILE, clamp } from '../util.js';
import { ITEMS, fuelValue } from '../data/items.js';
import { BUILD, FLOOR_IDS, WALLDECO_IDS } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { MOBS } from '../data/mobs.js';
import { RECIPES } from '../data/recipes.js';
import { TECHS, researchTierFor } from '../data/techs.js';
import { wallCodeOf, floorCodeOf, decoCodeOf, wallDefOf, floorDefOf } from './world.js';
import { normColor } from '../data/paint.js';
import { techCostMult } from '../data/difficulty.js';
import { calcStats, addXp, touch, levelSkill, HOTBAR, EQUIP_SLOTS, syncSlots } from './player.js';
import { invCount, invRemove, invAdd, stackMax, compact } from './inventory.js';
import { useItem, harvestPlot, equipFromSlot, unequip, openWildChest } from './gather.js';
import { ensureState, processRecipes, growStorage } from './machines.js';
import { turnable, normRot, footprintFor } from '../data/facing.js';
import { seatSlots, bedSpot, restingThing, standUp } from './furniture.js';
import { spawnBoss } from './combat.js';

const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const recipeById = (id) => RECIPE_BY_ID[id];

// ------------------------------------------------------------------ shared pantry: player bag + nearby chests
export function sourcesFor(sim, p) {
  const w = sim.world;
  const out = [{ inv: p.inv, owner: p }];
  for (const t of w.thingsNear(p.x, p.y - 6, 7.5 * TILE)) {
    const d = BUILD[t.type];
    if (d && d.behavior === 'storage' && !(d.conf && d.conf.grave)) { ensureState(t); out.push({ inv: t.s.inv, thing: t }); }
  }
  return out;
}
export function countAll(src, token) { let n = 0; for (const s of src) n += invCount(s.inv, token); return n; }
export function canAffordAll(src, cost, mult = 1) {
  for (const k in cost) { if (countAll(src, k) < Math.ceil(cost[k] * mult - 1e-9)) return false; }
  return true;
}
export function spendAll(sim, src, cost, mult = 1) {
  if (!canAffordAll(src, cost, mult)) return false;
  const touched = new Set();
  for (const k in cost) {
    let need = Math.ceil(cost[k] * mult - 1e-9);
    for (const s of src) {
      if (need <= 0) break;
      const have = invCount(s.inv, k);
      const take = Math.min(have, need);
      if (take > 0) { invRemove(s.inv, k, take); need -= take; touched.add(s); }
    }
  }
  for (const s of touched) { if (s.owner) touch(s.owner); if (s.thing) sim.world.patchThing(s.thing.id, { s: s.thing.s }); }
  return true;
}
export function missingAll(src, cost, mult = 1) {
  const out = [];
  for (const k in cost) { const need = Math.ceil(cost[k] * mult - 1e-9), have = countAll(src, k); if (have < need) out.push([k, need - have]); }
  return out;
}
function giveAll(sim, p, items) { for (const id in items) sim.award(p, id, items[id]); }

const near = (p, px, py, tiles) => Math.hypot(p.x - px, p.y - 6 - py) <= tiles * TILE;
const center = (t) => [(t.x + t.w / 2) * TILE, (t.y + t.h / 2) * TILE];

export function stationNear(sim, p, key) {
  const w = sim.world;
  if (key === 'hand') return true;
  const r = 5.5 * TILE;
  if (w.nearestStationDist(p.x, p.y - 6, key, r) <= r) return true;
  if (key === 'campfire' && w.nearestStationDist(p.x, p.y - 6, 'kitchen', r) <= r) return true;
  return false;
}

export function buildMult(sim, p, def) {
  const w = sim.world, st = calcStats(w, p);
  const base = w.settings.buildCost;
  if (base === 0) return 0;
  let disc = st.buildDiscount;
  if (def.kind === 'wall' || def.kind === 'floor') disc += st.wallDiscount;
  return base * (1 - Math.min(0.75, disc));
}

/** a list of [x, y] tiles from the network: at most 220, anything that is not a pair of numbers is skipped */
const tileList = (a) => (Array.isArray(a) ? a.slice(0, 220).filter((t) => Array.isArray(t) && Number.isFinite(t[0]) && Number.isFinite(t[1])) : []);

// ------------------------------------------------------------------ dispatcher
export function exec(sim, pid, cmd) {
  const w = sim.world;
  const p = w.players.get(pid);
  if (!p || !p.online || !cmd) return;
  switch (cmd.c) {
    case 'use': if (p.dead > 0) return; return useItem(sim, p, clamp(cmd.slot | 0, 0, p.inv.length - 1), +cmd.ax || p.x, +cmd.ay || p.y);
    case 'sel': p.sel = clamp(cmd.i | 0, 0, HOTBAR - 1); return;
    case 'craft': return doCraft(sim, p, cmd);
    case 'build': return doBuild(sim, p, cmd);
    case 'buildMany': { const list = tileList(cmd.tiles); for (const t of list) doBuild(sim, p, { bid: cmd.bid, tx: t[0], ty: t[1], flip: cmd.flip, rot: cmd.rot, col: cmd.col }, true); return; }
    case 'paint': return doPaint(sim, p, cmd);
    case 'unbuildMany': { const list = tileList(cmd.tiles); for (const t of list) doUnbuild(sim, p, { tx: t[0], ty: t[1], layer: cmd.layer }, true); return; }
    case 'unbuild': return doUnbuild(sim, p, cmd);
    case 'buyLand': return doBuyLand(sim, p, cmd);
    case 'research': return doResearch(sim, p, cmd);
    case 'skill': { const err = levelSkill(w, p, cmd.sid); if (err) sim.toast(p.pid, err, 'warn'); else { w.fx('skill', p.x, p.y - 12, 0); if (growStorage(w)) sim.toast(p.pid, 'Your storage got bigger!', 'good'); } return; }
    case 'interact': return doInteract(sim, p, cmd);
    case 'inv': return doInv(sim, p, cmd);
    case 'drop': return doDrop(sim, p, cmd);
    case 'sell': return doSell(sim, p, cmd);
    case 'door': return doDoor(sim, p, cmd);
    case 'warp': return doWarp(sim, p, cmd);
    case 'wake': standUp(sim, p, false); return; // the player already stepped out on their own screen (same spot the host would pick)
    case 'dash': { const st = calcStats(w, p); if (p.energy >= 25 && p.dashCd <= 0) { p.energy -= 25; p.dashCd = st.dashCd; p.shield = Math.max(p.shield, 0.2); w.fx('dashpuff', p.x, p.y, p.id); touch(p); } return; }
    case 'emote': w.fx('emote', p.x, p.y - 22, p.id, cmd.e | 0); return;
    case 'pet': return doPet(sim, p, cmd);
    case 'sort': compact(p.inv); touch(p); return;
    case 'equip': if (equipFromSlot(sim, p, cmd.i | 0)) return; return;
    case 'unequip': unequip(sim, p, cmd.slot); return;
    case 'closeui': return;
    case 'feed': return;
    case 'ping': w.fx('ping', +cmd.x || p.x, +cmd.y || p.y, p.id, 0); return;
  }
}

// ------------------------------------------------------------------ crafting
function doCraft(sim, p, cmd) {
  const w = sim.world;
  const r = RECIPE_BY_ID[cmd.rid];
  if (!r) return;
  if (r.tech && !w.techs.has(r.tech)) return sim.toast(p.pid, 'You need to research this first.', 'warn');
  if (!stationNear(sim, p, r.station)) return sim.toast(p.pid, `Stand near a ${r.station === 'campfire' ? 'campfire' : r.station}.`, 'warn');
  const n = clamp(cmd.n | 0 || 1, 1, 999);
  const src = sourcesFor(sim, p);
  let made = 0;
  for (let i = 0; i < n; i++) {
    if (!canAffordAll(src, r.in)) break;
    spendAll(sim, src, r.in);
    const left = invAdd(p.inv, r.out, r.n);
    if (left > 0) sim.spawnDrop(r.out, left, p.x, p.y - 4);
    made++;
    addXp(w, p, r.xp);
  }
  if (!made) return sim.toast(p.pid, 'Missing ingredients.', 'warn');
  sim.bump('crafted', made); sim.bump('made_' + r.out, made * r.n);
  touch(p);
  w.fx('craft', p.x, p.y - 10, r.out, made);
}

// ------------------------------------------------------------------ building
function clearSoftNodes(sim, def, tx, ty) {
  const w = sim.world;
  for (let yy = 0; yy < (def.h || 1); yy++) for (let xx = 0; xx < (def.w || 1); xx++) {
    const t = w.thingAt(tx + xx, ty + yy);
    if (t) { const nd = NODES[t.type]; if (nd && nd.kind === 'node' && (!nd.solid || t.dep)) w.removeThing(t.id); }
  }
}
/** the blueprint as turned: same piece, footprint w/h swapped for sideways turns (so every rule below just reads def.w / def.h) */
export function turnedDef(def, rot) {
  if (!rot || !turnable(def)) return def;
  const [fw, fh] = footprintFor(def, rot);
  return fw === (def.w || 1) && fh === (def.h || 1) ? def : { ...def, w: fw, h: fh };
}
export function placeCheck(sim, p, def0, tx, ty, rot = 0) {
  const def = turnedDef(def0, rot);
  const w = sim.world;
  // allow building over soft nodes (grass, flowers, stumps)
  const softOnly = (x, y) => { const t = w.thingAt(x, y); if (!t) return true; const nd = NODES[t.type]; return !!(nd && nd.kind === 'node' && (!nd.solid || t.dep)); };
  let reason = w.placeProblem(def, tx, ty);
  if (reason === 'Occupied' || reason === 'Something is in the way') {
    let ok = true;
    for (let yy = 0; yy < (def.h || 1); yy++) for (let xx = 0; xx < (def.w || 1); xx++) if (!softOnly(tx + xx, ty + yy)) ok = false;
    if (ok) reason = null;
  }
  if (reason) return reason;
  if (def.solid !== false && def.kind !== 'floor' && def.kind !== 'walldeco' && def.kind !== 'flat' && w.entityBlocks(tx, ty, def.w || 1, def.h || 1, p.pid)) return 'Someone is standing there';
  return null;
}

/** Give back exactly what building it costs the player right now, so discounts can never be farmed by build/remove cycles. */
function refund(sim, p, def) {
  const mult = buildMult(sim, p, def), items = {};
  for (const k in def.cost) { const n = Math.ceil(def.cost[k] * mult - 1e-9); if (n > 0) items[k] = n; }
  giveAll(sim, p, items);
}

function doBuild(sim, p, cmd, quiet = false) {
  const w = sim.world;
  const def = BUILD[cmd.bid];
  if (!def || def.hidden) return;
  if (def.tech && !w.techs.has(def.tech)) return sim.toast(p.pid, 'Research this first.', 'warn');
  const tx = cmd.tx | 0, ty = cmd.ty | 0;
  const tilePiece = def.kind === 'wall' || def.kind === 'floor' || def.kind === 'walldeco'; // pieces of the tile layers turn too (a window, a door, a floor pattern)
  const rot = turnable(def) || tilePiece ? normRot(cmd.rot) : 0, fp = turnedDef(def, rot); // fp = the footprint as turned
  const col = normColor(cmd.col); // the paint color it is built in (0 = as drawn)
  const st = calcStats(w, p);
  if (!w.inb(tx, ty)) return;
  if (Math.hypot(p.x - (tx + (fp.w || 1) / 2) * TILE, p.y - (ty + (fp.h || 1) / 2) * TILE) > (st.buildReach + 1) * TILE) return sim.toast(p.pid, 'Too far away.', 'warn');
  const reason = placeCheck(sim, p, def, tx, ty, rot);
  if (reason) return sim.toast(p.pid, reason, 'warn');
  // same piece already there? nothing to build (so drag-painting wastes nothing); the same piece in another color or turn is just repainted / turned, free
  const i = w.idx(tx, ty);
  if (def.kind === 'wall' && w.wall[i] === wallCodeOf(def.id)) { if (w.wallCol[i] !== col || w.wallRot[i] !== rot) w.setWall(tx, ty, w.wall[i], w.wallState[i], false, col, rot); return; }
  if (def.kind === 'floor' && w.floor[i] === floorCodeOf(def.id)) { if (w.floorCol[i] !== col || w.floorRot[i] !== rot) w.setFloor(tx, ty, w.floor[i], false, col, rot); return; }
  if (def.kind === 'walldeco' && w.deco[i] === decoCodeOf(def.id)) { if (w.decoCol[i] !== col || w.decoRot[i] !== rot) w.setDeco(tx, ty, w.deco[i], false, col, rot); return; }
  const mult = buildMult(sim, p, def);
  const src = sourcesFor(sim, p);
  if (mult > 0 && !canAffordAll(src, def.cost, mult)) {
    const miss = missingAll(src, def.cost, mult).map(([k, n]) => `${n} ${ITEMS[k] ? ITEMS[k].name : k}`).join(', ');
    return sim.toast(p.pid, `Need ${miss}`, 'warn');
  }
  if (mult > 0) spendAll(sim, src, def.cost, mult);
  const cx = (tx + (fp.w || 1) / 2) * TILE, cy = (ty + (fp.h || 1)) * TILE;
  if (def.kind === 'wall') {
    if (w.wall[i]) refund(sim, p, BUILD[wallDefOf(w.wall[i]).id]);
    clearSoftNodes(sim, def, tx, ty);
    w.setWall(tx, ty, wallCodeOf(def.id), 0, false, col, rot);
  } else if (def.kind === 'floor') {
    if (w.floor[i]) refund(sim, p, BUILD[FLOORS_BY_CODE(w.floor[i])]);
    clearSoftNodes(sim, def, tx, ty);
    w.setFloor(tx, ty, floorCodeOf(def.id), false, col, rot);
  } else if (def.kind === 'walldeco') {
    w.setDeco(tx, ty, decoCodeOf(def.id), false, col, rot);
  } else {
    clearSoftNodes(sim, fp, tx, ty);
    const t = w.addThing(def.id, tx, ty, { flip: !!cmd.flip && !rot, rot, col }); // a turned piece is never also mirrored
    if (def.behavior === 'storage' || def.behavior === 'processor' || def.behavior === 'farm' || def.behavior === 'producer' || def.behavior === 'drill' || def.behavior === 'turret') {
      ensureState(t); growStorage(w, t); w.patchThing(t.id, { s: t.s });
    }
    if (def.behavior === 'farm' || def.behavior === 'producer') t.s.by = p.pid;
  }
  addXp(w, p, 0.5 + Object.keys(def.cost).length * 0.4, false);
  sim.bump('built');
  w.fx('build', cx, cy, def.kind === 'wall' ? 1 : 0);
  touch(p);
}
const FLOORS_BY_CODE = (c) => FLOOR_IDS[c - 1];

function spillThing(sim, t) {
  const w = sim.world;
  const [cx, cy] = center(t);
  const s = t.s;
  if (!s) return;
  const spill = (stack) => { if (stack && stack.n > 0) sim.spawnDrop(stack.id, stack.n, cx, cy + 4); };
  if (s.inv) for (const stack of s.inv) spill(stack);
  spill(s.inp); spill(s.fuel); spill(s.out);
  if (s.buf) for (const b of s.buf) spill(b);
  const d = BUILD[t.type];
  if (d && d.behavior === 'producer' && s.stock > 0 && d.conf.out && d.conf.out[0] !== '@') sim.spawnDrop(d.conf.out, s.stock, cx, cy + 4);
  if (s.c) sim.spawnDrop('seed_' + s.c, 1, cx, cy);
}

/** natural things the Remove tool may clear: any plant (berry bushes, flowers...), an opened treasure chest, and the leftovers (stumps...) of anything gathered */
export function clearableNode(t) {
  const nd = t && NODES[t.type];
  if (!nd) return false;
  if (nd.kind === 'treasure') return !!t.dep;
  return nd.kind === 'node' && !!(nd.plant || t.dep);
}
function clearNode(sim, p, t) {
  const nd = NODES[t.type];
  if (nd.kind === 'treasure') sim.award(p, 'wood', 1 + sim.rng.int(2)); // an old chest is a few planks
  else if (!t.dep) for (const [item, min, max, chance = 1] of nd.drops) { // a ripe plant gives its harvest on the way out
    if (sim.rng.next() > chance) continue;
    const n = min + sim.rng.int(max - min + 1);
    if (n > 0) sim.award(p, item, n);
  }
  sim.world.removeThing(t.id);
}

// ------------------------------------------------------------------ paint
/** the piece a brush stroke on this tile would color, or null: a piece of furniture or decor first; on a wall, the wall, then what hangs on it (once the wall already has the color); else the floor */
export function paintTarget(w, tx, ty, col) {
  if (!w.inb(tx, ty)) return null;
  const i = w.idx(tx, ty);
  const th = w.thingAt(tx, ty) || w.flatAt(tx, ty);
  if (th && BUILD[th.type] && !BUILD[th.type].hidden) return { layer: 'thing', thing: th, has: th.col || 0 };
  if (w.wall[i]) {
    if (w.deco[i] && (w.wallCol[i] || 0) === col && (w.decoCol[i] || 0) !== col) return { layer: 'deco', has: w.decoCol[i] || 0 };
    return { layer: 'wall', has: w.wallCol[i] || 0 };
  }
  if (w.floor[i]) return { layer: 'floor', has: w.floorCol[i] || 0 };
  return null;
}
/** the color of the piece on a tile (for the color dropper): furniture first, then the wall, then the floor; null when there is nothing there */
export function colorAt(w, tx, ty) {
  if (!w.inb(tx, ty)) return null;
  const i = w.idx(tx, ty);
  const th = w.thingAt(tx, ty) || w.flatAt(tx, ty);
  if (th && BUILD[th.type] && !BUILD[th.type].hidden) return { col: th.col || 0, name: BUILD[th.type].name };
  if (w.wall[i]) return { col: w.wallCol[i] || 0, name: wallDefOf(w.wall[i]).name };
  if (w.floor[i]) return { col: w.floorCol[i] || 0, name: floorDefOf(w.floor[i]).name };
  return null;
}
/** color pieces that are already built (free); col 0 puts a piece back to how it was drawn */
function doPaint(sim, p, cmd) {
  const w = sim.world, col = normColor(cmd.col), st = calcStats(w, p);
  const tiles = Array.isArray(cmd.tiles) ? tileList(cmd.tiles) : [[cmd.tx, cmd.ty]];
  let n = 0, far = false;
  for (const t of tiles) {
    const tx = t[0] | 0, ty = t[1] | 0;
    if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) continue;
    if (Math.hypot(p.x - (tx + 0.5) * TILE, p.y - (ty + 0.5) * TILE) > (st.buildReach + 1) * TILE) { far = true; continue; }
    const tg = paintTarget(w, tx, ty, col);
    if (!tg || tg.has === col) continue;
    const i = w.idx(tx, ty);
    if (tg.layer === 'thing') w.patchThing(tg.thing.id, { col });
    else if (tg.layer === 'wall') w.setWall(tx, ty, w.wall[i], w.wallState[i], false, col);
    else if (tg.layer === 'deco') w.setDeco(tx, ty, w.deco[i], false, col);
    else w.setFloor(tx, ty, w.floor[i], false, col);
    if (n++ < 40) w.fx('paint', (tx + 0.5) * TILE, (ty + 0.5) * TILE, col);
  }
  if (far && !n) sim.toast(p.pid, 'Too far away.', 'warn');
}

function doUnbuild(sim, p, cmd, quiet = false) {
  const w = sim.world;
  const tx = cmd.tx | 0, ty = cmd.ty | 0;
  if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) return;
  const st = calcStats(w, p);
  if (Math.hypot(p.x - (tx + 0.5) * TILE, p.y - (ty + 0.5) * TILE) > (st.buildReach + 1) * TILE) return sim.toast(p.pid, 'Too far away.', 'warn');
  const i = w.idx(tx, ty);
  let layer = cmd.layer;
  const thing = w.thingAt(tx, ty) || w.flatAt(tx, ty);
  const placed = thing && BUILD[thing.type] && !BUILD[thing.type].hidden ? thing : null;
  const wild = !placed && clearableNode(thing) ? thing : null;
  if (!layer) layer = w.deco[i] ? 'deco' : placed ? 'thing' : wild ? 'wild' : w.wall[i] ? 'wall' : w.floor[i] ? 'floor' : null;
  if (!layer) return;
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  if (layer === 'deco' && w.deco[i]) {
    const id = require_deco(w.deco[i]);
    if (id) refund(sim, p, BUILD[id]);
    w.setDeco(tx, ty, 0);
  } else if (layer === 'thing' && placed) {
    const d = BUILD[placed.type];
    if (d.conf && d.conf.grave) { const any = placed.s && placed.s.inv && placed.s.inv.some(Boolean); if (any) return sim.toast(p.pid, 'Empty the gravestone first.', 'info'); }
    spillThing(sim, placed);
    refund(sim, p, d);
    // anyone sitting or sleeping on it gets up first (a sleeper is stepped out beside the bed)
    for (const q of w.players.values()) if (restingThing(w, q) === placed) standUp(sim, q);
    w.removeThing(placed.id);
  } else if (layer === 'wild' && wild) {
    clearNode(sim, p, wild);
  } else if (layer === 'wall' && w.wall[i]) {
    const wd = wallDefOf(w.wall[i]);
    if (w.deco[i]) { const id = require_deco(w.deco[i]); if (id) refund(sim, p, BUILD[id]); }
    refund(sim, p, BUILD[wd.id]);
    w.setWall(tx, ty, 0, 0);
    sim.openDoors.delete(i);
  } else if (layer === 'floor' && w.floor[i]) {
    refund(sim, p, BUILD[FLOORS_BY_CODE(w.floor[i])]);
    w.setFloor(tx, ty, 0);
  } else return;
  w.fx('unbuild', cx, cy, 0);
  touch(p);
}
const require_deco = (c) => WALLDECO_IDS[c - 1];

// ------------------------------------------------------------------ land
function doBuyLand(sim, p, cmd) {
  const w = sim.world;
  const gx = cmd.gx | 0, gy = cmd.gy | 0;
  if (gx < 0 || gy < 0 || gx >= w.gw || gy >= w.gh || w.isLandOwned(gx, gy)) return;
  if (!(w.isLandOwned(gx + 1, gy) || w.isLandOwned(gx - 1, gy) || w.isLandOwned(gx, gy + 1) || w.isLandOwned(gx, gy - 1))) return sim.toast(p.pid, 'Buy a land next to your island first.', 'warn');
  const price = sim.priceOf(gx, gy, p);
  if (w.coins < price) return sim.toast(p.pid, `Need ${price} coins.`, 'warn');
  w.coins -= price;
  w.emit(['coins', w.coins]);
  sim.claimLand(gx, gy);
  const b = w.biomeOfLand(gx, gy);
  for (const q of w.players.values()) if (q.online) { addXp(w, q, 20 + b.tier * 10); }
  w.emit(['landbought', gx, gy, p.name]);
  for (const q of w.players.values()) if (q.online) sim.toast(q.pid, `${p.name} bought a ${b.name}!`, 'good');
}

// ------------------------------------------------------------------ research
function doResearch(sim, p, cmd) {
  const w = sim.world;
  const t = TECHS[cmd.tid];
  if (!t || w.techs.has(t.id)) return;
  for (const r of t.req) if (!w.techs.has(r)) return sim.toast(p.pid, `Needs ${TECHS[r].name} first.`, 'warn');
  const free = w.settings.techCost === 0;
  const needTier = researchTierFor(t.tier);
  if (!free) {
    let ok = false;
    for (const th of w.thingsNear(p.x, p.y - 6, 7 * TILE)) { const d = BUILD[th.type]; if (d && d.behavior === 'research' && d.conf.tier >= needTier) ok = true; }
    if (!ok) return sim.toast(p.pid, needTier === 1 ? 'Stand near a Research Table.' : needTier === 2 ? 'Needs a Library Desk nearby.' : 'Needs an Observatory nearby.', 'warn');
  }
  const src = sourcesFor(sim, p);
  const mult = techCostMult(w.settings);
  if (mult > 0 && !canAffordAll(src, t.cost, mult)) {
    const miss = missingAll(src, t.cost, mult).map(([k, n]) => `${n} ${ITEMS[k] ? ITEMS[k].name : k}`).join(', ');
    return sim.toast(p.pid, `Need ${miss}`, 'warn');
  }
  if (mult > 0) spendAll(sim, src, t.cost, mult);
  w.techs.add(t.id);
  w.shared.flags.statsRev = (w.shared.flags.statsRev || 0) + 1;
  w.emit(['tech', t.id]);
  for (const q of w.players.values()) { q.stats = null; syncSlots(w, q); touch(q); }
  w.rev++;
  addXp(w, p, t.xp);
  w.fx('research', p.x, p.y - 12, t.tier);
  for (const q of w.players.values()) if (q.online) sim.toast(q.pid, `Researched ${t.name}!`, 'good');
}

// ------------------------------------------------------------------ interactions
function uiOpen(sim, p, kind, t, extra = {}) {
  if (t) { ensureState(t); sim.world.patchThing(t.id, { s: t.s }, true); }
  sim.world.tell(p.pid, { t: 'ui', kind, id: t ? t.id : 0, s: t ? t.s : null, ...extra });
}

function doInteract(sim, p, cmd) {
  const w = sim.world;
  const t = w.things.get(cmd.id | 0);
  if (!t) return;
  const nd = NODES[t.type];
  const [cx, cy] = center(t);
  if (!near(p, cx, cy, 3.4 + Math.max(t.w, t.h) / 2)) return sim.toast(p.pid, 'Move closer.', 'info');
  if (nd) {
    if (nd.kind === 'treasure') return openWildChest(sim, p, t);
    if (nd.kind === 'dig') return sim.toast(p.pid, 'Dig it up with a shovel!', 'info');
    return;
  }
  const d = BUILD[t.type];
  if (!d) return;
  if (p.sleeping || p.sit) {
    const was = restingThing(w, p);
    standUp(sim, p);
    if (was && was.id === t.id) return; // the hand button on what you are lying or sitting on gets you up
  }
  switch (d.behavior) {
    case 'storage': return uiOpen(sim, p, 'chest', t);
    case 'station': return uiOpen(sim, p, 'station', t, { station: d.conf.station });
    case 'research': return uiOpen(sim, p, 'research', t, { tier: d.conf.tier });
    case 'processor': return uiOpen(sim, p, 'processor', t);
    case 'market': return uiOpen(sim, p, 'market', t);
    case 'bed': return doBed(sim, p, t, d);
    case 'seat': return doSeat(sim, p, t, d);
    case 'farm': {
      const s = ensureState(t);
      if (s.c) return harvestPlot(sim, p, t);
      // plant selected seed
      const sel = p.inv[p.sel];
      if (sel && ITEMS[sel.id] && ITEMS[sel.id].crop) return useItem(sim, p, p.sel, cx, cy);
      return sim.toast(p.pid, 'Hold seeds and tap the plot to plant.', 'info');
    }
    case 'producer': return doProducer(sim, p, t, d);
    case 'drill': return doFuelMachine(sim, p, t, d);
    case 'turret': return doFuelMachine(sim, p, t, d);
    case 'warp': {
      const pads = [];
      for (const o of w.things.values()) if (o.type === 'warp_pad') pads.push({ id: o.id, x: o.x, y: o.y });
      return w.tell(p.pid, { t: 'ui', kind: 'warp', id: t.id, pads });
    }
    case 'altar': return doAltar(sim, p, t, d);
    case 'piano': w.fx('piano', cx, cy, (sim.rng.int(7))); return;
    case 'monument': return sim.toast(p.pid, 'The Heart of the Isles glows warmly.', 'good');
  }
}

/** sit on the nearest free cushion of a chair, sofa or bench, facing the way it faces */
function doSeat(sim, p, t, d) {
  const w = sim.world, taken = new Set();
  for (const q of w.players.values()) if (q !== p && q.online && q.sit && q.sit.id === t.id) taken.add(q.sit.i);
  const free = seatSlots(t, d).filter((s) => !taken.has(s.i)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  if (!free.length) return sim.toast(p.pid, 'Someone is already sitting there.', 'info');
  const s = free[0];
  p.sit = { id: t.id, i: s.i }; p.sleeping = false; p.bed = 0;
  p.x = s.x; p.y = s.y; p.vx = p.vy = 0;
  w.tell(p.pid, { t: 'teleport', x: p.x, y: p.y });
  touch(p);
}

/** lie down in a bed (head on the pillow). Any time of day; at night it also sleeps the night away once everyone who must is in bed. */
function doBed(sim, p, t, d) {
  const w = sim.world, s = bedSpot(t, d);
  p.spawn = { id: t.id };
  p.sleeping = true; p.sit = null; p.bed = t.id;
  p.x = s.x; p.y = s.y; p.vx = p.vy = 0;
  w.tell(p.pid, { t: 'teleport', x: p.x, y: p.y });
  w.fx('zzz', p.x, p.y - 12, p.id);
  sim.computeCozy(p); // a bed is solid: the room is the one you would step out into
  sim.toast(p.pid, sim.nightness() > 0.3 ? 'Sweet dreams... (move to get up)' : 'Resting. This bed is where you wake up if you faint. (move to get up)', 'info');
  touch(p);
}
function doProducer(sim, p, t, d) {
  const w = sim.world, s = ensureState(t), c = d.conf;
  s.by = s.by || p.pid;
  if (s.stock > 0) {
    if (c.out === '@fishpick') { for (const id of (s.fish || [])) sim.award(p, id, 1); s.fish = []; }
    else sim.award(p, c.out, s.stock);
    addXp(w, p, 2 + s.stock);
    s.stock = 0;
    w.patchThing(t.id, { s });
    w.fx('harvest', ...center(t), 0);
    return;
  }
  if (c.feed) {
    const cap = 8;
    let fed = 0;
    for (const f of c.feed) {
      while (s.feed < cap && invCount(p.inv, f) > 0 && fed < 4) { invRemove(p.inv, f, 1); s.feed++; fed++; }
    }
    if (fed) { touch(p); w.patchThing(t.id, { s }); w.fx('plant', ...center(t), 0); return sim.toast(p.pid, `Fed (${s.feed} meals stored)`, 'good'); }
    return sim.toast(p.pid, s.feed > 0 ? `Happy! ${s.feed} meals left.` : `Hungry! Feed it ${c.feed.map((f) => ITEMS[f].name).slice(0, 2).join(' or ')}.`, 'info');
  }
  sim.toast(p.pid, c.flowers ? 'Bees need flowers nearby.' : 'Nothing yet.', 'info');
}

function doFuelMachine(sim, p, t, d) {
  const w = sim.world, s = ensureState(t), c = d.conf;
  if (d.behavior === 'drill') {
    // take buffered items first
    if (s.buf && s.buf.length) { for (const b of s.buf) sim.award(p, b.id, b.n); s.buf = []; w.patchThing(t.id, { s }); return; }
    if (c.fuel) {
      let added = 0;
      for (let i = 0; i < p.inv.length; i++) { const it = p.inv[i]; if (it && fuelValue(it.id) > 0 && it.id !== 'wood') { const n = Math.min(it.n, 10); s.heat += fuelValue(it.id) * n; it.n -= n; if (it.n <= 0) p.inv[i] = null; added += n; break; } }
      if (added) { touch(p); w.patchThing(t.id, { s }); return sim.toast(p.pid, `Fuel added (${Math.round(s.heat)}s left)`, 'good'); }
      return sim.toast(p.pid, s.heat > 0 ? `Running (${Math.round(s.heat)}s of fuel).` : 'Out of fuel! Add coal, or put a chest next to it.', 'info');
    }
    return sim.toast(p.pid, 'Running on clean energy.', 'info');
  }
  if (d.behavior === 'turret') {
    if (c.ammo) {
      const n = Math.min(40 - s.ammo, invCount(p.inv, c.ammo));
      if (n > 0) { invRemove(p.inv, c.ammo, n); s.ammo += n; touch(p); w.patchThing(t.id, { s }); return sim.toast(p.pid, `Loaded ${n} arrows (${s.ammo} total)`, 'good'); }
      return sim.toast(p.pid, s.ammo > 0 ? `${s.ammo} arrows loaded.` : 'Needs arrows! Or place a chest of arrows next to it.', 'info');
    }
    return sim.toast(p.pid, 'On guard!', 'info');
  }
}

function doAltar(sim, p, t, d) {
  const w = sim.world;
  if (w.shared.bossUp) return sim.toast(p.pid, 'A boss is already awake!', 'warn');
  const offer = d.conf.offer;
  for (const k in offer) if (invCount(p.inv, k) < offer[k]) {
    return sim.toast(p.pid, 'Offer: ' + Object.entries(offer).map(([k2, n]) => `${n} ${ITEMS[k2].name}`).join(' + '), 'info');
  }
  for (const k in offer) invRemove(p.inv, k, offer[k]);
  touch(p);
  const [cx, cy] = center(t);
  spawnBoss(sim, d.conf.boss, cx, cy - 56);
  for (const q of w.players.values()) if (q.online) sim.toast(q.pid, `${MOBS[d.conf.boss].name} awakens!`, 'warn');
}

function doPet(sim, p, cmd) {
  const w = sim.world;
  const m = w.mobs.get(cmd.id | 0);
  if (!m) return;
  w.fx('heart', m.x, m.y - 12, 0);
  if (!p.petT || w.time - p.petT > 20) { p.petT = w.time; addXp(w, p, 1); }
}

function doDoor(sim, p, cmd) {
  const w = sim.world;
  const tx = cmd.tx | 0, ty = cmd.ty | 0;
  if (!w.inb(tx, ty)) return;
  const i = w.idx(tx, ty), wc = w.wall[i];
  if (!wc || !near(p, (tx + 0.5) * TILE, (ty + 0.5) * TILE, 3.5)) return;
  const d = wallDefOf(wc);
  if (d.piece !== 'door' && d.piece !== 'gate') return;
  const open = w.wallState[i] ? 0 : 1;
  w.setWallState(tx, ty, open);
  if (open) sim.openDoors.set(i, 0); else sim.openDoors.delete(i);
  w.fx('door', (tx + 0.5) * TILE, (ty + 0.5) * TILE, open);
}

function doWarp(sim, p, cmd) {
  const w = sim.world;
  const target = w.things.get(cmd.id | 0);
  if (!target || target.type !== 'warp_pad') return;
  let onPad = null;
  for (const t of w.thingsNear(p.x, p.y, 40)) if (t.type === 'warp_pad') onPad = t;
  if (!onPad || onPad.id === target.id) return;
  w.fx('poof', p.x, p.y, 1);
  p.x = (target.x + 0.5) * TILE; p.y = (target.y + 1) * TILE + 6;
  w.tell(p.pid, { t: 'teleport', x: p.x, y: p.y });
  w.fx('poof', p.x, p.y, 1);
}

// ------------------------------------------------------------------ selling
function doSell(sim, p, cmd) {
  const w = sim.world;
  let ok = false;
  for (const t of w.thingsNear(p.x, p.y - 6, 7 * TILE)) { const d = BUILD[t.type]; if (d && d.behavior === 'market') ok = true; }
  if (!ok) return sim.toast(p.pid, 'Stand near a Market Stall.', 'warn');
  const i = cmd.i | 0;
  const s = p.inv[i];
  if (!s) return;
  const it = ITEMS[s.id];
  if (!it || !it.sell) return;
  const n = clamp(cmd.n | 0 || s.n, 1, s.n);
  const st = calcStats(w, p);
  const mul = (w.shared.market && w.shared.market[s.id]) || 1;
  const each = Math.max(1, Math.round(it.sell * mul * st.sellMul));
  s.n -= n; if (s.n <= 0) p.inv[i] = null;
  w.coins += each * n;
  sim.bump('sold', n);
  w.emit(['coins', w.coins]);
  w.fx('coin', p.x, p.y - 14, each * n);
  addXp(w, p, 0.4 * n, false);
  touch(p);
}

// ------------------------------------------------------------------ inventory transfers
function slotRef(sim, p, d) {
  const w = sim.world;
  if (!d) return null;
  if (d.k === 'p') {
    const i = d.i | 0;
    if (i < 0 || i >= p.inv.length) return null;
    return { get: () => p.inv[i], set: (v) => { p.inv[i] = v; }, ok: () => true, done: () => touch(p) };
  }
  if (d.k === 'e') {
    if (!EQUIP_SLOTS.includes(d.slot)) return null;
    return {
      get: () => p.equip[d.slot], set: (v) => { p.equip[d.slot] = v; p.stats = null; },
      ok: (id) => { const it = ITEMS[id]; return !!it && ((d.slot === 'charm' && it.charm) || it.armor === d.slot); }, single: true, done: () => touch(p),
    };
  }
  const t = w.things.get(d.id | 0);
  if (!t || Math.hypot((t.x + t.w / 2) * TILE - p.x, (t.y + t.h / 2) * TILE - (p.y - 6)) > (4.5 + t.w) * TILE) return null;
  const def = BUILD[t.type];
  if (!def) return null;
  ensureState(t);
  if (d.k === 't') {
    const inv = t.s.inv;
    const i = d.i | 0;
    if (!inv || i < 0 || i >= inv.length) return null;
    return { get: () => inv[i], set: (v) => { inv[i] = v; }, ok: (id) => !(def.conf && def.conf.foodOnly) || !!(ITEMS[id] && (ITEMS[id].food || ITEMS[id].fish)), done: () => w.patchThing(t.id, { s: t.s }) };
  }
  if (d.k === 'm' && def.behavior === 'processor') {
    const f = d.f;
    if (!['inp', 'fuel', 'out'].includes(f)) return null;
    const recipes = processRecipes(w, def.conf.kind);
    return {
      get: () => t.s[f], set: (v) => { t.s[f] = v; },
      ok: (id) => (f === 'inp' ? recipes.some((r) => r.input === id) : f === 'fuel' ? fuelValue(id) > 0 && !def.conf.noFuel : false),
      single: false, done: () => { t.s.ps = 0; w.patchThing(t.id, { s: t.s }); },
    };
  }
  if (d.k === 'f' && def.behavior === 'producer') return null;
  return null;
}

function doInv(sim, p, cmd) {
  const w = sim.world;
  if (cmd.op === 'quick') {
    // shift-click: bag -> open container, container -> bag
    const from = slotRef(sim, p, cmd.from);
    if (!from) return;
    const s = from.get();
    if (!s) return;
    if (cmd.from.k === 'p' || cmd.from.k === 'e') {
      // find destination container slots
      const t = w.things.get(cmd.to && cmd.to.id | 0);
      if (!t) {
        // equip if possible
        const it = ITEMS[s.id];
        if (cmd.from.k === 'p' && (it.armor || it.charm)) return equipFromSlot(sim, p, cmd.from.i | 0);
        if (cmd.from.k === 'e') return unequip(sim, p, cmd.from.slot);
        return;
      }
      const def = BUILD[t.type];
      if (def.behavior === 'processor') {
        const recipes = processRecipes(w, def.conf.kind);
        const f = recipes.some((r) => r.input === s.id) ? 'inp' : fuelValue(s.id) > 0 && !def.conf.noFuel ? 'fuel' : null;
        if (f) return moveStack(sim, p, from, slotRef(sim, p, { k: 'm', id: t.id, f }), s.n);
        return sim.toast(p.pid, 'It does not take that.', 'info');
      }
      ensureState(t);
      const inv = t.s.inv;
      if (!inv) return;
      let moved = false;
      let rest = s.n;
      const left = def.conf && def.conf.foodOnly && !(ITEMS[s.id].food || ITEMS[s.id].fish) ? rest : invAdd(inv, s.id, rest);
      if (left !== rest) { s.n = left; if (s.n <= 0) from.set(null); moved = true; }
      if (moved) { from.done(); w.patchThing(t.id, { s: t.s }); }
      return;
    }
    // container -> bag
    const left = invAdd(p.inv, s.id, s.n);
    if (left !== s.n) { if (left > 0) s.n = left; else from.set(null); from.done(); touch(p); }
    if (cmd.from.k === 't') maybeClearGrave(sim, w.things.get(cmd.from.id | 0));
    return;
  }
  const from = slotRef(sim, p, cmd.from), to = slotRef(sim, p, cmd.to);
  if (!from || !to) return;
  moveStack(sim, p, from, to, cmd.n | 0);
  if (cmd.from.k === 't') maybeClearGrave(sim, w.things.get(cmd.from.id | 0));
}
function maybeClearGrave(sim, t) {
  if (!t) return;
  const d = BUILD[t.type];
  if (d && d.conf && d.conf.grave && t.s && t.s.inv && !t.s.inv.some(Boolean)) sim.world.removeThing(t.id);
}

function moveStack(sim, p, from, to, n) {
  if (!from || !to) return;
  const src = from.get();
  if (!src) return;
  if (n <= 0 || n > src.n) n = src.n;
  if (!to.ok(src.id)) return;
  const dst = to.get();
  const max = stackMax(src.id);
  if (!dst) {
    if (to.single) n = 1;
    to.set({ id: src.id, n });
    src.n -= n; if (src.n <= 0) from.set(null);
  } else if (dst.id === src.id) {
    const room = to.single ? 0 : max - dst.n;
    const k = Math.min(room, n);
    if (k <= 0) { return swap(from, to, src, dst, n); }
    dst.n += k; src.n -= k; if (src.n <= 0) from.set(null);
  } else {
    return swap(from, to, src, dst, n);
  }
  from.done && from.done();
  to.done && to.done();
}
function swap(from, to, src, dst, n) {
  if (n !== src.n) return;
  if (!from.ok(dst.id) || from.single && dst.n > 1) return;
  if (!to.ok(src.id)) return;
  from.set(dst); to.set(src);
  from.done && from.done(); to.done && to.done();
}

function doDrop(sim, p, cmd) {
  const w = sim.world;
  const i = cmd.i | 0;
  const s = p.inv[i];
  if (!s) return;
  const n = clamp(cmd.n | 0 || s.n, 1, s.n);
  s.n -= n; if (s.n <= 0) p.inv[i] = null;
  const d = sim.spawnDrop(s.id, n, p.x, p.y - 4, { pid: p.pid });
  if (d) d.age = -1.6; // brief grace so you don't instantly re-collect it
  touch(p);
}
