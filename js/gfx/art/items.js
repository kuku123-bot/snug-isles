// Item icons (16x16), generated from templates per family so a whole tier of tools/armor/bars stays consistent.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, INK, A } from '../pixmap.js';
import { ITEMS, TIERS, ARMOR_SETS } from '../../data/items.js';
import { RNG, strHash } from '../../util.js';

const WHITE = hex('#ffffff');
const EYE = hex('#2a1f3d');
const R = (c) => ramp(hex(c));

export const METAL = {
  wood: '#c68a52', stone: '#a9aec4', copper: '#ee8e4c', iron: '#c3cbdc', gold: '#ffcf45', steel: '#93a3c0',
  obsidian: '#6a5a96', crystal: '#7fe0ff', star: '#ffe9a0', cloth: '#f4a6c0', void: '#8a6cff',
};
const HANDLE = R('#a8703f');

function outline(pm, amt = 0.68) { pm.outline(null, { amt }); return pm; }
function line2(pm, x0, y0, x1, y1, pal) {
  pm.line(x0, y0, x1, y1, pal[2]);
  pm.line(x0, y0 - 1, x1, y1 - 1, pal[1]);
  pm.line(x0 + 1, y0, x1 + 1, y1, pal[3]);
}
function sparkle(pm, x, y, c = WHITE) { pm.set(x, y, c); pm.set(x - 1, y, withAlpha(c, 160)); pm.set(x + 1, y, withAlpha(c, 160)); pm.set(x, y - 1, withAlpha(c, 160)); pm.set(x, y + 1, withAlpha(c, 160)); }

// ============================================================ tools & weapons
function pickaxe(mat) {
  const pm = new Pixmap(16, 16), hp = R(METAL[mat]);
  line2(pm, 2, 14, 11, 5, HANDLE);
  // curved head
  const arc = [[5, 3], [7, 2], [9, 2], [11, 3], [13, 5], [14, 7], [14, 9]];
  for (let i = 0; i < arc.length; i++) { const [x, y] = arc[i]; pm.set(x, y, hp[1]); pm.set(x, y + 1, hp[2]); if (i > 0 && i < arc.length - 1) pm.set(x, y + 2, hp[3]); }
  pm.set(5, 4, hp[3]); pm.set(14, 10, hp[3]);
  pm.set(8, 2, hp[0]); pm.set(9, 2, hp[0]);
  return outline(pm);
}
function sword(mat) {
  const pm = new Pixmap(16, 16), bp = R(METAL[mat]), gp = R(mat === 'gold' ? '#ff9a3c' : '#ffd84a');
  // blade (2px diagonal)
  for (let i = 0; i < 9; i++) { const x = 6 + i, y = 9 - i; pm.set(x, y, bp[1]); pm.set(x + 1, y, bp[2]); pm.set(x, y + 1, bp[2]); pm.set(x + 1, y + 1, bp[3]); }
  pm.set(14, 1, bp[0]); pm.set(14, 2, bp[1]); pm.set(13, 1, bp[1]);
  // guard
  pm.line(4, 8, 8, 12, gp[2]); pm.line(5, 8, 8, 11, gp[1]); pm.line(4, 9, 7, 12, gp[3]);
  // grip + pommel
  pm.line(3, 12, 5, 10, HANDLE[2]); pm.line(2, 13, 4, 11, HANDLE[3]);
  pm.set(1, 14, gp[2]); pm.set(2, 14, gp[3]); pm.set(1, 13, gp[1]);
  return outline(pm);
}
function bow(mat) {
  const pm = new Pixmap(16, 16), bp = R(METAL[mat === 'wood' ? 'wood' : mat]);
  const pts = [[11, 1], [8, 2], [6, 4], [5, 7], [5, 9], [6, 12], [8, 14], [11, 15]];
  for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; pm.set(x, y, bp[1]); pm.set(x + 1, y, bp[2]); if (i % 2) pm.set(x + 2, y, bp[3]); }
  pm.vline(12, 2, 13, hex('#f4f4f8'));
  pm.set(5, 8, HANDLE[3]); pm.set(6, 8, HANDLE[2]); pm.set(5, 7, HANDLE[1]);
  // arrow
  pm.line(3, 8, 12, 8, hex('#d8c8a0')); pm.set(13, 8, hex('#ffffff')); pm.set(2, 7, hex('#ff6a8a')); pm.set(2, 9, hex('#ff6a8a'));
  return outline(pm);
}
function staff(color, orb = null) {
  const pm = new Pixmap(16, 16), c = R(color || '#a77bff');
  line2(pm, 2, 14, 10, 6, HANDLE);
  pm.circle(11.5, 4.5, 3.2, c[2]); pm.set(10, 3, c[0]); pm.set(11, 3, c[1]); pm.set(10, 4, c[1]); pm.circle(12, 5, 1.2, c[3]);
  pm.set(8, 7, HANDLE[1]); pm.set(9, 8, HANDLE[2]);
  sparkle(pm, 14, 1, c[0]); sparkle(pm, 7, 3, c[1]);
  return outline(pm);
}
function shovel(mat) {
  const pm = new Pixmap(16, 16), hp = R(METAL[mat]);
  line2(pm, 2, 14, 10, 6, HANDLE);
  pm.rect(10, 1, 4, 5, hp[2]); pm.rect(11, 0, 2, 1, hp[2]); pm.rect(10, 1, 1, 5, hp[1]); pm.rect(13, 2, 1, 4, hp[3]); pm.rect(10, 5, 4, 1, hp[3]); pm.set(11, 2, hp[0]);
  pm.rect(8, 5, 2, 2, HANDLE[1]); pm.set(9, 5, HANDLE[0]);
  return outline(pm);
}
function rod(mat) {
  const pm = new Pixmap(16, 16), hp = R(METAL[mat]);
  line2(pm, 1, 14, 11, 4, HANDLE);
  pm.line(11, 3, 14, 2, hp[1]); pm.line(14, 2, 14, 9, hex('#f4f4f8'));
  pm.circle(14, 10.5, 1.8, hex('#ff5a6a')); pm.set(14, 9, hex('#ffffff')); pm.set(14, 11, hex('#ffffff'));
  pm.set(4, 12, hp[2]); pm.set(7, 9, hp[2]);
  return outline(pm);
}

