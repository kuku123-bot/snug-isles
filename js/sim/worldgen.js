// World generation (host only; clients receive the results). Uses seeded RNG + integer noise.
import { RNG, valueNoise, fbm, hash32, TILE } from '../util.js';
import { BIOMES, GROUND_CODE } from '../data/biomes.js';
import { LAND } from './world.js';
import { NODES } from '../data/nodes.js';

const CLEAR = 0; // placeholder for readability

/** Decide the biome of every land. Returns array (gw*gh) of biome ids. */
export function assignBiomes(gw, gh, seed) {
  const rng = new RNG(seed ^ 0x51ed);
  const cx = gw >> 1, cy = gh >> 1, R = Math.max(cx, cy);
  const sec = rng.shuffle(['desert', 'tundra', 'swamp', 'meadow']); // N E S W
  const diag = rng.shuffle(['graveyard', 'volcano']); // NE/SW get diag[0], NW/SE get diag[1]
  const out = new Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const dx = gx - cx, dy = gy - cy, adx = Math.abs(dx), ady = Math.abs(dy);
    const ring = Math.max(adx, ady);
    const sector = adx > ady ? (dx > 0 ? sec[1] : sec[3]) : adx < ady ? (dy > 0 ? sec[2] : sec[0]) : (((dx > 0) === (dy > 0)) ? sec[1] : sec[3]);
    const quad = ((dx > 0) === (dy > 0)) ? diag[1] : diag[0]; // NE/SW vs NW/SE
    let b;
    if (ring <= 1) b = 'meadow';
    else if (ring === R) {
      // outermost ring: corners & near-corners are void, edges are crystal. (R==3: near-corners are graveyard/volcano)
      const nearCorner = (adx === R && ady >= R - 1) || (ady === R && adx >= R - 1);
      if (adx === ady) b = 'void';
      else if (nearCorner) b = R === 3 ? quad : 'void';
      else b = 'crystal';
    } else if (ring === R - 1 && R >= 4) b = quad;
    else b = sector;
    out[gy * gw + gx] = b;
  }
  return out;
}

export function landPrice(world, gx, gy, discount = 0) {
  const n = world.ownedCount(); // lands already owned (>=1)
  const b = world.biomeOfLand(gx, gy);
  const base = 12 * (1 + 0.55 * n + 0.04 * n * n + 0.0009 * n * n * n) * b.price;
  const mult = (world.settings.landPrice === undefined ? 1 : world.settings.landPrice) * (1 - Math.min(0.6, discount));
  return Math.round(base * mult);
}

const THEMES = [
  { id: 'plain', w: 3, mult: {} },
  { id: 'forest', w: 2, mult: { oak: 1.8, pine: 1.8, palm: 1.6, mangrove: 1.6, dead_tree: 1.6, burnt_tree: 1.6, crystal_tree: 1.6, void_tree: 1.6, rock: 0.6 } },
  { id: 'quarry', w: 2, mult: { rock: 1.8, coal_rock: 2, copper_rock: 2, iron_rock: 1.8, gold_rock: 1.6, ice_rock: 1.8, sandstone: 1.8, tombstone: 1.6, ember_rock: 1.6, obsidian_rock: 1.6, crystal_rock: 1.6, star_rock: 1.6, oak: 0.5, pine: 0.5 } },
  { id: 'orchard', w: 1.4, mult: { berry_bush: 2.2, frost_bush: 2, cactus: 1.8, mushroom_patch: 2, cotton_plant: 2, oak: 1.2 } },
  { id: 'blooms', w: 1.4, mult: { flower_pink: 2.4, flower_yellow: 2.4, flower_blue: 2.4, spirit_flower: 2, ember_bloom: 2, crystal_bloom: 1.8, star_bloom: 1.8, tall_grass: 1.4, oak: 0.6 } },
];
export function landTheme(seed, gx, gy) {
  const rng = new RNG(hash32(seed, gx, gy, 77));
  return rng.weighted(THEMES.map((t) => [t, t.w]));
}

