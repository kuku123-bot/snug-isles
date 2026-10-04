// Terrain art: ground tiles per biome, decorations, animated water, foam, cliffs and edge composition.
import { Pixmap, hex, darker, lighter, mixC, withAlpha, bayer, INK, A } from '../pixmap.js';
import { RNG, strHash } from '../../util.js';
import { GROUND, WATER } from '../palette.js';

export const GROUND_KINDS = Object.keys(GROUND);
const GV = 4; // base variants per ground
export const DECOS = 4;
export const WATER_VARIANTS = 3;
export const WATER_FRAMES = 4;

const col = (g) => ({ base: hex(g.base), lo: hex(g.lo), hi: hex(g.hi), tuft: hex(g.tuft), edge: hex(g.edge), dirt: hex(g.dirt) });

function cluster(pm, rng, color, n, maxLen = 2) {
  for (let i = 0; i < n; i++) {
    const x = rng.int(16), y = rng.int(16), len = 1 + rng.int(maxLen), horiz = rng.chance(0.65);
    for (let k = 0; k < len; k++) pm.set(horiz ? (x + k) & 15 : x, horiz ? y : (y + k) & 15, color);
  }
}
function tuft(pm, x, y, c, hiC) {
  pm.set(x, y, c); pm.set(x + 2, y, c); pm.set(x + 1, y + 1, c);
  if (hiC !== undefined) { pm.set(x, y - 1, hiC); pm.set(x + 2, y - 1, hiC); }
}

/** One 16x16 ground tile (no edges). */
export function groundTile(kind, v) {
  const g = col(GROUND[kind]);
  const rng = new RNG(strHash(kind) + v * 7919 + 13);
  const pm = new Pixmap(16, 16).fill(g.base);
  cluster(pm, rng, g.lo, 9);
  cluster(pm, rng, g.hi, 8);
  switch (kind) {
    case 'grass':
      if (v === 1 || v === 3) tuft(pm, 2 + rng.int(9), 3 + rng.int(9), g.tuft, g.hi);
      if (v === 2 || v === 3) tuft(pm, 3 + rng.int(9), 3 + rng.int(9), g.tuft, g.hi);
      break;
    case 'sand':
      for (let i = 0; i < 2; i++) { // soft ripples
        const x = rng.int(10), y = 2 + rng.int(12);
        pm.hline(x, y, 3, g.lo); pm.set(x + 3, y - 1, g.lo);
      }
      if (v === 3) { const x = 3 + rng.int(9), y = 3 + rng.int(9); pm.set(x, y, g.dirt); pm.set(x + 1, y, g.dirt); pm.set(x, y - 1, g.hi); }
      break;
    case 'snow':
      for (let i = 0; i < 3; i++) pm.set(rng.int(16), rng.int(16), hex('#cfe6ff'));
      if (v === 2) { const x = 2 + rng.int(10), y = 3 + rng.int(9); pm.hline(x, y, 3, g.lo); pm.hline(x + 1, y + 1, 2, g.lo); }
      break;
    case 'swamp':
      if (v >= 2) { // murky puddle
        const x = 3 + rng.int(7), y = 4 + rng.int(7);
        pm.ellipse(x + 2, y + 1, 3, 1.6, hex('#2f6a6a')); pm.hline(x + 1, y, 2, hex('#4f9a8c'));
      }
      if (v === 1) tuft(pm, 2 + rng.int(9), 3 + rng.int(9), g.tuft, g.hi);
      break;
    case 'grave':
      for (let i = 0; i < 2; i++) { // cracks
        let x = rng.int(14), y = rng.int(14);
        for (let k = 0; k < 4; k++) { pm.set(x, y, g.lo); x += rng.chance(0.5) ? 1 : 0; y += rng.chance(0.6) ? 1 : 0; }
      }
      if (v === 1 || v === 2) tuft(pm, 2 + rng.int(9), 3 + rng.int(9), g.tuft);
      break;
    case 'volcano':
      if (v >= 2) { // glowing crack
        let x = 2 + rng.int(8), y = 2 + rng.int(10);
        for (let k = 0; k < 6; k++) {
          pm.set(x, y, hex('#ff6a2e'));
          if (k % 2 === 0) pm.set(x, y + 1, hex('#ffd27a'));
          x += 1; y += rng.chance(0.5) ? 1 : 0;
        }
      }
      break;
    case 'crystal':
      for (let i = 0; i < 3; i++) { const x = rng.int(16), y = rng.int(16); pm.set(x, y, rng.pick([hex('#ffb8e0'), hex('#9ff0e0'), hex('#ffffff')])); }
      if (v === 3) { const x = 3 + rng.int(9), y = 3 + rng.int(9); pm.set(x, y, hex('#ffffff')); pm.set(x - 1, y, hex('#ffffffaa')); pm.set(x + 1, y, hex('#ffffffaa')); pm.set(x, y - 1, hex('#ffffffaa')); pm.set(x, y + 1, hex('#ffffffaa')); }
      break;
    case 'void':
      for (let i = 0; i < 5; i++) pm.set(rng.int(16), rng.int(16), rng.pick([hex('#fffbd0'), hex('#a9c4ff'), hex('#ffb3e6'), hex('#6f5cc8')]));
      if (v === 2) pm.ellipse(5 + rng.int(6), 5 + rng.int(6), 3.5, 2.5, hex('#3a2a7a'));
      break;
  }
  return pm;
}

