// Stations, machines, storage, farming, lights, decor. Sprite names: t_<id> (+ _on / _a0.._aN for animated ones).
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, bayer, INK, A } from '../pixmap.js';
import { RNG } from '../../util.js';
import { BUILD } from '../../data/build.js';
import { groundShadow } from './nodes.js';
import { CROPS } from '../../data/crops.js';

const WHITE = hex('#ffffff');
const EYE = hex('#2a1f3d');
const R = (c) => ramp(hex(c));
const WOOD = R('#c68a52'), DWOOD = R('#8a5a38'), STONE = R('#aab0c4'), IRON = R('#9aa4bc'), BRICK = R('#d4684f'), GOLD = R('#ffcf45');

/** pseudo-3D block: top face (topH rows) + front face */
function box(pm, x, y, w, h, topH, pal, o = {}) {
  pm.rect(x, y, w, topH, pal[1]);
  pm.rect(x, y, w, 1, pal[0]);
  pm.rect(x, y + topH, w, h - topH, pal[2]);
  pm.rect(x, y + topH, 1, h - topH, pal[1]);
  pm.rect(x + w - 1, y + topH, 1, h - topH, pal[3]);
  pm.rect(x, y + h - 1, w, 1, pal[4]);
  pm.rect(x + w - 1, y, 1, topH, pal[2]);
  if (o.planks) for (let xx = x + 3; xx < x + w - 1; xx += 4) pm.vline(xx, y + topH + 1, h - topH - 2, pal[3]);
  if (o.bricks) { for (let yy = y + topH + 2; yy < y + h - 1; yy += 3) pm.hline(x + 1, yy, w - 2, pal[3]); for (let yy = y + topH; yy < y + h - 1; yy += 3) for (let xx = x + 2 + ((yy / 3) % 2 ? 0 : 2); xx < x + w - 1; xx += 5) pm.set(xx, yy + 1, pal[3]); }
  return pm;
}
function fin(pm, shadow = null, amt = 0.7) { pm.outline(null, { amt }); if (shadow) groundShadow(pm, shadow[0], shadow[1], shadow[2], shadow[3] || 1.4, shadow[4] || 60); return pm; }
function flame(pm, cx, by, h, f) {
  const o = f % 3;
  pm.poly([[cx - 3, by], [cx - 2 - (o === 1 ? 1 : 0), by - h * 0.55], [cx + (o - 1), by - h], [cx + 2 + (o === 2 ? 1 : 0), by - h * 0.55], [cx + 3, by]], hex('#ff7a3d'));
  pm.poly([[cx - 2, by], [cx - 1, by - h * 0.5], [cx + (o - 1), by - h * 0.78], [cx + 1, by - h * 0.5], [cx + 2, by]], hex('#ffb347'));
  pm.poly([[cx - 1, by], [cx, by - h * 0.4], [cx + 1, by]], hex('#ffe9a0'));
}
function sparkle(pm, x, y, c = WHITE) { pm.set(x, y, c); pm.set(x - 1, y, withAlpha(c, 160)); pm.set(x + 1, y, withAlpha(c, 160)); pm.set(x, y - 1, withAlpha(c, 160)); pm.set(x, y + 1, withAlpha(c, 160)); }

const S = {}; // id -> fn(frameOrState) -> Pixmap