// ============================================================ armor & charms
function hat(setId) {
  const pm = new Pixmap(16, 16), c = R(armorColor(setId));
  pm.ellipse(8, 9, 6.5, 4.6, c[2]); pm.rect(1, 9, 14, 3, c[2]); pm.rect(1, 11, 14, 2, c[3]); pm.rect(1, 9, 14, 1, c[1]);
  pm.rect(3, 5, 10, 2, c[1]); pm.set(5, 6, c[0]); pm.set(6, 5, c[0]);
  if (setId === 'cloth') { pm.circle(8, 3.5, 1.8, c[0]); } else { pm.rect(7, 3, 2, 3, c[1]); pm.set(7, 2, c[0]); pm.rect(6, 9, 4, 1, hex('#ffd84a')); }
  if (setId === 'gold' || setId === 'star') { pm.set(4, 10, hex('#ffffff')); pm.set(12, 10, hex('#ffffff')); }
  return outline(pm);
}
function tunic(setId) {
  const pm = new Pixmap(16, 16), c = R(armorColor(setId));
  pm.rect(4, 3, 8, 11, c[2]); pm.rect(1, 3, 3, 6, c[2]); pm.rect(12, 3, 3, 6, c[3]);
  pm.rect(4, 3, 1, 11, c[1]); pm.rect(11, 3, 1, 11, c[3]); pm.rect(1, 3, 3, 1, c[1]); pm.rect(4, 13, 8, 1, c[4]); pm.rect(1, 8, 3, 1, c[3]); pm.rect(12, 8, 3, 1, c[4]);
  pm.rect(6, 3, 4, 2, darker(c[3], 0.2)); pm.rect(7, 5, 2, 8, c[1]);
  pm.rect(4, 10, 8, 1, setId === 'cloth' ? c[3] : hex('#ffd84a'));
  return outline(pm);
}
function boots(setId) {
  const pm = new Pixmap(16, 16), c = R(armorColor(setId));
  for (const x0 of [2, 9]) { pm.rect(x0, 4, 5, 8, c[2]); pm.rect(x0, 4, 1, 8, c[1]); pm.rect(x0 + 4, 4, 1, 8, c[3]); pm.rect(x0 - 1, 10, 7, 3, c[2]); pm.rect(x0 - 1, 12, 7, 1, c[4]); pm.rect(x0, 4, 5, 2, c[1]); pm.set(x0 + 1, 7, c[0]); }
  return outline(pm);
}
function armorColor(setId) { return { cloth: '#f4a6c0', copper: '#ee8e4c', iron: '#c3cbdc', gold: '#ffcf45', obsidian: '#6a5a96', crystal: '#7fe0ff', star: '#ffe9a0' }[setId]; }
function charm(color, glyph) {
  const pm = new Pixmap(16, 16), c = R(color);
  pm.circle(8, 9, 5.6, c[2]); pm.ring(8, 9, 4.2, 5.6, c[3]); pm.circle(8, 9, 3.4, c[1]);
  pm.rect(7, 1, 2, 3, hex('#ffd84a')); pm.set(7, 1, hex('#fff3a8')); pm.ring(8, 3, 1.1, 2, hex('#ffd84a'));
  glyph(pm, c);
  pm.set(5, 6, c[0]); pm.set(6, 5, c[0]);
  return outline(pm);
}