/** Sparse decoration overlay for a ground kind (index 0..DECOS-1), 16x16 mostly transparent. */
export function decoTile(kind, n) {
  const pm = new Pixmap(16, 16);
  const g = col(GROUND[kind]);
  const rng = new RNG(strHash('deco' + kind) + n * 31);
  const x = 4 + rng.int(7), y = 5 + rng.int(7);
  const stem = hex('#3f9a45');
  switch (kind) {
    case 'grass': {
      const petals = [hex('#ffffff'), hex('#ff9fc0'), hex('#ffe066'), hex('#8fb8ff')][n];
      pm.set(x, y + 1, stem); pm.set(x, y + 2, stem); pm.set(x - 1, y + 2, stem);
      pm.set(x, y, hex('#ffd84a'));
      pm.set(x - 1, y, petals); pm.set(x + 1, y, petals); pm.set(x, y - 1, petals);
      if (n !== 3) pm.set(x, y + 1, petals === hex('#ffffff') ? hex('#e8f0ff') : stem);
      pm.outline(withAlpha(darker(stem, 0.5), 150));
      break;
    }
    case 'sand':
      if (n === 0) { pm.ellipse(x, y, 2.5, 1.8, hex('#fff1e6')); pm.hline(x - 1, y, 3, hex('#f3b9a5')); pm.outline(withAlpha(hex('#b98a5a'), 255)); }
      else if (n === 1) { for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]]) pm.set(x + dx, y + dy, hex('#ff9a7a')); pm.outline(hex('#b5603f')); }
      else if (n === 2) { pm.set(x, y, hex('#b9a37a')); pm.set(x + 1, y, hex('#a48d62')); pm.set(x - 2, y + 2, hex('#a48d62')); pm.set(x + 3, y - 1, hex('#c9b68c')); }
      else { pm.line(x - 2, y + 1, x + 2, y - 1, hex('#8a6a40')); pm.set(x + 2, y - 2, hex('#8a6a40')); }
      break;
    case 'snow':
      if (n === 0) { tuft(pm, x - 1, y, hex('#ffffff'), hex('#ffffff')); pm.outline(withAlpha(hex('#9bb4d4'), 255)); }
      else if (n === 1) { pm.set(x, y + 2, stem); pm.set(x, y + 1, stem); pm.set(x, y, hex('#ffffff')); pm.set(x - 1, y + 1, hex('#ffffff')); pm.set(x + 1, y + 1, hex('#ffffff')); pm.outline(hex('#7a9bc4')); }
      else if (n === 2) { pm.line(x - 2, y, x + 2, y + 1, hex('#8a6a4a')); pm.set(x, y - 1, hex('#8a6a4a')); }
      else { pm.set(x, y, hex('#bfe6ff')); pm.set(x + 1, y, hex('#e8f6ff')); pm.set(x, y + 1, hex('#8fc7f2')); pm.outline(hex('#6aa6d8')); }
      break;
    case 'swamp':
      if (n === 0) { for (let k = 0; k < 4; k++) pm.vline(x + k - 1, y - (k % 2) * 2, 5, hex('#6a9a4a')); pm.set(x, y - 2, hex('#8a5a3a')); pm.set(x + 2, y - 3, hex('#8a5a3a')); pm.outline(hex('#274a30')); }
      else if (n === 1) { pm.ellipse(x, y, 3, 2, hex('#6fcf6a')); pm.set(x + 1, y, hex('#2f6a6a')); pm.outline(hex('#2a6a3a')); }
      else if (n === 2) { pm.ellipse(x, y, 3.5, 1.8, hex('#2f6a70')); pm.hline(x - 1, y - 1, 2, hex('#6fb8b0')); pm.outline(hex('#1f4a50')); }
      else { pm.set(x, y + 1, hex('#e8f0d0')); pm.rect(x - 1, y - 1, 3, 2, hex('#7fffd0')); pm.set(x, y - 2, hex('#b8ffe8')); pm.outline(hex('#2a6a5a')); }
      break;
    case 'grave':
      if (n === 0) { pm.rect(x - 2, y, 5, 1, hex('#efe6d0')); pm.set(x - 2, y - 1, hex('#efe6d0')); pm.set(x + 2, y + 1, hex('#efe6d0')); pm.outline(hex('#4b3f5a')); }
      else if (n === 1) { pm.line(x - 2, y + 1, x + 2, y - 1, hex('#5a4a40')); pm.line(x, y, x + 2, y + 2, hex('#5a4a40')); }
      else if (n === 2) { pm.ellipse(x, y, 2.5, 2, hex('#efe6d0')); pm.set(x - 1, y, hex('#2a1f3d')); pm.set(x + 1, y, hex('#2a1f3d')); pm.outline(hex('#4b3f5a')); }
      else { pm.rect(x - 1, y, 3, 3, hex('#f4ecd8')); pm.set(x, y - 1, hex('#ffd84a')); pm.set(x, y - 2, hex('#ff9a3c')); pm.outline(hex('#4b3f5a')); }
      break;
    case 'volcano':
      if (n === 0) { pm.set(x, y, hex('#ffd27a')); pm.set(x + 1, y, hex('#ff8a3d')); pm.set(x, y + 1, hex('#ff6a2e')); }
      else if (n === 1) { pm.ellipse(x, y, 2, 1.5, hex('#3a2832')); pm.set(x - 1, y - 1, hex('#6a5662')); pm.outline(hex('#1f1219')); }
      else if (n === 2) { pm.ellipse(x, y + 1, 3.5, 2, hex('#8a7a82')); pm.set(x - 1, y, hex('#b3a3ab')); pm.outline(hex('#3a2832')); }
      else { for (let k = 0; k < 5; k++) pm.set(x + k, y + (k % 2), hex('#ff7a3d')); pm.set(x + 2, y, hex('#ffd27a')); }
      break;
    case 'crystal':
      if (n < 2) { const c = n === 0 ? hex('#ff9fd0') : hex('#7fe8d4'); pm.rect(x, y - 2, 2, 5, c); pm.set(x, y - 3, lighter(c)); pm.set(x - 1, y, darker(c)); pm.set(x + 2, y + 1, darker(c)); pm.outline(darker(c, 0.6)); }
      else if (n === 2) { for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) pm.set(x + dx, y + dy, hex('#ffffff')); pm.set(x, y, hex('#ffe066')); }
      else { pm.set(x, y, hex('#ffffff')); pm.set(x + 3, y + 2, hex('#ffb8e0')); pm.set(x - 2, y + 3, hex('#9ff0e0')); }
      break;
    case 'void':
      if (n === 0) { pm.set(x, y, hex('#ffffff')); pm.set(x - 1, y, hex('#fffbd0aa')); pm.set(x + 1, y, hex('#fffbd0aa')); pm.set(x, y - 1, hex('#fffbd0aa')); pm.set(x, y + 1, hex('#fffbd0aa')); }
      else if (n === 1) { pm.set(x, y, hex('#a9c4ff')); pm.set(x + 3, y + 2, hex('#ffb3e6')); pm.set(x - 3, y + 1, hex('#fffbd0')); }
      else if (n === 2) { pm.rect(x, y, 1, 3, hex('#8a6cff')); pm.set(x - 1, y, hex('#b79cff')); pm.set(x + 1, y - 1, hex('#b79cff')); pm.set(x, y - 1, hex('#e1d4ff')); pm.outline(hex('#14092e')); }
      else { pm.ellipse(x, y, 3, 2, hex('#4a3a9a')); pm.set(x, y, hex('#fffbd0')); }
      break;
  }
  return pm;
}

