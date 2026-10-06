// Using furniture: where each seat sits, where a bed's pillow is, and where you step out afterwards.
// Pure maths over a world. The host's simulation and a player's own screen both use it, so getting up can happen the instant a key is pressed
// (no round trip to the host) and both sides still agree on where you end up.
import { TILE } from '../util.js';
import { BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { DIR_VEC, seatFacing, headEnd, hasViews, normRot } from '../data/facing.js';
import { touch } from './player.js';

/** feet of a player standing in a tile: 12px down it (the 6px-high collision box then sits wholly inside the tile) */
export const footX = (tx) => (tx + 0.5) * TILE;
export const footY = (ty) => ty * TILE + 12;
export const BOX = [4, 3]; // half-width and half-height of a player's collision box, centred 3px above their feet

export const isBed = (d) => !!d && d.behavior === 'bed';
export const isSeat = (d) => !!d && d.behavior === 'seat';
export const standsFree = (w, x, y) => w.boxFree(x, y - 3, BOX[0], BOX[1]);

/**
 * The seats a piece offers, one per cushion: [{ i, tx, ty, x, y, dir }]. (x, y) is where the sitter's feet go, dir the way they face
 * (0 down, 1 right, 2 up, 3 left: the way the piece faces).
 */
export function seatSlots(t, def = BUILD[t.type]) {
  const dir = seatFacing(def, t.rot || 0), cells = [];
  if (t.w * t.h === 1) cells.push([0, 0]);
  else if (t.w * t.h === 2) { for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) cells.push([x, y]); } // a sofa or bench: one place per cushion
  else for (let x = 0; x < t.w; x++) cells.push([x, t.h - 1]); // a swing seats people side by side on its front row
  return cells.map(([dx, dy], i) => ({ i, tx: t.x + dx, ty: t.y + dy, x: (t.x + dx + 0.5) * TILE, y: (t.y + dy + 1) * TILE - 2, dir }));
}

/** where a sleeper lies: the middle of the head end of the bed. head = the way the head points (0 down, 1 right, 2 up, 3 left). */
export function bedSpot(t, def = BUILD[t.type]) {
  const head = headEnd(def, t.rot || 0), [dx, dy] = DIR_VEC[head];
  const cx = (t.x + t.w / 2) * TILE, cy = (t.y + t.h / 2) * TILE;
  return { head, x: cx + dx * (t.w - 1) * TILE / 2, y: cy + dy * (t.h - 1) * TILE / 2 + 4 };
}

/**
 * Where the head lies on a bed as drawn (world pixels): the pillow of the picture, which sits differently in the front, back and side views.
 * Beds that cannot turn use the middle of their head end.
 */
export function pillowAt(t, def = BUILD[t.type]) {
  const b = bedSpot(t, def), cx = b.x, cy = b.y - 4; // cx, cy: middle of the head tile
  if (def.id === 'tent') return { head: 2, x: cx, y: t.y * TILE + 20 }; // peeking out of the entrance
  if (!hasViews(def)) return { head: b.head, x: cx, y: cy };
  if (b.head === 2) return { head: 2, x: cx, y: t.y * TILE + 11.5 };
  if (b.head === 0) return { head: 0, x: cx, y: t.y * TILE + 20.5 };
  return { head: b.head, x: t.x * TILE + (b.head === 3 ? 9 : 23), y: t.y * TILE + 3.5 };
}

/** The bed (kind 'bed') or seat ('seat') a player is lying or sitting on, found by where they are, so every screen finds the same piece. */
export function furnitureUnder(w, p, kind) {
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 3) / TILE);
  if (!w.inb(tx, ty)) return null;
  const t = w.thingAt(tx, ty), d = t && BUILD[t.type];
  return d && d.behavior === kind ? t : null;
}
/**
 * The piece this player is lying or sitting on. The host knows it by id (`p.bed` for sleepers, `p.sit.id` for sitters); a screen that does not
 * (the player's own, for a bed) finds it by where they are.
 */
export function restingThing(w, p) {
  if (p.sleeping) return (p.bed && w.things.get(p.bed)) || furnitureUnder(w, p, 'bed');
  if (p.sit) return (p.sit.id && w.things.get(p.sit.id)) || furnitureUnder(w, p, 'seat');
  return null;
}

