// Art for gatherable nodes: trees, rocks/ores, plants, and special lootables.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, bayer, INK, A } from '../pixmap.js';
import { RNG } from '../../util.js';

const SH = hex('#1e1440');
export function groundShadow(pm, cx, cy, rx, ry, alpha = 80) {
  const c = withAlpha(SH, alpha);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) pm.under(x, y, c);
  }
  return pm;
}

// ----------------------------------------------------------------- helpers
const LEAF = {
  oak: ramp(hex('#62c553')), pine: ramp(hex('#2f8f5b')), palm: ramp(hex('#66c75a')), mangrove: ramp(hex('#4d9a5b')),
  crystal: ramp(hex('#e7a6f0')), void: ramp(hex('#6f58d8')), apple: ramp(hex('#7ad45a')),
};
const BARK = ramp(hex('#a86f3d'));

function trunk(pm, x, y, w, h, pal = BARK, flare = true) {
  pm.rect(x, y, w, h, pal[2]);
  pm.rect(x, y, 1, h, pal[1]);
  pm.rect(x + w - 1, y, 1, h, pal[3]);
  pm.rect(x + w - 2, y, 1, h, pal[3]);
  for (let k = 2; k < h; k += 4) pm.set(x + 1 + (k % 3), y + k, pal[3]);
  if (flare) { pm.set(x - 1, y + h - 1, pal[3]); pm.set(x + w, y + h - 1, pal[4]); pm.rect(x - 1, y + h - 2, 1, 1, pal[2]); pm.rect(x + w, y + h - 2, 1, 1, pal[3]); }
}

function leafSpecks(pm, rng, pal, n, bounds) {
  for (let i = 0; i < n; i++) {
    const x = bounds.x + rng.int(bounds.w), y = bounds.y + rng.int(bounds.h);
    if (!A(pm.get(x, y))) continue;
    const c = pm.get(x, y);
    if (c === pal[2]) { pm.set(x, y, pal[1]); if (rng.chance(0.5)) pm.set(x + 1, y, pal[1]); }
    else if (c === pal[3]) { pm.set(x, y, pal[4]); }
  }
}

function canopyOak(rng, pal, o = {}) {
  const pm = new Pixmap(32, 40);
  trunk(pm, 13, 25, 6, 13);
  const lobes = o.lobes || [[8.5, 19, 8, 7], [23.5, 19, 8, 7], [16, 9.5, 8.5, 7.5], [16, 16, 12, 10]];
  for (const [cx, cy, rx, ry] of lobes) ballShade(pm, cx, cy, rx, ry, pal, { dither: 0.16 });
  leafSpecks(pm, rng, pal, 26, { x: 2, y: 2, w: 28, h: 26 });
  if (o.fruit) for (let i = 0; i < o.fruit.n; i++) { const x = 6 + rng.int(20), y = 8 + rng.int(16); if (A(pm.get(x, y))) { pm.set(x, y, o.fruit.c); pm.set(x + 1, y, darker(o.fruit.c, 0.3)); pm.set(x, y - 1, lighter(o.fruit.c, 0.5)); } }
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 16, 38, 10, 2.6);
  return pm;
}

function treePine(rng) {
  const pm = new Pixmap(32, 40);
  const pal = LEAF.pine, snow = ramp(hex('#ffffff'));
  trunk(pm, 14, 30, 4, 8);
  const tiers = [[16, 25, 13, 12], [16, 17, 10.5, 11], [16, 9.5, 7.5, 9.5]]; // cx, baseY, halfWidth, height
  for (const [cx, by, hw, h] of tiers) {
    for (let y = 0; y < h; y++) {
      const t = (y + 1) / h; const half = Math.max(1, Math.round(hw * t));
      for (let x = -half; x <= half; x++) {
        const px = Math.round(cx + x), py = by - h + y + 1;
        const edge = Math.abs(x) >= half - 0;
        const lit = x < -half * 0.2;
        pm.set(px, py, lit ? pal[1] : (x > half * 0.45 ? pal[3] : pal[2]));
        if (y === h - 1 || (edge && y > h * 0.5)) pm.set(px, py, x > 0 ? pal[3] : pal[2]);
      }
    }
  }
  // snow dabs on tiers
  for (const [cx, by, hw, h] of tiers) { for (let y = 0; y < h * 0.55; y++) { const t = (y + 1) / h; const half = Math.round(hw * t); pm.set(Math.round(cx - half * 0.55), by - h + y + 1, snow[1]); if (y % 2 === 0) pm.set(Math.round(cx - half * 0.25), by - h + y + 1, snow[2]); } pm.set(cx - 1, by - h + 1, snow[0]); pm.set(cx, by - h + 1, snow[1]); }
  leafSpecks(pm, rng, pal, 12, { x: 4, y: 2, w: 24, h: 26 });
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 16, 38, 9, 2.4);
  return pm;
}