// ----------------------------------------------------------------- stations
S.workbench = () => {
  const pm = new Pixmap(32, 20);
  for (const x of [2, 27]) { pm.rect(x, 12, 3, 7, DWOOD[3]); pm.set(x, 12, DWOOD[2]); }
  box(pm, 0, 5, 32, 8, 4, WOOD, { planks: true });
  pm.rect(0, 11, 32, 2, DWOOD[2]);
  // tools: saw, hammer, plank
  pm.rect(4, 3, 9, 2, IRON[2]); for (let x = 4; x < 13; x += 2) pm.set(x, 5, IRON[3]); pm.rect(12, 2, 3, 3, DWOOD[1]);
  pm.rect(18, 4, 6, 2, WOOD[1]); pm.rect(18, 4, 6, 1, WOOD[0]);
  pm.rect(24, 1, 5, 3, IRON[2]); pm.rect(25, 3, 2, 3, DWOOD[2]); pm.set(24, 1, IRON[0]);
  return fin(pm, [16, 19, 14]);
};
S.campfire = (f = 0) => {
  const pm = new Pixmap(16, 16);
  for (const [x, y, r] of [[3, 12, 1.8], [6, 13.5, 1.8], [10, 13.5, 1.8], [13, 12, 1.8], [4.5, 9.5, 1.6], [11.5, 9.5, 1.6]]) ballShade(pm, x, y, r + 0.6, r, R('#aab0c4'), { dither: 0 });
  pm.rect(4, 11, 8, 2, DWOOD[2]); pm.rect(4, 11, 8, 1, DWOOD[1]); pm.rect(5, 9, 2, 3, DWOOD[3]); pm.rect(9, 9, 2, 3, DWOOD[2]);
  flame(pm, 8, 11, 9, f);
  if (f % 2) { pm.set(5, 3, hex('#ffb347')); pm.set(11, 4, hex('#ffe066')); } else { pm.set(10, 2, hex('#ffb347')); pm.set(4, 4, hex('#ffe066')); }
  return fin(pm, [8, 15, 7, 1.2, 55]);
};
S.research_table = () => {
  const pm = new Pixmap(32, 24);
  for (const x of [2, 27]) pm.rect(x, 15, 3, 8, DWOOD[3]);
  box(pm, 0, 9, 32, 9, 4, WOOD, { planks: true }); pm.rect(0, 16, 32, 2, DWOOD[2]);
  // open book, scroll, quill, lens
  pm.rect(4, 5, 10, 6, hex('#fff6e0')); pm.vline(9, 5, 6, hex('#c8b890')); for (const y of [6, 8]) { pm.hline(5, y, 3, hex('#a89870')); pm.hline(10, y, 3, hex('#a89870')); } pm.rect(4, 11, 10, 1, hex('#8a5a3a'));
  pm.rect(17, 7, 7, 3, hex('#f4ecd0')); pm.rect(17, 7, 1, 3, hex('#d8c8a0')); pm.rect(23, 7, 1, 3, hex('#d8c8a0'));
  pm.line(26, 3, 29, 8, hex('#ff8fb3')); pm.set(26, 2, hex('#ffd0e0')); pm.set(29, 9, EYE);
  pm.circle(20.5, 4.5, 2, withAlpha(hex('#bfeaff'), 255)); pm.ring(20.5, 4.5, 1.4, 2.4, GOLD[2]); pm.set(19, 3, WHITE);
  return fin(pm, [16, 23, 14]);
};
S.library = () => {
  const pm = new Pixmap(32, 28);
  for (const x of [2, 27]) pm.rect(x, 19, 3, 8, DWOOD[4]);
  box(pm, 0, 11, 32, 10, 4, R('#7a4a30'), { planks: true }); pm.rect(0, 19, 32, 2, DWOOD[3]);
  // stacks of books + lamp
  const cols = ['#e04a4a', '#4f8cff', '#5fc98a', '#ffd84a', '#b07aff'];
  for (const [x, n] of [[3, 3], [9, 4]]) for (let i = 0; i < n; i++) { const c = R(cols[(x + i) % 5]); pm.rect(x, 9 - i * 2, 7, 2, c[2]); pm.hline(x, 9 - i * 2, 7, c[0]); }
  pm.rect(17, 6, 9, 5, hex('#fff6e0')); pm.vline(21, 6, 5, hex('#c8b890')); pm.hline(18, 8, 3, hex('#a89870')); pm.hline(22, 8, 3, hex('#a89870'));
  pm.rect(27, 8, 2, 3, GOLD[3]); pm.poly([[26, 8], [30, 8], [29, 3], [27, 3]], hex('#ffe9a0')); pm.set(28, 5, WHITE);
  return fin(pm, [16, 27, 14]);
};
S.observatory = () => {
  const pm = new Pixmap(32, 40);
  box(pm, 2, 18, 28, 20, 5, STONE, { bricks: true });
  pm.rect(13, 28, 6, 10, DWOOD[2]); pm.frame(13, 28, 6, 10, DWOOD[4]); pm.set(17, 33, GOLD[2]);
  // dome with slit + telescope
  pm.ellipse(16, 18, 13, 11, R('#5a6aa8')[2]); pm.rect(3, 18, 26, 4, R('#5a6aa8')[2]);
  ballShade(pm, 16, 17, 12, 10, R('#6a7ac0'), { dither: 0.1 });
  pm.rect(14, 4, 4, 14, hex('#14102a')); pm.rect(14, 4, 1, 14, hex('#2a2a5a'));
  pm.line(16, 14, 24, 5, IRON[2]); pm.line(16, 15, 24, 6, IRON[3]); pm.rect(24, 3, 3, 3, IRON[1]); pm.set(24, 3, WHITE);
  for (const [x, y] of [[8, 8], [24, 11], [6, 14]]) pm.set(x, y, hex('#fff0a0'));
  return fin(pm, [16, 38, 14, 1.6]);
};
S.furnace = (on = false) => {
  const pm = new Pixmap(16, 24);
  box(pm, 1, 6, 14, 17, 3, STONE, { bricks: true });
  pm.rect(5, 0, 6, 8, STONE[2]); pm.rect(5, 0, 1, 8, STONE[1]); pm.rect(10, 0, 1, 8, STONE[3]); pm.rect(4, 0, 8, 2, STONE[1]); pm.hline(5, 2, 6, STONE[4]);
  pm.rect(4, 12, 8, 7, hex('#2a1e34')); pm.frame(4, 12, 8, 7, STONE[4]);
  if (on) { pm.rect(5, 14, 6, 5, hex('#ff7a3d')); pm.rect(6, 16, 4, 3, hex('#ffb347')); pm.rect(7, 17, 2, 2, hex('#ffe9a0')); } else { pm.rect(5, 17, 6, 2, hex('#4a3a40')); pm.set(7, 16, hex('#6a5a50')); }
  pm.rect(3, 20, 10, 1, STONE[4]);
  return fin(pm, [8, 23, 8]);
};
S.blast_furnace = (on = false) => {
  const pm = new Pixmap(16, 28);
  box(pm, 1, 8, 14, 19, 3, IRON, { bricks: false });
  pm.rect(5, 0, 6, 10, IRON[3]); pm.rect(5, 0, 1, 10, IRON[2]); pm.rect(4, 0, 8, 2, IRON[1]); pm.rect(5, 2, 6, 1, IRON[4]);
  for (const y of [12, 22]) { pm.rect(1, y, 14, 2, IRON[4]); pm.set(3, y, IRON[0]); pm.set(12, y, IRON[0]); }
  pm.rect(4, 15, 8, 6, hex('#2a1e34')); pm.frame(4, 15, 8, 6, IRON[4]);
  if (on) { pm.rect(5, 16, 6, 4, hex('#ff7a3d')); pm.rect(6, 17, 4, 3, hex('#ffb347')); pm.rect(7, 18, 2, 2, hex('#ffe9a0')); }
  return fin(pm, [8, 27, 8]);
};
S.magma_furnace = (on = false) => {
  const pm = new Pixmap(32, 36);
  box(pm, 1, 10, 30, 25, 4, R('#5a4a68'));
  pm.rect(10, 0, 12, 12, R('#4a3a58')[2]); pm.rect(9, 0, 14, 3, R('#6a5a78')[1]); pm.rect(10, 0, 1, 12, R('#6a5a78')[1]);
  for (const y of [14, 28]) pm.rect(1, y, 30, 2, hex('#2a1f3a'));
  pm.rect(8, 17, 16, 10, hex('#14102a')); pm.frame(8, 17, 16, 10, R('#6a5a78')[3]);
  if (on) { pm.rect(9, 19, 14, 7, hex('#ff5a2e')); pm.rect(11, 21, 10, 5, hex('#ff9a3d')); pm.rect(13, 23, 6, 3, hex('#ffe9a0')); for (const x of [10, 15, 20]) pm.set(x, 18, hex('#ffb347')); } else pm.rect(9, 24, 14, 2, hex('#4a3a40'));
  pm.rect(13, 30, 6, 3, hex('#ff7a3d')); pm.set(14, 30, hex('#ffe9a0'));
  return fin(pm, [16, 35, 15, 1.8]);
};
S.windmill = (f = 0) => {
  const pm = new Pixmap(32, 44);
  // tower
  pm.poly([[8, 42], [24, 42], [21, 14], [11, 14]], R('#e8d4aa')[2]);
  pm.poly([[8, 42], [16, 42], [16, 14], [11, 14]], R('#f4e4c0')[1]);
  pm.poly([[16, 42], [24, 42], [21, 14], [16, 14]], R('#c8b080')[3]);
  for (const y of [20, 26, 32, 38]) pm.hline(9 + (42 - y) / 10, y, 14 - (42 - y) / 5, R('#c8b080')[3]);
  pm.rect(13, 34, 6, 8, DWOOD[2]); pm.frame(13, 34, 6, 8, DWOOD[4]); pm.rect(14, 22, 4, 5, hex('#9ad8ff')); pm.frame(14, 22, 4, 5, DWOOD[3]);
  pm.poly([[9, 14], [23, 14], [16, 5]], R('#d8604a')[2]); pm.poly([[9, 14], [16, 14], [16, 5]], R('#e8806a')[1]); pm.hline(9, 14, 14, R('#a8402a')[3]);
  // sails (rotate with f)
  const ang0 = f * 0.4;
  for (let k = 0; k < 4; k++) {
    const a = ang0 + k * Math.PI / 2;
    const ex = 16 + Math.cos(a) * 13, ey = 11 + Math.sin(a) * 13;
    pm.line(16, 11, Math.round(ex), Math.round(ey), DWOOD[2]);
    // sail cloth
    for (let t = 3; t < 13; t++) { const px = 16 + Math.cos(a) * t, py = 11 + Math.sin(a) * t; const nx = -Math.sin(a), ny = Math.cos(a); for (let w = 1; w < 4; w++) { pm.set(Math.round(px + nx * w), Math.round(py + ny * w), (t + w) % 2 ? hex('#fff6e0') : hex('#e8dcc0')); } }
  }
  pm.circle(16, 11, 2, DWOOD[3]); pm.set(15, 10, DWOOD[1]);
  return fin(pm, [16, 43, 10]);
};
S.sewing_station = () => {
  const pm = new Pixmap(16, 20);
  for (const x of [2, 12]) pm.rect(x, 13, 2, 6, DWOOD[3]);
  box(pm, 0, 9, 16, 6, 3, WOOD);
  pm.rect(2, 3, 10, 6, R('#e0508a')[2]); pm.rect(2, 3, 10, 1, R('#e0508a')[1]); pm.rect(10, 1, 3, 4, IRON[2]); pm.set(12, 1, IRON[0]); pm.line(12, 5, 12, 8, IRON[3]);
  pm.circle(4.5, 6, 1.6, GOLD[2]); pm.rect(6, 7, 4, 1, WHITE); pm.set(12, 9, hex('#ff8fb3'));
  return fin(pm, [8, 19, 7]);
};
S.anvil = () => {
  const pm = new Pixmap(16, 16);
  pm.rect(4, 11, 8, 4, IRON[4]); pm.rect(3, 14, 10, 1, IRON[4]); pm.rect(6, 8, 4, 4, IRON[3]);
  pm.rect(1, 4, 14, 5, IRON[2]); pm.rect(1, 4, 14, 1, IRON[0]); pm.rect(1, 5, 14, 1, IRON[1]); pm.poly([[1, 6], [0, 6], [0, 8], [3, 9]], IRON[3]); pm.poly([[15, 5], [16, 7], [14, 9]], IRON[3]);
  pm.set(4, 5, WHITE); pm.set(5, 5, WHITE);
  return fin(pm, [8, 15.2, 7]);
};
S.kitchen = () => {
  const pm = new Pixmap(32, 22);
  box(pm, 0, 6, 32, 15, 4, R('#f4ecd8'), {});
  pm.rect(0, 14, 32, 1, hex('#c8b890'));
  // stove burners + pot + drawers
  pm.rect(2, 8, 12, 2, hex('#3a3050')); for (const x of [4, 9]) { pm.ellipse(x + 1, 8.5, 2.2, 1, hex('#14102a')); }
  pm.rect(18, 3, 9, 6, IRON[2]); pm.rect(18, 3, 9, 1, IRON[0]); pm.rect(17, 4, 1, 2, IRON[3]); pm.rect(27, 4, 1, 2, IRON[3]); pm.rect(19, 2, 7, 1, hex('#ffffff55'));
  pm.set(20, 1, hex('#ffffffaa')); pm.set(23, 0, hex('#ffffffaa'));
  for (const x of [3, 19]) { pm.rect(x, 16, 10, 4, hex('#e8dcc0')); pm.frame(x, 16, 10, 4, hex('#a89870')); pm.rect(x + 4, 17, 2, 1, GOLD[2]); }
  pm.rect(0, 20, 32, 1, hex('#a89870'));
  return fin(pm, [16, 21, 14]);
};
S.alchemy_table = (f = 0) => {
  const pm = new Pixmap(16, 20);
  for (const x of [1, 12]) pm.rect(x, 14, 3, 5, R('#6a4a8a')[3]);
  box(pm, 0, 10, 16, 6, 3, R('#8a6aaa'));
  const flask = (x, y, c, bub) => { pm.rect(x + 1, y, 2, 2, hex('#cfeeff')); pm.rect(x, y + 2, 4, 4, hex('#cfeeff')); pm.rect(x + 1, y + 3, 2, 3, hex(c)); pm.set(x, y + 2, WHITE); if (bub) pm.set(x + 1, y - 1 - (f % 2), withAlpha(hex(c), 220)); };
  flask(2, 4, '#ff6f9a', true); flask(7, 2, '#6aff9a', f % 2 === 0); flask(11, 5, '#6ac8ff', f % 2 === 1);
  pm.rect(5, 7, 5, 3, hex('#cfeeff')); pm.set(6, 8, hex('#ffe066')); pm.set(8, 8, hex('#ffe066'));
  return fin(pm, [8, 19, 7]);
};
S.forge = (f = 0) => {
  const pm = new Pixmap(32, 22);
  box(pm, 0, 5, 20, 16, 4, R('#5a4a58'), { bricks: true });
  pm.rect(3, 11, 14, 8, hex('#14102a')); pm.frame(3, 11, 14, 8, R('#5a4a58')[4]);
  pm.rect(4, 13, 12, 5, hex('#ff5a2e')); pm.rect(6, 15, 8, 3, hex('#ff9a3d')); pm.rect(8, 16, 4, 2, hex('#ffe9a0'));
  for (const x of [5, 10, 14]) pm.set(x + (f % 2), 12, hex('#ffb347'));
  pm.rect(7, 0, 6, 6, R('#5a4a58')[2]); pm.rect(6, 0, 8, 2, R('#5a4a58')[1]);
  // anvil on the right
  pm.rect(23, 15, 6, 5, IRON[4]); pm.rect(21, 11, 11, 5, IRON[2]); pm.rect(21, 11, 11, 1, IRON[0]); pm.poly([[21, 13], [19, 13], [19, 15], [22, 16]], IRON[3]);
  return fin(pm, [16, 21, 14]);
};
S.arcane_altar = (f = 0) => {
  const pm = new Pixmap(32, 22);
  box(pm, 2, 8, 28, 13, 4, R('#6a5a9a'));
  pm.rect(0, 18, 32, 3, R('#5a4a8a')[3]); pm.rect(0, 18, 32, 1, R('#8a7ab8')[1]);
  const c = [hex('#c8a0ff'), hex('#ffffff')];
  for (const x of [6, 12, 18, 24]) { pm.set(x, 13, c[0]); pm.set(x, 14, c[0]); pm.set(x + 1, 14, c[0]); pm.set(x - 1, 15, c[0]); pm.set(x, 16, c[0]); }
  pm.circle(16, 5 - (f % 2), 3, R('#a77bff')[2]); pm.set(15, 4 - (f % 2), WHITE); pm.circle(16, 5 - (f % 2), 1.2, hex('#e8d8ff'));
  sparkle(pm, 10, 3 + (f % 2), hex('#e8d8ff')); sparkle(pm, 23, 4, hex('#c8a0ff'));
  return fin(pm, [16, 21, 15]);
};
S.prism_workshop = (f = 0) => {
  const pm = new Pixmap(32, 22);
  for (const x of [2, 27]) pm.rect(x, 14, 3, 7, R('#b88ae0')[3]);
  box(pm, 0, 8, 32, 8, 4, R('#d8b8f4'));
  const prism = (x, y, w, h, c) => { const p = R(c); for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w / 2 * (1 - j / (h * 1.1)))); for (let i = -hw; i <= hw; i++) pm.set(x + i, y - j, i < 0 ? p[1] : i > 0 ? p[3] : p[2]); } pm.set(x - 1, y - h + 2, p[0]); };
  prism(7, 8, 6, 8, '#ff9fd0'); prism(15, 8, 5, 6, '#9ff0e0'); prism(23, 8, 6, 9, '#d4b8ff');
  pm.rect(26, 9, 4, 2, IRON[2]); pm.set(28, 10, WHITE); sparkle(pm, 11, 2 + (f % 2), WHITE);
  return fin(pm, [16, 21, 14]);
};
S.star_forge = (f = 0) => {
  const pm = new Pixmap(32, 40);
  box(pm, 2, 14, 28, 25, 5, R('#3a3a7a'));
  pm.rect(0, 34, 32, 5, R('#2a2a5a')[2]);
  pm.ellipse(16, 15, 7, 4, hex('#14102a')); pm.ellipse(16, 15, 5.4, 3, hex('#2a2a7a'));
  pm.poly([[16, 2 - (f % 2)], [18, 8], [24, 8.5], [19, 12], [21, 18], [16, 14.5], [11, 18], [13, 12], [8, 8.5], [14, 8]], R('#ffe48a')[2]);
  pm.poly([[16, 2 - (f % 2)], [16, 14.5], [11, 18], [13, 12], [8, 8.5], [14, 8]], R('#ffe48a')[1]);
  pm.set(15, 6, WHITE);
  for (const [x, y] of [[5, 22], [26, 24], [8, 30], [24, 31]]) { pm.set(x, y, hex('#fff0a0')); }
  pm.rect(10, 26, 12, 8, hex('#14102a')); pm.rect(11, 28, 10, 5, hex('#5a5aff')); pm.rect(13, 30, 6, 3, hex('#c8d0ff'));
  return fin(pm, [16, 39, 14, 1.8]);
};
S.market_stall = () => {
  const pm = new Pixmap(32, 26);
  for (const x of [2, 28]) pm.rect(x, 8, 2, 17, DWOOD[2]);
  // striped awning
  for (let x = 0; x < 32; x += 4) { const c = ((x / 4) % 2) ? R('#ffffff') : R('#ff6f9a'); pm.rect(x, 1, 4, 7, c[2]); pm.hline(x, 1, 4, c[0]); pm.hline(x, 7, 4, c[3]); }
  for (let x = 0; x < 32; x += 4) { const c = ((x / 4) % 2) ? R('#ffffff') : R('#ff6f9a'); pm.poly([[x, 8], [x + 4, 8], [x + 2, 10]], c[2]); }
  box(pm, 1, 15, 30, 10, 3, WOOD, { planks: true });
  // goods
  for (const [x, c] of [[4, '#ff4f6d'], [8, '#ffe066'], [12, '#7ed07a']]) { pm.circle(x + 0.5, 14, 1.8, hex(c)); pm.set(x - 0.5 | 0, 13, WHITE); }
  pm.rect(18, 12, 4, 4, R('#a8703f')[2]); pm.rect(23, 13, 5, 3, R('#e0508a')[2]); pm.set(24, 13, WHITE);
  return fin(pm, [16, 25, 14]);
};