// ============================================================ resources
function logPile() {
  const pm = new Pixmap(16, 16), b = R('#a86f3d'), ring = R('#e8c08a');
  for (const [x, y, o] of [[2, 8, 0], [7, 8, 0], [4.5, 3, 1]]) {
    pm.rect(Math.floor(x), y, 9, 5, b[2]); pm.rect(Math.floor(x), y + 4, 9, 1, b[3]); pm.rect(Math.floor(x), y, 9, 1, b[1]);
    pm.ellipse(x + 1.5, y + 2.5, 2.2, 2.6, ring[1]); pm.ellipse(x + 1.5, y + 2.5, 1.1, 1.3, ring[2]); pm.set(Math.floor(x + 1.5), y + 2, b[2]);
  }
  return outline(pm);
}
function rocks(base, n = 3) {
  const pm = new Pixmap(16, 16), p = R(base);
  for (const [x, y, rx, ry] of [[5.5, 10.5, 4.5, 3.6], [10.5, 10, 4, 3.4], [8, 6.5, 3.6, 3.1]].slice(0, n)) ballShade(pm, x, y, rx, ry, p, { dither: 0 });
  return outline(pm);
}
function fiber() {
  const pm = new Pixmap(16, 16), p = R('#7ad060');
  for (const [x, l, lean] of [[4, 11, -2], [6, 12, -1], [8, 12, 0], [10, 11, 1], [12, 10, 2], [7, 9, 1]]) for (let k = 0; k < l; k++) { const px = x + Math.round(lean * k / l); pm.set(px, 14 - k, k > l * 0.6 ? p[1] : p[2]); pm.set(px + 1, 14 - k, p[3]); }
  pm.rect(3, 9, 10, 2, hex('#e8c06a')); pm.rect(3, 10, 10, 1, hex('#c8a04a'));
  return outline(pm);
}
function coal() { const pm = new Pixmap(16, 16), p = R('#4a4660'); for (const [x, y, r] of [[5, 10, 3.6], [10.5, 9.5, 3.2], [8, 5.5, 3]]) ballShade(pm, x, y, r, r * 0.9, p, { dither: 0 }); pm.set(4, 8, p[0]); pm.set(9, 7, p[0]); pm.set(9, 4, lighter(p[1], 0.4)); return outline(pm); }
function sandItem() { const pm = new Pixmap(16, 16), p = R('#f1dc9a'); ballShade(pm, 8, 11, 6.5, 4, p, { dither: 0.05 }); ballShade(pm, 6, 12, 3.5, 2.2, p, { dither: 0 }); pm.set(7, 8, p[0]); pm.set(8, 8, p[0]); for (const [x, y] of [[4, 10], [10, 12], [12, 10]]) pm.set(x, y, p[3]); return outline(pm); }
function clay() { const pm = new Pixmap(16, 16), p = R('#d8906a'); ballShade(pm, 8, 10, 6, 4.6, p, { dither: 0 }); pm.hline(5, 11, 5, p[3]); pm.set(6, 8, p[0]); pm.set(7, 8, p[0]); return outline(pm); }
function ore(base, cols) {
  const pm = new Pixmap(16, 16), p = R('#9da2b8');
  for (const [x, y, rx, ry] of [[6, 10, 4.8, 4.2], [11, 10.5, 3.8, 3.4], [8.5, 6.5, 4, 3.4]]) ballShade(pm, x, y, rx, ry, p, { dither: 0 });
  const rng = new RNG(strHash(base));
  for (let i = 0; i < 6; i++) { const x = 4 + rng.int(9), y = 5 + rng.int(8); if (A(pm.get(x, y))) { const c = cols[i % cols.length]; pm.set(x, y, c); pm.set(x + 1, y, darker(c, 0.2)); pm.set(x, y - 1, lighter(c, 0.4)); } }
  return outline(pm);
}
function cottonItem() { const pm = new Pixmap(16, 16); for (const [x, y, r] of [[5.5, 9, 3.6], [10.5, 9, 3.6], [8, 5.5, 3.6], [8, 10.5, 3.4]]) { pm.circle(x, y, r, WHITE); } for (const [x, y] of [[4, 10], [9, 11], [11, 7], [7, 5]]) pm.set(x, y, hex('#d8e0f8')); pm.set(5, 7, hex('#f0f4ff')); pm.rect(7, 12, 2, 2, hex('#6aa850')); return outline(pm); }
function petals(color) { const pm = new Pixmap(16, 16), c = R(color); for (const [x, y, rot] of [[5, 8, 0], [10, 8, 1], [7.5, 4, 2], [7.5, 11, 3]]) { pm.ellipse(x, y, 3, 2.4, c[2]); pm.set(Math.round(x) - 1, Math.round(y) - 1, c[0]); pm.set(Math.round(x), Math.round(y) - 1, c[1]); pm.set(Math.round(x) + 1, Math.round(y) + 1, c[3]); } pm.circle(8, 8, 1.3, hex('#ffd84a')); return outline(pm); }
function iceShard() { const pm = new Pixmap(16, 16), c = R('#a8e6ff'); pm.poly([[8, 1], [12, 7], [10, 14], [6, 14], [4, 7]], c[2]); pm.poly([[8, 1], [8, 14], [6, 14], [4, 7]], c[1]); pm.poly([[8, 1], [12, 7], [10, 14], [8, 14]], c[3]); pm.set(6, 6, c[0]); pm.set(6, 7, c[0]); pm.set(7, 4, c[0]); sparkle(pm, 13, 3); return outline(pm); }
function moss() { const pm = new Pixmap(16, 16), p = R('#5fb06a'); for (const [x, y, r] of [[5, 10, 3.4], [10, 10, 3.6], [7.5, 6.5, 3.4]]) ballShade(pm, x, y, r, r * 0.9, p, { dither: 0.15 }); for (const [x, y] of [[4, 9], [9, 6], [11, 11]]) pm.set(x, y, p[0]); pm.set(6, 12, hex('#e8f0c0')); return outline(pm); }
function bone() { const pm = new Pixmap(16, 16), b = R('#f1ead7'); pm.line(3, 12, 12, 3, b[2]); pm.line(4, 12, 13, 3, b[2]); pm.line(3, 11, 12, 2, b[1]); for (const [x, y] of [[2, 11], [3, 13], [12, 2], [14, 3]]) pm.circle(x + 0.5, y + 0.5, 1.7, b[2]); pm.set(2, 10, b[0]); pm.set(12, 1, b[0]); pm.set(4, 13, b[3]); pm.set(14, 4, b[3]); return outline(pm); }
function spiritDust() { const pm = new Pixmap(16, 16), c = R('#a8d8ff'); ballShade(pm, 8, 11, 5.6, 3.4, c, { dither: 0.2 }); for (const [x, y] of [[4, 5], [11, 4], [8, 7], [13, 9], [3, 9]]) sparkle(pm, x, y, hex('#e8f6ff')); return outline(pm, 0.5); }
function emberStone() { const pm = new Pixmap(16, 16), p = R('#6a4a52'); ballShade(pm, 8, 9, 6, 5.2, p, { dither: 0 }); for (const [x, y] of [[5, 7], [9, 6], [7, 10], [11, 10], [6, 12]]) { pm.set(x, y, hex('#ff6a2e')); pm.set(x, y + 1, hex('#ffb347')); } pm.set(9, 5, hex('#ffd27a')); return outline(pm); }
function obsidianShard() { const pm = new Pixmap(16, 16), c = R('#4a3a7a'); pm.poly([[8, 1], [12, 8], [10, 14], [5, 14], [4, 7]], c[2]); pm.poly([[8, 1], [8, 14], [5, 14], [4, 7]], c[1]); pm.poly([[8, 1], [12, 8], [10, 14], [8, 14]], c[3]); pm.set(6, 5, hex('#c8b8ff')); pm.set(6, 6, hex('#a898e8')); pm.set(7, 3, hex('#c8b8ff')); return outline(pm); }
function crystalShard(color = '#ff9fd0') { const pm = new Pixmap(16, 16), c = R(color); for (const [x, b, w, h] of [[8, 14, 6, 12], [4, 14, 4, 7], [12, 14, 4, 8]]) { for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w / 2 * (1 - j / (h * 1.15)))); for (let i = -hw; i <= hw; i++) pm.set(x + i, b - j, i < 0 ? c[1] : i > 0 ? c[3] : c[2]); } pm.set(x - 1, b - h + 3, c[0]); } sparkle(pm, 13, 2); return outline(pm); }
function prismWood() { const pm = logPile(); pm.mapColors((c) => c); const cols = [hex('#ff9fd0'), hex('#9ff0e0'), hex('#d4b8ff')]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = pm.get(x, y); if (A(c) && c === R('#a86f3d')[2]) pm.set(x, y, cols[(x + y) % 3]); } return pm; }
function starFragment() { const pm = new Pixmap(16, 16), c = R('#ffe9a0'); pm.poly([[8, 1], [10, 6], [15, 6.5], [11, 9.5], [12.5, 15], [8, 11.8], [3.5, 15], [5, 9.5], [1, 6.5], [6, 6]], c[2]); pm.poly([[8, 1], [8, 11.8], [3.5, 15], [5, 9.5], [1, 6.5], [6, 6]], c[1]); pm.set(7, 5, WHITE); pm.set(6, 7, c[0]); return outline(pm); }
function voidEssence() { const pm = new Pixmap(16, 16), c = R('#8a6cff'); ballShade(pm, 8, 8, 5.6, 5.6, c, { dither: 0.15 }); pm.ellipse(8, 8, 3.2, 1.6, hex('#14102a')); pm.ellipse(8, 8, 1.6, 3.2, hex('#14102a')); for (const [x, y] of [[3, 3], [13, 4], [12, 12], [4, 12]]) pm.set(x, y, hex('#fffbd0')); return outline(pm, 0.8); }
function goo() { const pm = new Pixmap(16, 16), c = R('#7ee27a'); ballShade(pm, 8, 9.5, 5.6, 4.6, c, { dither: 0.1 }); pm.circle(5, 4, 1.8, c[2]); pm.set(5, 3, c[0]); pm.set(5, 6, c[2]); pm.set(5, 7, c[2]); pm.set(6, 7, c[2]); pm.ellipse(6, 7.5, 1.4, 1.1, WHITE.valueOf() && withAlpha(WHITE, 170)); return outline(pm); }
function feather(color = '#ffffff') { const pm = new Pixmap(16, 16), c = R(color); for (let i = 0; i < 11; i++) { const x = 3 + i, y = 12 - i; const w = Math.round(Math.sin(i / 10 * Math.PI) * 3) + 1; for (let k = -w; k <= w; k++) pm.set(x + (k > 0 ? 0 : 0), y + k, k < 0 ? c[1] : k > 0 ? c[3] : c[2]); } pm.line(2, 13, 13, 2, hex('#c8b8e8')); pm.set(2, 14, hex('#c8b8e8')); pm.set(13, 3, c[0]); return outline(pm); }
function acorn() { const pm = new Pixmap(16, 16), n = R('#c88a4a'), cap = R('#8a5a2a'); ballShade(pm, 8, 10, 4.4, 4.6, n, { dither: 0 }); pm.ellipse(8, 6.5, 5.2, 2.8, cap[2]); pm.rect(3, 6, 10, 2, cap[2]); pm.hline(4, 5, 8, cap[1]); for (let x = 4; x < 12; x += 2) pm.set(x, 7, cap[3]); pm.rect(7, 2, 2, 3, cap[3]); pm.set(7, 2, cap[1]); return outline(pm); }
function charcoal() { const pm = coal(); return pm; }
function gem(color) { const pm = new Pixmap(16, 16), c = R(color); pm.poly([[4, 3], [12, 3], [15, 7], [8, 14], [1, 7]], c[2]); pm.poly([[4, 3], [8, 7], [1, 7]], c[1]); pm.poly([[12, 3], [15, 7], [8, 7]], c[3]); pm.poly([[1, 7], [8, 7], [8, 14]], c[2]); pm.poly([[15, 7], [8, 7], [8, 14]], c[4]); pm.set(5, 4, c[0]); pm.set(6, 4, c[0]); pm.set(4, 5, c[0]); sparkle(pm, 13, 2); return outline(pm); }
function wheat() { const pm = new Pixmap(16, 16), g = R('#f0c850'); for (const [x, lean] of [[4, -1], [8, 0], [12, 1]]) { pm.line(x, 14, x + lean, 5, hex('#c8a040')); for (let k = 0; k < 5; k++) { const y = 2 + k * 2; pm.set(x + lean - 1, y + 1, g[2]); pm.set(x + lean + 1, y, g[1]); pm.set(x + lean, y, g[2]); } } pm.rect(3, 11, 10, 2, hex('#c8504a')); return outline(pm); }
function milk() { const pm = new Pixmap(16, 16), g = R('#d8f0ff'); pm.rect(4, 5, 8, 9, g[1]); pm.rect(5, 2, 6, 3, g[2]); pm.rect(4, 5, 1, 9, WHITE); pm.rect(11, 5, 1, 9, g[3]); pm.rect(5, 8, 6, 4, WHITE); pm.rect(5, 9, 6, 1, hex('#ffb3c8')); pm.rect(6, 1, 4, 1, hex('#ff6f9a')); return outline(pm); }
function woolItem() { const pm = new Pixmap(16, 16), c = R('#fdf0f6'); for (const [x, y, r] of [[5.5, 9, 3.8], [10.5, 9, 3.8], [8, 5.5, 3.8], [8, 10.5, 3.6]]) ballShade(pm, x, y, r, r, c, { dither: 0 }); pm.set(6, 6, WHITE); pm.line(4, 8, 11, 12, hex('#ff9fc0')); return outline(pm); }
function egg(color = '#fff2d6', spots = null) { const pm = new Pixmap(16, 16), c = R(color); ballShade(pm, 8, 9, 4.6, 5.6, c, { dither: 0 }); if (spots) for (const [x, y] of [[6, 7], [10, 10], [7, 12], [10, 6], [5, 10]]) { pm.set(x, y, spots); pm.set(x + 1, y, darker(spots, 0.2)); } pm.set(6, 5, WHITE); pm.set(6, 6, c[0]); return outline(pm); }