function treePalm(rng) {
  const pm = new Pixmap(32, 40);
  const bark = ramp(hex('#c8925a'));
  // curved trunk
  const pts = [[15, 38], [15, 33], [16, 28], [17, 23], [18, 19], [19, 15]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    for (let t = 0; t <= 4; t++) { const x = Math.round(x0 + (x1 - x0) * t / 4), y = Math.round(y0 + (y1 - y0) * t / 4); pm.rect(x - 1, y, 4, 1, bark[2]); pm.set(x - 1, y, bark[1]); pm.set(x + 2, y, bark[3]); if ((y + i) % 3 === 0) pm.hline(x - 1, y, 4, bark[3]); }
  }
  const pal = LEAF.palm;
  const fronds = [[-1, -0.35, 12], [-0.8, -0.8, 11], [0, -1, 9], [0.8, -0.8, 11], [1, -0.35, 12], [-0.6, 0.35, 10], [0.6, 0.35, 10]];
  const hx = 19, hy = 15;
  for (const [dx, dy, len] of fronds) {
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = Math.round(hx + dx * k * 1.15), y = Math.round(hy + dy * k + t * t * 9 * (dy > -0.9 ? 1 : 0.4));
      const w = k < len * 0.65 ? 2 : 1;
      pm.set(x, y, pal[2]); pm.set(x, y - 1, pal[1]); if (w > 1) pm.set(x, y + 1, pal[3]);
      if (k > 2 && k < len - 2) { pm.set(x + (dx > 0 ? 1 : -1), y + 1, pal[3]); }
    }
  }
  pm.rect(hx - 1, hy - 1, 3, 3, ramp(hex('#8a5a2a'))[2]); // coconuts
  pm.set(hx - 1, hy + 1, ramp(hex('#8a5a2a'))[3]); pm.set(hx + 1, hy + 1, ramp(hex('#6a3a1a'))[2]);
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 16, 38, 8, 2.2);
  return pm;
}

function treeMangrove(rng) {
  const pm = new Pixmap(32, 40);
  const pal = LEAF.mangrove, bark = ramp(hex('#7a5a3a'));
  // arched roots
  for (const [x0, x1] of [[8, 14], [24, 18]]) { for (let t = 0; t <= 10; t++) { const x = Math.round(x0 + (x1 - x0) * t / 10), y = Math.round(38 - Math.sin(t / 10 * Math.PI) * 8); pm.rect(x, y, 2, 2, bark[2]); pm.set(x, y, bark[1]); } }
  trunk(pm, 14, 24, 5, 14, bark);
  for (const [cx, cy, rx, ry] of [[9, 18, 8, 6.5], [23, 18, 8, 6.5], [16, 10, 9.5, 7.5], [16, 16, 12, 9]]) ballShade(pm, cx, cy, rx, ry, pal, { dither: 0.16 });
  // hanging vines
  for (const x of [6, 11, 21, 26]) { const len = 4 + rng.int(4); for (let k = 0; k < len; k++) pm.set(x, 23 + k, k % 2 ? pal[3] : pal[2]); }
  leafSpecks(pm, rng, pal, 24, { x: 2, y: 2, w: 28, h: 24 });
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 16, 38, 11, 2.6);
  return pm;
}

function treeDead(rng) {
  const pm = new Pixmap(32, 40);
  const bark = ramp(hex('#8a7a8a'));
  trunk(pm, 14, 18, 5, 20, bark);
  const branch = (x0, y0, x1, y1, w = 2) => { pm.line(x0, y0, x1, y1, bark[2]); pm.line(x0, y0 - 1, x1, y1 - 1, bark[1]); if (w > 1) pm.line(x0, y0 + 1, x1, y1 + 1, bark[3]); };
  branch(15, 22, 6, 12); branch(6, 12, 3, 8, 1); branch(6, 12, 8, 6, 1);
  branch(18, 20, 27, 10); branch(27, 10, 29, 5, 1); branch(27, 10, 24, 5, 1);
  branch(16, 18, 16, 7); branch(16, 12, 12, 8, 1); branch(16, 10, 21, 5, 1);
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 16, 38, 9, 2.4);
  return pm;
}

function treeBurnt(rng) {
  const pm = new Pixmap(32, 40);
  const bark = ramp(hex('#4a4050'));
  trunk(pm, 13, 14, 6, 24, bark);
  const branch = (x0, y0, x1, y1) => { pm.line(x0, y0, x1, y1, bark[2]); pm.line(x0, y0 - 1, x1, y1 - 1, bark[1]); };
  branch(14, 20, 6, 10); branch(18, 18, 26, 8); branch(16, 14, 16, 4);
  for (let i = 0; i < 9; i++) { const x = 13 + rng.int(6), y = 15 + rng.int(20); pm.set(x, y, hex('#ff7a3d')); if (i % 3 === 0) pm.set(x, y + 1, hex('#ffd27a')); }
  for (const [x, y] of [[6, 10], [26, 8], [16, 4]]) { pm.set(x, y, hex('#ff9a3d')); pm.set(x, y - 1, hex('#ffd27a')); }
  pm.outline(null, { amt: 0.75 });
  groundShadow(pm, 16, 38, 9, 2.4);
  return pm;
}