// ----------------------------------------------------------------- storage
S.chest = () => {
  const pm = new Pixmap(16, 16), w = WOOD;
  pm.rect(2, 7, 12, 8, w[2]); pm.rect(2, 7, 12, 1, w[1]); pm.rect(2, 13, 12, 2, w[3]);
  pm.rect(2, 3, 12, 5, w[1]); pm.rect(3, 2, 10, 1, w[0]); pm.rect(2, 3, 12, 1, w[0]); pm.rect(2, 7, 12, 1, w[3]);
  for (const x of [4, 11]) pm.rect(x, 3, 1, 12, DWOOD[3]);
  pm.rect(2, 8, 12, 1, IRON[3]); pm.rect(7, 6, 3, 4, GOLD[2]); pm.set(7, 6, GOLD[0]); pm.set(8, 8, GOLD[4]);
  return fin(pm, [8, 15, 7]);
};
S.large_chest = () => {
  const pm = new Pixmap(32, 18), w = R('#a86f3d');
  pm.rect(1, 8, 30, 9, w[2]); pm.rect(1, 8, 30, 1, w[1]); pm.rect(1, 15, 30, 2, w[3]);
  pm.rect(1, 3, 30, 6, w[1]); pm.rect(2, 2, 28, 1, w[0]); pm.rect(1, 3, 30, 1, w[0]); pm.rect(1, 8, 30, 1, w[3]);
  for (const x of [5, 15, 26]) pm.rect(x, 3, 1, 14, DWOOD[3]);
  pm.rect(1, 9, 30, 1, IRON[3]); pm.rect(14, 6, 4, 5, GOLD[2]); pm.set(14, 6, GOLD[0]); pm.set(16, 8, GOLD[4]);
  for (const [x, y] of [[3, 10], [28, 10], [3, 5], [28, 5]]) pm.set(x, y, IRON[0]);
  return fin(pm, [16, 17, 14]);
};
S.vault = () => {
  const pm = new Pixmap(32, 22), m = R('#8a94b0');
  box(pm, 1, 2, 30, 19, 3, m);
  pm.rect(1, 7, 30, 1, m[4]); pm.rect(1, 15, 30, 1, m[4]);
  pm.circle(16, 12, 5.5, m[1]); pm.ring(16, 12, 3.6, 5.5, m[3]); pm.circle(16, 12, 3.6, m[2]);
  for (let a = 0; a < 6.28; a += 1.05) pm.set(Math.round(16 + Math.cos(a) * 2.6), Math.round(12 + Math.sin(a) * 2.6), GOLD[2]); pm.circle(16, 12, 1, GOLD[1]);
  for (const [x, y] of [[3, 4], [28, 4], [3, 18], [28, 18]]) { pm.set(x, y, WHITE); pm.set(x + 1, y + 1, m[4]); }
  pm.rect(25, 10, 4, 4, GOLD[3]); pm.set(26, 11, GOLD[0]);
  return fin(pm, [16, 21, 14]);
};
S.gravestone = () => {
  const pm = new Pixmap(16, 20), p = R('#b4aec4');
  pm.rect(3, 6, 10, 11, p[2]); pm.ellipse(8, 7, 5, 4.5, p[2]); pm.rect(3, 6, 2, 11, p[1]); pm.rect(11, 6, 2, 11, p[3]); pm.rect(2, 16, 12, 2, p[3]);
  pm.rect(7, 6, 2, 7, p[4]); pm.rect(5, 8, 6, 2, p[4]); pm.set(6, 4, p[0]);
  pm.set(4, 14, hex('#6aa05a')); pm.set(10, 15, hex('#6aa05a')); pm.set(12, 12, hex('#ff8fb3')); pm.set(12, 11, hex('#ffd84a'));
  return fin(pm, [8, 18.5, 7, 1.6]);
};

// ----------------------------------------------------------------- farming
S.farm_plot = () => {
  const pm = new Pixmap(16, 16), d = R('#8a5a34');
  pm.rect(0, 0, 16, 16, d[2]);
  for (let y = 1; y < 16; y += 4) { pm.hline(1, y, 14, d[3]); pm.hline(1, y + 1, 14, d[1]); }
  pm.frame(0, 0, 16, 16, DWOOD[3]); pm.hline(0, 0, 16, DWOOD[1]); pm.vline(0, 0, 16, DWOOD[1]);
  for (const [x, y] of [[4, 3], [10, 7], [6, 11], [12, 13]]) pm.set(x, y, d[0]);
  return pm;
};
S.greenhouse_plot = () => {
  const pm = S.farm_plot();
  pm.ellipse(8, 7, 7.4, 6, withAlpha(hex('#cfeeff'), 120)); pm.ring(8, 7, 6.2, 7.4, withAlpha(hex('#ffffff'), 220));
  pm.line(3, 3, 6, 2, WHITE); pm.set(11, 10, WHITE);
  pm.rect(0, 12, 16, 4, withAlpha(DWOOD[3], 255)); pm.hline(0, 12, 16, hex('#cfeeff')); pm.frame(0, 0, 16, 16, hex('#8ac0e0'));
  return pm;
};
S.sprinkler = () => {
  const pm = new Pixmap(16, 16), m = IRON;
  pm.rect(7, 6, 2, 8, m[3]); pm.rect(5, 13, 6, 2, m[4]); pm.rect(5, 13, 6, 1, m[2]);
  pm.rect(5, 3, 6, 4, m[2]); pm.rect(5, 3, 6, 1, m[0]); pm.rect(4, 4, 1, 2, m[3]); pm.rect(11, 4, 1, 2, m[3]);
  for (const [x, y] of [[2, 2], [13, 2], [1, 6], [14, 6], [8, 0]]) pm.set(x, y, hex('#8fd8ff'));
  return fin(pm, [8, 15.2, 6]);
};
S.beehive = () => {
  const pm = new Pixmap(16, 18), h = R('#f4d060');
  pm.rect(3, 14, 10, 3, DWOOD[3]); pm.rect(2, 16, 12, 1, DWOOD[4]);
  for (const [y, w] of [[11, 10], [8, 9], [5, 7], [2, 5]]) { const x = 8 - w / 2; pm.rect(x, y, w, 3, h[2]); pm.hline(x, y, w, h[1]); pm.hline(x, y + 2, w, h[3]); }
  pm.rect(6, 12, 4, 2, hex('#3a2a20')); pm.set(8, 6, hex('#3a2a20'));
  pm.set(13, 4, hex('#ffe066')); pm.set(14, 3, WHITE); pm.set(12, 2, hex('#3a3050')); pm.set(2, 7, hex('#ffe066')); pm.set(1, 6, hex('#3a3050'));
  return fin(pm, [8, 17.5, 7]);
};
S.chicken_coop = () => {
  const pm = new Pixmap(32, 24);
  box(pm, 2, 10, 28, 13, 3, R('#d9a066'), { planks: true });
  pm.poly([[0, 11], [32, 11], [26, 3], [6, 3]], R('#d8604a')[2]); pm.poly([[0, 11], [32, 11], [32, 9], [0, 9]], R('#a8402a')[3]); pm.hline(6, 3, 20, R('#e8806a')[1]);
  pm.rect(12, 15, 8, 8, hex('#2a1e34')); pm.frame(12, 15, 8, 8, DWOOD[3]);
  // chickens
  for (const [x, y] of [[4, 20], [24, 20]]) { pm.circle(x + 2, y, 2.4, WHITE); pm.set(x + 4, y - 1, hex('#ff9a3c')); pm.set(x + 3, y - 3, hex('#e0304a')); pm.set(x + 3, y - 1, EYE); }
  pm.rect(17, 12, 3, 2, hex('#fff6e0'));
  return fin(pm, [16, 23, 14]);
};
S.cow_shed = () => {
  const pm = new Pixmap(32, 36);
  box(pm, 1, 14, 30, 21, 4, R('#b0804a'), { planks: true });
  pm.poly([[-1, 15], [33, 15], [27, 4], [5, 4]], R('#8a4a38')[2]); pm.poly([[-1, 15], [33, 15], [33, 12], [-1, 12]], R('#6a3a2a')[3]); pm.hline(5, 4, 22, R('#a86a50')[1]);
  pm.rect(8, 19, 16, 15, hex('#2a1e34')); pm.frame(8, 19, 16, 15, DWOOD[3]);
  // cow in the doorway
  pm.ellipse(16, 28, 6, 4, hex('#ffffff')); pm.ellipse(13, 27, 2, 2, hex('#3a3050')); pm.circle(21, 25, 3, hex('#ffffff')); pm.set(22, 24, EYE); pm.rect(20, 27, 3, 2, hex('#ffb3c8'));
  pm.set(19, 22, hex('#f4ecd8')); pm.set(23, 22, hex('#f4ecd8'));
  return fin(pm, [16, 35, 14, 1.6]);
};
S.sheep_pen = () => {
  const pm = new Pixmap(32, 32), g = R('#6ccf4e');
  pm.rect(0, 4, 32, 26, withAlpha(g[2], 255)); for (let i = 0; i < 20; i++) pm.set((i * 13) % 32, 6 + (i * 7) % 22, i % 2 ? g[1] : g[3]);
  for (let x = 0; x < 32; x += 6) { pm.rect(x, 2, 2, 7, DWOOD[2]); pm.rect(x, 25, 2, 7, DWOOD[2]); }
  pm.rect(0, 4, 32, 2, WOOD[2]); pm.rect(0, 27, 32, 2, WOOD[2]);
  for (const [x, y] of [[8, 15], [21, 20]]) { ballShade(pm, x, y, 5.4, 4.2, R('#fdf0f6'), { dither: 0 }); pm.circle(x + 4.5, y + 1, 2.2, hex('#4a4058')); pm.set(x + 5, y, WHITE); pm.rect(x - 2, y + 4, 1, 2, hex('#4a4058')); pm.rect(x + 2, y + 4, 1, 2, hex('#4a4058')); }
  return fin(pm, [16, 31, 15]);
};
S.fish_trap = () => {
  const pm = new Pixmap(16, 16), r = R('#c8a060');
  pm.ellipse(8, 10, 6.5, 4.4, r[2]); pm.ellipse(8, 9, 5.6, 3.4, hex('#2a4a6a'));
  for (let x = 3; x < 14; x += 3) pm.vline(x, 6, 8, r[3]); pm.hline(2, 9, 12, r[3]); pm.hline(2, 12, 12, r[1]);
  pm.rect(7, 2, 2, 5, hex('#ff5a6a')); pm.set(7, 2, WHITE);
  pm.set(5, 9, hex('#ffb347')); pm.set(6, 9, hex('#ffb347'));
  return fin(pm, null);
};

