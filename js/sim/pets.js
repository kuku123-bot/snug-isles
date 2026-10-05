// Pets: a Mystery Egg hatches into a little companion that follows you around (one per player; it comes back after every reload).
import { MOBS } from '../data/mobs.js';
import { spawnMob } from './combat.js';
import { touch } from './player.js';

const PETS = [['bunny', 30], ['chick', 28], ['duck', 22], ['lizard', 16], ['penguin', 14], ['snow_bunny', 10], ['unicorn', 3]];
export const PET_TYPES = PETS.map((e) => e[0]);

/** use an egg: returns true when the use was handled */
export function hatchEgg(sim, p, slot) {
  const w = sim.world, st = p.inv[slot];
  if (!st || st.id !== 'pet_egg') return false;
  p.cd = 0.6;
  if (p.pet) { sim.toast(p.pid, `${MOBS[p.pet].name} is already your buddy! (one pet at a time)`, 'info'); return true; }
  st.n--; if (st.n <= 0) p.inv[slot] = null;
  p.pet = sim.rng.weighted(PETS);
  sim.bump('hatched');
  w.fx('poof', p.x, p.y - 6, 1); w.fx('heart', p.x, p.y - 12, 0);
  sim.toast(p.pid, `A ${MOBS[p.pet].name} hatched! It will follow you around.`, 'good');
  touch(p);
  ensurePets(sim);
  return true;
}

/** every player's pet exists next to them; leftovers (owner offline, pet changed) are removed by the pet AI itself */
export function ensurePets(sim) {
  const w = sim.world;
  const have = new Set();
  for (const m of w.mobs.values()) if (m.pet) have.add(m.pet);
  for (const p of w.players.values()) {
    if (!p.pet || !p.online || have.has(p.pid) || !MOBS[p.pet]) continue;
    const side = p.face >= 0 ? -1 : 1;
    spawnMob(sim, p.pet, p.x + side * 12, p.y, { pet: p.pid });
  }
}