const chebyEdgeDist = (x, y) => Math.min(x, y, LAND - 1 - x, LAND - 1 - y);

/**
 * Generate one land's terrain and node list. isStart => keep a central plaza clear and add a tiny pond.
 * neighbourOwned: [n,e,s,w] booleans -> those edges stay fully land so lands merge.
 */
export function genLand(world, gx, gy, isStart = false) {
  const seed = world.seed;
  const biome = world.biomeOfLand(gx, gy);
  const rng = new RNG(hash32(seed, gx, gy, 1234));
  const gcode = GROUND_CODE[biome.ground];
  const ground = new Uint8Array(LAND * LAND).fill(gcode);
  const nOwned = [world.isLandOwned(gx, gy - 1), world.isLandOwned(gx + 1, gy), world.isLandOwned(gx, gy + 1), world.isLandOwned(gx - 1, gy)];
  const ox = gx * LAND, oy = gy * LAND; // noise coordinates are global so the coast looks continuous
  // organic coastline: carve notches in the outer 3 rings, except along edges that touch owned lands
  for (let y = 0; y < LAND; y++) for (let x = 0; x < LAND; x++) {
    const d = chebyEdgeDist(x, y);
    if (d > 2) continue;
    // never carve within 3 tiles of an edge that touches an already-owned land (so the lands merge)
    if ((nOwned[0] && y < 3) || (nOwned[2] && LAND - 1 - y < 3) || (nOwned[3] && x < 3) || (nOwned[1] && LAND - 1 - x < 3)) continue;
    const n = fbm((ox + x) * 0.33, (oy + y) * 0.33, seed + 5, 2);
    const th = d === 0 ? 0.42 : d === 1 ? 0.27 : 0.13;
    if (n < th) ground[y * LAND + x] = 0;
  }
  // round the four outer corners (only where both neighbouring edges are not owned)
  const cornerCut = (cx, cy, sx, sy, ax, ay) => {
    if (ax || ay) return;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) ground[(cy + sy * j) * LAND + (cx + sx * k)] = 0;
  };
  cornerCut(0, 0, 1, 1, nOwned[0], nOwned[3]);
  cornerCut(LAND - 1, 0, -1, 1, nOwned[0], nOwned[1]);
  cornerCut(0, LAND - 1, 1, -1, nOwned[2], nOwned[3]);
  cornerCut(LAND - 1, LAND - 1, -1, -1, nOwned[2], nOwned[1]);

  // ponds
  const ponds = [];
  if (isStart) ponds.push([15 + rng.int(2), 5 + rng.int(2), 2.4]);
  else if (rng.chance(biome.id === 'swamp' ? 0.9 : 0.4)) ponds.push([5 + rng.int(10), 5 + rng.int(10), 1.8 + rng.next() * 2.4]);
  if (biome.id === 'swamp' && rng.chance(0.6)) ponds.push([4 + rng.int(12), 4 + rng.int(12), 2 + rng.next() * 1.5]);
  for (const [px, py, pr] of ponds) {
    for (let y = 0; y < LAND; y++) for (let x = 0; x < LAND; x++) {
      const wob = valueNoise((ox + x) * 0.5, (oy + y) * 0.5, seed + 9) * 1.2;
      if (Math.hypot(x + 0.5 - px, y + 0.5 - py) < pr + wob - 0.4 && chebyEdgeDist(x, y) >= 2) ground[y * LAND + x] = 0;
    }
  }
  // if the central plaza of the start land got water, give it back
  const centre = LAND >> 1;
  if (isStart) for (let y = centre - 5; y <= centre + 4; y++) for (let x = centre - 5; x <= centre + 4; x++) ground[y * LAND + x] = gcode;

  // ---- resources
  const things = [];
  const used = new Uint8Array(LAND * LAND);
  const theme = isStart ? THEMES[0] : landTheme(seed, gx, gy);
  const isFree = (x, y) => x >= 1 && y >= 1 && x < LAND - 1 && y < LAND - 1 && ground[y * LAND + x] === gcode && !used[y * LAND + x];
  const nearWater = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= LAND || yy >= LAND || ground[yy * LAND + xx] === 0) return true; } return false; };
  const plazaR = isStart ? 4.6 : 0;
  const entries = [...biome.res].sort((a, b) => (NODES[b[0]].solid === NODES[a[0]].solid ? 0 : NODES[b[0]].solid ? 1 : -1));
  for (const [nid, cnt] of entries) {
    const def = NODES[nid];
    const m = (theme.mult[nid] || 1) * (isStart ? 0.85 : 1);
    const want = Math.round(cnt * m);
    const clusterScale = def.tree ? 0.22 : def.plant ? 0.3 : 0.26;
    const nseed = seed + hash32(nid.length, nid.charCodeAt(0), nid.charCodeAt(nid.length - 1));
    let placed = 0, tries = 0;
    while (placed < want && tries < want * 30) {
      tries++;
      const x = 1 + rng.int(LAND - 2), y = 1 + rng.int(LAND - 2);
      if (!isFree(x, y)) continue;
      if (isStart && Math.hypot(x + 0.5 - LAND / 2, y + 0.5 - LAND / 2) < plazaR) continue;
      if (nid === 'sand_pile' && !nearWater(x, y)) continue;
      // clustering: accept proportional to noise
      const n = valueNoise((ox + x) * clusterScale, (oy + y) * clusterScale, nseed);
      if (rng.next() > (n * n * 1.6 + 0.12)) continue;
      // keep solid nodes from touching each other so lands stay walkable
      if (def.solid) {
        let crowded = false;
        for (let dy = -1; dy <= 1 && !crowded; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= LAND || yy >= LAND) continue;
          if (used[yy * LAND + xx] === 2) { if (def.tree ? (dx === 0 || dy === 0) : true) { crowded = true; break; } }
        }
        if (crowded) continue;
      }
      used[y * LAND + x] = def.solid ? 2 : 1;
      things.push({ type: nid, x, y });
      placed++;
    }
  }
  // chests & dig spots
  const specials = [];
  const nChest = isStart ? 0 : (rng.chance(0.6) ? 1 : 0) + (rng.chance(0.2) ? 1 : 0);
  const nDig = isStart ? 2 : 2 + rng.int(3);
  for (let k = 0; k < nChest + nDig; k++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 2 + rng.int(LAND - 4), y = 2 + rng.int(LAND - 4);
      if (!isFree(x, y)) continue;
      if (isStart && Math.hypot(x + 0.5 - LAND / 2, y + 0.5 - LAND / 2) < 3) continue;
      used[y * LAND + x] = 2;
      specials.push({ type: k < nChest ? 'chest_wild' : 'dig_spot', x, y });
      break;
    }
  }
  return { ground, things: things.concat(specials), biome: biome.id, theme: theme.id };
}