// ----------------------------------------------------------------- drills & turrets & pads & altars
function drill(color, on, f = 0, glow = '#ff7a3d') {
  const pm = new Pixmap(32, 36), m = R(color);
  box(pm, 2, 14, 28, 21, 4, m);
  pm.rect(2, 22, 28, 2, darker(m[3], 0.2));
  pm.rect(6, 26, 20, 6, hex('#2a1e34')); pm.frame(6, 26, 20, 6, m[4]);
  // drill bit spinning
  pm.rect(13, 3, 6, 13, IRON[2]); pm.rect(13, 3, 1, 13, IRON[1]); pm.rect(18, 3, 1, 13, IRON[3]);
  for (let y = 4 + (f % 2); y < 16; y += 3) { pm.hline(13, y, 6, IRON[4]); }
  pm.poly([[13, 3], [19, 3], [16, 0]], IRON[1]);
  if (on) { pm.rect(8, 28, 16, 3, hex(glow)); pm.rect(10, 29, 12, 2, hex('#ffe9a0')); pm.set(11 + f * 3, 12, hex('#ffe066')); pm.set(21 - f * 3, 10, hex('#ffffff')); }
  pm.rect(26, 16, 3, 3, GOLD[2]); pm.set(26, 16, GOLD[0]);
  return fin(pm, [16, 35, 14, 1.6]);
}
S.drill_iron = (on, f) => drill('#8a94ac', on, f);
S.drill_steel = (on, f) => drill('#6a7a9c', on, f, '#ffb347');
S.drill_solar = (on, f) => { const pm = drill('#b8e8ff', on, f, '#9ff0e0'); pm.rect(4, 15, 24, 3, hex('#2a4a9a')); for (let x = 5; x < 27; x += 4) pm.vline(x, 15, 3, hex('#5a8aff')); return pm; };
S.drill_void = (on, f) => drill('#4a3a8a', on, f, '#b79cff');
function turret(color, muzzle) {
  const pm = new Pixmap(16, 22), m = R(color);
  pm.rect(3, 14, 10, 6, m[2]); pm.rect(3, 14, 10, 1, m[0]); pm.rect(3, 19, 10, 1, m[4]); pm.rect(2, 17, 12, 3, m[3]);
  pm.rect(5, 8, 6, 7, m[1]); pm.rect(5, 8, 1, 7, m[0]); pm.rect(10, 8, 1, 7, m[3]);
  pm.rect(7, 2, 3, 8, m[3]); pm.rect(7, 2, 3, 1, hex(muzzle)); pm.rect(7, 2, 1, 8, m[2]); pm.set(8, 1, hex(muzzle));
  pm.rect(7, 11, 2, 2, hex(muzzle)); pm.set(7, 11, WHITE);
  return fin(pm, [8, 21, 7]);
}
S.turret_arrow = () => turret('#a8703f', '#ffe9b0'); S.turret_magic = () => turret('#8a6aff', '#c8a0ff'); S.turret_fire = () => turret('#5a4a58', '#ff7a3d');
S.turret_prism = () => turret('#f0c0f0', '#ff9fd0'); S.turret_void = () => turret('#3a2a7a', '#b79cff');
S.warp_pad = (f = 0) => {
  const pm = new Pixmap(16, 16), s = R('#b6bccf');
  pm.ellipse(8, 10, 7.4, 4.6, s[3]); pm.ellipse(8, 9.2, 7, 4.2, s[1]); pm.ellipse(8, 9, 5.4, 3, R('#4a7ad8')[2]);
  pm.ellipse(8, 9, 3.6, 2, hex('#9ff0e0')); pm.ellipse(8, 9, 1.6, 0.9, WHITE);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + f * 0.8; pm.set(Math.round(8 + Math.cos(a) * 5), Math.round(9 + Math.sin(a) * 2.8), WHITE); }
  sparkle(pm, 8, 3 + (f % 2) * 1, hex('#9ff0e0'));
  return fin(pm, null);
};
function altar(color, glow, shape) {
  const pm = new Pixmap(32, 28), m = R(color);
  box(pm, 2, 12, 28, 15, 4, m);
  pm.rect(0, 23, 32, 4, m[3]); pm.rect(0, 23, 32, 1, m[1]);
  for (const x of [8, 22]) { pm.rect(x, 4, 3, 10, m[2]); pm.rect(x, 4, 1, 10, m[1]); pm.rect(x - 1, 3, 5, 2, m[1]); }
  shape(pm, hex(glow));
  for (const x of [6, 12, 19, 25]) { pm.set(x, 18, hex(glow)); pm.set(x, 19, hex(glow)); }
  return fin(pm, [16, 27, 15]);
}
S.slime_altar = () => altar('#7ed87a', '#ffffff', (pm, g) => { ballShade(pm, 16, 9, 5, 4, R('#7ee27a'), { dither: 0 }); pm.set(14, 8, EYE); pm.set(18, 8, EYE); pm.rect(13, 3, 6, 2, GOLD[2]); });
S.bone_altar = () => altar('#8a7a9a', '#c9a0ff', (pm, g) => { ballShade(pm, 16, 9, 5, 4.4, R('#f1ead7'), { dither: 0 }); pm.rect(13, 7, 2, 2, EYE); pm.rect(18, 7, 2, 2, EYE); pm.hline(14, 11, 4, EYE); });
S.spore_altar = () => altar('#8a5a8a', '#d7a0ff', (pm, g) => { ballShade(pm, 16, 8, 6, 3.6, R('#d6457f'), { dither: 0 }); for (const x of [13, 16, 19]) pm.set(x, 6, WHITE); pm.rect(15, 11, 3, 2, hex('#f4ecd8')); });
S.sun_altar = () => altar('#c8a860', '#ffe27a', (pm, g) => { pm.ellipse(16, 8, 5, 5, hex('#ffd84a')); pm.ellipse(16, 8, 3, 3, hex('#fff2a0')); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pm.set(Math.round(16 + Math.cos(a) * 7.6), Math.round(8 + Math.sin(a) * 7.6), hex('#ffd84a')); } });
S.frost_altar = () => altar('#8ab8d8', '#e8f8ff', (pm, g) => { pm.poly([[16, 0], [20, 10], [12, 10]], hex('#bfe8ff')); pm.poly([[16, 3], [18, 10], [14, 10]], hex('#ffffff')); pm.poly([[10, 5], [13, 10], [8, 10]], hex('#7fc6f0')); pm.poly([[22, 5], [24, 10], [19, 10]], hex('#7fc6f0')); });
S.crystal_altar = () => altar('#7a4aa8', '#ff9fd0', (pm, g) => { pm.poly([[16, 0], [21, 6], [16, 12], [11, 6]], hex('#e08ae8')); pm.poly([[16, 0], [21, 6], [16, 12]], hex('#b45ad0')); pm.poly([[11, 6], [16, 0], [15, 6]], hex('#ffe0ff')); });
S.magma_altar = () => altar('#4a3a48', '#ff7a3d', (pm, g) => { pm.poly([[16, 1], [21, 10], [11, 10]], hex('#ff6a2e')); pm.poly([[16, 4], [19, 10], [13, 10]], hex('#ffb347')); });
S.void_altar = () => altar('#2a2060', '#b79cff', (pm, g) => { pm.ellipse(16, 8, 6, 4, hex('#14102a')); pm.ellipse(16, 8, 3, 2, hex('#fffbd0')); pm.ellipse(16, 8, 1, 3, hex('#b79cff')); });
S.world_heart = (f = 0) => {
  const pm = new Pixmap(48, 56), m = R('#f6d8ff');
  box(pm, 4, 36, 40, 19, 5, R('#b6bccf'), { bricks: true });
  pm.rect(0, 50, 48, 5, R('#8a90a8')[3]);
  for (const x of [8, 36]) { pm.rect(x, 22, 5, 16, m[2]); pm.rect(x, 22, 1, 16, m[1]); pm.rect(x - 1, 21, 7, 2, m[1]); }
  const heart = hex('#ff5f8a');
  pm.circle(19, 14 - (f % 2), 7.5, R('#ff5f8a')[2]); pm.circle(29, 14 - (f % 2), 7.5, R('#ff5f8a')[2]); pm.poly([[12, 18 - (f % 2)], [36, 18 - (f % 2)], [24, 32 - (f % 2)]], R('#ff5f8a')[2]);
  pm.circle(17, 11 - (f % 2), 2.4, R('#ff5f8a')[0]); pm.set(24, 22, R('#ff5f8a')[3]);
  for (const [x, y] of [[8, 6], [40, 8], [6, 24], [42, 22], [24, 2]]) sparkle(pm, x, y + (f % 2), hex('#ffe9f4'));
  return fin(pm, [24, 55, 22, 2]);
};

// ----------------------------------------------------------------- lights
S.torch = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(7, 8, 2, 11, DWOOD[2]); pm.rect(7, 8, 1, 11, DWOOD[1]); pm.rect(6, 7, 4, 2, IRON[3]); flame(pm, 8, 7, 7, f); return fin(pm, [8, 19, 4, 1]); };
S.lantern_post = () => { const pm = new Pixmap(16, 28); pm.rect(7, 10, 2, 17, DWOOD[2]); pm.rect(6, 25, 4, 2, DWOOD[3]); pm.rect(4, 3, 8, 8, hex('#ffe9a0')); pm.frame(4, 3, 8, 8, DWOOD[3]); pm.rect(5, 4, 3, 6, hex('#fffbe0')); pm.rect(3, 2, 10, 2, DWOOD[2]); pm.set(8, 1, DWOOD[1]); pm.set(8, 6, hex('#ffffff')); return fin(pm, [8, 27, 5]); };
S.brazier = (f = 0) => { const pm = new Pixmap(16, 16); pm.poly([[2, 7], [14, 7], [11, 12], [5, 12]], STONE[2]); pm.poly([[2, 7], [8, 7], [8, 12], [5, 12]], STONE[1]); pm.rect(6, 12, 4, 3, STONE[3]); pm.rect(4, 14, 8, 1, STONE[4]); pm.hline(2, 7, 12, STONE[0]); pm.rect(3, 6, 10, 2, hex('#2a1e34')); flame(pm, 8, 7, 7, f); return fin(pm, [8, 15.2, 6]); };
S.candelabra = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(7, 9, 2, 9, IRON[3]); pm.rect(5, 17, 6, 2, IRON[4]); pm.rect(2, 8, 12, 2, IRON[2]); for (const x of [3, 7, 11]) { pm.rect(x, 4, 2, 5, hex('#f4ecff')); pm.set(x, 3 - (f + x) % 2, hex('#ffb347')); pm.set(x, 2 - (f + x) % 2, hex('#ffe066')); } return fin(pm, [8, 19, 5]); };
S.chandelier = () => { const pm = new Pixmap(16, 20); pm.rect(7, 0, 2, 5, GOLD[3]); pm.ellipse(8, 8, 7, 2.4, GOLD[2]); pm.hline(1, 8, 14, GOLD[1]); for (const x of [2, 6, 9, 13]) { pm.rect(x, 4, 2, 4, hex('#fff6e0')); pm.set(x, 3, hex('#ffe066')); } for (const x of [3, 7, 11]) { pm.rect(x, 10, 2, 3, hex('#cfeeff')); pm.set(x, 10, WHITE); } pm.rect(7, 12, 2, 4, hex('#cfeeff')); return fin(pm, null); };
S.lava_lamp = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(4, 15, 8, 3, IRON[3]); pm.poly([[5, 3], [11, 3], [12, 15], [4, 15]], hex('#ff9a6a')); pm.poly([[5, 3], [8, 3], [8, 15], [4, 15]], hex('#ffb892')); pm.rect(6, 1, 4, 3, IRON[2]); pm.circle(8, 11 - f, 2.4, hex('#ffe066')); pm.circle(9, 6 + f, 1.6, hex('#ff5a2e')); pm.set(5, 5, WHITE); return fin(pm, [8, 19, 5]); };
S.crystal_lamp = () => { const pm = new Pixmap(16, 20); pm.rect(4, 15, 8, 3, GOLD[3]); for (const [x, b, w, h, c] of [[8, 16, 6, 14, '#ffb8f0'], [4, 16, 4, 8, '#9ff0e0'], [12, 16, 4, 9, '#d4b8ff']]) { const p = R(c); for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w / 2 * (1 - j / (h * 1.1)))); for (let i = -hw; i <= hw; i++) pm.set(x + i, b - j, i < 0 ? p[1] : i > 0 ? p[3] : p[2]); } } sparkle(pm, 8, 2, WHITE); return fin(pm, [8, 19, 5]); };
S.star_lantern = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(7, 12, 2, 6, hex('#3a3a7a')); pm.rect(5, 17, 6, 2, hex('#3a3a7a')); pm.poly([[8, 1 + (f % 2)], [10, 6], [15, 6.5], [11, 9.5], [12.5, 14], [8, 11.5], [3.5, 14], [5, 9.5], [1, 6.5], [6, 6]], R('#ffe48a')[2]); pm.poly([[8, 1 + (f % 2)], [8, 11.5], [3.5, 14], [5, 9.5], [1, 6.5], [6, 6]], R('#ffe48a')[1]); pm.set(7, 5, WHITE); return fin(pm, null); };
S.stone_lantern = () => { const pm = new Pixmap(16, 22); pm.rect(5, 18, 6, 3, STONE[3]); pm.rect(6, 12, 4, 7, STONE[2]); pm.rect(3, 6, 10, 7, STONE[2]); pm.rect(3, 6, 10, 1, STONE[1]); pm.rect(5, 8, 6, 4, hex('#ffe9a0')); pm.set(6, 9, WHITE); pm.poly([[1, 6], [15, 6], [11, 1], [5, 1]], STONE[1]); pm.hline(1, 6, 14, STONE[3]); pm.circle(8, 1, 1.2, STONE[0]); return fin(pm, [8, 21, 5]); };