/** Water tile: tone 'shallow' | 'deep', variant 0..2, frame 0..3 */
export function waterTile(tone, variant, frame) {
  const base = hex(tone === 'deep' ? WATER.deep : WATER.shallow);
  const mid = hex(tone === 'deep' ? WATER.mid : '#4cb6f0');
  const hi = hex(WATER.hi), glint = hex(WATER.glint);
  const pm = new Pixmap(16, 16).fill(base);
  const rng = new RNG(900 + variant * 131 + (tone === 'deep' ? 7 : 0));
  // static darker blotches for depth
  for (let i = 0; i < 6; i++) { const x = rng.int(14), y = rng.int(16); pm.hline(x, y, 2 + rng.int(3), mid); }
  // drifting wave dashes (looks like ~ moving to the right)
  const dashes = 3;
  for (let i = 0; i < dashes; i++) {
    const bx = rng.int(16), y = 1 + ((i * 5 + variant * 3 + rng.int(3)) % 14);
    const x = (bx + frame) & 15;
    const wave = [[0, 1], [1, 0], [2, 0], [3, 1]];
    for (const [dx, dy] of wave) pm.set((x + dx) & 15, y + dy, hi);
  }
  const gx = (variant * 5 + 3) & 15, gy = (variant * 7 + 2) & 15;
  if (frame === 1 || frame === 3) { pm.set(gx, gy, glint); pm.set(gx + 1, gy, withAlpha(glint, 160)); }
  if (frame === 2) pm.set((gx + 7) & 15, (gy + 6) & 15, glint);
  return pm;
}