/** Fill the coast on already-owned neighbours' edges that face a newly bought land, so the lands merge. */
export function seamFill(world, gx, gy) {
  const changes = [];
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = gx + dx, ny = gy + dy;
    if (!world.isLandOwned(nx, ny)) continue;
    const nb = world.biomeOfLand(nx, ny);
    const code = GROUND_CODE[nb.ground];
    const [ox, oy] = world.landOrigin(nx, ny);
    // the neighbour's edge facing us: if we are to its south (dy=+1 from neighbour perspective is us at gy), its edge is the side towards (gx,gy)
    for (let k = 0; k < LAND; k++) for (let d = 0; d < 3; d++) {
      let tx, ty;
      if (dy === -1) { tx = ox + k; ty = oy + LAND - 1 - d; } // neighbour above us: its bottom rows
      else if (dy === 1) { tx = ox + k; ty = oy + d; } // neighbour below: its top rows
      else if (dx === 1) { tx = ox + d; ty = oy + k; } // neighbour right: its left cols
      else { tx = ox + LAND - 1 - d; ty = oy + k; } // neighbour left: its right cols
      if (world.ground[world.idx(tx, ty)] === 0 && !world.thingAt(tx, ty)) { changes.push([tx, ty, code]); }
    }
  }
  return changes;
}