// ----------------------------------------------------------------- decor
const pot = (pm, c = '#c8704a') => { const p = R(c); pm.poly([[3, 12], [13, 12], [11, 19], [5, 19]], p[2]); pm.poly([[3, 12], [8, 12], [8, 19], [5, 19]], p[1]); pm.rect(2, 11, 12, 2, p[1]); pm.hline(2, 11, 12, p[0]); pm.hline(5, 18, 6, p[4]); };
S.plant_fern = () => { const pm = new Pixmap(16, 20); pot(pm); const g = R('#5fc96a'); for (const [dx, dy, l] of [[-5, -2, 6], [-3, -5, 7], [0, -7, 8], [3, -5, 7], [5, -2, 6]]) pm.line(8, 11, 8 + dx, 11 + dy - l + 6, g[2]), pm.line(8, 10, 8 + dx, 10 + dy - l + 6, g[1]); ballShade(pm, 8, 6, 5.5, 4.4, g, { dither: 0.2 }); return fin(pm, [8, 19, 6, 1.1]); };
S.plant_flowerpot = () => { const pm = new Pixmap(16, 20); pot(pm, '#e8806a'); pm.rect(7, 6, 2, 6, hex('#4aa84a')); for (const [x, y, c] of [[5, 5, '#ff8fb3'], [8, 3, '#ffffff'], [11, 5, '#ff8fb3'], [7, 7, '#ffd84a'], [10, 8, '#ffffff']]) { pm.rect(x - 1, y - 1, 3, 3, hex(c)); pm.set(x, y, hex('#ffd84a')); } return fin(pm, [8, 19, 6, 1.1]); };
S.plant_sunflower = () => { const pm = new Pixmap(16, 20); pot(pm, '#c8704a'); pm.rect(7, 6, 2, 6, hex('#4aa84a')); pm.circle(8, 5, 4, hex('#ffd84a')); pm.circle(8, 5, 2.2, hex('#8a5a2a')); pm.set(7, 4, hex('#6a3a1a')); pm.set(4, 5, hex('#ffe066')); pm.set(12, 5, hex('#ffb347')); pm.poly([[9, 9], [13, 8], [11, 11]], hex('#58b84a')); return fin(pm, [8, 19, 6, 1.1]); };
S.plant_cactus = () => { const pm = new Pixmap(16, 20); pot(pm, '#e8b86a'); const c = R('#4fb868'); pm.rect(6, 3, 4, 9, c[2]); pm.rect(6, 3, 1, 9, c[1]); pm.rect(9, 3, 1, 9, c[3]); pm.rect(3, 6, 3, 2, c[2]); pm.rect(3, 4, 2, 3, c[2]); pm.rect(10, 7, 3, 2, c[2]); pm.rect(12, 5, 2, 4, c[2]); pm.set(8, 2, hex('#ff8fb3')); pm.set(7, 5, c[0]); pm.set(8, 8, c[0]); return fin(pm, [8, 19, 6, 1.1]); };
S.plant_bonsai = () => { const pm = new Pixmap(16, 20); pm.rect(3, 15, 10, 4, R('#6a4a8a')[2]); pm.hline(3, 15, 10, R('#8a6aaa')[1]); pm.hline(4, 18, 8, R('#4a3a6a')[3]); pm.rect(7, 9, 2, 7, DWOOD[2]); pm.line(8, 11, 3, 8, DWOOD[2]); pm.line(8, 10, 13, 7, DWOOD[2]); for (const [x, y, r] of [[4, 6, 3.6], [12, 5, 3.4], [8, 4, 4.2]]) ballShade(pm, x, y, r, r * 0.8, R('#5fc96a'), { dither: 0.2 }); pm.set(5, 5, hex('#ffb3d0')); pm.set(11, 4, hex('#ffb3d0')); return fin(pm, [8, 19, 6, 1.1]); };
S.plant_tulips = () => { const pm = new Pixmap(16, 20); pm.rect(5, 10, 6, 8, withAlpha(hex('#cfeeff'), 255)); pm.rect(5, 10, 1, 8, WHITE); pm.rect(6, 14, 4, 3, hex('#8fd8ff')); pm.rect(4, 17, 8, 1, hex('#9ad0f0')); for (const [x, y, c] of [[5, 4, '#ff8fb3'], [8, 2, '#ffd84a'], [11, 4, '#ff8fb3'], [7, 6, '#ffffff']]) { pm.rect(x - 1, y, 3, 4, hex(c)); pm.set(x - 1, y - 1, hex(c)); pm.set(x + 1, y - 1, hex(c)); pm.set(x, y + 1, darker(hex(c), 0.2)); pm.vline(x, y + 4, 6, hex('#4aa84a')); } return fin(pm, [8, 19, 5, 1]); };
S.plant_monstera = () => { const pm = new Pixmap(16, 24); pot(pm, '#6a7a9a'); pm.rect(0, 0, 16, 0, 0); const g = R('#3fa860'); for (const [cx, cy, rx, ry] of [[4, 8, 4.5, 3.4], [12, 7, 4.5, 3.4], [8, 4, 4.8, 3.6], [8, 10, 4, 3]]) { ballShade(pm, cx, cy, rx, ry, g, { dither: 0.1 }); } for (const [x, y] of [[3, 7], [12, 6], [8, 3], [8, 9]]) pm.set(x, y, hex('#1a1226')); pm.vline(8, 11, 4, hex('#3f8a3a')); return fin(pm, [8, 23, 6, 1.1]); };
S.bench = () => { const pm = new Pixmap(32, 20); for (const x of [3, 27]) pm.rect(x, 11, 2, 8, DWOOD[3]); box(pm, 1, 9, 30, 3, 2, WOOD); pm.rect(1, 3, 30, 5, WOOD[2]); pm.rect(1, 3, 30, 1, WOOD[0]); pm.rect(1, 7, 30, 1, WOOD[3]); pm.rect(1, 5, 30, 1, WOOD[3]); return fin(pm, [16, 19, 14]); };
S.picnic = () => { const pm = new Pixmap(32, 32); pm.rect(1, 3, 30, 26, hex('#ffffff')); for (let y = 3; y < 29; y += 6) pm.rect(1, y, 30, 3, hex('#ff8fa8')); for (let x = 1; x < 31; x += 6) pm.rect(x, 3, 3, 26, withAlpha(hex('#ff8fa8'), 150)); pm.frame(1, 3, 30, 26, hex('#e0708a')); ballShade(pm, 10, 14, 4, 3.5, R('#d8a060'), { dither: 0 }); pm.rect(7, 12, 6, 1, hex('#8a5a2a')); pm.circle(21, 20, 2.4, hex('#f2545b')); pm.circle(25, 21, 2, hex('#ffd84a')); pm.rect(17, 11, 3, 5, hex('#cfeeff')); pm.set(17, 11, WHITE); return pm; };
S.signpost = () => { const pm = new Pixmap(16, 20); pm.rect(7, 4, 2, 15, DWOOD[2]); pm.rect(1, 3, 12, 6, WOOD[2]); pm.rect(1, 3, 12, 1, WOOD[0]); pm.rect(1, 8, 12, 1, WOOD[3]); pm.poly([[13, 3], [15, 6], [13, 9]], WOOD[2]); pm.hline(3, 5, 7, DWOOD[3]); pm.hline(3, 7, 5, DWOOD[3]); return fin(pm, [8, 19, 4, 1]); };
S.mailbox = () => { const pm = new Pixmap(16, 20); pm.rect(7, 9, 2, 10, DWOOD[2]); box(pm, 2, 2, 12, 9, 3, R('#e0504a')); pm.rect(4, 5, 8, 4, hex('#2a1e34')); pm.rect(12, 1, 2, 5, hex('#ffd84a')); pm.set(12, 1, WHITE); pm.rect(6, 9, 4, 1, hex('#fff6e0')); return fin(pm, [8, 19, 4, 1]); };
S.barrel = () => { const pm = new Pixmap(16, 16); pm.ellipse(8, 8, 6.4, 7, WOOD[2]); pm.rect(2, 3, 12, 11, WOOD[2]); pm.rect(2, 3, 2, 11, WOOD[1]); pm.rect(12, 3, 2, 11, WOOD[3]); for (const y of [4, 11]) { pm.rect(2, y, 12, 2, IRON[3]); pm.hline(2, y, 12, IRON[1]); } pm.ellipse(8, 3, 5.4, 2, WOOD[1]); pm.ellipse(8, 3, 3.4, 1.2, WOOD[3]); return fin(pm, [8, 15.3, 7]); };
S.crate = () => { const pm = new Pixmap(16, 16); box(pm, 1, 2, 14, 13, 4, WOOD); pm.frame(1, 6, 14, 9, DWOOD[3]); pm.line(2, 7, 13, 14, DWOOD[3]); pm.line(13, 7, 2, 14, DWOOD[3]); pm.rect(2, 3, 12, 2, WOOD[0]); return fin(pm, [8, 15.3, 7]); };
S.haystack = () => { const pm = new Pixmap(16, 16), h = R('#f0d060'); ballShade(pm, 8, 10, 7, 5.6, h, { dither: 0.2 }); for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) pm.line(x, y, x + 2, y - 1, h[0]); pm.rect(2, 12, 12, 2, hex('#c8504a')); pm.hline(2, 12, 12, hex('#e8706a')); return fin(pm, [8, 15.3, 7]); };
S.log_pile = () => { const pm = new Pixmap(16, 16), b = R('#a86f3d'), ring = R('#e8c08a'); for (const [x, y] of [[1, 9], [8, 9], [4.5, 3]]) { pm.rect(Math.floor(x), y, 7, 5, b[2]); pm.hline(Math.floor(x), y, 7, b[1]); pm.hline(Math.floor(x), y + 4, 7, b[3]); pm.ellipse(x + 1.5, y + 2.5, 1.8, 2.4, ring[1]); pm.ellipse(x + 1.5, y + 2.5, 0.8, 1.2, ring[3]); } return fin(pm, [8, 15.3, 7]); };
S.hedge = () => { const pm = new Pixmap(16, 16), g = R('#4aa85a'); ballShade(pm, 4.5, 8, 4.6, 5.5, g, { dither: 0.25 }); ballShade(pm, 11.5, 8, 4.6, 5.5, g, { dither: 0.25 }); ballShade(pm, 8, 7, 5.5, 5.6, g, { dither: 0.25 }); for (const [x, y] of [[4, 6], [10, 5], [7, 9], [12, 9]]) pm.set(x, y, hex('#ff8fb3')); return fin(pm, [8, 15, 7]); };
S.flower_bed = () => { const pm = new Pixmap(16, 16); pm.rect(0, 9, 16, 6, DWOOD[2]); pm.rect(0, 9, 16, 1, DWOOD[1]); pm.rect(1, 10, 14, 3, R('#6a4a2a')[2]); for (const [x, c] of [[2, '#ff8fb3'], [5, '#ffd84a'], [8, '#ffffff'], [11, '#8fb8ff'], [14, '#ff8fb3']]) { pm.vline(x, 6, 5, hex('#4aa84a')); pm.rect(x - 1, 4, 3, 3, hex(c)); pm.set(x, 5, hex('#ffd84a')); } return fin(pm, [8, 15.3, 7, 1]); };
S.scarecrow = () => { const pm = new Pixmap(16, 26); pm.rect(7, 8, 2, 17, DWOOD[2]); pm.rect(1, 11, 14, 2, DWOOD[2]); pm.rect(4, 11, 8, 8, R('#e0504a')[2]); pm.rect(4, 11, 1, 8, R('#e0504a')[1]); pm.rect(11, 11, 1, 8, R('#e0504a')[3]); pm.rect(5, 14, 2, 2, hex('#ffd84a')); pm.circle(8, 7, 3.6, hex('#e8c88a')); pm.set(6, 6, EYE); pm.set(10, 6, EYE); pm.hline(6, 9, 4, EYE); pm.ellipse(8, 4, 7, 1.6, R('#c8a040')[2]); pm.rect(5, 1, 6, 3, R('#c8a040')[2]); pm.rect(5, 3, 6, 1, hex('#e0504a')); for (const x of [0, 14]) { pm.set(x, 13, hex('#f0d060')); pm.set(x + 1, 14, hex('#f0d060')); } return fin(pm, [8, 25, 5]); };
S.gnome = () => { const pm = new Pixmap(16, 16); pm.rect(4, 8, 8, 6, R('#5a8ae0')[2]); pm.rect(4, 8, 1, 6, R('#5a8ae0')[1]); pm.circle(8, 8, 3.4, hex('#ffdcc0')); pm.ellipse(8, 11, 4.4, 3, hex('#ffffff')); pm.poly([[4, 6], [12, 6], [8, -2]], hex('#e0304a')); pm.poly([[4, 6], [8, 6], [8, -2]], hex('#f2545b')); pm.set(6, 7, EYE); pm.set(10, 7, EYE); pm.set(8, 8, hex('#ff8fa8')); pm.rect(5, 13, 3, 2, hex('#5a3a2a')); pm.rect(9, 13, 3, 2, hex('#5a3a2a')); return fin(pm, [8, 15.3, 6]); };
S.well = () => { const pm = new Pixmap(32, 36); box(pm, 4, 18, 24, 16, 6, STONE, { bricks: true }); pm.ellipse(16, 21, 9, 3.6, hex('#2a4a8a')); pm.ellipse(16, 21, 7.4, 2.6, hex('#4f8cff')); pm.rect(5, 6, 3, 16, DWOOD[2]); pm.rect(24, 6, 3, 16, DWOOD[2]); pm.poly([[2, 8], [30, 8], [24, 0], [8, 0]], R('#d8604a')[2]); pm.poly([[2, 8], [16, 8], [16, 0], [8, 0]], R('#e8806a')[1]); pm.hline(2, 8, 28, R('#a8402a')[3]); pm.line(16, 8, 16, 15, hex('#e0c288')); pm.rect(14, 15, 4, 3, DWOOD[2]); return fin(pm, [16, 35, 14, 1.6]); };
S.bird_bath = () => { const pm = new Pixmap(16, 20); pm.rect(6, 9, 4, 8, STONE[2]); pm.ellipse(8, 18, 5, 1.6, STONE[3]); pm.ellipse(8, 8, 7.4, 3, STONE[1]); pm.ellipse(8, 8, 6, 2.2, hex('#4f8cff')); pm.ellipse(7, 7.6, 3, 1, hex('#9ad8ff')); pm.hline(2, 10, 12, STONE[3]); pm.circle(10, 5, 1.6, hex('#ffd84a')); pm.set(11, 4, EYE); pm.set(12, 5, hex('#ff9a3c')); return fin(pm, [8, 19, 6, 1.1]); };
S.fountain = (f = 0) => { const pm = new Pixmap(32, 34); pm.ellipse(16, 25, 15, 7, STONE[3]); pm.ellipse(16, 24, 15, 6.4, STONE[1]); pm.ellipse(16, 24, 12.6, 5, hex('#3a78d8')); pm.ellipse(16, 24, 10, 3.6, hex('#6aaaf0')); pm.rect(14, 12, 4, 12, STONE[2]); pm.ellipse(16, 14, 6, 2.4, STONE[1]); pm.ellipse(16, 14, 4.6, 1.6, hex('#6aaaf0')); pm.rect(15, 5, 2, 8, STONE[2]); for (const [dx, dy] of [[-3, 6], [3, 6], [-5, 10], [5, 10]]) { pm.set(16 + dx, 2 + dy + (f % 2), hex('#bfeaff')); pm.set(16 + dx, 3 + dy + (f % 2), hex('#9ad8ff')); } pm.set(16, 2 + (f % 2), WHITE); pm.set(16, 3, hex('#cfeeff')); pm.line(16, 4, 12, 12, hex('#bfeaff')); pm.line(16, 4, 20, 12, hex('#bfeaff')); return fin(pm, [16, 32, 14, 1.8]); };
S.statue_cat = () => { const pm = new Pixmap(16, 22); pm.rect(3, 16, 10, 5, STONE[3]); pm.rect(3, 16, 10, 1, STONE[1]); ballShade(pm, 8, 11, 4.6, 5.4, STONE, { dither: 0 }); ballShade(pm, 8, 6, 3.8, 3.4, STONE, { dither: 0 }); pm.poly([[4, 5], [5, 1], [7, 3]], STONE[2]); pm.poly([[12, 5], [11, 1], [9, 3]], STONE[2]); pm.set(6, 6, EYE); pm.set(10, 6, EYE); pm.set(8, 8, STONE[4]); pm.line(12, 13, 14, 9, STONE[2]); pm.set(14, 8, GOLD[2]); pm.rect(7, 9, 2, 1, GOLD[2]); return fin(pm, [8, 21, 6]); };
S.statue_angel = () => { const pm = new Pixmap(16, 34); pm.rect(3, 28, 10, 5, STONE[3]); pm.rect(3, 28, 10, 1, STONE[1]); pm.poly([[5, 27], [11, 27], [12, 14], [4, 14]], STONE[2]); pm.poly([[5, 27], [8, 27], [8, 14], [4, 14]], STONE[1]); for (const s of [-1, 1]) { pm.poly([[8 + s * 3, 14], [8 + s * 8, 8], [8 + s * 7, 18]], STONE[1]); pm.poly([[8 + s * 3, 14], [8 + s * 7, 18], [8 + s * 4, 19]], STONE[2]); } ballShade(pm, 8, 9, 3.6, 3.6, STONE, { dither: 0 }); pm.ring(8, 4, 1.6, 2.6, GOLD[2]); pm.set(7, 9, EYE); pm.set(9, 9, EYE); pm.set(5, 15, STONE[0]); return fin(pm, [8, 33, 6, 1.4]); };
S.tent = () => { const pm = new Pixmap(32, 32); pm.poly([[1, 29], [31, 29], [16, 3]], R('#ff9fc0')[2]); pm.poly([[1, 29], [16, 29], [16, 3]], R('#ffc0d8')[1]); pm.poly([[16, 29], [31, 29], [16, 3]], R('#e0709a')[3]); for (const x of [6, 11, 21, 26]) pm.line(x, 29, 16, 3 + Math.abs(x - 16) * 0.2, R('#e0709a')[3]); pm.poly([[11, 29], [21, 29], [16, 13]], hex('#3a2a40')); pm.poly([[11, 29], [16, 29], [16, 13]], hex('#4a3a50')); pm.rect(15, 0, 2, 5, DWOOD[2]); pm.poly([[17, 0], [23, 2], [17, 4]], hex('#ffd84a')); return fin(pm, [16, 30, 15, 1.6]); };
S.hammock = () => { const pm = new Pixmap(32, 20); for (const x of [2, 28]) { pm.rect(x, 3, 3, 16, DWOOD[2]); pm.rect(x, 3, 1, 16, DWOOD[1]); } for (let x = 5; x < 28; x++) { const y = 8 + Math.round(Math.sin((x - 5) / 22 * Math.PI) * 4); pm.rect(x, y, 1, 3, R('#7fb0ff')[2]); pm.set(x, y, R('#7fb0ff')[1]); pm.set(x, y + 2, R('#7fb0ff')[3]); } pm.rect(9, 9, 6, 3, hex('#fff6e0')); return fin(pm, [16, 19, 14]); };
S.swing = () => { const pm = new Pixmap(32, 34); pm.line(2, 31, 8, 3, DWOOD[2]); pm.line(3, 31, 9, 3, DWOOD[3]); pm.line(30, 31, 24, 3, DWOOD[2]); pm.line(29, 31, 23, 3, DWOOD[3]); pm.rect(7, 2, 18, 3, DWOOD[2]); pm.rect(7, 2, 18, 1, DWOOD[1]); pm.line(11, 5, 11, 20, hex('#e0c288')); pm.line(21, 5, 21, 20, hex('#e0c288')); pm.rect(9, 20, 14, 3, WOOD[2]); pm.rect(9, 20, 14, 1, WOOD[1]); return fin(pm, [16, 33, 14, 1.4]); };
S.lighthouse = () => { const pm = new Pixmap(32, 64); pm.poly([[6, 62], [26, 62], [22, 18], [10, 18]], R('#ffffff')[2]); for (const [y0, y1] of [[22, 32], [42, 52]]) pm.poly([[6 + (62 - y1) * 0.2, y1], [26 - (62 - y1) * 0.2, y1], [26 - (62 - y0) * 0.2, y0], [6 + (62 - y0) * 0.2, y0]], R('#e0504a')[2]); pm.poly([[6, 62], [14, 62], [14, 18], [10, 18]], withAlpha(hex('#ffffff'), 90)); pm.rect(12, 50, 8, 12, DWOOD[2]); pm.frame(12, 50, 8, 12, DWOOD[4]); pm.rect(7, 12, 18, 7, IRON[3]); pm.rect(9, 5, 14, 8, hex('#fff0b0')); pm.frame(9, 5, 14, 8, IRON[3]); pm.rect(12, 7, 8, 4, WHITE); pm.poly([[7, 5], [25, 5], [16, -3]], R('#e0504a')[2]); pm.poly([[7, 5], [16, 5], [16, -3]], R('#f2706a')[1]); return fin(pm, [16, 63, 12, 1.8]); };
S.counter = () => { const pm = new Pixmap(16, 16); box(pm, 0, 3, 16, 12, 4, R('#f4ecd8')); pm.rect(2, 9, 12, 4, R('#e8dcc0')[2]); pm.frame(2, 9, 12, 4, R('#a89870')[2]); pm.rect(7, 10, 2, 1, GOLD[2]); pm.rect(11, 0, 3, 4, hex('#cfeeff')); pm.set(11, 0, WHITE); return fin(pm, [8, 15.2, 7]); };
S.sink = () => { const pm = S.counter(); pm.rect(3, 3, 8, 3, IRON[3]); pm.rect(4, 3, 6, 2, hex('#8fd8ff')); pm.rect(11, 0, 2, 4, IRON[2]); pm.rect(10, 0, 3, 1, IRON[1]); return pm; };
S.fridge = () => { const pm = new Pixmap(16, 30); box(pm, 1, 2, 14, 27, 3, R('#cfeeff')); pm.hline(2, 13, 12, R('#8ac0e0')[3]); pm.rect(11, 6, 2, 5, IRON[3]); pm.rect(11, 16, 2, 6, IRON[3]); pm.rect(3, 5, 3, 3, hex('#ff8fb3')); pm.set(4, 6, WHITE); pm.set(5, 7, hex('#ffe066')); return fin(pm, [8, 29, 7]); };
S.bathtub = () => { const pm = new Pixmap(32, 18); for (const x of [3, 27]) pm.rect(x, 14, 3, 3, IRON[2]); pm.ellipse(16, 10, 15.5, 7.5, R('#ffffff')[3]); pm.ellipse(16, 9, 15, 7, R('#ffffff')[1]); pm.ellipse(16, 9, 12.4, 4.6, hex('#8fd8ff')); pm.ellipse(14, 8, 6, 1.6, hex('#bfeaff')); pm.circle(8, 6, 2.4, hex('#ffffff')); pm.circle(10, 7, 2, hex('#ffffff')); pm.circle(25, 5, 1.6, hex('#ffe9f0')); pm.rect(27, 0, 2, 5, IRON[2]); pm.rect(25, 0, 4, 1, IRON[1]); return fin(pm, [16, 17, 14]); };
S.fireplace = (f = 0) => { const pm = new Pixmap(32, 28); box(pm, 1, 2, 30, 25, 4, R('#c8704a'), { bricks: true }); pm.rect(3, 0, 26, 4, STONE[2]); pm.rect(3, 0, 26, 1, STONE[0]); pm.rect(7, 10, 18, 16, hex('#1a1226')); pm.frame(7, 10, 18, 16, R('#7a3a2a')[3]); flame(pm, 12, 24, 9, f); flame(pm, 20, 24, 11, f + 1); flame(pm, 16, 24, 7, f + 2); pm.rect(8, 24, 16, 2, hex('#4a3a40')); pm.rect(10, 22, 4, 2, DWOOD[3]); pm.rect(18, 22, 4, 2, DWOOD[2]); return fin(pm, [16, 27, 14]); };
S.piano = () => { const pm = new Pixmap(32, 28); for (const x of [3, 27]) pm.rect(x, 21, 3, 6, hex('#2a1f3d')); box(pm, 0, 3, 32, 20, 5, R('#3a3050')); pm.rect(2, 10, 28, 5, WHITE); for (let x = 3; x < 30; x += 3) pm.vline(x, 10, 5, hex('#c8c0d8')); for (const x of [4, 7, 13, 16, 19, 25, 28]) pm.rect(x, 10, 2, 3, hex('#1a1226')); pm.rect(2, 15, 28, 2, R('#3a3050')[3]); pm.rect(6, 0, 20, 4, R('#4a4060')[2]); pm.hline(6, 0, 20, R('#4a4060')[0]); pm.rect(12, 1, 8, 2, hex('#fff6e0')); return fin(pm, [16, 27, 14]); };
S.aquarium = () => { const pm = new Pixmap(32, 24); for (const x of [2, 27]) pm.rect(x, 17, 3, 6, DWOOD[3]); box(pm, 0, 14, 32, 5, 2, WOOD); pm.rect(1, 2, 30, 13, withAlpha(hex('#7fd0ff'), 255)); pm.frame(1, 2, 30, 13, hex('#cfeeff')); for (let y = 3; y < 14; y++) for (let x = 2; x < 30; x++) if (bayer(x, y) < (y - 3) / 11 * 0.5) pm.set(x, y, hex('#4aa8e8')); pm.rect(2, 12, 28, 2, hex('#e8d08a')); for (const [x, c] of [[6, '#6aa850'], [24, '#6aa850']]) { pm.vline(x, 8, 5, hex(c)); pm.vline(x + 1, 9, 4, hex(c)); } for (const [x, y, c] of [[12, 6, '#ff9a3c'], [20, 8, '#ff6f9a'], [16, 4, '#ffe066']]) { pm.ellipse(x, y, 2.4, 1.4, hex(c)); pm.poly([[x + 2, y], [x + 4, y - 1], [x + 4, y + 1]], hex(c)); pm.set(x - 1, y - 0, EYE); } pm.set(9, 4, WHITE); pm.set(10, 3, WHITE); pm.set(25, 5, WHITE); pm.rect(2, 3, 5, 1, hex('#ffffff88')); return fin(pm, [16, 23, 14]); };
S.globe = () => { const pm = new Pixmap(16, 20); pm.rect(6, 14, 4, 4, DWOOD[2]); pm.rect(4, 17, 8, 2, DWOOD[3]); pm.circle(8, 8, 6, R('#4f8cff')[2]); pm.ellipse(6, 7, 2.4, 3, hex('#6cc24e')); pm.ellipse(11, 10, 2, 2, hex('#6cc24e')); pm.set(5, 5, WHITE); pm.ring(8, 8, 6, 7, GOLD[2]); pm.line(2, 13, 14, 3, GOLD[3]); return fin(pm, [8, 19, 5]); };
S.telescope = () => { const pm = new Pixmap(16, 34); pm.line(8, 30, 3, 33, DWOOD[3]); pm.line(8, 30, 13, 33, DWOOD[3]); pm.line(8, 30, 8, 33, DWOOD[3]); pm.rect(7, 18, 2, 12, DWOOD[2]); pm.line(4, 18, 13, 4, IRON[2]); pm.line(5, 19, 14, 5, IRON[3]); pm.rect(11, 1, 4, 5, IRON[1]); pm.set(11, 1, WHITE); pm.rect(2, 17, 4, 3, GOLD[2]); pm.ring(8, 18, 1, 2.4, GOLD[2]); return fin(pm, [8, 33, 6, 1]); };
S.grandfather_clock = () => { const pm = new Pixmap(16, 34); box(pm, 2, 8, 12, 25, 2, R('#6a3a2a')); pm.rect(4, 3, 8, 6, R('#6a3a2a')[1]); pm.poly([[3, 4], [13, 4], [8, 0]], R('#6a3a2a')[2]); pm.circle(8, 8, 3.4, hex('#fff6e0')); pm.set(8, 6, EYE); pm.set(8, 10, EYE); pm.line(8, 8, 8, 6, EYE); pm.line(8, 8, 10, 8, hex('#c8304a')); pm.rect(4, 14, 8, 15, hex('#2a1e34')); pm.frame(4, 14, 8, 15, GOLD[3]); pm.line(8, 15, 8, 22, GOLD[2]); pm.circle(8, 24, 2, GOLD[2]); pm.set(7, 23, WHITE); return fin(pm, [8, 33, 6, 1.1]); };
S.rocking_chair = () => { const pm = new Pixmap(16, 20); pm.rect(4, 2, 8, 9, WOOD[2]); pm.rect(4, 2, 1, 9, WOOD[1]); pm.rect(11, 2, 1, 9, WOOD[3]); for (const x of [5, 7, 9]) pm.vline(x, 3, 6, WOOD[3]); pm.rect(2, 10, 12, 3, R('#ffb3cc')[2]); pm.rect(2, 10, 12, 1, R('#ffb3cc')[1]); pm.rect(2, 13, 12, 1, WOOD[3]); pm.line(1, 18, 14, 18, WOOD[2]); pm.line(1, 17, 3, 18, WOOD[2]); pm.line(14, 17, 12, 18, WOOD[2]); pm.vline(4, 14, 4, WOOD[3]); pm.vline(11, 14, 4, WOOD[3]); return fin(pm, [8, 19, 6, 1.1]); };
S.armchair = () => { const pm = new Pixmap(16, 20), c = R('#ff9fc0'); pm.rect(1, 2, 14, 10, c[2]); pm.rect(1, 2, 14, 2, c[1]); pm.rect(0, 7, 3, 9, c[2]); pm.rect(13, 7, 3, 9, c[3]); pm.rect(3, 10, 10, 5, c[1]); pm.hline(3, 14, 10, c[3]); pm.rect(0, 15, 16, 1, c[4]); for (const x of [2, 12]) pm.rect(x, 16, 2, 3, DWOOD[3]); pm.set(8, 6, c[0]); pm.set(6, 5, hex('#ffd0e0')); pm.set(10, 7, hex('#ffd0e0')); return fin(pm, [8, 19, 7, 1.2]); };
S.mushroom_lamp = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(6, 9, 4, 9, hex('#f4ecd8')); pm.vline(9, 9, 9, hex('#d8c8a8')); ballShade(pm, 8, 7, 7, 5.6, R('#4fd0a0'), { dither: 0.1 }); for (const [x, y] of [[4, 6], [9, 4], [11, 8], [7, 9]]) pm.rect(x, y, 2, 2, hex('#e8fff4')); sparkle(pm, 2, 2 + (f % 2), hex('#b8ffe8')); sparkle(pm, 14, 4, hex('#b8ffe8')); pm.ellipse(8, 18, 5, 1.4, hex('#5a6a4a')); return fin(pm, [8, 19, 5]); };
S.mushroom_stool = () => { const pm = new Pixmap(16, 16); pm.rect(6, 8, 4, 6, hex('#f4ecd8')); pm.vline(9, 8, 6, hex('#d8c8a8')); ballShade(pm, 8, 7, 6.4, 4.2, R('#ff8a4a'), { dither: 0.1 }); for (const [x, y] of [[4, 6], [9, 4], [11, 7]]) pm.rect(x, y, 2, 2, WHITE); return fin(pm, [8, 15.2, 6]); };
S.cauldron = (f = 0) => { const pm = new Pixmap(16, 16); pm.ellipse(8, 10, 7, 5.4, R('#3a3050')[2]); pm.rect(1, 7, 14, 7, R('#3a3050')[2]); pm.rect(1, 7, 2, 7, R('#5a4a70')[1]); pm.rect(13, 7, 2, 7, R('#2a2040')[3]); pm.ellipse(8, 7, 7, 2.6, R('#5a4a70')[1]); pm.ellipse(8, 7, 5.6, 1.8, hex('#7aff9a')); pm.circle(6, 6 - f, 1, hex('#bfffd0')); pm.circle(10, 7, 0.8, hex('#bfffd0')); pm.rect(2, 14, 2, 2, R('#3a3050')[3]); pm.rect(12, 14, 2, 2, R('#3a3050')[3]); return fin(pm, [8, 15.2, 6]); };
S.coffin = () => { const pm = new Pixmap(16, 32), w = R('#5a3a2a'); pm.poly([[4, 2], [12, 2], [15, 9], [13, 30], [3, 30], [1, 9]], w[2]); pm.poly([[4, 2], [8, 2], [8, 30], [3, 30], [1, 9]], w[1]); pm.poly([[8, 2], [12, 2], [15, 9], [13, 30], [8, 30]], w[3]); pm.rect(7, 6, 2, 12, hex('#c9a0ff')); pm.rect(5, 9, 6, 2, hex('#c9a0ff')); pm.rect(4, 22, 8, 6, R('#7a3a9a')[2]); pm.hline(4, 22, 8, R('#7a3a9a')[1]); return fin(pm, [8, 31, 7, 1.2]); };
S.crystal_ball = (f = 0) => { const pm = new Pixmap(16, 20); pm.rect(4, 15, 8, 3, GOLD[3]); pm.rect(5, 14, 6, 2, GOLD[2]); pm.circle(8, 9, 6, R('#c8a8ff')[2]); ballShade(pm, 8, 9, 5.6, 5.6, R('#b898f0'), { dither: 0.15 }); pm.set(5, 6, WHITE); pm.set(6, 5, WHITE); sparkle(pm, 9 + (f % 2), 10, hex('#ffe9f4')); return fin(pm, [8, 19, 5]); };
S.fairy_ring = (f = 0) => { const pm = new Pixmap(32, 32); for (let a = 0; a < 6.28; a += 0.45) { const x = 16 + Math.cos(a) * 12, y = 16 + Math.sin(a) * 11; const c = ['#ff9fd0', '#ffffff', '#9ff0e0', '#ffe48a'][Math.floor(a / 0.45) % 4]; pm.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, hex(c)); pm.set(Math.round(x), Math.round(y), hex('#ffd84a')); } pm.ellipse(16, 16, 9, 8, withAlpha(hex('#ffd0ff'), 70)); sparkle(pm, 16 + (f ? 3 : -3), 16, WHITE); sparkle(pm, 10, 12 + f, hex('#ffe9f4')); return pm; };
S.rainbow_arch = () => { const pm = new Pixmap(32, 30); const cols = ['#ff6a8a', '#ffb347', '#ffe066', '#7ed07a', '#5cc7ff', '#b07aff']; cols.forEach((c, i) => { const r = 15 - i * 1.6; for (let a = Math.PI; a <= Math.PI * 2; a += 0.04) { pm.set(Math.round(16 + Math.cos(a) * r), Math.round(28 + Math.sin(a) * (r * 1.6)), hex(c)); pm.set(Math.round(16 + Math.cos(a) * r), Math.round(29 + Math.sin(a) * (r * 1.6)), hex(c)); } }); pm.rect(0, 25, 3, 4, hex('#ffffff')); pm.rect(29, 25, 3, 4, hex('#ffffff')); return fin(pm, null, 0.5); };
S.star_orb = (f = 0) => { const pm = new Pixmap(16, 22); pm.circle(8, 10 - (f % 2), 5, R('#d8e0ff')[2]); ballShade(pm, 8, 10 - (f % 2), 4.6, 4.6, R('#d8e0ff'), { dither: 0.1 }); pm.set(6, 8 - (f % 2), WHITE); sparkle(pm, 3, 4, hex('#fff0a0')); sparkle(pm, 13, 6 + f, hex('#a9c4ff')); sparkle(pm, 12, 15, hex('#fff0a0')); pm.ellipse(8, 19, 4, 1.2, withAlpha(hex('#1e1440'), 90)); return fin(pm, null, 0.6); };
S.portal_ring = (f = 0) => { const pm = new Pixmap(32, 34); pm.ellipse(16, 17, 13, 15, R('#8a6cff')[3]); pm.ellipse(16, 17, 11.4, 13.4, R('#b79cff')[1]); pm.ellipse(16, 17, 9.4, 11.4, hex('#14102a')); pm.ellipse(16, 17, 6, 8, hex('#2a1f6a')); pm.ellipse(16, 17, 3, 4.5, hex('#6a5cff')); for (let k = 0; k < 6; k++) { const a = k + f * 0.9; pm.set(Math.round(16 + Math.cos(a) * 7), Math.round(17 + Math.sin(a) * 9), hex('#fffbd0')); } pm.rect(6, 29, 20, 4, R('#3a3a7a')[2]); pm.rect(6, 29, 20, 1, R('#5a5a9a')[1]); return fin(pm, [16, 33, 12, 1.6]); };

