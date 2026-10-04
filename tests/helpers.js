import { Sim } from '../js/sim/sim.js';
import { presetSettings } from '../js/data/difficulty.js';
import { TILE } from '../js/util.js';
import { invAdd } from '../js/sim/inventory.js';

export function makeSim(preset = 'classic', overrides = {}, seed = 12345) {
  const sim = Sim.create({ seed, settings: { ...presetSettings(preset), ...overrides } });
  sim.world.hooks.tell = (pid, ev) => { (sim.tells || (sim.tells = [])).push([pid, ev]); };
  sim.world.record = true;
  return sim;
}
export function step(sim, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) sim.update(dt);
}
export function give(p, id, n) { invAdd(p.inv, id, n); p.rev++; }
export function findThing(sim, type, from) {
  let best = null, bd = Infinity;
  for (const t of sim.world.things.values()) {
    if (t.type !== type || t.dep) continue;
    const d = from ? Math.hypot((t.x + .5) * TILE - from.x, (t.y + .5) * TILE - from.y) : 0;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
export function standNear(sim, p, t, dx = 0, dy = 14) {
  p.x = (t.x + 0.5) * TILE + dx; p.y = (t.y + 0.5) * TILE + dy;
}
export function freeSpot(sim, p, tiles = 8) {
  const w = sim.world;
  for (let r = 0; r < tiles; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = Math.floor(p.x / TILE) + dx, ty = Math.floor(p.y / TILE) + dy;
    if (w.inb(tx, ty) && w.isTileOwned(tx, ty) && !(w.solid[w.idx(tx, ty)] & 1) && !w.occ[w.idx(tx, ty)] && !w.floor[w.idx(tx, ty)]) return [tx, ty];
  }
  return null;
}