function treeCrystal(rng) {
  const pm = new Pixmap(32, 40);
  const bark = ramp(hex('#f2d6ff'));
  trunk(pm, 14, 24, 5, 14, bark);
  const cols = [hex('#ff9fd0'), hex('#9ff0e0'), hex('#d4b8ff'), hex('#ffe0a0')];
  const prism = (cx, by, w, h, c) => {
    const pal = ramp(c);
    for (let y = 0; y < h; y++) { const hw = Math.max(1, Math.round((w / 2) * (1 - Math.abs(y - h * 0.35) / (h * 0.7)))); for (let x = -hw; x <= hw; x++) pm.set(cx + x, by - y, x < -hw * 0.2 ? pal[1] : x > hw * 0.3 ? pal[3] : pal[2]); }
    pm.set(cx - 1, by - h + 2, pal[0]); pm.set(cx - 1, by - h + 3, pal[0]);
  };
  prism(8, 24, 8, 16, cols[1]); prism(24, 24, 8, 16, cols[2]); prism(16, 22, 10, 21, cols[0]); prism(12, 25, 6, 12, cols[3]); prism(21, 26, 6, 12, cols[1]);
  for (let i = 0; i < 6; i++) pm.set(3 + rng.int(26), 4 + rng.int(20), hex('#ffffff'));
  pm.outline(null, { amt: 0.55 });
  groundShadow(pm, 16, 38, 9, 2.4);
  return pm;
}

function treeVoid(rng) {
  const pm = new Pixmap(32, 40);
  const bark = ramp(hex('#2a2050'));
  trunk(pm, 14, 22, 5, 16, bark);
  const pal = LEAF.void;
  for (const [cx, cy, rx, ry] of [[9, 17, 8, 6.5], [23, 17, 8, 6.5], [16, 9.5, 9, 7.5], [16, 15, 12, 9]]) ballShade(pm, cx, cy, rx, ry, pal, { dither: 0.16 });
  for (let i = 0; i < 14; i++) { const x = 3 + rng.int(26), y = 3 + rng.int(22); if (A(pm.get(x, y))) pm.set(x, y, rng.pick([hex('#fffbd0'), hex('#a9c4ff'), hex('#ffb3e6')])); }
  pm.outline(null, { amt: 0.8 });
  groundShadow(pm, 16, 38, 10, 2.6);
  return pm;
}

function stump(barkBase = '#a86f3d') {
  const pm = new Pixmap(16, 16);
  const bark = ramp(hex(barkBase));
  pm.ellipse(8, 11.5, 5.5, 3.2, bark[2]);
  pm.rect(3, 10, 10, 4, bark[2]);
  pm.rect(3, 10, 1, 4, bark[1]); pm.rect(12, 10, 1, 4, bark[3]);
  pm.rect(4, 13, 8, 1, bark[3]);
  pm.ellipse(8, 9.5, 5.2, 2.8, lighter(bark[1], 0.35));
  pm.ellipse(8, 9.5, 3, 1.6, lighter(bark[1], 0.5));
  pm.ellipse(8, 9.5, 1.2, 0.7, bark[2]);
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 8, 14, 7, 1.8);
  return pm;
}