// crop sprites (drawn on top of the 16x16 farm plot): stage 0 seeds .. 3 ripe. Each crop has its own silhouette so a field reads at a glance.
const C = {
  leaf: R('#5cc24a'), leafD: R('#3f9a3a'), stalk: hex('#7ccf5a'),
  soil: hex('#6a4a2a'), soilL: hex('#8a6038'),
  gold: hex('#f6c844'), goldD: hex('#d89a24'), goldL: hex('#fff0a0'),
  org: hex('#ff9a3c'), orgD: hex('#d9701a'), orgL: hex('#ffc070'),
  red: hex('#f2503a'), redD: hex('#c0322a'), redL: hex('#ff8a70'),
  berry: hex('#ff4f6d'), berryD: hex('#c93252'),
  wood: hex('#a8743c'), white: hex('#ffffff'), cream: hex('#f0eef8'), flower: hex('#ffffff'), yolk: hex('#ffd84a'),
};
function bushShape(pm, cx, cy, r) { const L = C.leaf, D = C.leafD; pm.ellipse(cx, cy, r, r * 0.75, D[2]); pm.ellipse(cx, cy - 0.5, r - 0.6, r * 0.75 - 0.6, L[2]); for (const [dx, dy] of [[-1, -1], [1, 0], [0, -2]]) pm.set(Math.round(cx + dx * r * 0.4), Math.round(cy + dy * 0.8), L[0]); }
function sprout(pm, x, y) { pm.set(x, y, C.leaf[1]); pm.set(x - 1, y - 1, C.leaf[0]); pm.set(x + 1, y - 1, C.leaf[0]); pm.set(x, y + 1, C.leaf[3]); }
function clod(pm, x, y) { pm.set(x, y, C.soilL); pm.set(x + 1, y + 1, C.soil); }
function drawCrop(id, stage) {
  const pm = new Pixmap(16, 16);
  if (stage === 0) { for (const [x, y] of [[4, 4], [10, 7], [6, 11], [12, 12], [3, 12]]) clod(pm, x, y); return pm; }
  const L = C.leaf, D = C.leafD;
  if (id === 'wheat') {
    const xs = [4, 8, 12];
    xs.forEach((x, i) => {
      const h = [3, 6, 10][stage - 1] + (i === 1 ? 1 : 0), lean = stage === 3 ? (i - 1) : 0;
      for (let k = 0; k < h; k++) pm.set(x + Math.round(lean * k / h), 13 - k, k < 2 ? D[2] : C.stalk);
      if (stage >= 2) { pm.set(x - 1, 12 - Math.floor(h / 3), L[1]); pm.set(x + 1, 11 - Math.floor(h / 3), L[1]); pm.set(x - 2, 11 - Math.floor(h / 3), L[2]); }
      if (stage === 3) { const hx = x + lean, hy = 13 - h; for (let k = 0; k < 4; k++) { pm.set(hx - 1, hy + k, k % 2 ? C.goldD : C.gold); pm.set(hx + 1, hy + k - 1, k % 2 ? C.gold : C.goldD); pm.set(hx, hy + k - 1, C.gold); } pm.set(hx, hy - 2, C.goldL); pm.set(hx - 1, hy - 2, C.goldD); pm.set(hx + 1, hy - 3, C.goldL); }
    });
  } else if (id === 'carrot') {
    [4, 8, 12].forEach((x, i) => {
      const n = stage === 1 ? 2 : stage === 2 ? 4 : 5, hgt = stage === 1 ? 3 : stage === 2 ? 5 : 6, by = 12 + (i % 2) * 0;
      for (let k = 0; k < n; k++) { const dx = k - (n - 1) / 2; const len = hgt - Math.abs(dx) * 1.3; for (let j = 0; j < len; j++) pm.set(Math.round(x + dx * (0.6 + j * 0.28)), by - j, j > len - 2 ? L[1] : (k % 2 ? L[2] : D[1])); }
      if (stage === 3) { pm.rect(x - 1, 12, 3, 2, C.org); pm.set(x - 1, 12, C.orgL); pm.set(x + 1, 13, C.orgD); pm.set(x, 14, C.orgD); }
    });
  } else if (id === 'tomato') {
    const xs = stage === 1 ? [5, 11] : [5, 11];
    xs.forEach((x, i) => {
      const h = [3, 7, 10][stage - 1];
      if (stage >= 2) { for (let k = 0; k < h + 1; k++) pm.set(x + 1, 13 - k, C.wood); }
      for (let k = 0; k < h; k++) pm.set(x, 13 - k, D[1]);
      for (let k = 0; k < Math.max(1, h / 2.2); k++) { const y = 12 - k * 2; pm.set(x - 1, y, L[1]); pm.set(x - 2, y - 1, L[2]); pm.set(x + 2, y - 1, L[1]); pm.set(x + 3, y, L[2]); }
      if (stage === 2) { pm.set(x - 2, 7, C.yolk); pm.set(x + 3, 9, C.yolk); }
      if (stage === 3) for (const [dx, dy] of [[-2, 7], [3, 9], [-2, 11], [3, 5]]) { pm.rect(x + dx, dy, 2, 2, C.red); pm.set(x + dx, dy, C.redL); pm.set(x + dx + 1, dy + 1, C.redD); pm.set(x + dx, dy - 1, D[1]); }
    });
  } else if (id === 'pumpkin') {
    const cx = 8;
    if (stage === 1) { pm.set(cx, 12, D[2]); pm.set(cx, 11, D[1]); pm.rect(cx - 3, 9, 3, 2, L[1]); pm.rect(cx + 1, 8, 3, 2, L[2]); pm.set(cx - 3, 9, L[0]); }
    else {
      // vine + big leaves
      for (let k = 0; k < 9; k++) pm.set(Math.round(2 + k * 1.3), 13 - Math.round(Math.sin(k / 2.2) * 2), D[2]);
      pm.circle(4, 9, 2.6, L[1]); pm.set(3, 8, L[0]); pm.circle(13, 6, 2.4, L[2]); pm.set(12, 5, L[0]); pm.set(4, 9, D[2]);
      if (stage === 2) { pm.circle(9, 10, 2, hex('#7dc860')); pm.set(8, 9, hex('#a8e088')); pm.set(9, 7, D[3]); }
      else {
        pm.ellipse(8, 9.5, 5.4, 4, C.orgD); pm.ellipse(8, 9, 5, 3.6, C.org);
        for (const x of [4, 6, 10, 12]) pm.vline(x, 7, 5, C.orgD);
        pm.vline(8, 6, 6, C.orgD); pm.rect(5, 7, 2, 2, C.orgL); pm.set(9, 7, C.orgL);
        pm.rect(7, 4, 2, 3, D[3]); pm.set(7, 4, L[1]); pm.set(9, 4, D[2]); pm.set(10, 3, D[2]);
      }
    }
  } else if (id === 'strawberry') {
    const bush = (cx, cy, r) => bushShape(pm, cx, cy, r);
    if (stage === 1) { sprout(pm, 5, 11); sprout(pm, 11, 10); pm.set(8, 12, L[1]); pm.set(7, 11, L[0]); pm.set(9, 11, L[0]); }
    else {
      bush(5, 10, stage === 2 ? 4 : 4.4); bush(11, 9, stage === 2 ? 4 : 4.4); bush(8, 12, 3.4);
      if (stage === 2) for (const [x, y] of [[4, 8], [11, 6], [7, 11], [12, 10]]) { pm.set(x, y, C.flower); pm.set(x - 1, y, C.flower); pm.set(x + 1, y, C.flower); pm.set(x, y - 1, C.flower); pm.set(x, y + 1, C.flower); pm.set(x, y, C.yolk); }
      else for (const [x, y] of [[4, 8], [7, 12], [10, 9], [13, 11], [8, 7], [2, 11]]) { pm.rect(x, y, 2, 3, C.berry); pm.set(x, y, C.redL); pm.set(x + 1, y + 2, C.berryD); pm.set(x, y + 1, C.yolk); pm.set(x + 1, y - 1, D[2]); pm.set(x, y - 1, D[2]); }
    }
  } else if (id === 'cotton') {
    if (stage === 1) { sprout(pm, 4, 11); sprout(pm, 8, 10); sprout(pm, 12, 11); }
    else {
      bushShape(pm, 5, 10, 4.2); bushShape(pm, 11, 10, 4.2); bushShape(pm, 8, 8, 3.8);
      if (stage === 2) for (const [x, y] of [[4, 8], [8, 6], [12, 8], [7, 11], [11, 12]]) { pm.rect(x, y, 2, 2, hex('#8ad870')); pm.set(x, y, hex('#c8f4b0')); }
      else for (const [x, y] of [[3, 7], [8, 4], [13, 7], [6, 9], [10, 10]]) {
        pm.set(x - 1, y + 2, C.wood); pm.set(x + 1, y + 2, C.wood); pm.set(x, y + 3, C.wood);
        pm.circle(x, y, 1.7, C.white); pm.set(x - 1, y - 1, C.white); pm.set(x + 1, y + 1, C.cream); pm.set(x + 1, y, C.cream); pm.set(x, y - 1, hex('#ffffff'));
      }
    }
  }
  pm.outline(null, { amt: 0.55 });
  return pm;
}
function crop(id, stage) { return drawCrop(id, stage); }