// ============================================================ materials
function plank() { const pm = new Pixmap(16, 16), w = R('#c68a52'); for (const [y, o] of [[3, 0], [6, 2], [9, 0], [12, 2]]) { pm.rect(1 + o, y, 12, 3, w[2]); pm.rect(1 + o, y, 12, 1, w[1]); pm.rect(1 + o, y + 2, 12, 1, w[3]); pm.set(4 + o, y + 1, w[3]); pm.set(9 + o, y + 1, w[3]); } return outline(pm); }
function rope() { const pm = new Pixmap(16, 16), r = R('#e0c288'); pm.ring(8, 8, 3, 6.2, r[2]); pm.ring(8, 8, 4, 5, r[1]); for (let a = 0; a < 6.28; a += 0.5) { const x = 8 + Math.cos(a) * 5.6, y = 8 + Math.sin(a) * 5.6; pm.set(Math.round(x), Math.round(y), r[3]); } pm.rect(8, 1, 5, 2, r[2]); pm.set(13, 2, r[3]); pm.rect(12, 3, 2, 3, r[2]); return outline(pm); }
function clothItem(color = '#f4a6c0') { const pm = new Pixmap(16, 16), c = R(color); pm.rect(2, 4, 12, 9, c[2]); pm.rect(2, 4, 12, 2, c[1]); pm.rect(2, 12, 12, 1, c[3]); pm.rect(2, 8, 12, 1, c[3]); pm.rect(11, 4, 3, 9, c[3]); pm.rect(11, 4, 1, 9, c[2]); pm.set(3, 5, c[0]); pm.set(4, 5, c[0]); for (let x = 3; x < 11; x += 2) pm.set(x, 10, c[1]); return outline(pm); }
function glassItem() { const pm = new Pixmap(16, 16), c = R('#bfeaff'); pm.rect(2, 2, 12, 12, withAlpha(c[1], 200)); pm.frame(2, 2, 12, 12, c[3]); pm.rect(4, 4, 3, 1, WHITE); pm.rect(4, 5, 1, 3, WHITE); pm.set(11, 11, WHITE); pm.set(10, 12, WHITE); pm.line(8, 5, 5, 10, withAlpha(WHITE, 150)); return outline(pm); }
function brickItem() { const pm = new Pixmap(16, 16), b = R('#d4684f'); pm.rect(1, 4, 14, 9, b[2]); for (const y of [4, 8, 12]) pm.hline(1, y, 14, b[1]); pm.hline(1, 7, 14, b[4]); pm.hline(1, 11, 14, b[4]); pm.vline(7, 5, 2, b[4]); pm.vline(4, 8, 3, b[4]); pm.vline(11, 8, 3, b[4]); pm.vline(7, 12, 1, b[4]); pm.rect(1, 12, 14, 1, b[3]); return outline(pm); }
function bottle(liquid = null, cork = '#c68a52') { const pm = new Pixmap(16, 16), g = R('#cfeeff'); pm.rect(5, 6, 6, 8, g[1]); pm.rect(6, 3, 4, 3, g[1]); pm.rect(5, 6, 1, 8, WHITE); pm.rect(10, 6, 1, 8, g[3]); pm.rect(5, 13, 6, 1, g[3]); if (liquid) { const l = R(liquid); pm.rect(6, 8, 4, 5, l[2]); pm.rect(6, 8, 4, 1, l[1]); pm.rect(9, 8, 1, 5, l[3]); pm.set(7, 9, l[0]); } pm.rect(6, 1, 4, 2, hex(cork)); pm.set(6, 1, lighter(hex(cork), 0.4)); return outline(pm); }
function paper() { const pm = new Pixmap(16, 16), c = R('#fff6e0'); pm.rect(3, 2, 10, 12, c[2]); pm.rect(3, 2, 10, 1, WHITE); pm.rect(12, 2, 1, 12, c[3]); pm.rect(3, 13, 10, 1, c[3]); for (const y of [5, 7, 9]) pm.hline(5, y, 6, hex('#b8a888')); pm.set(10, 11, hex('#b8a888')); return outline(pm); }
function flour() { const pm = new Pixmap(16, 16), c = R('#f4ead0'); pm.rect(3, 4, 10, 10, c[2]); pm.rect(3, 4, 1, 10, c[1]); pm.rect(12, 4, 1, 10, c[3]); pm.rect(3, 13, 10, 1, c[3]); pm.rect(4, 2, 8, 3, c[1]); pm.rect(5, 3, 6, 1, c[3]); pm.rect(5, 7, 6, 4, hex('#c88a4a')); pm.set(8, 8, hex('#f0c850')); pm.set(7, 9, hex('#f0c850')); pm.set(9, 9, hex('#f0c850')); pm.vline(8, 7, 4, hex('#a86a2a')); return outline(pm); }
function fertilizer() { const pm = new Pixmap(16, 16), c = R('#a07a4a'); pm.rect(3, 5, 10, 9, c[2]); pm.rect(3, 5, 1, 9, c[1]); pm.rect(12, 5, 1, 9, c[3]); pm.rect(3, 13, 10, 1, c[3]); pm.rect(4, 3, 8, 3, c[1]); pm.rect(7, 8, 2, 4, hex('#6fd05a')); pm.set(6, 8, hex('#8fe070')); pm.set(9, 7, hex('#8fe070')); pm.set(7, 7, hex('#6fd05a')); return outline(pm); }
function ingot(mat) { const pm = new Pixmap(16, 16), c = R(METAL[mat] || mat); pm.poly([[2, 10], [5, 5], [14, 5], [11, 10]], c[1]); pm.rect(2, 10, 9, 4, c[2]); pm.poly([[11, 10], [14, 5], [14, 9], [11, 14]], c[3]); pm.rect(2, 13, 9, 1, c[4]); pm.rect(5, 6, 6, 1, c[0]); pm.set(3, 11, c[0]); pm.set(4, 11, c[0]); return outline(pm); }
function plate(mat) { const pm = new Pixmap(16, 16), c = R(METAL[mat]); pm.rect(2, 3, 12, 10, c[2]); pm.rect(2, 3, 12, 1, c[0]); pm.rect(2, 3, 1, 10, c[1]); pm.rect(13, 3, 1, 10, c[3]); pm.rect(2, 12, 12, 1, c[4]); for (const [x, y] of [[4, 5], [11, 5], [4, 10], [11, 10]]) { pm.set(x, y, c[0]); pm.set(x + 1, y + 1, c[4]); } pm.line(5, 8, 10, 6, c[1]); return outline(pm); }
function bar(mat) { const pm = ingot(mat); sparkle(pm, 13, 2); return pm; }
function gear() { const pm = new Pixmap(16, 16), c = R('#c3cbdc'); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const x = 8 + Math.cos(a) * 6, y = 8 + Math.sin(a) * 6; pm.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, c[2]); } pm.circle(8, 8, 5, c[2]); pm.circle(8, 8, 2, hex('#2a1f3d')); pm.ring(8, 8, 3, 5, c[1]); pm.set(6, 5, c[0]); pm.set(7, 4, c[0]); pm.circle(8, 8, 1.2, c[3]); return outline(pm); }
function lens() { const pm = new Pixmap(16, 16), c = R('#bfeaff'), g = R('#ffcf45'); pm.circle(8, 8, 6, g[2]); pm.ring(8, 8, 4.5, 6, g[1]); pm.circle(8, 8, 4.4, c[1]); pm.set(5, 5, WHITE); pm.set(6, 5, WHITE); pm.set(5, 6, WHITE); pm.set(10, 10, withAlpha(WHITE, 170)); pm.circle(8, 8, 2, withAlpha(c[2], 220)); return outline(pm); }
function core(color) { const pm = new Pixmap(16, 16), c = R(color); pm.circle(8, 8, 6.4, hex('#3a3050')); pm.ring(8, 8, 5, 6.4, hex('#6a5a8a')); ballShade(pm, 8, 8, 4.4, 4.4, c, { dither: 0 }); pm.set(6, 6, WHITE); pm.set(7, 5, c[0]); for (const [x, y] of [[8, 0], [8, 15], [0, 8], [15, 8]]) pm.set(x, y, hex('#6a5a8a')); return outline(pm); }
function arrow() { const pm = new Pixmap(16, 16); pm.line(2, 13, 12, 3, hex('#d8c8a0')); pm.line(3, 13, 13, 3, hex('#b8a070')); pm.poly([[12, 1], [15, 1], [15, 4]], hex('#c3cbdc')); pm.set(14, 2, WHITE); pm.poly([[1, 12], [4, 15], [1, 15]], hex('#ff6a8a')); pm.poly([[2, 11], [0, 13], [3, 14]], hex('#ffa0b8')); return outline(pm); }