// ----------------------------------------------------------------- rocks & ores
function rockBase(rng, hexBase, o = {}) {
  const w = o.w || 16, h = o.h || 16;
  const pm = new Pixmap(w, h);
  const pal = ramp(hex(hexBase));
  const cx = w / 2, by = h - 3.5;
  // lumpy silhouette from overlapping ellipses
  const lumps = o.lumps || [[cx, by - 3, 6.8, 5.2], [cx - 3.2, by - 1.5, 4.2, 3.4], [cx + 3.4, by - 1.2, 4, 3.2]];
  for (const [x, y, rx, ry] of lumps) ballShade(pm, x, y, rx, ry, pal, { lx: -0.5, ly: -0.85, dither: 0.1 });
  // facet lines
  pm.line(Math.round(cx - 1), Math.round(by - 7), Math.round(cx + 1), Math.round(by - 3), pal[3]);
  pm.line(Math.round(cx + 2), Math.round(by - 4), Math.round(cx + 4), Math.round(by - 1), pal[3]);
  pm.set(Math.round(cx - 2), Math.round(by - 6), pal[0]); pm.set(Math.round(cx - 3), Math.round(by - 5), pal[0]);
  return { pm, pal, cx, by };
}
function finishRock(pm, w = 16, h = 16, shadowY = null) {
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, w / 2, shadowY === null ? h - 1.5 : shadowY, w * 0.42, 2);
  return pm;
}
function specks(pm, rng, cx, cy, n, colors, spread = 5) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (rng.next() - 0.5) * spread * 2), y = Math.round(cy + (rng.next() - 0.5) * spread * 1.4);
    if (!A(pm.get(x, y))) continue;
    const c = rng.pick(colors);
    pm.set(x, y, c); if (rng.chance(0.6)) pm.set(x + 1, y, c); if (rng.chance(0.5)) pm.set(x, y + 1, darker(c, 0.25));
    pm.set(x, y - 1, lighter(c, 0.4));
  }
}
function rockPlain(rng, base) { const { pm } = rockBase(rng, base); return finishRock(pm); }
function rockOre(rng, base, oreCols, n = 7) { const { pm, cx, by } = rockBase(rng, base); specks(pm, rng, cx, by - 3, n, oreCols, 5); return finishRock(pm); }
function rockCrystal(rng, cols, base = '#9a8fc8') {
  const { pm, cx, by } = rockBase(rng, base, { lumps: [[8, 12, 7, 3.6]] });
  const prism = (x, y, w, h, c) => { const pal = ramp(c); for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round((w / 2) * (1 - j / (h * 1.1)))); for (let i = -hw; i <= hw; i++) pm.set(x + i, y - j, i < 0 ? pal[1] : i > 0 ? pal[3] : pal[2]); } pm.set(x, y - h + 1, pal[0]); };
  prism(8, 11, 5, 11, cols[0]); prism(4, 12, 3, 6, cols[1]); prism(12, 12, 3, 7, cols[2]);
  for (let i = 0; i < 3; i++) pm.set(2 + rng.int(12), 2 + rng.int(8), hex('#ffffff'));
  return finishRock(pm);
}
function rockObsidian(rng) {
  const { pm } = rockBase(rng, '#3a3050', { lumps: [[8, 11, 5.5, 5.5], [5.5, 12.5, 3.3, 3.3], [10.8, 12.4, 3.1, 3.2]] });
  const h = hex('#8a7ac0');
  pm.vline(7, 4, 6, h); pm.vline(8, 6, 3, lighter(h, 0.4)); pm.set(5, 8, h); pm.set(11, 9, h);
  return finishRock(pm);
}
function rockStar(rng) {
  const { pm, cx, by } = rockBase(rng, '#3a3a78');
  for (let i = 0; i < 7; i++) { const x = 3 + rng.int(10), y = 3 + rng.int(9); if (A(pm.get(x, y))) { pm.set(x, y, hex('#fffbd0')); if (i % 2) { pm.set(x + 1, y, hex('#a9c4ff')); pm.set(x, y - 1, hex('#a9c4ff')); } } }
  return finishRock(pm);
}
function rockIce(rng) {
  const { pm } = rockBase(rng, '#aee3ff', { lumps: [[8, 10.5, 5.5, 6], [5, 12.5, 3.2, 3.4], [11.5, 12, 3.3, 3.4]] });
  pm.line(6, 6, 5, 10, hex('#ffffff')); pm.set(9, 5, hex('#ffffff')); pm.set(10, 6, hex('#ffffffaa'));
  return finishRock(pm);
}
function rockSand(rng) { const { pm } = rockBase(rng, '#e6c27a'); pm.hline(4, 9, 7, hex('#c89a52')); pm.hline(5, 12, 6, hex('#c89a52')); return finishRock(pm); }
function tombstone() {
  const pm = new Pixmap(16, 20);
  const pal = ramp(hex('#b4aec4'));
  pm.rect(3, 6, 10, 11, pal[2]); pm.ellipse(8, 7, 5, 4.5, pal[2]);
  pm.rect(3, 6, 2, 11, pal[1]); pm.rect(11, 6, 2, 11, pal[3]); pm.rect(2, 16, 12, 2, pal[3]);
  pm.rect(7, 6, 2, 7, pal[4]); pm.rect(5, 8, 6, 2, pal[4]); // cross
  pm.set(6, 4, pal[0]); pm.set(5, 5, pal[0]);
  pm.set(4, 14, hex('#6aa05a')); pm.set(5, 14, hex('#6aa05a')); pm.set(10, 15, hex('#6aa05a')); pm.set(4, 15, hex('#4f8a46'));
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 8, 18.5, 7, 1.6);
  return pm;
}
function rockEmber(rng) {
  const { pm, cx, by } = rockBase(rng, '#6a4a52');
  for (const [x, y] of [[6, 6], [9, 8], [7, 10], [11, 11], [5, 11]]) { pm.set(x, y, hex('#ff6a2e')); pm.set(x, y + 1, hex('#ffb347')); }
  pm.set(8, 5, hex('#ffd27a'));
  return finishRock(pm);
}
function geode(rng) {
  const { pm } = rockBase(rng, '#8a8aa8');
  pm.ellipse(8, 10.2, 3.5, 3, ramp(hex('#2a2050'))[2]);
  const cols = [hex('#ff6b8a'), hex('#5cc7ff'), hex('#5fe08a'), hex('#c49aff')];
  for (let i = 0; i < 6; i++) { const x = 6 + (i % 3) * 2, y = 9 + Math.floor(i / 3) * 2; pm.set(x, y, rng.pick(cols)); pm.set(x, y - 1, hex('#ffffffaa')); }
  return finishRock(pm);
}
function rubble(base) {
  const pm = new Pixmap(16, 16);
  const pal = ramp(hex(base));
  for (const [x, y, r] of [[5, 12, 2.8], [10, 12.5, 2.4], [8, 11, 2.2], [12, 13, 1.6], [3, 13.5, 1.4]]) ballShade(pm, x, y, r, r * 0.8, pal, { dither: 0 });
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 8, 14.5, 7, 1.6, 60);
  return pm;
}
function clayDeposit() { const { pm } = rockBase(new RNG(5), '#c98a6a', { lumps: [[8, 12, 6.8, 3.6], [6, 11.5, 4, 3.2]] }); pm.hline(5, 12, 5, hex('#a96a4c')); return finishRock(pm); }