// ----------------------------------------------------------------- seaside, zen and festival decor
S.beach_umbrella = () => {
  const pm = new Pixmap(16, 32), red = R('#ff6b7a'), wh = R('#ffffff');
  pm.rect(7, 12, 2, 18, DWOOD[2]); pm.rect(7, 12, 1, 18, DWOOD[1]); pm.rect(8, 12, 1, 18, DWOOD[3]);
  for (let y = 1; y <= 13; y++) for (let x = 0; x < 16; x++) {
    const dx = (x + 0.5 - 8) / 8, dy = (y + 0.5 - 13.5) / 12.5;
    if (dx * dx + dy * dy > 1) continue;
    const pal = Math.floor((x + 1) / 3) % 2 ? wh : red;
    pm.set(x, y, x < 5 ? pal[1] : x > 10 ? pal[3] : pal[2]);
  }
  for (let x = 0; x < 16; x += 3) pm.set(x + 1, 13, pm.get(x + 1, 12));
  pm.rect(7, 0, 2, 2, GOLD[2]); pm.set(7, 0, GOLD[0]);
  pm.ellipse(8, 30, 5.5, 1.7, hex('#f1dc9a'));
  return fin(pm, [8, 31, 7, 1.4]);
};
S.deck_chair = () => {
  const pm = new Pixmap(16, 20), blue = R('#5fb8e8'), wh = R('#ffffff');
  for (const x of [1, 13]) { pm.rect(x, 1, 2, 18, DWOOD[2]); pm.vline(x, 1, 18, DWOOD[1]); pm.vline(x + 1, 1, 18, DWOOD[3]); }
  for (let y = 2; y < 15; y += 2) { pm.rect(3, y, 10, 2, Math.floor(y / 2) % 2 ? wh[2] : blue[2]); pm.hline(3, y, 10, Math.floor(y / 2) % 2 ? wh[1] : blue[1]); }
  pm.rect(1, 9, 3, 2, DWOOD[1]); pm.rect(12, 9, 3, 2, DWOOD[1]); pm.rect(3, 15, 10, 1, DWOOD[3]);
  return fin(pm, [8, 19, 7, 1.3]);
};
S.sandcastle = () => {
  const pm = new Pixmap(16, 16), s = R('#f1dc9a');
  const tower = (x, w, top) => { pm.rect(x, top, w, 13 - top, s[2]); pm.rect(x, top, w, 1, s[0]); pm.vline(x, top, 13 - top, s[1]); pm.vline(x + w - 1, top, 13 - top, s[3]); for (let k = 0; k < w; k += 2) pm.set(x + k, top - 1, s[2]); };
  pm.ellipse(8, 13, 7.5, 2.4, s[3]);
  pm.rect(2, 9, 12, 4, s[2]); pm.hline(2, 9, 12, s[1]);
  tower(1, 4, 5); tower(11, 4, 5); tower(6, 4, 3);
  pm.rect(7, 10, 2, 3, s[4]);
  pm.vline(8, 0, 2, DWOOD[2]); pm.poly([[9, 0], [12, 1], [9, 2]], hex('#ff6b7a'));
  pm.set(3, 14, hex('#ffb8c8')); pm.set(12, 14, WHITE);
  return fin(pm, [8, 14, 8, 1.3]);
};
S.shell_lamp = () => {
  const pm = new Pixmap(16, 24), pink = R('#ffb8c8'), cream = R('#fff3e8');
  pm.rect(7, 14, 2, 8, DWOOD[2]); pm.vline(7, 14, 8, DWOOD[1]); pm.ellipse(8, 22, 4.5, 1.6, DWOOD[3]);
  pm.poly([[8, 15], [0, 7], [3, 2], [8, 0], [13, 2], [16, 7]], cream[2]);
  pm.poly([[8, 15], [3, 5], [8, 2], [13, 5]], cream[1]);
  for (const [x, y] of [[1.5, 7], [4, 2.5], [8, 1], [12, 2.5], [14.5, 7]]) pm.line(8, 15, Math.round(x), Math.round(y), pink[3]);
  for (let x = 1; x < 16; x += 3) pm.set(x, 7 - Math.round(Math.sin((x / 16) * Math.PI) * 5), pink[2]);
  pm.ellipse(8, 8, 3, 3, withAlpha(hex('#fff6c0'), 220));
  return fin(pm, [8, 23, 5, 1.2]);
};
S.hot_tub = () => {
  const pm = new Pixmap(32, 32), wd = DWOOD, wt = R('#5fd0f4');
  pm.ellipse(16, 22, 15.5, 9, wd[3]); pm.ellipse(16, 20, 15.5, 9, wd[2]); pm.ellipse(16, 20, 13, 7, wd[1]);
  pm.ellipse(16, 20, 11.5, 5.8, wt[2]); pm.ellipse(14, 18.6, 6, 2.4, wt[1]);
  for (let x = 3; x < 30; x += 4) pm.vline(x, 24, 5, wd[4]);
  for (const [x, y] of [[12, 20], [19, 21], [16, 18], [22, 19]]) pm.set(x, y, WHITE);
  for (const [x, y, a] of [[13, 10, 110], [15, 7, 90], [17, 11, 100], [19, 8, 80], [16, 4, 60]]) { pm.set(x, y, withAlpha(WHITE, a)); pm.set(x + 1, y, withAlpha(WHITE, a)); }
  return fin(pm, [16, 31, 14, 1.8]);
};
S.paper_lantern = () => {
  const pm = new Pixmap(16, 24), red = R('#ff6b5a');
  pm.rect(7, 12, 2, 11, DWOOD[2]); pm.rect(7, 12, 1, 11, DWOOD[1]); pm.ellipse(8, 22.5, 3.5, 1.3, DWOOD[3]);
  pm.rect(5, 1, 6, 2, DWOOD[2]);
  pm.ellipse(8, 7.5, 6, 5.5, red[2]); pm.ellipse(7, 6.5, 4, 3.5, red[1]); pm.ellipse(8, 7.5, 2.5, 3, hex('#ffd58a'));
  for (const x of [4, 8, 12]) pm.vline(x, 3, 9, red[3]);
  pm.rect(5, 12, 6, 2, DWOOD[2]); pm.vline(8, 14, 2, hex('#ffd84a'));
  return fin(pm, [8, 23, 5, 1.2]);
};