// ============================================================ plants & food
function berries(color = '#ff4f6d', leaf = '#58b84a') { const pm = new Pixmap(16, 16), b = R(color), l = R(leaf); for (const [x, y] of [[5, 9], [10, 9], [7.5, 5.5], [8, 11.5]]) { pm.circle(x, y, 2.9, b[2]); pm.set(Math.round(x) - 1, Math.round(y) - 1, WHITE); pm.set(Math.round(x), Math.round(y) - 1, b[1]); pm.set(Math.round(x) + 1, Math.round(y) + 1, b[3]); } pm.poly([[7, 2], [10, 1], [11, 4], [8, 4]], l[2]); pm.set(9, 2, l[1]); return outline(pm); }
function apple() { const pm = new Pixmap(16, 16), a = R('#f2545b'); ballShade(pm, 8, 9.5, 5.6, 5.2, a, { dither: 0 }); pm.set(5, 6, WHITE); pm.set(6, 5, a[0]); pm.rect(8, 2, 1, 3, hex('#6a4a2a')); pm.poly([[9, 3], [13, 2], [12, 5], [9, 5]], hex('#58b84a')); pm.set(11, 3, hex('#8fe070')); return outline(pm); }
function mushroomItem(cap = '#e0508a', glow = false) { const pm = new Pixmap(16, 16), c = R(cap), s = R('#f4ecd8'); pm.rect(6, 8, 4, 6, s[2]); pm.rect(6, 8, 1, 6, s[1]); pm.rect(9, 8, 1, 6, s[3]); ballShade(pm, 8, 6.5, 6.4, 4.8, c, { dither: 0 }); for (const [x, y] of [[4, 5], [8, 3], [11, 6], [6, 7]]) { pm.rect(x, y, 2, 2, glow ? hex('#e8fff4') : WHITE); } if (glow) { sparkle(pm, 2, 2, hex('#b8ffe8')); sparkle(pm, 14, 4, hex('#b8ffe8')); } return outline(pm); }
function cactusFlesh() { const pm = new Pixmap(16, 16), c = R('#4fb868'); ballShade(pm, 8, 8.5, 4, 6, c, { dither: 0 }); for (const [x, y] of [[8, 4], [6, 8], [10, 10], [8, 12]]) pm.set(x, y, c[0]); pm.set(8, 2, hex('#ff8fb3')); pm.set(9, 2, hex('#ffc2d8')); pm.set(7, 2, hex('#ff6f9a')); return outline(pm); }
function coconut() { const pm = new Pixmap(16, 16), c = R('#8a5a2a'); ballShade(pm, 8, 8.5, 5.6, 5.6, c, { dither: 0 }); pm.set(6, 7, hex('#2a1a0a')); pm.set(9, 7, hex('#2a1a0a')); pm.set(8, 9, hex('#2a1a0a')); pm.set(5, 5, c[0]); pm.set(6, 4, c[0]); return outline(pm); }
function carrot() { const pm = new Pixmap(16, 16), c = R('#ff9a3c'), g = R('#58b84a'); pm.poly([[4, 5], [12, 5], [8, 15]], c[2]); pm.poly([[4, 5], [8, 5], [8, 15]], c[1]); pm.poly([[8, 5], [12, 5], [8, 15]], c[3]); for (const y of [7, 9, 11]) pm.hline(6, y, 3, c[3]); for (const x of [5, 8, 11]) pm.line(8, 5, x, 1, g[2]); pm.set(5, 1, g[1]); pm.set(11, 1, g[1]); pm.set(6, 6, c[0]); return outline(pm); }
function tomato() { const pm = new Pixmap(16, 16), c = R('#f2503a'); ballShade(pm, 8, 9.5, 6, 5, c, { dither: 0 }); pm.set(5, 7, WHITE); pm.set(6, 6, c[0]); pm.poly([[5, 4], [8, 5], [11, 4], [10, 7], [8, 6], [6, 7]], hex('#58b84a')); pm.rect(8, 2, 1, 3, hex('#3f8a3a')); return outline(pm); }
function pumpkin() { const pm = new Pixmap(16, 16), c = R('#ff9a3c'); for (const [x, rx] of [[4.5, 3.6], [11.5, 3.6], [8, 5]]) ballShade(pm, x, 9.5, rx, 5, c, { dither: 0 }); pm.vline(8, 5, 9, c[3]); pm.vline(5, 6, 7, c[3]); pm.vline(11, 6, 7, c[3]); pm.rect(7, 2, 2, 3, hex('#6a8a3a')); pm.set(9, 3, hex('#58b84a')); pm.set(5, 6, c[0]); return outline(pm); }
function strawberry() { const pm = new Pixmap(16, 16), c = R('#ff4f6d'); pm.poly([[3, 5], [13, 5], [11, 11], [8, 15], [5, 11]], c[2]); pm.poly([[3, 5], [8, 5], [8, 15], [5, 11]], c[1]); pm.poly([[8, 5], [13, 5], [11, 11], [8, 15]], c[3]); for (const [x, y] of [[5, 7], [8, 8], [10, 7], [6, 10], [9, 11]]) pm.set(x, y, hex('#ffe066')); pm.poly([[4, 3], [8, 4], [12, 3], [10, 6], [8, 5], [6, 6]], hex('#58b84a')); pm.rect(8, 1, 1, 3, hex('#3f8a3a')); return outline(pm); }
function honey() { const pm = new Pixmap(16, 16), c = R('#ffc933'); pm.rect(3, 5, 10, 9, c[2]); pm.rect(3, 5, 1, 9, c[1]); pm.rect(12, 5, 1, 9, c[3]); pm.rect(3, 13, 10, 1, c[4]); pm.rect(4, 3, 8, 3, hex('#e8c08a')); pm.rect(4, 3, 8, 1, hex('#fff0d0')); pm.rect(5, 7, 6, 4, hex('#fff3c0')); pm.set(8, 9, hex('#ff9a3c')); pm.set(7, 8, hex('#ff9a3c')); pm.set(9, 8, hex('#ff9a3c')); pm.set(5, 6, c[0]); pm.rect(7, 0, 2, 3, hex('#8a5a2a')); return outline(pm); }
function fish(color, belly = '#ffffff', fin = null) { const pm = new Pixmap(16, 16), c = R(color); pm.ellipse(7.5, 8.5, 5.6, 3.6, c[2]); pm.poly([[11, 8.5], [15, 4], [15, 13]], fin ? hex(fin) : c[3]); pm.ellipse(7, 10, 4, 1.6, hex(belly)); pm.rect(3, 6, 6, 1, c[1]); pm.set(4, 7, EYE); pm.set(4, 6, WHITE); pm.rect(8, 6, 1, 5, c[3]); pm.poly([[6, 5], [9, 3], [10, 6]], fin ? hex(fin) : c[3]); return outline(pm); }