/** Foam on a water tile where land touches. side = 'n'|'e'|'s'|'w', frame 0..1 */
export function foamTile(side, frame) {
  const pm = new Pixmap(16, 16);
  const f = hex(WATER.foam), f2 = withAlpha(f, 150);
  for (let i = 0; i < 16; i++) {
    const wob = Math.round(Math.sin((i + frame * 4) * 0.8) * 0.8);
    const d = 1 + wob; // distance from the edge in px
    const px = side === 'n' ? [i, d] : side === 's' ? [i, 15 - d] : side === 'w' ? [d, i] : [15 - d, i];
    pm.set(px[0], px[1], f);
    const px2 = side === 'n' ? [i, d + 1] : side === 's' ? [i, 14 - d] : side === 'w' ? [d + 1, i] : [14 - d, i];
    if ((i + frame) % 3 !== 0) pm.set(px2[0], px2[1], f2);
  }
  return pm;
}

/** Cliff face drawn on the water tile south of a land tile. m bit0 = round left end, bit1 = round right end. 16x8 */
export function cliffTile(kind, m) {
  const g = col(GROUND[kind]);
  const dirt = g.dirt;
  const pm = new Pixmap(16, 8);
  const rng = new RNG(strHash('cliff' + kind));
  pm.rect(0, 0, 16, 1, darker(g.base, 0.4)); // shaded underside of the grass lip
  pm.rect(0, 1, 16, 2, lighter(dirt, 0.12));
  pm.rect(0, 3, 16, 3, dirt);
  pm.rect(0, 6, 16, 1, darker(dirt, 0.28));
  for (let i = 0; i < 6; i++) pm.set(rng.int(16), 1 + rng.int(5), darker(dirt, 0.3));
  for (let i = 0; i < 4; i++) pm.set(rng.int(16), 1 + rng.int(3), lighter(dirt, 0.3));
  // pebbles
  pm.set(4, 4, lighter(dirt, 0.4)); pm.set(11, 3, lighter(dirt, 0.4)); pm.set(5, 4, darker(dirt, 0.35));
  const dk = darker(dirt, 0.65);
  pm.hline(0, 7, 16, withAlpha(dk, 0));
  if (m & 1) { pm.set(0, 0, 0); pm.set(0, 1, 0); pm.set(0, 6, 0); pm.set(1, 6, darker(dirt, 0.5)); pm.set(0, 5, darker(dirt, 0.5)); }
  if (m & 2) { pm.set(15, 0, 0); pm.set(15, 1, 0); pm.set(15, 6, 0); pm.set(14, 6, darker(dirt, 0.5)); pm.set(15, 5, darker(dirt, 0.5)); }
  // outline the bottom + ends
  const out = darker(dirt, 0.7);
  pm.hline(m & 1 ? 1 : 0, 7, 16 - ((m & 1) ? 1 : 0) - ((m & 2) ? 1 : 0), out);
  if (!(m & 1)) { /* keep square end */ }
  return pm;
}

