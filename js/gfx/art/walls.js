// Wall / window / door / fence / floor / wall-decor art.
// Wall sprite = 16x20: 4px "cap" above the footprint + 16px face. Faces tile vertically (period 16) and horizontally.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, bayer, INK, A } from '../pixmap.js';
import { RNG } from '../../util.js';
import { BUILD, WALL_MATS, WALL_IDS, FLOOR_IDS, WALLDECO_IDS } from '../../data/build.js';

const WHITE = hex('#ffffff');
const R = (c) => ramp(hex(c));

// ------------------------------------------------------------------ face patterns (draw into 16x16 at 0,0)
const FACES = {};
const CAPS = {}; // top-surface color per material
const TRIM = {}; // window/door frame palette base

function boards(pm, pal, vertical = true, w = 4) {
  pm.rect(0, 0, 16, 16, pal[2]);
  for (let x = 0; x < 16; x += w) {
    pm.vline(x, 0, 16, pal[3]);
    pm.vline(x + 1, 0, 16, pal[1]);
    const knot = (x * 7) % 11;
    pm.set(x + 2, 3 + knot, pal[3]); pm.set(x + 2, 4 + knot, pal[3]);
    pm.set(x + 1, 13, pal[4]);
  }
  pm.hline(0, 15, 16, pal[3]);
}
FACES.plank = (pm) => boards(pm, R('#d9a066'));
CAPS.plank = '#f0c088'; TRIM.plank = '#8a5a30';
FACES.log = (pm) => {
  const p = R('#b07840');
  for (let y = 0; y < 16; y += 4) {
    pm.rect(0, y, 16, 4, p[2]); pm.hline(0, y, 16, p[1]); pm.hline(0, y + 1, 16, lighter(p[2], 0.12)); pm.hline(0, y + 3, 16, p[3]);
    for (const x of [3 + (y * 3) % 7, 11 - (y * 2) % 5]) { pm.set(x, y + 2, p[3]); pm.set(x + 1, y + 2, p[4]); }
  }
};
CAPS.log = '#d8a060'; TRIM.log = '#6a4222';
FACES.thatch = (pm) => {
  const p = R('#e8c25a'), rng = new RNG(31);
  pm.rect(0, 0, 16, 16, p[2]);
  for (let y = 0; y < 16; y += 3) { pm.hline(0, y, 16, p[3]); for (let x = (y * 5) % 4; x < 16; x += 4) { pm.set(x, y + 1, p[1]); pm.set(x + 1, y + 1, p[1]); pm.set(x + 2, y + 2, p[3]); } }
  for (let i = 0; i < 14; i++) pm.set(rng.int(16), rng.int(16), rng.chance(0.5) ? p[0] : p[4]);
};
CAPS.thatch = '#f4d878'; TRIM.thatch = '#8a6a22';
const plasterFace = (base) => (pm) => {
  const p = R(base), rng = new RNG(base.length * 13 + base.charCodeAt(2));
  pm.rect(0, 0, 16, 16, p[2]);
  for (let i = 0; i < 16; i++) pm.set(rng.int(16), rng.int(13), rng.chance(0.5) ? p[1] : p[3]);
  pm.rect(0, 13, 16, 3, darker(p[3], 0.2)); pm.hline(0, 13, 16, p[4]); pm.hline(0, 14, 16, darker(p[3], 0.3));
};
FACES.plaster = plasterFace('#f6ecd8'); CAPS.plaster = '#fff8e8'; TRIM.plaster = '#8a5a3a';
FACES.pink = plasterFace('#ffc2d6'); CAPS.pink = '#ffe0ea'; TRIM.pink = '#e0709a';
FACES.mint = plasterFace('#b8ecd0'); CAPS.mint = '#d8fae8'; TRIM.mint = '#5ab890';
FACES.sky = plasterFace('#bcdcff'); CAPS.sky = '#dceeff'; TRIM.sky = '#5a8ad0';
FACES.butter = plasterFace('#ffe8a0'); CAPS.butter = '#fff4c8'; TRIM.butter = '#d8a830';
FACES.lilac = plasterFace('#d9c6f4'); CAPS.lilac = '#ece0fb'; TRIM.lilac = '#9a74d0';
FACES.peach = plasterFace('#ffd2b8'); CAPS.peach = '#ffe6d6'; TRIM.peach = '#e0825a';
FACES.seafoam = plasterFace('#bdf0e0'); CAPS.seafoam = '#dcfaf0'; TRIM.seafoam = '#48b898';
function blocks(pm, pal, rows, mortar) {
  pm.rect(0, 0, 16, 16, mortar);
  let y = 0;
  rows.forEach((row, ri) => {
    const h = row.h; let x = row.off || 0;
    for (const bw of row.w) {
      const x0 = x % 16;
      for (const xo of [0, -16]) { const bx = x0 + xo; if (bx + bw <= 0 || bx >= 16) continue; blockFill(pm, bx + 1, y + 1, bw - 1, h - 1, pal, ri + bw); }
      x += bw;
    }
    y += h;
  });
}
function blockFill(pm, x, y, w, h, pal, seed) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    let c = pal[2];
    if (yy === 0) c = pal[1]; else if (yy === h - 1) c = pal[3]; else if (xx === 0) c = lighter(pal[2], 0.08); else if (xx === w - 1) c = darker(pal[2], 0.12);
    if (((xx * 3 + yy * 5 + seed) % 11) === 0) c = pal[3];
    pm.set(x + xx, y + yy, c);
  }
}
FACES.stone = (pm) => blocks(pm, R('#b6bccf'), [{ h: 5, w: [7, 9] }, { h: 6, w: [5, 6, 5], off: 3 }, { h: 5, w: [9, 7], off: 1 }], hex('#6a7088'));
CAPS.stone = '#d4d8e6'; TRIM.stone = '#5a6078';
FACES.brick = (pm) => blocks(pm, R('#d86a50'), [{ h: 4, w: [8, 8] }, { h: 4, w: [8, 8], off: 4 }, { h: 4, w: [8, 8] }, { h: 4, w: [8, 8], off: 4 }], hex('#f0d8c8'));
CAPS.brick = '#e89078'; TRIM.brick = '#7a3a2a';
FACES.glass = (pm) => {
  const p = R('#bfeaff');
  pm.rect(0, 0, 16, 16, withAlpha(p[1], 255));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (bayer(x, y) < (y / 16) * 0.5) pm.set(x, y, p[2]);
  pm.vline(0, 0, 16, WHITE); pm.vline(8, 0, 16, hex('#e8f8ff')); pm.hline(0, 0, 16, WHITE); pm.hline(0, 8, 16, hex('#e8f8ff')); pm.hline(0, 15, 16, hex('#9ad0f0'));
  for (const [x, y] of [[3, 2], [4, 3], [5, 4], [11, 10], [12, 11]]) pm.set(x, y, WHITE);
};
CAPS.glass = '#f4fcff'; TRIM.glass = '#8ac0e0';
FACES.sandstone = (pm) => blocks(pm, R('#eccb88'), [{ h: 8, w: [10, 6] }, { h: 8, w: [6, 10], off: 0 }], hex('#b8904a'));
CAPS.sandstone = '#f8e0a8'; TRIM.sandstone = '#8a6a32';
FACES.ice = (pm) => {
  const p = R('#b8e8ff'), rng = new RNG(77);
  blocks(pm, p, [{ h: 8, w: [8, 8] }, { h: 8, w: [5, 6, 5], off: 2 }], hex('#e8f8ff'));
  for (const [x, y] of [[3, 3], [11, 11], [5, 12], [12, 4]]) { pm.set(x, y, WHITE); pm.set(x + 1, y + 1, hex('#ffffffaa')); }
  pm.line(2, 10, 5, 14, hex('#ffffffaa'));
};
CAPS.ice = '#f0fbff'; TRIM.ice = '#6aa8d8';
FACES.iron = (pm) => {
  const p = R('#a4adc2');
  pm.rect(0, 0, 16, 16, p[2]);
  for (const y of [0, 8]) { pm.hline(0, y, 16, p[1]); pm.hline(0, y + 7, 16, p[4]); pm.hline(0, y + 6, 16, p[3]); }
  for (const y of [2, 10]) for (const x of [2, 13]) { pm.set(x, y, p[0]); pm.set(x, y + 1, p[4]); }
  pm.vline(8, 1, 6, p[3]); pm.vline(8, 9, 6, p[3]);
};
CAPS.iron = '#cdd4e4'; TRIM.iron = '#4a5268';
FACES.gilded = (pm) => {
  const w = R('#6a3a2a'), g = R('#ffcf45');
  boards(pm, w, true, 4);
  pm.hline(0, 0, 16, g[2]); pm.hline(0, 1, 16, g[3]); pm.hline(0, 14, 16, g[2]); pm.hline(0, 15, 16, g[3]);
  for (const x of [2, 6, 10, 14]) { pm.set(x, 7, g[1]); pm.set(x, 8, g[3]); }
};
CAPS.gilded = '#ffe48a'; TRIM.gilded = '#a8801a';
FACES.bone = (pm) => {
  const b = R('#f1ead7'), rng = new RNG(9);
  pm.rect(0, 0, 16, 16, hex('#6a5a6a'));
  for (let y = 0; y < 16; y += 4) for (let x = (y % 8) ? -3 : 1; x < 16; x += 8) { pm.rect(x, y + 1, 7, 3, b[2]); pm.hline(x, y + 1, 7, b[0]); pm.hline(x, y + 3, 7, b[3]); pm.circle(x, y + 2.5, 1.8, b[2]); pm.circle(x + 7, y + 2.5, 1.8, b[2]); }
};
CAPS.bone = '#fbf6e8'; TRIM.bone = '#5a4a5a';
FACES.obsidian = (pm) => {
  const p = R('#4a3a7a');
  blocks(pm, p, [{ h: 8, w: [9, 7] }, { h: 8, w: [6, 10], off: 0 }], hex('#1a1230'));
  for (const [x, y] of [[3, 2], [4, 3], [11, 10], [12, 11], [10, 3]]) pm.set(x, y, hex('#b8a8f0'));
};
CAPS.obsidian = '#7a68b0'; TRIM.obsidian = '#2a1f4a';
FACES.crystal = (pm) => {
  const cols = [R('#ffb8dc'), R('#a8f0e4'), R('#d4c0ff')];
  for (let x = 0; x < 16; x += 4) { const p = cols[(x / 4) % 3]; pm.poly([[x, 16], [x, 5], [x + 2, 0], [x + 4, 5], [x + 4, 16]], p[2]); pm.poly([[x, 16], [x, 5], [x + 2, 0], [x + 2, 16]], p[1]); pm.poly([[x + 2, 0], [x + 4, 5], [x + 4, 16], [x + 2, 16]], p[3]); pm.set(x + 1, 4, p[0]); pm.set(x + 1, 5, p[0]); }
  pm.hline(0, 15, 16, hex('#8a70c8'));
  for (const [x, y] of [[5, 9], [13, 12]]) pm.set(x, y, WHITE);
};
CAPS.crystal = '#f0d8ff'; TRIM.crystal = '#9a78d8';
FACES.star = (pm) => {
  const p = R('#2f2a6a'), g = R('#ffd84a'), rng = new RNG(3);
  pm.rect(0, 0, 16, 16, p[2]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (bayer(x, y) < (y / 16) * 0.4) pm.set(x, y, p[3]);
  for (let i = 0; i < 10; i++) pm.set(rng.int(16), rng.int(14), rng.pick([WHITE, hex('#a9c4ff'), hex('#fff0a0')]));
  pm.hline(0, 0, 16, g[2]); pm.hline(0, 15, 16, g[3]); pm.set(4, 5, WHITE); pm.set(3, 5, hex('#ffffff88')); pm.set(5, 5, hex('#ffffff88')); pm.set(4, 4, hex('#ffffff88')); pm.set(4, 6, hex('#ffffff88'));
};
CAPS.star = '#6a5ac0'; TRIM.star = '#ffd84a';

// ------------------------------------------------------------------ openings
function windowOn(pm, mat, glass = true) {
  const frame = R(TRIM[mat] || '#8a5a30');
  // frame
  pm.rect(3, 2, 10, 10, frame[2]); pm.rect(3, 2, 10, 1, frame[1]); pm.rect(3, 11, 10, 1, frame[4]); pm.vline(3, 2, 10, frame[1]); pm.vline(12, 2, 10, frame[3]);
  if (glass) {
    const g = R('#9ad8ff');
    pm.rect(4, 3, 8, 8, g[2]);
    for (let y = 3; y < 11; y++) for (let x = 4; x < 12; x++) if (bayer(x, y) < ((y - 3) / 8) * 0.55) pm.set(x, y, g[3]);
    pm.vline(7, 3, 8, frame[2]); pm.vline(8, 3, 8, frame[3]); pm.hline(4, 6, 8, frame[2]); pm.hline(4, 7, 8, frame[3]);
    pm.set(5, 4, WHITE); pm.set(5, 5, WHITE); pm.set(6, 4, hex('#ffffffaa')); pm.set(9, 8, hex('#ffffffaa'));
  } else {
    // open shuttered window: dark interior + shutters
    pm.rect(4, 3, 8, 8, hex('#3a2a40')); pm.rect(5, 4, 3, 3, hex('#5a4a60'));
    const s = R(mat === 'thatch' ? '#c8a040' : '#c8883e');
    pm.rect(1, 2, 3, 10, s[2]); pm.rect(12, 2, 3, 10, s[2]); pm.vline(2, 3, 8, s[3]); pm.vline(13, 3, 8, s[3]); pm.vline(1, 2, 10, s[1]); pm.vline(14, 2, 10, s[3]);
  }
  // sill + flower box for cosy walls
  pm.rect(2, 12, 12, 2, frame[3]); pm.hline(2, 12, 12, frame[1]);
  if (['plaster', 'pink', 'mint', 'sky', 'butter', 'plank', 'log', 'thatch'].includes(mat)) {
    for (const [x, c] of [[3, '#ff8fb3'], [5, '#ffe066'], [7, '#ffffff'], [9, '#ff8fb3'], [11, '#8fb8ff']]) { pm.set(x, 11, hex('#4aa84a')); pm.set(x, 10, hex(c)); }
  }
}
function doorOn(pm, mat, open) {
  const frame = R(TRIM[mat] || '#8a5a30');
  const metal = mat === 'iron' || mat === 'obsidian' || mat === 'crystal' || mat === 'star' || mat === 'glass' || mat === 'ice';
  const dp = metal ? R({ iron: '#8a94ac', obsidian: '#3a2a60', crystal: '#c8a8f0', star: '#4a3a9a', glass: '#bfeaff', ice: '#d0f0ff' }[mat]) : R('#a86f3d');
  // frame
  pm.rect(2, 1, 12, 15, frame[3]); pm.rect(2, 1, 12, 1, frame[1]); pm.vline(2, 1, 15, frame[2]);
  pm.rect(3, 2, 10, 14, open ? hex('#2a1e34') : dp[2]);
  if (open) {
    pm.rect(4, 3, 8, 13, hex('#3a2a46')); pm.rect(4, 12, 8, 4, hex('#5a4a50')); pm.rect(5, 13, 6, 3, hex('#6a5a58'));
    pm.rect(3, 2, 2, 14, dp[2]); pm.vline(3, 2, 14, dp[1]); pm.vline(4, 2, 14, dp[3]);
  } else {
    if (mat === 'glass' || mat === 'ice') { pm.rect(3, 2, 10, 14, withAlpha(dp[1], 255)); pm.vline(8, 2, 14, WHITE); pm.hline(3, 8, 10, WHITE); pm.set(5, 4, WHITE); pm.set(5, 5, WHITE); }
    else {
      for (let x = 3; x < 13; x += 3) { pm.vline(x, 2, 14, dp[1]); pm.vline(x + 1, 2, 14, dp[3]); }
      pm.rect(3, 2, 10, 1, dp[1]); pm.hline(3, 8, 10, dp[3]);
      if (metal) { for (const [x, y] of [[4, 4], [11, 4], [4, 12], [11, 12]]) pm.set(x, y, hex('#e8ecf8')); }
    }
    pm.rect(10, 9, 2, 2, hex('#ffd84a')); pm.set(10, 9, hex('#fff3a8')); pm.set(11, 10, hex('#a8801a'));
  }
  pm.rect(2, 15, 12, 1, frame[4]);
}

// ------------------------------------------------------------------ composition
/** mask: N=1, E=2, W=4 (wall present). */
export function wallSprite(mat, piece, mask = 0, open = 0) {
  const pm = new Pixmap(16, 20);
  const face = new Pixmap(16, 16);
  FACES[mat](face);
  if (piece === 'window') windowOn(face, mat, !['plank', 'log', 'thatch'].includes(mat));
  else if (piece === 'door') doorOn(face, mat, open);
  pm.blit(face, 0, 4);
  const hasN = mask & 1, hasE = mask & 2, hasW = mask & 4;
  const capC = ramp(hex(CAPS[mat]));
  const edge = darker(R(TRIM[mat] || '#6a4222')[3], 0.45);
  if (!hasN) {
    // cap on top of the face, in the 4 rows above
    pm.rect(0, 0, 16, 4, capC[2]);
    pm.hline(0, 0, 16, capC[0]); pm.hline(0, 1, 16, capC[1]); pm.hline(0, 3, 16, capC[3]);
    for (let x = 2; x < 16; x += 5) pm.set(x, 2, capC[3]);
    // lip highlight where the cap meets the face
    pm.hline(0, 4, 16, mixC(pm.get(0, 4), capC[3], 0.3));
  }
  const top = hasN ? 4 : 0;
  // side edges
  if (!hasW) { pm.vline(0, top, 20 - top, darker(pm.get(1, 10), 0.35)); pm.vline(1, top + (hasN ? 0 : 1), 20 - top - 1, lighter(pm.get(2, 10), 0.18)); }
  if (!hasE) { pm.vline(15, top, 20 - top, darker(pm.get(14, 10), 0.4)); pm.vline(14, top + 1, 19 - top, darker(pm.get(13, 10), 0.14)); }
  // dark base line
  pm.hline(0, 19, 16, darker(pm.get(2, 18), 0.5));
  // rounded cap ends
  if (!hasN) {
    if (!hasW) { pm.set(0, 0, 0); pm.set(1, 0, 0); pm.set(0, 1, 0); }
    if (!hasE) { pm.set(15, 0, 0); pm.set(14, 0, 0); pm.set(15, 1, 0); }
  }
  // log ends
  if (mat === 'log') {
    const ring = R('#e8c08a'), b = R('#b07840');
    for (const [side, show] of [[0, !hasW], [1, !hasE]]) if (show) for (let y = 4; y < 20; y += 4) { const x = side ? 13 : 0; pm.ellipse(x + 1.5, y + 2, 2.2, 1.9, ring[1]); pm.ellipse(x + 1.5, y + 2, 1, 0.9, ring[3]); pm.hline(x, y + 3, 3, b[4]); }
  }
  // plaster: timber posts at ends
  if (['plaster', 'pink', 'mint', 'sky', 'butter'].includes(mat)) {
    const t = R('#8a5a3a');
    if (!hasW) { pm.rect(0, top, 2, 20 - top, t[2]); pm.vline(0, top, 20 - top, t[1]); }
    if (!hasE) { pm.rect(14, top, 2, 20 - top, t[3]); pm.vline(15, top, 20 - top, t[4]); }
  }
  pm.outline(withAlpha(hex('#2a1f3d'), 0)); // no external outline (walls are tiled)
  return pm;
}

/** fence / gate (low, see-through). mask: E=2, W=4 */
export function fenceSprite(mat, gate, mask = 0, open = 0) {
  const pm = new Pixmap(16, 20);
  const pal = R({ wood: '#d9a066', picket: '#fffaf0', stone: '#aab0c4', iron: '#6a7490', bone: '#f1ead7', drift: '#cdbb9c' }[mat]);
  const dark = darker(pal[3], 0.3);
  const hasE = mask & 2, hasW = mask & 4;
  if (mat === 'stone') {
    // low stone wall
    pm.rect(0, 10, 16, 9, pal[2]); pm.hline(0, 10, 16, pal[0]); pm.hline(0, 11, 16, pal[1]); pm.hline(0, 18, 16, pal[4]);
    for (const x of [4, 10]) pm.vline(x, 12, 3, pal[3]); pm.vline(7, 15, 3, pal[3]); pm.vline(13, 15, 3, pal[3]); pm.hline(0, 14, 16, pal[3]);
    pm.rect(0, 8, 16, 2, pal[1]); pm.hline(0, 8, 16, pal[0]);
    if (!hasW) pm.vline(0, 9, 10, dark); if (!hasE) pm.vline(15, 9, 10, dark);
    if (gate) { pm.rect(3, 4, 10, 6, hex('#00000000')); }
  } else {
    // posts
    const post = (x) => { pm.rect(x, 6, 3, 13, pal[2]); pm.vline(x, 6, 13, pal[1]); pm.vline(x + 2, 6, 13, pal[3]); pm.rect(x, 5, 3, 1, pal[0]); if (mat === 'picket') { pm.set(x + 1, 4, pal[1]); } };
    if (mat === 'picket') {
      for (let x = 0; x < 16; x += 4) { pm.rect(x + 1, 6, 3, 13, pal[2]); pm.vline(x + 1, 6, 13, WHITE); pm.vline(x + 3, 6, 13, pal[3]); pm.set(x + 2, 5, pal[1]); pm.set(x + 2, 4, pal[0]); pm.set(x + 1, 5, pal[2]); pm.set(x + 3, 5, pal[2]); }
      pm.rect(0, 10, 16, 2, pal[3]); pm.hline(0, 10, 16, pal[2]); pm.rect(0, 15, 16, 2, pal[3]); pm.hline(0, 15, 16, pal[2]);
    } else if (mat === 'iron') {
      for (let x = 1; x < 16; x += 4) { pm.vline(x, 4, 15, pal[2]); pm.vline(x + 1, 4, 15, pal[3]); pm.set(x, 3, pal[0]); pm.set(x, 2, pal[1]); pm.set(x + 1, 3, pal[1]); }
      pm.rect(0, 8, 16, 2, pal[2]); pm.rect(0, 15, 16, 2, pal[2]); pm.hline(0, 8, 16, pal[1]); pm.hline(0, 15, 16, pal[1]); pm.hline(0, 9, 16, pal[4]); pm.hline(0, 16, 16, pal[4]);
    } else if (mat === 'bone') {
      for (let x = 1; x < 16; x += 5) { pm.rect(x, 5, 3, 14, pal[2]); pm.vline(x, 5, 14, pal[1]); pm.vline(x + 2, 5, 14, pal[3]); pm.circle(x + 1.5, 5.5, 2, pal[1]); pm.set(x + 1, 4, pal[0]); }
      pm.rect(0, 10, 16, 2, pal[3]); pm.rect(0, 15, 16, 2, pal[3]); pm.hline(0, 10, 16, pal[2]);
    } else {
      post(0); post(13);
      if (hasE || true) { pm.rect(3, 8, 10, 2, pal[2]); pm.hline(3, 8, 10, pal[1]); pm.hline(3, 9, 10, pal[3]); pm.rect(3, 13, 10, 2, pal[2]); pm.hline(3, 13, 10, pal[1]); pm.hline(3, 14, 10, pal[3]); }
      if (hasE) { pm.rect(13, 8, 3, 2, pal[2]); pm.rect(13, 13, 3, 2, pal[2]); pm.hline(13, 8, 3, pal[1]); pm.hline(13, 13, 3, pal[1]); }
      if (hasW) { pm.rect(0, 8, 3, 2, pal[2]); pm.rect(0, 13, 3, 2, pal[2]); pm.hline(0, 8, 3, pal[1]); pm.hline(0, 13, 3, pal[1]); }
    }
  }
  if (gate) {
    if (open) { pm.rect(2, 4, 12, 15, hex('#00000000')); const g = pal; pm.rect(1, 6, 2, 13, g[2]); pm.rect(13, 6, 2, 13, g[2]); pm.rect(1, 9, 2, 2, g[3]); pm.rect(13, 9, 2, 2, g[3]); }
    else { pm.rect(6, 4, 4, 1, pal[1]); pm.rect(7, 10, 2, 3, hex('#ffd84a')); pm.set(7, 10, hex('#fff3a8')); }
  }
  // soft ground shadow
  const sh = withAlpha(hex('#1e1440'), 60);
  for (let x = 1; x < 15; x++) pm.under(x, 19, sh);
  pm.outline(null, { amt: 0.7 });
  return pm;
}

// ------------------------------------------------------------------ floors (16x16 tileable)
const FLOORFN = {};
function planksFloor(pm, base, rows = 4) {
  const p = R(base), rng = new RNG(base.length + 5);
  pm.rect(0, 0, 16, 16, p[2]);
  for (let y = 0; y < 16; y += 4) {
    pm.hline(0, y, 16, p[3]); pm.hline(0, y + 1, 16, p[1]);
    const off = (y / 4) % 2 ? 8 : 3;
    pm.vline(off, y + 1, 3, p[3]);
    pm.set((off + 6) % 16, y + 2, p[3]);
    for (let i = 0; i < 3; i++) pm.set(rng.int(16), y + 1 + rng.int(3), rng.chance(0.5) ? p[1] : p[3]);
  }
}
FLOORFN.plank = (pm) => planksFloor(pm, '#d9a066');
FLOORFN.dark = (pm) => planksFloor(pm, '#7a4a30');
FLOORFN.parquet = (pm) => {
  const p = R('#d0904a');
  pm.rect(0, 0, 16, 16, p[2]);
  for (let by = 0; by < 16; by += 8) for (let bx = 0; bx < 16; bx += 8) {
    const horiz = ((bx + by) / 8) % 2 === 0;
    for (let k = 0; k < 8; k += 2) { if (horiz) { pm.hline(bx, by + k, 8, p[3]); pm.hline(bx, by + k + 1, 8, p[1]); } else { pm.vline(bx + k, by, 8, p[3]); pm.vline(bx + k + 1, by, 8, p[1]); } }
    pm.frame(bx, by, 8, 8, p[4]);
  }
};
FLOORFN.straw = (pm) => {
  const p = R('#e8c870');
  pm.rect(0, 0, 16, 16, p[2]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (((x + (y >> 1) * 2) & 3) === 0 && (y & 1)) pm.set(x, y, p[3]); else if (((x + y) & 3) === 0) pm.set(x, y, p[1]); }
  pm.hline(0, 0, 16, p[3]); pm.hline(0, 8, 16, p[3]);
};
FLOORFN.path = (pm) => {
  const p = R('#c8a078'), rng = new RNG(4);
  pm.rect(0, 0, 16, 16, p[2]);
  for (let i = 0; i < 18; i++) { const x = rng.int(15), y = rng.int(15); pm.set(x, y, rng.chance(0.5) ? p[1] : p[3]); }
  for (const [x, y] of [[3, 4], [10, 9], [6, 12], [12, 3]]) { pm.set(x, y, p[0]); pm.set(x + 1, y, p[3]); }
};
FLOORFN.cobble = (pm) => {
  const rng = new RNG(8);
  pm.rect(0, 0, 16, 16, hex('#6a7088'));
  const stones = [[1, 1, 5, 4], [7, 1, 4, 5], [12, 1, 3, 4], [1, 6, 4, 4], [6, 7, 5, 4], [12, 6, 3, 5], [1, 11, 6, 4], [8, 12, 4, 3], [13, 12, 2, 3]];
  const p = R('#b6bccf');
  for (const [x, y, w, h] of stones) blockFill(pm, x, y, w, h, p, x + y);
};
FLOORFN.flagstone = (pm) => {
  const p = R('#b0b6c8');
  pm.rect(0, 0, 16, 16, hex('#707890'));
  for (const [x, y, w, h] of [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) { blockFill(pm, x + 1, y + 1, w - 1, h - 1, p, x * 3 + y); }
  pm.set(3, 3, p[0]); pm.set(12, 12, p[0]);
};
const carpet = (base, accent) => (pm) => {
  const p = R(base), a = R(accent);
  pm.rect(0, 0, 16, 16, p[2]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (((x ^ y) & 1) && (x + y) % 4 === 1) pm.set(x, y, p[1]); }
  // soft diamond motif
  for (const [cx, cy] of [[4, 4], [12, 12]]) { pm.set(cx, cy - 1, a[2]); pm.set(cx - 1, cy, a[2]); pm.set(cx + 1, cy, a[2]); pm.set(cx, cy + 1, a[2]); pm.set(cx, cy, a[1]); }
  for (const [cx, cy] of [[12, 4], [4, 12]]) pm.set(cx, cy, a[3]);
};
FLOORFN.carpet_cream = carpet('#f6ecd8', '#e8c9a0'); FLOORFN.carpet_pink = carpet('#ff9fc0', '#ffd0e0'); FLOORFN.carpet_blue = carpet('#7fb0ff', '#bcd4ff');
FLOORFN.carpet_yellow = carpet('#ffd84a', '#fff0a0'); FLOORFN.carpet_red = carpet('#e0506a', '#ff9fb0'); FLOORFN.carpet_green = carpet('#6ec878', '#b0f0b8');
const tiles = (a, b) => (pm) => {
  const pa = R(a), pb = R(b);
  for (let by = 0; by < 16; by += 8) for (let bx = 0; bx < 16; bx += 8) {
    const p = ((bx + by) / 8) % 2 ? pb : pa;
    pm.rect(bx, by, 8, 8, p[2]); pm.hline(bx, by, 8, p[1]); pm.vline(bx, by, 8, p[1]); pm.hline(bx, by + 7, 8, p[3]); pm.vline(bx + 7, by, 8, p[3]); pm.set(bx + 2, by + 2, p[0]);
  }
};
FLOORFN.tile_pink = tiles('#ffc2d6', '#fff0f5'); FLOORFN.tile_blue = tiles('#a8d0ff', '#eef6ff'); FLOORFN.checker = tiles('#f4f0f0', '#4a4458');
FLOORFN.boardwalk = (pm) => { planksFloor(pm, '#c8ad86'); const gap = darker(hex('#c8ad86'), 0.4), sand = hex('#f1dc9a'); for (let y = 0; y < 16; y += 4) pm.hline(0, y, 16, gap); for (const [x, y] of [[2, 2], [10, 6], [5, 10], [13, 14], [8, 13]]) pm.set(x, y, sand); };
FLOORFN.tile_mint = tiles('#bdf0dc', '#effcf6'); FLOORFN.tile_lilac = tiles('#d9c6f4', '#f6efff'); FLOORFN.tile_butter = tiles('#ffe9a0', '#fff8d8');
FLOORFN.carpet_lilac = carpet('#c9a8f0', '#e8d8ff'); FLOORFN.carpet_teal = carpet('#4fc9c0', '#a8f0e8');
FLOORFN.brick = (pm) => blocks(pm, R('#d86a50'), [{ h: 4, w: [8, 8] }, { h: 4, w: [8, 8], off: 4 }, { h: 4, w: [8, 8] }, { h: 4, w: [8, 8], off: 4 }], hex('#e8cfc0'));
FLOORFN.sandstone = (pm) => blocks(pm, R('#eccb88'), [{ h: 8, w: [8, 8] }, { h: 8, w: [8, 8], off: 4 }], hex('#c8a060'));
FLOORFN.ice = (pm) => { const p = R('#c8eeff'); blocks(pm, p, [{ h: 8, w: [8, 8] }, { h: 8, w: [8, 8], off: 4 }], hex('#f0fbff')); pm.line(2, 6, 6, 3, WHITE); pm.set(11, 12, WHITE); };
FLOORFN.gold = (pm) => { const g = R('#ffcf45'); tiles('#ffcf45', '#ffe48a')(pm); for (const [x, y] of [[3, 3], [11, 11]]) pm.set(x, y, WHITE); pm.frame(0, 0, 16, 16, g[3]); };
FLOORFN.bone = (pm) => { const b = R('#f1ead7'); pm.rect(0, 0, 16, 16, b[2]); for (let y = 0; y < 16; y += 4) pm.hline(0, y, 16, b[3]); for (let y = 0; y < 16; y += 8) { pm.circle(3, y + 2, 1.4, b[1]); pm.circle(12, y + 6, 1.4, b[1]); } };
FLOORFN.moss = (pm) => { const p = R('#5fb06a'), rng = new RNG(12); pm.rect(0, 0, 16, 16, p[2]); for (let i = 0; i < 24; i++) pm.set(rng.int(16), rng.int(16), rng.chance(0.5) ? p[1] : p[3]); for (const [x, y] of [[4, 4], [11, 10]]) { pm.set(x, y, hex('#e8f0c0')); } };
FLOORFN.obsidian = (pm) => { tiles('#3a2a60', '#2a1f4a')(pm); for (const [x, y] of [[2, 2], [10, 10]]) pm.set(x, y, hex('#b8a8f0')); };
FLOORFN.crystal = (pm) => { tiles('#e8b8f0', '#b8f0e8')(pm); for (const [x, y] of [[3, 3], [11, 11], [11, 3]]) { pm.set(x, y, WHITE); } };
FLOORFN.star = (pm) => { tiles('#2f2a6a', '#3a3480')(pm); for (const [x, y] of [[3, 3], [11, 11], [11, 3], [4, 12]]) pm.set(x, y, hex('#fff0a0')); };

function bridge(kind) {
  const pm = new Pixmap(16, 16);
  if (kind === 'rope') {
    const p = R('#d9a066'), r = R('#e0c288');
    pm.rect(0, 1, 16, 14, p[2]);
    for (let y = 1; y < 15; y += 3) { pm.hline(0, y, 16, p[1]); pm.hline(0, y + 2, 16, p[3]); }
    pm.vline(0, 0, 16, r[3]); pm.vline(1, 0, 16, r[2]); pm.vline(14, 0, 16, r[2]); pm.vline(15, 0, 16, r[3]);
    for (let y = 1; y < 16; y += 5) { pm.set(0, y, r[0]); pm.set(15, y, r[0]); }
  } else {
    const p = R('#b6bccf');
    pm.rect(0, 0, 16, 16, p[2]);
    for (let y = 0; y < 16; y += 8) { pm.hline(0, y, 16, p[1]); pm.hline(0, y + 7, 16, p[3]); }
    pm.vline(0, 0, 16, p[3]); pm.vline(15, 0, 16, p[3]); pm.vline(8, 0, 8, p[3]); pm.vline(4, 8, 8, p[3]); pm.vline(12, 8, 8, p[3]);
  }
  return pm;
}

// ------------------------------------------------------------------ wall decor (16x16 overlays on the face)
function frame(pm, x, y, w, h, c) { const f = R(c); pm.rect(x, y, w, h, f[2]); pm.frame(x, y, w, h, f[3]); pm.hline(x, y, w, f[1]); pm.vline(x, y, h, f[1]); pm.hline(x + 1, y + h - 1, w - 1, f[4]); }
const DECOFN = {
  painting_meadow: (pm) => { frame(pm, 2, 3, 12, 9, '#a8703f'); pm.rect(3, 4, 10, 7, hex('#8fd8ff')); pm.rect(3, 8, 10, 3, hex('#6cc24e')); pm.circle(10.5, 6, 1.5, hex('#ffe066')); pm.set(5, 7, hex('#3f9a45')); pm.rect(6, 7, 2, 2, hex('#58b84a')); pm.set(7, 6, hex('#58b84a')); },
  painting_cat: (pm) => { frame(pm, 3, 2, 10, 11, '#e8c068'); pm.rect(4, 3, 8, 9, hex('#ffe8d0')); pm.ellipse(8, 8, 3.2, 2.8, hex('#f0a060')); pm.poly([[5, 6], [6, 3], [7.5, 5]], hex('#f0a060')); pm.poly([[10.5, 6], [10, 3], [8.5, 5]], hex('#f0a060')); pm.set(7, 8, hex('#2a1f3d')); pm.set(9, 8, hex('#2a1f3d')); pm.set(8, 9, hex('#ff8fa8')); },
  painting_sea: (pm) => { frame(pm, 2, 3, 12, 9, '#6a4a3a'); pm.rect(3, 4, 10, 7, hex('#bfe8ff')); pm.rect(3, 8, 10, 3, hex('#4f9ae8')); for (const x of [4, 8, 11]) pm.hline(x, 9, 2, hex('#9ad0ff')); pm.poly([[7, 8], [10, 8], [8.5, 5]], hex('#ffffff')); pm.hline(7, 8, 3, hex('#8a5a3a')); },
  painting_stars: (pm) => { frame(pm, 2, 3, 12, 9, '#ffcf45'); pm.rect(3, 4, 10, 7, hex('#1f1a50')); for (const [x, y] of [[4, 5], [8, 6], [11, 5], [6, 9], [10, 9]]) pm.set(x, y, hex('#fff0a0')); pm.circle(10.5, 6, 1.4, hex('#fff6c0')); pm.set(8, 6, hex('#ffffff')); },
  wall_clock: (pm) => { pm.circle(8, 8, 5.5, hex('#8a5a2a')); pm.circle(8, 8, 4.4, hex('#fff6e0')); pm.set(8, 5, hex('#2a1f3d')); pm.set(8, 11, hex('#2a1f3d')); pm.set(5, 8, hex('#2a1f3d')); pm.set(11, 8, hex('#2a1f3d')); pm.line(8, 8, 8, 5, hex('#2a1f3d')); pm.line(8, 8, 10, 9, hex('#c8304a')); pm.set(8, 8, hex('#2a1f3d')); },
  wreath: (pm) => { pm.ring(8, 8, 3, 5.6, hex('#58b84a')); for (const [x, y, c] of [[8, 3, '#ff8fb3'], [12, 6, '#ffe066'], [12, 10, '#ff8fb3'], [4, 6, '#ffffff'], [4, 10, '#ffe066'], [8, 13, '#ff8fb3']]) { pm.set(x, y, hex(c)); pm.set(x + 1, y, hex(c)); } pm.set(8, 13, hex('#c8304a')); pm.set(7, 14, hex('#c8304a')); pm.set(9, 14, hex('#c8304a')); },
  banner_pink: (pm) => banner(pm, '#ff9fc0', '#ffffff'), banner_blue: (pm) => banner(pm, '#7fb0ff', '#ffe066'),
  curtains_cream: (pm) => curtains(pm, '#f6ecd8'), curtains_pink: (pm) => curtains(pm, '#ff9fc0'), curtains_blue: (pm) => curtains(pm, '#8fb8ff'),
  sconce: (pm) => { pm.rect(6, 9, 4, 4, hex('#6a7490')); pm.rect(5, 8, 6, 2, hex('#8a94ac')); pm.rect(7, 5, 2, 4, hex('#fff6e0')); pm.set(7, 4, hex('#ffe066')); pm.set(8, 3, hex('#ff9a3c')); pm.set(8, 4, hex('#ffd84a')); pm.set(7, 5, WHITE); },
  wall_mirror: (pm) => { frame(pm, 4, 1, 8, 13, '#ffcf45'); pm.rect(5, 2, 6, 11, hex('#cfeeff')); pm.line(6, 3, 6, 7, WHITE); pm.set(9, 11, WHITE); pm.set(10, 10, hex('#ffffffaa')); },
  antlers: (pm) => { const b = R('#f1ead7'); pm.rect(5, 9, 6, 4, hex('#8a5a3a')); for (const s of [-1, 1]) { const x = 8 + s * 2; pm.line(x, 9, x + s * 3, 4, b[2]); pm.line(x + s, 7, x + s * 4, 6, b[2]); pm.line(x + s * 2, 6, x + s * 2, 2, b[1]); } },
  wall_shelf: (pm) => { pm.rect(2, 9, 12, 2, hex('#a8703f')); pm.hline(2, 9, 12, hex('#d09860')); pm.rect(4, 6, 3, 3, hex('#ff8fb3')); pm.rect(4, 5, 3, 1, hex('#58b84a')); pm.rect(9, 5, 2, 4, hex('#fff6e0')); pm.set(10, 4, hex('#ffe066')); pm.set(10, 3, hex('#ff9a3c')); pm.set(2, 12, hex('#6a4a2a')); pm.set(13, 12, hex('#6a4a2a')); },
  conch_shell: (pm) => { const p = R('#ffe2cc'), sp = R('#e08a6a'); pm.circle(8, 8.5, 5.8, p[2]); pm.circle(7, 7.5, 3.6, p[1]); pm.poly([[11, 3], [14, 2], [13, 6]], p[2]); for (let t = 0; t < 12.5; t += 0.25) { const r = 0.6 + t * 0.4, x = Math.round(8 + r * Math.cos(t)), y = Math.round(8.5 + r * Math.sin(t)); pm.set(x, y, t > 8 ? sp[2] : sp[1]); } pm.ellipse(12.2, 11.5, 1.4, 2, hex('#ff9fa8')); pm.set(5, 5, WHITE); },
  lifebuoy: (pm) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy); if (d >= 3 && d <= 6.2) { const a = Math.atan2(dy, dx) + Math.PI + 0.4; pm.set(x, y, Math.floor(a / (Math.PI / 2)) % 2 ? hex('#ff5a68') : hex('#ffffff')); } } pm.set(8, 1, hex('#8a5a2a')); pm.set(8, 0, hex('#8a5a2a')); },
  string_lights: (pm) => { const cols = ['#ffe066', '#ff8fb3', '#8fd8ff', '#b0f08a']; for (let x = 0; x < 16; x++) pm.set(x, 3 + Math.round(Math.sin((x / 15) * Math.PI) * 3), hex('#4a3a40')); [1, 5, 9, 13].forEach((x, i) => { const y = 3 + Math.round(Math.sin((x / 15) * Math.PI) * 3) + 1; pm.set(x, y, hex(cols[i])); pm.set(x, y + 1, hex(cols[i])); pm.set(x - 1, y, withAlpha(hex(cols[i]), 120)); pm.set(x + 1, y, withAlpha(hex(cols[i]), 120)); }); },
  star_map: (pm) => { frame(pm, 2, 2, 12, 11, '#6a5ac0'); pm.rect(3, 3, 10, 9, hex('#1f1a50')); for (const [x, y] of [[4, 4], [7, 6], [10, 5], [5, 9], [11, 10]]) pm.set(x, y, hex('#fff0a0')); pm.line(4, 4, 7, 6, hex('#a9c4ff')); pm.line(7, 6, 10, 5, hex('#a9c4ff')); pm.line(7, 6, 5, 9, hex('#a9c4ff')); },
};
function banner(pm, c, accent) { const p = R(c); pm.rect(3, 1, 10, 1, hex('#8a5a2a')); pm.rect(4, 2, 8, 10, p[2]); pm.poly([[4, 12], [12, 12], [8, 15]], p[2]); pm.vline(4, 2, 10, p[1]); pm.vline(11, 2, 10, p[3]); pm.circle(8, 6, 2, hex(accent)); pm.set(7, 5, WHITE); }
function curtains(pm, c) { const p = R(c); for (const [x0, x1] of [[1, 5], [11, 15]]) { pm.rect(x0, 1, x1 - x0, 12, p[2]); for (let x = x0; x < x1; x += 2) pm.vline(x, 1, 12, p[3]); pm.vline(x0, 1, 12, p[1]); pm.rect(x0, 13, x1 - x0, 1, p[3]); } pm.rect(0, 1, 16, 1, hex('#8a5a2a')); pm.set(5, 7, hex('#ffd84a')); pm.set(11, 7, hex('#ffd84a')); }