// ----------------------------------------------------------------- plants
function bladeTuft(pm, x, y, h, pal, lean = 0) {
  for (let k = 0; k < h; k++) {
    const px = x + Math.round(lean * k / h);
    pm.set(px, y - k, k > h * 0.55 ? pal[1] : pal[2]); pm.set(px + 1, y - k, pal[3]);
  }
}
function tallGrass(seed) {
  const rng = new RNG(seed);
  const pm = new Pixmap(16, 16);
  const pal = ramp(hex('#6fd05a'));
  for (const [x, h, l] of [[3, 7, -2], [6, 10, -1], [9, 11, 1], [12, 8, 2], [8, 6, 0], [5, 5, 1]]) bladeTuft(pm, x + (seed % 2), 14, h - (seed % 3), pal, l);
  pm.outline(null, { amt: 0.6 });
  groundShadow(pm, 8, 14.5, 6, 1.4, 50);
  return pm;
}
function tallGrassStub() { const pm = new Pixmap(16, 16); const pal = ramp(hex('#6fd05a')); bladeTuft(pm, 5, 14, 2, pal); bladeTuft(pm, 9, 14, 3, pal); bladeTuft(pm, 12, 14, 2, pal); pm.outline(null, { amt: 0.6 }); return pm; }
function flowerPatch(petal, center = '#ffd84a', seed = 1) {
  const pm = new Pixmap(16, 16);
  const stem = ramp(hex('#4aa84a')), pc = ramp(hex(petal));
  const fl = [[4, 9, 3], [9, 6, 4], [12, 10, 3]];
  for (const [x, y, s] of fl) {
    pm.vline(x, y + 1, 14 - y - 1, stem[2]); pm.set(x + 1, 13, stem[3]);
    const pc2 = pc;
    pm.set(x, y - 1, pc2[1]); pm.set(x - 1, y, pc2[1]); pm.set(x + 1, y, pc2[2]); pm.set(x, y + 1, pc2[3]);
    pm.set(x, y, hex(center));
    if (s > 3) { pm.set(x - 1, y - 1, pc2[0]); pm.set(x + 1, y - 1, pc2[1]); pm.set(x - 1, y + 1, pc2[2]); pm.set(x + 1, y + 1, pc2[3]); }
  }
  bladeTuft(pm, 7, 14, 4, stem, -1); bladeTuft(pm, 10, 14, 3, stem, 1);
  pm.outline(null, { amt: 0.55 });
  return pm;
}
function flowerStub() { const pm = new Pixmap(16, 16); const stem = ramp(hex('#4aa84a')); bladeTuft(pm, 6, 14, 3, stem); bladeTuft(pm, 10, 14, 2, stem); pm.outline(null, { amt: 0.6 }); return pm; }
function berryBush(berry = '#ff4f6d', leaf = '#58b84a', withBerries = true, pale = false) {
  const pm = new Pixmap(16, 16);
  const pal = ramp(hex(leaf));
  for (const [x, y, rx, ry] of [[5, 10, 4.5, 3.8], [11, 10, 4.5, 3.8], [8, 8, 6, 5]]) ballShade(pm, x, y, rx, ry, pal, { dither: 0.12 });
  if (withBerries) {
    const bc = ramp(hex(berry));
    for (const [x, y] of [[4, 8], [8, 6], [11, 9], [6, 11], [10, 12], [3, 11], [13, 12]]) { pm.set(x, y, bc[2]); pm.set(x + 1, y, bc[3]); pm.set(x, y - 1, lighter(bc[1], 0.4)); pm.set(x + 1, y - 1, bc[1]); }
  } else { for (const [x, y] of [[5, 9], [9, 7], [11, 11]]) pm.set(x, y, pal[3]); }
  pm.outline(null, { amt: 0.65 });
  groundShadow(pm, 8, 14, 7, 1.8);
  return pm;
}
function cactus() {
  const pm = new Pixmap(16, 24);
  const pal = ramp(hex('#4fb868'));
  const body = (x, y, w, h) => { pm.rect(x, y + 1, w, h - 1, pal[2]); pm.rect(x + 1, y, w - 2, 1, pal[2]); pm.rect(x + 1, y + 1, 1, h - 2, pal[1]); pm.rect(x + w - 2, y + 1, 1, h - 2, pal[3]); };
  body(6, 3, 5, 18); body(1, 9, 3, 7); body(1, 14, 6, 3); body(12, 6, 3, 7); body(9, 11, 6, 3);
  for (const [x, y] of [[8, 6], [8, 10], [9, 14], [8, 18], [2, 11], [13, 8]]) pm.set(x, y, pal[0]);
  pm.set(8, 2, hex('#ff8fb3')); pm.set(9, 2, hex('#ffc2d8')); pm.set(7, 2, hex('#ff6f9a')); pm.set(8, 1, hex('#ffe066'));
  pm.outline(null, { amt: 0.65 });
  groundShadow(pm, 8, 22, 6, 1.6);
  return pm;
}
function mushrooms() {
  const pm = new Pixmap(16, 16);
  const cap = (x, y, r, c) => { const pal = ramp(hex(c)); ballShade(pm, x, y, r, r * 0.75, pal, { dither: 0 }); pm.set(x - 1, y - 1, hex('#ffffff')); pm.set(x + 1, y, hex('#ffffffcc')); };
  const stem = (x, y, h) => { pm.rect(x, y, 2, h, hex('#f4ecd8')); pm.vline(x + 1, y, h, hex('#d8c8a8')); };
  stem(4, 10, 4); cap(5, 9, 3.4, '#ff5a6a');
  stem(10, 9, 5); cap(11, 8, 3.8, '#ff8a4a');
  stem(7, 12, 2); cap(8, 12, 2.4, '#ffc2d8');
  pm.outline(null, { amt: 0.6 });
  groundShadow(pm, 8, 14.5, 6.5, 1.5, 55);
  return pm;
}
function cottonPlant() {
  const pm = new Pixmap(16, 16);
  const stem = ramp(hex('#5aa850'));
  bladeTuft(pm, 4, 14, 8, stem, -1); bladeTuft(pm, 8, 14, 10, stem, 0); bladeTuft(pm, 12, 14, 7, stem, 1);
  for (const [x, y] of [[3, 6], [8, 3], [12, 7], [6, 8]]) { pm.circle(x + 0.5, y + 0.5, 2.2, hex('#ffffff')); pm.set(x, y + 1, hex('#e6ecff')); pm.set(x + 1, y + 1, hex('#d2dcf5')); }
  pm.outline(null, { amt: 0.55 });
  return pm;
}
function reeds() {
  const pm = new Pixmap(16, 20);
  const stem = ramp(hex('#7aa84a')), br = ramp(hex('#8a5a3a'));
  for (const [x, h] of [[4, 14], [7, 17], [10, 15], [13, 12]]) { pm.vline(x, 18 - h, h, stem[2]); pm.vline(x + 1, 18 - h, h, stem[3]); pm.rect(x - 0, 18 - h, 2, 4, br[2]); pm.set(x, 18 - h, br[1]); pm.set(x, 18 - h - 1, br[3]); }
  pm.outline(null, { amt: 0.6 });
  return pm;
}
function bonePile() {
  const pm = new Pixmap(16, 16);
  const b = ramp(hex('#f1ead7'));
  const bone = (x0, y0, x1, y1) => { pm.line(x0, y0, x1, y1, b[2]); pm.line(x0, y0 - 1, x1, y1 - 1, b[1]); pm.circle(x0, y0, 1.4, b[2]); pm.circle(x1, y1, 1.4, b[2]); };
  bone(3, 11, 11, 9); bone(5, 13, 13, 12); bone(4, 9, 9, 12);
  pm.circle(11, 10, 3, b[2]); pm.set(10, 10, hex('#2a1f3d')); pm.set(12, 10, hex('#2a1f3d')); pm.set(11, 12, b[4]);
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 8, 14.5, 7, 1.5, 55);
  return pm;
}
function glowFlower(petal, core, glow) {
  const pm = new Pixmap(16, 18);
  const stem = ramp(hex('#4a8a8a'));
  pm.vline(8, 9, 8, stem[2]); pm.set(7, 13, stem[1]); pm.set(9, 11, stem[3]);
  const pc = ramp(hex(petal));
  for (const [dx, dy, c] of [[0, -3, pc[1]], [-2, -1, pc[1]], [2, -1, pc[2]], [-1, 1, pc[2]], [1, 1, pc[3]], [0, -1, pc[0]]]) pm.rect(8 + dx - 1, 8 + dy - 1, 2, 2, c);
  pm.set(8, 7, hex(core)); pm.set(8, 8, hex(core));
  pm.outline(null, { amt: 0.55 });
  for (const [x, y] of [[4, 4], [12, 5], [3, 9], [13, 10]]) pm.set(x, y, withAlpha(hex(glow), 200));
  return pm;
}
function sandPile() {
  const pm = new Pixmap(16, 16);
  const pal = ramp(hex('#f1dc9a'));
  ballShade(pm, 8, 12, 6.5, 3.6, pal, { dither: 0.05 }); ballShade(pm, 5.5, 12.5, 3.5, 2.2, pal, { dither: 0 });
  pm.set(7, 10, pal[0]); pm.set(8, 10, pal[0]);
  pm.outline(null, { amt: 0.5 });
  return pm;
}