// cooked food
function jar(fill, lid = '#ff6f9a', label = null) { const pm = new Pixmap(16, 16), c = R(fill); pm.rect(4, 5, 8, 9, withAlpha(hex('#cfeeff'), 255)); pm.rect(5, 6, 6, 7, c[2]); pm.rect(5, 6, 6, 1, c[1]); pm.rect(10, 6, 1, 7, c[3]); pm.rect(4, 3, 8, 3, hex(lid)); pm.rect(4, 3, 8, 1, lighter(hex(lid), 0.4)); pm.set(5, 8, c[0]); if (label) { pm.rect(6, 9, 4, 3, hex(label)); } return outline(pm); }
function bread() { const pm = new Pixmap(16, 16), c = R('#d8964a'); pm.ellipse(8, 9, 7, 4.6, c[2]); pm.rect(1, 9, 14, 4, c[2]); pm.rect(1, 12, 14, 1, c[3]); pm.ellipse(8, 7, 6, 3, c[1]); for (const x of [4, 7, 10]) pm.line(x, 5, x + 2, 9, c[3]); pm.set(4, 5, c[0]); pm.set(5, 5, c[0]); return outline(pm); }
function bowl(fill, steam = true, extra = null) { const pm = new Pixmap(16, 16), c = R(fill), b = R('#e8e0f0'); pm.ellipse(8, 8, 6.5, 2.6, c[2]); pm.ellipse(8, 7.6, 5.4, 1.8, c[1]); pm.poly([[1, 8], [15, 8], [12, 14], [4, 14]], b[2]); pm.poly([[1, 8], [8, 8], [8, 14], [4, 14]], b[1]); pm.poly([[8, 8], [15, 8], [12, 14], [8, 14]], b[3]); pm.hline(4, 14, 8, b[4]); if (extra) extra(pm); if (steam) { pm.set(6, 3, hex('#ffffffaa')); pm.set(7, 2, hex('#ffffffaa')); pm.set(10, 4, hex('#ffffffaa')); pm.set(9, 3, hex('#ffffffaa')); } return outline(pm); }
function cake(base, top, cherry = true) { const pm = new Pixmap(16, 16), b = R(base), t = R(top); pm.rect(2, 8, 12, 6, b[2]); pm.rect(2, 8, 12, 1, b[1]); pm.rect(2, 13, 12, 1, b[3]); pm.rect(2, 10, 12, 1, t[1]); pm.rect(2, 5, 12, 4, t[2]); pm.rect(2, 5, 12, 1, t[0]); for (const x of [3, 6, 9, 12]) pm.vline(x, 9, 2, t[2]); pm.rect(12, 5, 2, 9, t[3]); if (cherry) { pm.circle(8, 3.5, 2, hex('#e0304a')); pm.set(7, 2, WHITE); pm.rect(8, 0, 1, 2, hex('#3f8a3a')); } return outline(pm); }
function pie(crust, filling) { const pm = new Pixmap(16, 16), c = R(crust), f = R(filling); pm.ellipse(8, 10, 7, 4, c[2]); pm.rect(1, 10, 14, 3, c[2]); pm.rect(1, 12, 14, 1, c[3]); pm.ellipse(8, 9, 5.4, 2.8, f[2]); pm.ellipse(7, 8.5, 2.4, 1.2, f[1]); for (const [x, y] of [[3, 9], [13, 9], [5, 6], [11, 6], [8, 5]]) pm.set(x, y, c[1]); pm.line(6, 8, 10, 10, c[2]); pm.line(10, 8, 6, 10, c[2]); return outline(pm); }
function grilledFish() { const pm = fish('#e8a050', '#f4d8a0'); pm.line(3, 12, 14, 12, hex('#c8a060')); pm.set(6, 8, hex('#6a3a1a')); pm.set(9, 7, hex('#6a3a1a')); pm.set(8, 10, hex('#6a3a1a')); return pm; }
function omelet() { const pm = new Pixmap(16, 16), c = R('#ffd84a'); pm.ellipse(8, 9, 7, 4.6, c[2]); pm.ellipse(7, 8, 4.8, 2.6, c[1]); pm.poly([[2, 9], [14, 9], [11, 12], [5, 12]], c[3]); for (const [x, y] of [[5, 8], [9, 8], [11, 10]]) pm.set(x, y, hex('#ff6a4a')); for (const [x, y] of [[6, 7], [10, 9]]) pm.set(x, y, hex('#58b84a')); pm.set(4, 7, WHITE); return outline(pm); }
function cocoa() { const pm = new Pixmap(16, 16), c = R('#8a5a3a'), m = R('#fff0e0'); pm.rect(3, 4, 9, 10, m[2]); pm.rect(3, 4, 1, 10, m[1]); pm.rect(11, 4, 1, 10, m[3]); pm.rect(3, 13, 9, 1, m[4]); pm.rect(4, 5, 7, 2, c[2]); pm.ring(13, 8, 1.4, 2.8, m[2]); pm.set(5, 9, hex('#ff9fc0')); pm.set(6, 10, hex('#ff9fc0')); pm.set(8, 9, hex('#ff9fc0')); pm.set(5, 2, hex('#ffffffaa')); pm.set(8, 1, hex('#ffffffaa')); return outline(pm); }
function juice() { const pm = bottle('#7ed07a'); pm.set(7, 9, hex('#ffffff')); return pm; }
function seedPacket(color, cropShape) { const pm = new Pixmap(16, 16), c = R('#f4ecd8'), a = R(color); pm.rect(3, 2, 10, 13, c[2]); pm.rect(3, 2, 10, 2, a[2]); pm.rect(3, 2, 10, 1, a[1]); pm.rect(12, 2, 1, 13, c[3]); pm.rect(3, 14, 10, 1, c[3]); pm.circle(8, 9, 3, a[1]); pm.circle(8, 9, 1.6, a[2]); pm.set(7, 8, WHITE); for (const [x, y] of [[5, 12], [7, 13], [10, 12]]) pm.set(x, y, hex('#6a4a2a')); return outline(pm); }

