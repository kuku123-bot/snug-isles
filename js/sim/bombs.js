// Bombs and fireworks (host side). Throwing one uses it up and starts a short fuse at the spot it lands; when it goes off it hurts monsters, breaks rocks,
// opens cracked boulders and pushes friends away (it never hurts them or their buildings). The other player only needs the effects (fx events).
import { TILE, clamp } from '../util.js';
import { ITEMS, BOMB_IDS } from '../data/items.js';
import { NODES } from '../data/nodes.js';
import { MOBS } from '../data/mobs.js';
import { touch, addXp } from './player.js';
import { hurtMob } from './combat.js';
import { breakNode } from './gather.js';

const THROW = 78; // how far (px) a bomb can be thrown
const FUSE = { bomb: 1.4, mega_bomb: 1.7, frost_bomb: 1.3, fire_bomb: 1.3, firework: 0.9 };

/** use one bomb from slot and throw it toward (ax, ay) */
export function throwBomb(sim, p, slot, item, ax, ay) {
  const w = sim.world, s = p.inv[slot];
  if (!s || s.id !== item.id) return false;
  s.n--; if (s.n <= 0) p.inv[slot] = null;
  touch(p);
  p.cd = 0.45;
  const sx = p.x, sy = p.y - 8;
  const dx = ax - sx, dy = ay - sy, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, THROW);
  let ex = sx + dx / d * reach, ey = sy + dy / d * reach;
  // a wall stops it: step back toward the thrower until the spot is open
  for (let k = 0; k < 14; k++) {
    const tx = Math.floor(ex / TILE), ty = Math.floor((ey + 6) / TILE);
    if (w.inb(tx, ty) && !(w.solid[w.idx(tx, ty)] & 2)) break;
    ex += (sx - ex) * 0.2; ey += (sy - ey) * 0.2;
  }
  const idx = BOMB_IDS.indexOf(item.id), fuse = FUSE[item.id] || 1.4;
  sim.bombs.push({ x: ex, y: ey, t: fuse, id: item.id, pid: p.pid });
  // [kind, x, y, thrown from x, y, fuse (tenths of a second) * 10 + which bomb]
  w.fx('bombthrow', Math.round(ex), Math.round(ey), Math.round(sx), Math.round(sy), Math.round(fuse * 10) * 10 + idx);
  sim.bump('thrown');
  return true;
}

export function updateBombs(sim, dt) {
  const list = sim.bombs;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.t -= dt;
    if (b.t > 0) continue;
    list.splice(i, 1);
    explode(sim, b);
  }
}

export function explode(sim, b) {
  const w = sim.world, def = ITEMS[b.id].bomb, owner = b.pid ? w.players.get(b.pid) : null, idx = BOMB_IDS.indexOf(b.id);
  if (def.kind === 'firework') {
    w.fx('firework', Math.round(b.x), Math.round(b.y), Math.round(sim.rng.next() * 360), 0, 0);
    sim.bump('fireworks');
    if (owner) addXp(w, owner, 2);
    return;
  }
  w.fx('boom', Math.round(b.x), Math.round(b.y), def.radius, idx, 0);
  // monsters (not pets, not the passive critters)
  for (const m of [...w.mobs.values()]) {
    const md = MOBS[m.type];
    if (!md || !md.hostile || m.pet || m.hp <= 0) continue;
    const d = Math.hypot(m.x - b.x, m.y - md.h * 0.4 - b.y), reach = def.radius + md.r;
    if (d > reach) continue;
    const fall = 1 - 0.5 * clamp(d / reach, 0, 1);
    hurtMob(sim, m, def.dmg * fall * (md.boss ? 0.6 : 1), b.x, b.y, owner, { knock: 170 });
    if (m.hp <= 0) continue;
    if (def.freeze) m.frozen = Math.max(m.frozen || 0, def.freeze * (md.boss ? 0.4 : 1));
    if (def.burn) { m.burn = Math.max(m.burn || 0, def.burn); m.burnBy = b.pid; }
  }
  // rocks, ores, bushes (and trees for the big one); cracked boulders open for any bomb
  if (def.nodes) {
    for (const t of w.thingsNear(b.x, b.y, def.radius)) {
      const nd = NODES[t.type];
      if (!nd || nd.kind !== 'node' || t.dep) continue;
      if (nd.tree && !def.trees) continue;
      if (!nd.cracked && nd.hard > def.nodes) continue;
      t.hp = 0;
      breakNode(sim, t, owner);
      if (nd.cracked) { sim.bump('cracked'); w.fx('ding', (t.x + 0.5) * TILE, (t.y + 0.5) * TILE, 0); }
    }
  }
  // friends get a push, never a hurt
  for (const p of w.players.values()) {
    if (!p.online || p.dead > 0) continue;
    const d = Math.hypot(p.x - b.x, p.y - 6 - b.y);
    if (d < def.radius + 16) { const a = Math.atan2(p.y - 6 - b.y, p.x - b.x), k = 1 - d / (def.radius + 16) * 0.5; w.tell(p.pid, { t: 'kb', vx: Math.cos(a) * 200 * k, vy: Math.sin(a) * 200 * k }); }
  }
  sim.bump('bombs');
}