/** the seat of a piece nearest to a point: where a sitter at (x, y) is */
export function nearestSlot(t, x, y) {
  let best = null, bd = Infinity;
  for (const s of seatSlots(t)) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}

/** tiles around a piece to step out onto: the side it faces first, then the sides, then behind; the nearest ring first. [tx, ty] each. */
export function ringTiles(t, front, from) {
  const out = [], order = [front, (front + 1) % 4, (front + 3) % 4, (front + 2) % 4];
  const near = (a) => Math.abs(a[0] - from[0]) + Math.abs(a[1] - from[1]);
  for (let k = 1; k <= 2; k++) for (const d of order) {
    const side = [];
    if (d === 0 || d === 2) { const y = d === 0 ? t.y + t.h - 1 + k : t.y - k; for (let x = t.x; x < t.x + t.w; x++) side.push([x, y]); }
    else { const x = d === 1 ? t.x + t.w - 1 + k : t.x - k; for (let y = t.y; y < t.y + t.h; y++) side.push([x, y]); }
    side.sort((a, b) => near(a) - near(b));
    out.push(...side);
  }
  return out;
}

/** can someone stand in this tile? strict = also nothing built on it (only grass and flowers) */
function spotFree(w, tx, ty, strict) {
  if (!w.inb(tx, ty) || !standsFree(w, footX(tx), footY(ty))) return false;
  if (strict) { const o = w.thingAt(tx, ty); if (o && !(NODES[o.type] && !NODES[o.type].solid)) return false; }
  return true;
}

/** the nearest standable spot to a pixel position, searching outwards (tiles within `max`); null if there is none */
export function nearestStand(w, x, y, max = 6) {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  for (const strict of [true, false]) {
    let best = null, bd = Infinity;
    for (let r = 0; r <= max && !best; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (!spotFree(w, tx, ty, strict)) continue;
        const d = Math.hypot(footX(tx) - x, footY(ty) - y);
        if (d < bd) { bd = d; best = { x: footX(tx), y: footY(ty) }; }
      }
    }
    if (best) return best;
  }
  return null;
}
/** a player whose feet are stuck inside something solid: where to move them (null if they are fine) */
export function unstickSpot(w, x, y) { return standsFree(w, x, y) ? null : nearestStand(w, x, y, 8); }

/** the first free spot to step out onto beside a piece (the side it faces first), counting from the tile `from` the person was lying or sitting in */
export function exitFrom(w, t, from) {
  const def = BUILD[t.type];
  const front = isBed(def) ? (hasViews(def) ? normRot(t.rot || 0) : 0) : seatFacing(def, t.rot || 0);
  const ring = ringTiles(t, front, from);
  for (const strict of [true, false]) for (const [tx, ty] of ring) if (spotFree(w, tx, ty, strict)) return { x: footX(tx), y: footY(ty) };
  return nearestStand(w, (t.x + t.w / 2) * TILE, (t.y + t.h) * TILE, 8);
}
/** where someone getting up from what they are on goes; null if they are on nothing. Depends only on the piece (and the seat), so every screen agrees. */
export function exitSpot(w, p) {
  const t = restingThing(w, p);
  if (!t) return null;
  const def = BUILD[t.type];
  let from;
  if (isBed(def)) { const b = bedSpot(t, def); from = [Math.floor(b.x / TILE), Math.floor((b.y - 3) / TILE)]; }
  else { const sl = p.sit && p.sit.i !== undefined ? seatSlots(t, def)[p.sit.i] : null, s = sl || nearestSlot(t, p.x, p.y); from = [s.tx, s.ty]; }
  return exitFrom(w, t, from);
}

/**
 * Stop sitting or sleeping. A bed is solid, so whoever gets up from one is stepped out to a free spot beside it (a seat can simply be walked off,
 * so there they stay put unless something blocks them). Returns the spot they were moved to, if any. The player is told when they were moved.
 */
export function standUp(sim, p, move = true) {
  const w = sim.world;
  if (!p.sleeping && !p.sit) return null;
  let spot = null;
  if (move && (p.sleeping || !standsFree(w, p.x, p.y))) spot = exitSpot(w, p);
  p.sleeping = false; p.sit = null; p.bed = 0;
  if (spot) { p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0; w.tell(p.pid, { t: 'teleport', x: p.x, y: p.y }); }
  touch(p);
  return spot;
}