// ============================================================ misc
function petEggItem() { const pm = egg('#fff6dc', hex('#ff9fd0')); for (const [x, y] of [[6, 9], [9, 7], [8, 12]]) pm.set(x, y, hex('#5cc7ff')); sparkle(pm, 13, 3, hex('#ffe066')); return pm; }
function key() { const pm = new Pixmap(16, 16), g = R('#ffcf45'); pm.ring(5, 5, 1.6, 3.8, g[2]); pm.line(7, 7, 13, 13, g[2]); pm.line(8, 7, 14, 13, g[3]); pm.rect(11, 11, 3, 1, g[2]); pm.rect(12, 13, 2, 1, g[2]); pm.rect(10, 9, 2, 1, g[2]); pm.set(4, 3, g[0]); return outline(pm); }
function trophy() { const pm = new Pixmap(16, 16), g = R('#ffcf45'); pm.rect(5, 2, 6, 6, g[2]); pm.ellipse(8, 7.5, 3.4, 2.4, g[2]); pm.rect(5, 2, 1, 6, g[1]); pm.rect(10, 2, 1, 6, g[3]); pm.ring(3.5, 5, 1, 2.2, g[2]); pm.ring(12.5, 5, 1, 2.2, g[2]); pm.rect(7, 9, 2, 3, g[3]); pm.rect(4, 12, 8, 3, g[2]); pm.rect(4, 12, 8, 1, g[1]); pm.rect(4, 14, 8, 1, g[4]); pm.set(6, 4, WHITE); pm.set(8, 13, hex('#ff5f8a')); return outline(pm); }

const glyphs = {
  speed: (pm, c) => { pm.poly([[9, 5], [5, 10], [8, 10], [7, 13], [11, 8], [8, 8]], WHITE); },
  magnet: (pm, c) => { pm.rect(5, 6, 2, 6, hex('#e04a4a')); pm.rect(9, 6, 2, 6, hex('#5c8cff')); pm.rect(5, 6, 6, 2, hex('#cfd4e8')); pm.rect(5, 11, 2, 1, WHITE); pm.rect(9, 11, 2, 1, WHITE); },
  luck: (pm, c) => { for (const [x, y] of [[8, 6], [6, 8], [10, 8], [8, 10]]) pm.circle(x, y, 1.6, hex('#58b84a')); pm.set(8, 8, hex('#ffe066')); pm.set(8, 13, hex('#3f8a3a')); },
  heart: (pm, c) => { pm.circle(6.5, 8, 1.8, hex('#ff5f8a')); pm.circle(9.5, 8, 1.8, hex('#ff5f8a')); pm.poly([[4.8, 8.6], [11.2, 8.6], [8, 12.4]], hex('#ff5f8a')); pm.set(6, 7, WHITE); },
  pick: (pm, c) => { pm.line(6, 12, 10, 6, hex('#a8703f')); pm.line(5, 6, 11, 6, WHITE); pm.set(5, 7, WHITE); pm.set(11, 7, WHITE); },
  xp: (pm, c) => { pm.poly([[8, 5], [9, 8], [12, 8], [9.6, 10], [10.6, 13], [8, 11], [5.4, 13], [6.4, 10], [4, 8], [7, 8]], hex('#ffe066')); },
  fire: (pm, c) => { pm.poly([[8, 4], [11, 9], [10, 13], [6, 13], [5, 9]], hex('#ff7a3d')); pm.poly([[8, 8], [9.5, 11], [8, 13], [6.5, 11]], hex('#ffe066')); },
  moon: (pm, c) => { pm.circle(8, 9, 3.4, hex('#fff6c0')); pm.circle(9.6, 8, 3, c[1]); },
};