// ----------------------------------------------------------------- specials
function digSpot() {
  const pm = new Pixmap(16, 16);
  const d = ramp(hex('#9a6a3e'));
  pm.ellipse(8, 10, 6, 3.4, d[2]); pm.ellipse(8, 9, 5, 2.6, d[1]);
  const x = hex('#5a3a22');
  pm.line(5, 7, 11, 12, x); pm.line(6, 7, 12, 12, x); pm.line(11, 7, 5, 12, x); pm.line(10, 7, 4, 12, x);
  pm.set(3, 6, hex('#ffe066')); pm.set(13, 6, hex('#ffffff')); pm.set(2, 12, hex('#ffffff'));
  pm.outline(null, { amt: 0.6 });
  return pm;
}
function chestWild(open) {
  const pm = new Pixmap(16, 16);
  const w = ramp(hex('#b07840')), m = ramp(hex('#e8c64a'));
  pm.rect(2, 7, 12, 8, w[2]); pm.rect(2, 7, 12, 1, w[1]); pm.rect(2, 13, 12, 2, w[3]);
  for (const x of [4, 11]) pm.rect(x, 7, 1, 8, w[3]);
  pm.rect(2, 10, 12, 1, m[3]);
  if (!open) {
    pm.rect(2, 3, 12, 5, w[2]); pm.rect(3, 2, 10, 1, w[2]); pm.rect(2, 3, 12, 1, w[1]); pm.rect(3, 2, 10, 1, w[1]);
    for (const x of [4, 11]) pm.rect(x, 3, 1, 5, w[3]);
    pm.rect(7, 7, 3, 4, m[2]); pm.set(8, 9, ramp(hex('#8a6a1a'))[3]); pm.set(7, 7, m[0]);
  } else {
    pm.rect(2, 2, 12, 3, w[3]); pm.rect(3, 1, 10, 1, w[3]);
    pm.rect(3, 5, 10, 2, hex('#3a2a50')); pm.set(5, 5, hex('#ffe066')); pm.set(9, 6, hex('#ffe066')); pm.set(7, 5, hex('#ff8fb3'));
    pm.rect(7, 8, 3, 3, m[2]);
  }
  pm.outline(null, { amt: 0.7 });
  groundShadow(pm, 8, 15, 7, 1.5);
  return pm;
}