export function registerStructures(book) {
  const add = (name, pm) => book.add(name, pm);
  for (const [id, fn] of Object.entries(S)) {
    // animated families
    if (['campfire', 'torch', 'brazier', 'candelabra', 'lava_lamp', 'star_lantern', 'warp_pad', 'fountain', 'fireplace', 'cauldron', 'crystal_ball', 'mushroom_lamp', 'star_orb', 'portal_ring', 'fairy_ring', 'forge', 'arcane_altar', 'prism_workshop', 'star_forge', 'alchemy_table', 'world_heart'].includes(id)) {
      for (let f = 0; f < 3; f++) add(`t_${id}_a${f}`, fn(f));
      add(`t_${id}`, fn(0));
    } else if (['furnace', 'blast_furnace', 'magma_furnace'].includes(id)) { add(`t_${id}`, fn(false)); add(`t_${id}_on`, fn(true)); }
    else if (id.startsWith('drill_')) { add(`t_${id}`, fn(false, 0)); add(`t_${id}_on`, fn(true, 0)); add(`t_${id}_on1`, fn(true, 1)); }
    else if (id === 'windmill') { for (let f = 0; f < 4; f++) add(`t_windmill_a${f}`, fn(f)); add('t_windmill', fn(0)); }
    else add(`t_${id}`, fn());
  }
  for (const c of Object.keys(CROPS)) for (let s = 0; s <= 3; s++) add(`crop_${c}_${s}`, crop(c, s));
}
export const STRUCTURE_ART = S;