// ============================================================ registry
const PICK = { tool: 'pick' };
export function drawItem(it) {
  const id = it.id;
  if (it.tool === 'pick') return pickaxe(it.mat);
  if (it.weapon === 'sword') return sword(it.mat);
  if (it.weapon === 'bow') return bow(it.mat);
  if (it.weapon === 'staff') return staff(it.color);
  if (it.tool === 'shovel') return shovel(it.mat);
  if (it.tool === 'rod') return rod(it.mat);
  if (it.armor) return it.armor === 'head' ? hat(it.mat) : it.armor === 'body' ? tunic(it.mat) : boots(it.mat);
  if (it.crop) return seedPacket({ wheat: '#e8c04a', carrot: '#ff9a3c', tomato: '#f2503a', pumpkin: '#ff9a3c', strawberry: '#ff4f6d', cotton: '#e8ecff' }[it.crop]);
  const t = {
    charm_speed: () => charm('#6ac8ff', glyphs.speed), charm_magnet: () => charm('#c8a0ff', glyphs.magnet), charm_luck: () => charm('#7ed07a', glyphs.luck), charm_heart: () => charm('#ff8fb3', glyphs.heart),
    charm_miner: () => charm('#ffb347', glyphs.pick), charm_xp: () => charm('#ffe066', glyphs.xp), charm_fire: () => charm('#ff7a3d', glyphs.fire), charm_night: () => charm('#6a7cff', glyphs.moon),
    wood: logPile, stone: () => rocks('#b3b8cc'), fiber, coal, sand: sandItem, clay,
    copper_ore: () => ore('copper', [hex('#ff9a4a'), hex('#e8742e'), hex('#5fd0a0')]), iron_ore: () => ore('iron', [hex('#f0d0b8'), hex('#d8b09a'), hex('#e8e8f0')]), gold_ore: () => ore('gold', [hex('#ffe066'), hex('#ffc933'), hex('#fff3a8')]),
    cotton: cottonItem, petal_pink: () => petals('#ff8fb3'), petal_yellow: () => petals('#ffd84a'), petal_blue: () => petals('#7fb0ff'),
    ice_shard: iceShard, swamp_moss: moss, bone, spirit_dust: spiritDust, ember_stone: emberStone, obsidian: obsidianShard, crystal_shard: () => crystalShard(),
    prism_wood: prismWood, star_fragment: starFragment, void_essence: voidEssence, slime_goo: goo, feather: () => feather(), acorn, charcoal,
    gem_ruby: () => gem('#ff4f6d'), gem_sapphire: () => gem('#4f8cff'), gem_emerald: () => gem('#4fd08a'), gem_amethyst: () => gem('#b07aff'),
    wheat, milk, wool: woolItem, egg: () => egg(),
    plank, rope, cloth: () => clothItem(), glass: glassItem, brick: brickItem, bottle: () => bottle(), paper, flour, fertilizer,
    copper_ingot: () => ingot('copper'), iron_ingot: () => ingot('iron'), gold_ingot: () => ingot('gold'), steel_ingot: () => ingot('steel'),
    obsidian_plate: () => plate('obsidian'), crystal_bar: () => bar('crystal'), star_bar: () => bar('star'), void_bar: () => bar('void'),
    gear, lens, arcane_core: () => core('#a77bff'), lava_core: () => core('#ff7a3d'), prism_core: () => core('#ff9fd0'), void_core: () => core('#8a6cff'), arrow,
    berries: () => berries(), apple, mushroom: () => mushroomItem(), glow_mushroom: () => mushroomItem('#4fd0a0', true), cactus_flesh: cactusFlesh, frost_berries: () => berries('#5aa0ff', '#7ec8c0'), coconut,
    carrot, tomato, pumpkin, strawberry, honey,
    berry_jam: () => jar('#c8304a', '#ff6f9a'), bread, grilled_fish: grilledFish, mushroom_soup: () => bowl('#c8a070', true, (pm) => { pm.set(5, 7, hex('#e0508a')); pm.set(9, 7, hex('#e0508a')); }),
    veggie_stew: () => bowl('#e07a3a', true, (pm) => { pm.set(5, 7, hex('#58b84a')); pm.set(10, 8, hex('#f2503a')); pm.set(7, 7, hex('#ff9a3c')); }),
    fish_stew: () => bowl('#e8a060', true, (pm) => { pm.set(6, 7, hex('#8fd0ff')); pm.set(9, 7, hex('#58b84a')); }),
    honey_cake: () => cake('#e8b86a', '#ffc933', false), pumpkin_pie: () => pie('#d8964a', '#ff9a3c'), strawberry_cake: () => cake('#fff0e0', '#ff8fb3', true),
    fruit_salad: () => bowl('#ff9fb0', false, (pm) => { pm.set(5, 6, hex('#f2545b')); pm.set(8, 5, hex('#ffe066')); pm.set(11, 6, hex('#7ed07a')); pm.set(7, 7, hex('#b07aff')); }),
    omelet, cactus_juice: juice, hot_cocoa: cocoa, apple_pie: () => pie('#d8964a', '#f2c860'),
    pet_egg: petEggItem, treasure_key: key, boss_token: trophy,
  };
  if (t[id]) return t[id]();
  if (id.startsWith('potion_')) return bottle({ health_s: '#ff6f8a', health_m: '#ff4f6d', health_l: '#e0304a', speed: '#6ac8ff', mining: '#ffb347', night: '#6a7cff', strength: '#ff7a3d', fireproof: '#ff9a3c', luck: '#7ed07a' }[id.slice(7)] || '#a77bff');
  if (id === 'elixir_xp') return bottle('#ffe066', '#ff6f9a');
  if (it.fish) return fish({ fish_minnow: '#8fb8d0', fish_carp: '#e8a060', fish_salmon: '#ff8a7a', fish_koi: '#ffb347', fish_frost: '#a8e0ff', fish_glow: '#4fd0a0', fish_lava: '#ff6a3a', fish_star: '#b79cff', fish_cactus: '#9ad06a' }[id] || '#8fb8d0');
  return null;
}

export function registerItems(book) {
  for (const id of Object.keys(ITEMS)) {
    const pm = drawItem(ITEMS[id]);
    if (pm) book.add(`i_${id}`, pm);
  }
  // coin
  const c = new Pixmap(16, 16), g = R('#ffcf45');
  c.circle(8, 8, 5.6, g[2]); c.ring(8, 8, 3.6, 5.6, g[3]); c.circle(8, 8, 3.6, g[1]); c.rect(7, 5, 2, 6, g[3]); c.set(6, 6, g[0]); c.set(7, 5, g[0]); c.set(5, 5, WHITE);
  c.outline(null, { amt: 0.65 });
  book.add('i_coin', c);
}