// ---- neighbour mask bits for land composition
export const NB = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 };

/**
 * Compose a land tile: base ground pixmap + shoreline edges (mask = water neighbours) + biome blending toward
 * different-biome neighbours (nb = {n,e,s,w} -> {pm} of the neighbouring tile's base, or null).
 */
export function composeLand(basePm, kind, mask, nb = null) {
  const g = col(GROUND[kind]);
  const pm = basePm.clone();
  // biome blend: dither the neighbour's pixels into a band along the shared edge
  if (nb) {
    const band = 5;
    for (const side of ['n', 'e', 's', 'w']) {
      const o = nb[side];
      if (!o) continue;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = side === 'n' ? y : side === 's' ? 15 - y : side === 'w' ? x : 15 - x;
        if (d >= band) continue;
        const t = ((band - d) / band) * 0.55;
        if (bayer(x, y) < t) pm.set(x, y, o.get(x, y));
      }
    }
  }
  const eo = g.edge;
  const hiC = lighter(g.base, 0.3), loC = darker(g.base, 0.22);
  const N = mask & NB.N, E = mask & NB.E, S = mask & NB.S, W = mask & NB.W;
  if (N) { pm.hline(0, 1, 16, hiC); pm.hline(0, 0, 16, eo); }
  if (W) { pm.vline(1, 0, 16, hiC); pm.vline(0, 0, 16, eo); }
  if (E) { pm.vline(14, 0, 16, loC); pm.vline(15, 0, 16, eo); }
  if (S) { pm.hline(0, 14, 16, loC); pm.hline(0, 15, 16, eo); }
  const cut = (cx, cy, sx, sy) => {
    // chamfer-style rounded corner: remove x+y<3 and outline x+y==3 (in corner-local coords)
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) pm.set(cx + sx * k, cy + sy * j, 0);
    pm.set(cx + sx * 3, cy, eo); pm.set(cx + sx * 2, cy + sy, eo); pm.set(cx + sx, cy + sy * 2, eo); pm.set(cx, cy + sy * 3, eo);
    pm.set(cx + sx * 3, cy + sy, hiC === 0 ? eo : (sx > 0 && sy > 0 ? hiC : loC));
  };
  if (N && W) cut(0, 0, 1, 1);
  if (N && E) cut(15, 0, -1, 1);
  if (S && W) cut(0, 15, 1, -1);
  if (S && E) cut(15, 15, -1, -1);
  // inner (concave) corners
  if (!N && !W && mask & NB.NW) { pm.set(0, 0, eo); pm.set(1, 0, eo); pm.set(0, 1, eo); }
  if (!N && !E && mask & NB.NE) { pm.set(15, 0, eo); pm.set(14, 0, eo); pm.set(15, 1, eo); }
  if (!S && !W && mask & NB.SW) { pm.set(0, 15, eo); pm.set(1, 15, eo); pm.set(0, 14, eo); }
  if (!S && !E && mask & NB.SE) { pm.set(15, 15, eo); pm.set(14, 15, eo); pm.set(15, 14, eo); }
  return pm;
}

export function registerTerrain(book) {
  for (const kind of GROUND_KINDS) {
    for (let v = 0; v < GV; v++) book.add(`g_${kind}_${v}`, groundTile(kind, v));
    for (let n = 0; n < DECOS; n++) book.add(`deco_${kind}_${n}`, decoTile(kind, n));
    for (let m = 0; m < 4; m++) book.add(`cliff_${kind}_${m}`, cliffTile(kind, m));
  }
  for (const tone of ['shallow', 'deep']) for (let v = 0; v < WATER_VARIANTS; v++) for (let f = 0; f < WATER_FRAMES; f++) book.add(`water_${tone}_${v}_${f}`, waterTile(tone, v, f));
  for (const s of ['n', 'e', 's', 'w']) for (let f = 0; f < 2; f++) book.add(`foam_${s}_${f}`, foamTile(s, f));
}
export const GROUND_VARIANTS = GV;
