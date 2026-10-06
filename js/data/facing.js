// Turning furniture. Which pieces can face four ways, what each turn looks like, and how the footprint changes.
// rot: 0 faces down (the normal picture), 1 faces right, 2 faces up, 3 faces left. Sprites of turns 1-3 are named `t_<id>_r<rot>`.
// A view says how a turn differs: swap = the footprint turns sideways (2x1 becomes 1x2); art = which picture the art code draws;
// mirror = it is the mirror image of that picture; same = look like turn n (a long table seen from the other end).
import { BUILD } from './build.js';

export const DIRS = ['down', 'right', 'up', 'left'];
export const DIR_VEC = [[0, 1], [1, 0], [0, -1], [-1, 0]];

const SIDE = (art, swap) => ({ art, swap: !!swap });
const BACK = (art) => ({ art });
const MIRROR = (art, swap) => ({ art, mirror: true, swap: !!swap });

/** furniture designs (every style has them) -> views for turns 1, 2, 3 */
export const DESIGN_TURNS = {
  chair: [null, SIDE('chair_side'), BACK('chair_back'), MIRROR('chair_side')],
  sofa: [null, SIDE('sofa_side', true), BACK('sofa_back'), MIRROR('sofa_side', true)],
  bed: [null, SIDE('bed_side', true), BACK('bed_back'), MIRROR('bed_side', true)], // rot = the way the foot points: 1 = head on the left
  table: [null, SIDE('table_side', true), { same: 0 }, MIRROR('table_side', true)],
  bookshelf: [null, SIDE('bookshelf_side'), BACK('bookshelf_back'), MIRROR('bookshelf_side')],
  wardrobe: [null, SIDE('wardrobe_side'), BACK('wardrobe_back'), MIRROR('wardrobe_side')],
  dresser: [null, SIDE('dresser_side'), BACK('dresser_back'), MIRROR('dresser_side')],
  nightstand: [null, SIDE('nightstand_side'), BACK('nightstand_back'), MIRROR('nightstand_side')],
};
/** other pieces by id. 'flat' pieces (rugs) are simply turned like a picture. */
export const DECOR_TURNS = {
  bench: [null, SIDE('bench_side', true), BACK('bench_back'), MIRROR('bench_side', true)],
  picnic: [null, { art: 'turn90' }, { art: 'turn180' }, { art: 'turn270' }],
};

export function turnsOf(def) {
  if (!def) return null;
  if (def.set && def.design && DESIGN_TURNS[def.design]) return DESIGN_TURNS[def.design];
  return DECOR_TURNS[def.id] || null;
}
export const turnable = (def) => !!turnsOf(def);
export const normRot = (rot) => ((rot | 0) % 4 + 4) % 4;

/** the footprint [w, h] of a piece turned to rot */
export function footprintFor(def, rot) {
  const w = def.w || 1, h = def.h || 1, tv = turnsOf(def);
  const v = tv && tv[normRot(rot)];
  if (!v) return [w, h];
  const via = v.same !== undefined ? tv[v.same] : v;
  return via && via.swap ? [h, w] : [w, h];
}
/** sprite name of a piece turned to rot */
export function turnSprite(def, rot) {
  const r = turnable(def) ? normRot(rot) : 0;
  return r === 0 ? 't_' + def.id : `t_${def.id}_r${r}`;
}
/** the way a seated person faces on a piece turned to rot (0..3 into DIRS); pieces that cannot turn always face down */
export const seatFacing = (def, rot) => (turnable(def) ? normRot(rot) : 0);
/** which end of a bed the head is at, as a DIRS index (0 down 1 right 2 up 3 left): the foot points the way `rot` says, so the head is at the opposite end */
export function headEnd(def, rot) {
  if (turnable(def)) return [2, 3, 0, 1][normRot(rot)];
  return (def.w || 1) > (def.h || 1) ? 3 : 2; // hammocks lie sideways with the head on the left, everything else head-up
}
export function allTurnIds() { return Object.values(BUILD).filter((d) => d.kind !== 'wall' && d.kind !== 'floor' && d.kind !== 'walldeco' && turnable(d)).map((d) => d.id); }