export function registerWalls(book) {
  // wall pieces for items-in-menu use a standard (isolated) preview sprite
  for (const [mat, name] of WALL_MATS.map((m) => [m[0], m[1]])) {
    book.add(`wp_${mat}_wall`, wallSprite(mat, 'wall', 0));
    if (mat !== 'glass') book.add(`wp_${mat}_window`, wallSprite(mat, 'window', 0));
    book.add(`wp_${mat}_door`, wallSprite(mat, 'door', 0));
  }
  for (const m of ['wood', 'picket', 'stone', 'iron', 'bone', 'drift']) { book.add(`wp_fence_${m}`, fenceSprite(m, false, 0)); book.add(`wp_gate_${m}`, fenceSprite(m, true, 0)); }
  for (const id of Object.keys(FLOORFN)) { const pm = new Pixmap(16, 16); FLOORFN[id](pm); book.add(`f_${id}`, pm); }
  book.add('f_bridge_rope', bridge('rope')); book.add('f_bridge_stone', bridge('stone'));
  for (const id of Object.keys(DECOFN)) { const pm = new Pixmap(16, 16); DECOFN[id](pm); pm.outline(null, { amt: 0.6 }); book.add(`d_${id}`, pm); }
}
export const wallDecoIds = () => Object.keys(DECOFN);
export const floorIds = () => Object.keys(FLOORFN);