export function registerNodes(book) {
  const r = (n) => new RNG(1000 + n);
  const add = (name, pm) => book.add(name, pm);
  // trees: two variants each
  add('t_oak', canopyOak(r(1), LEAF.oak, { fruit: { n: 0 } }));
  add('t_oak_v1', canopyOak(r(2), ramp(hex('#6ccb55')), { lobes: [[9, 20, 8.5, 6.5], [23, 18.5, 8, 7], [15, 10, 9.5, 8], [17, 17, 11, 9.5]], fruit: { n: 4, c: hex('#ff5a6a') } }));
  add('t_oak_dep', stump());
  add('t_pine', treePine(r(3))); add('t_pine_v1', treePine(r(4))); add('t_pine_dep', stump('#8a5a3a'));
  add('t_palm', treePalm(r(5))); add('t_palm_dep', stump('#c8925a'));
  add('t_mangrove', treeMangrove(r(6))); add('t_mangrove_dep', stump('#6a4a2a'));
  add('t_dead_tree', treeDead(r(7))); add('t_dead_tree_dep', stump('#8a7a8a'));
  add('t_burnt_tree', treeBurnt(r(8))); add('t_burnt_tree_dep', stump('#3a3040'));
  add('t_crystal_tree', treeCrystal(r(9))); add('t_crystal_tree_dep', rubble('#e7a6f0'));
  add('t_void_tree', treeVoid(r(10))); add('t_void_tree_dep', rubble('#6f58d8'));
  // rocks & ores
  add('t_rock', rockPlain(r(11), '#b3b8cc')); add('t_rock_v1', rockPlain(r(12), '#a9aec2')); add('t_rock_dep', rubble('#b3b8cc'));
  add('t_coal_rock', rockOre(r(13), '#8d92a8', [hex('#2a2538'), hex('#3b3550')], 8)); add('t_coal_rock_dep', rubble('#8d92a8'));
  add('t_copper_rock', rockOre(r(14), '#b0a8b8', [hex('#ff9a4a'), hex('#e8742e'), hex('#5fd0a0')], 7)); add('t_copper_rock_dep', rubble('#b0a8b8'));
  add('t_iron_rock', rockOre(r(15), '#a4a8bc', [hex('#f0d0b8'), hex('#d8b09a'), hex('#e8e8f0')], 7)); add('t_iron_rock_dep', rubble('#a4a8bc'));
  add('t_gold_rock', rockOre(r(16), '#a8a4b8', [hex('#ffe066'), hex('#ffc933'), hex('#fff3a8')], 7)); add('t_gold_rock_dep', rubble('#a8a4b8'));
  add('t_ice_rock', rockIce(r(17))); add('t_ice_rock_dep', rubble('#aee3ff'));
  add('t_sandstone', rockSand(r(18))); add('t_sandstone_dep', rubble('#e6c27a'));
  add('t_clay_deposit', clayDeposit()); add('t_clay_deposit_dep', rubble('#c98a6a'));
  add('t_tombstone', tombstone()); add('t_tombstone_dep', rubble('#b4aec4'));
  add('t_ember_rock', rockEmber(r(19))); add('t_ember_rock_dep', rubble('#6a4a52'));
  add('t_obsidian_rock', rockObsidian(r(20))); add('t_obsidian_rock_dep', rubble('#3a3050'));
  add('t_crystal_rock', rockCrystal(r(21), [hex('#ff9fd0'), hex('#9ff0e0'), hex('#d4b8ff')])); add('t_crystal_rock_dep', rubble('#9a8fc8'));
  add('t_star_rock', rockStar(r(22))); add('t_star_rock_dep', rubble('#3a3a78'));
  add('t_geode', geode(r(23))); add('t_geode_dep', rubble('#8a8aa8'));
  // plants
  add('t_tall_grass', tallGrass(0)); add('t_tall_grass_v1', tallGrass(1)); add('t_tall_grass_v2', tallGrass(2)); add('t_tall_grass_dep', tallGrassStub());
  add('t_flower_pink', flowerPatch('#ff8fb3')); add('t_flower_pink_dep', flowerStub());
  add('t_flower_yellow', flowerPatch('#ffd84a', '#ff9a3c')); add('t_flower_yellow_dep', flowerStub());
  add('t_flower_blue', flowerPatch('#7fb0ff', '#ffffff')); add('t_flower_blue_dep', flowerStub());
  add('t_berry_bush', berryBush()); add('t_berry_bush_dep', berryBush('#ff4f6d', '#58b84a', false));
  add('t_frost_bush', berryBush('#5aa0ff', '#7ec8c0')); add('t_frost_bush_dep', berryBush('#5aa0ff', '#7ec8c0', false));
  add('t_cactus', cactus()); add('t_cactus_dep', rubble('#4fb868'));
  add('t_mushroom_patch', mushrooms()); add('t_mushroom_patch_dep', flowerStub());
  add('t_cotton_plant', cottonPlant()); add('t_cotton_plant_dep', flowerStub());
  add('t_reeds', reeds()); add('t_reeds_dep', tallGrassStub());
  add('t_bone_pile', bonePile()); add('t_bone_pile_dep', rubble('#f1ead7'));
  add('t_spirit_flower', glowFlower('#a8d8ff', '#ffffff', '#c8ecff')); add('t_spirit_flower_dep', flowerStub());
  add('t_ember_bloom', glowFlower('#ff7a3d', '#ffe066', '#ffb347')); add('t_ember_bloom_dep', flowerStub());
  add('t_crystal_bloom', glowFlower('#ff9fd0', '#ffffff', '#ffd0ec')); add('t_crystal_bloom_dep', flowerStub());
  add('t_star_bloom', glowFlower('#8a6cff', '#fffbd0', '#d0c8ff')); add('t_star_bloom_dep', flowerStub());
  add('t_sand_pile', sandPile()); add('t_sand_pile_dep', rubble('#f1dc9a'));
  add('t_dig_spot', digSpot());
  add('t_chest_wild', chestWild(false)); add('t_chest_wild_dep', chestWild(true));
}
