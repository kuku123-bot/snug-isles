// Furniture: 12 designs x 7 style palettes. Each sprite is bottom-aligned to its footprint (extra height extends upward).
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, bayer, INK, A } from '../pixmap.js';
import { RNG } from '../../util.js';
import { STYLES, DESIGNS } from '../../data/build.js';
import { groundShadow } from './nodes.js';

const WHITE = hex('#ffffff');
const EYE = hex('#2a1f3d');
const R = (c) => ramp(hex(c));

// style palettes: wood (frame), cloth (soft furnishings), trim (accent metal), cloth2 (secondary), pattern kind
export const STYLE_PAL = {
  rustic: { wood: R('#c68a52'), cloth: R('#e8cfa0'), cloth2: R('#d8604a'), trim: R('#8a5a30'), pat: 'check' },
  cottage: { wood: R('#fbf6ee'), cloth: R('#ffb3cc'), cloth2: R('#ffffff'), trim: R('#e8a0bc'), pat: 'flower' },
  modern: { wood: R('#8a96ae'), cloth: R('#4fd1b5'), cloth2: R('#f0f4f8'), trim: R('#d8e0ee'), pat: 'stripe' },
  elegant: { wood: R('#6a3a2a'), cloth: R('#c8304a'), cloth2: R('#ffcf45'), trim: R('#ffcf45'), pat: 'trim' },
  gothic: { wood: R('#3a3050'), cloth: R('#7a3a9a'), cloth2: R('#2a1f3d'), trim: R('#c9a0ff'), pat: 'trim' },
  rainbow: { wood: R('#f6d8ff'), cloth: R('#ff9fd0'), cloth2: R('#9ff0e0'), trim: R('#ffe48a'), pat: 'rainbow' },
  celestial: { wood: R('#3a3a7a'), cloth: R('#5a4ab8'), cloth2: R('#d8e0ff'), trim: R('#ffe48a'), pat: 'stars' },
};

function patternFill(pm, x, y, w, h, st, base) {
  const P = STYLE_PAL[st];
  const c1 = base || P.cloth, c2 = P.cloth2;
  pm.rect(x, y, w, h, c1[2]);
  switch (P.pat) {
    case 'check': for (let yy = 0; yy < h; yy += 2) for (let xx = (yy / 2) % 2 ? 0 : 2; xx < w; xx += 4) { pm.rect(x + xx, y + yy, 2, 2, c2[2]); } break;
    case 'flower': for (let yy = 1; yy < h - 1; yy += 4) for (let xx = (yy / 4) % 2 ? 1 : 3; xx < w - 1; xx += 5) { pm.set(x + xx, y + yy, c2[0]); pm.set(x + xx - 1, y + yy, c2[1]); pm.set(x + xx + 1, y + yy, c2[1]); pm.set(x + xx, y + yy - 1, c2[1]); pm.set(x + xx, y + yy + 1, c2[1]); pm.set(x + xx, y + yy, hex('#ffd84a')); } break;
    case 'stripe': for (let xx = 1; xx < w; xx += 4) pm.vline(x + xx, y, h, c2[2]); break;
    case 'trim': pm.hline(x, y, w, c2[2]); pm.hline(x, y + h - 1, w, c2[2]); for (let xx = 2; xx < w; xx += 4) pm.set(x + xx, y + h - 2, c2[1]); break;
    case 'rainbow': { const cols = ['#ff9fd0', '#ffe48a', '#9ff0e0', '#b8c8ff']; for (let xx = 0; xx < w; xx++) pm.vline(x + xx, y, h, hex(cols[Math.floor(xx / 3) % 4])); for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx++) if ((xx + yy) % 4 === 0) pm.set(x + xx, y + yy, withAlpha(WHITE, 90)); break; }
    case 'stars': for (let i = 0; i < Math.floor(w * h / 14); i++) pm.set(x + ((i * 7) % w), y + ((i * 5) % h), c2[0]); break;
  }
  // soft shading
  pm.hline(x, y, w, c1[1]); pm.hline(x, y + h - 1, w, c1[3]);
}

function legs(pm, p, xs, y, h) { for (const x of xs) { pm.rect(x, y, 2, h, p[3]); pm.set(x, y, p[2]); } }

const D = {};
D.bed = (st) => {
  const pm = new Pixmap(16, 32), P = STYLE_PAL[st], w = P.wood;
  // headboard (tall) + frame + footboard
  pm.rect(0, 0, 16, 7, w[2]); pm.rect(0, 0, 16, 1, w[0]); pm.rect(1, 0, 14, 2, w[1]); pm.rect(0, 5, 16, 2, w[3]);
  pm.rect(1, 2, 2, 4, w[1]); pm.rect(13, 2, 2, 4, w[3]);
  if (st === 'elegant' || st === 'celestial') { pm.rect(6, 1, 4, 2, P.trim[2]); pm.set(7, 1, P.trim[0]); }
  if (st === 'gothic') { pm.set(2, 0, P.trim[2]); pm.set(13, 0, P.trim[2]); pm.set(8, -1 + 1, P.trim[1]); }
  pm.rect(0, 7, 16, 24, w[2]); pm.rect(0, 7, 1, 24, w[1]); pm.rect(15, 7, 1, 24, w[3]);
  pm.rect(1, 8, 14, 21, hex('#fff6ec')); // mattress
  // pillow
  pm.rect(3, 9, 10, 5, WHITE); pm.rect(3, 9, 10, 1, hex('#ffffff')); pm.rect(3, 13, 10, 1, hex('#d8d8f0')); pm.rect(12, 9, 1, 5, hex('#e0e0f4')); pm.set(4, 10, hex('#f4f4ff'));
  // blanket
  patternFill(pm, 1, 15, 14, 14, st);
  pm.rect(1, 15, 14, 2, P.cloth[1]); pm.hline(1, 17, 14, P.cloth[3]);
  pm.rect(0, 28, 16, 4, w[2]); pm.rect(0, 28, 16, 1, w[1]); pm.rect(0, 31, 16, 1, w[4]); pm.rect(0, 30, 16, 1, w[3]);
  pm.outline(null, { amt: 0.7 });
  return pm;
};
D.chair = (st) => {
  const pm = new Pixmap(16, 20), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [4, 10], 14, 5);
  pm.rect(3, 9, 10, 5, P.cloth[2]); pm.rect(3, 9, 10, 1, P.cloth[1]); pm.rect(3, 13, 10, 1, P.cloth[3]);
  pm.rect(4, 1, 8, 9, w[2]); pm.rect(4, 1, 8, 1, w[0]); pm.rect(4, 1, 1, 9, w[1]); pm.rect(11, 1, 1, 9, w[3]);
  patternFill(pm, 5, 3, 6, 5, st);
  if (st === 'elegant' || st === 'celestial' || st === 'rainbow') { pm.set(6, 0, P.trim[2]); pm.set(9, 0, P.trim[2]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 19, 6, 1.5, 60);
  return pm;
};
D.stool = (st) => {
  const pm = new Pixmap(16, 16), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [4, 10], 9, 5); pm.rect(7, 10, 2, 4, w[3]);
  pm.ellipse(8, 8, 5.5, 3.2, P.cloth[2]); pm.ellipse(8, 7, 5, 2.5, P.cloth[1]); pm.hline(3, 9, 10, P.cloth[3]);
  pm.set(6, 6, P.cloth[0]); pm.set(7, 6, P.cloth[0]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 15, 6, 1.4, 60);
  return pm;
};
D.sofa = (st) => {
  const pm = new Pixmap(32, 22), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [2, 28], 18, 3);
  pm.rect(2, 1, 28, 10, P.cloth[2]); pm.rect(2, 1, 28, 2, P.cloth[1]); pm.rect(2, 10, 28, 1, P.cloth[3]);
  for (const x of [10, 21]) pm.vline(x, 2, 8, P.cloth[3]);
  pm.rect(0, 6, 6, 12, P.cloth[2]); pm.rect(26, 6, 6, 12, P.cloth[3]); pm.rect(0, 6, 6, 2, P.cloth[1]); pm.rect(26, 6, 6, 2, P.cloth[2]); pm.rect(0, 17, 6, 1, P.cloth[4]); pm.rect(26, 17, 6, 1, P.cloth[4]);
  pm.rect(6, 11, 20, 7, P.cloth[2]); pm.rect(6, 11, 20, 1, P.cloth[1]); pm.vline(16, 11, 7, P.cloth[3]); pm.hline(6, 17, 20, P.cloth[4]);
  patternFill(pm, 7, 12, 8, 5, st); patternFill(pm, 17, 12, 8, 5, st);
  pm.rect(0, 18, 32, 1, w[3]);
  if (st === 'elegant' || st === 'celestial') { pm.set(3, 8, P.trim[2]); pm.set(28, 8, P.trim[2]); pm.hline(2, 18, 28, P.trim[3]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 16, 21, 14, 1.4, 60);
  return pm;
};
D.table = (st) => {
  const pm = new Pixmap(32, 20), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [2, 28], 12, 7);
  pm.rect(0, 6, 32, 7, w[2]); pm.rect(0, 6, 32, 2, w[1]); pm.rect(0, 5, 32, 1, w[0]); pm.rect(0, 12, 32, 1, w[4]); pm.rect(0, 11, 32, 1, w[3]);
  pm.rect(1, 8, 30, 3, mixC(w[2], w[1], 0.4));
  // runner + decor
  if (st !== 'modern') { pm.rect(7, 6, 18, 4, P.cloth[2]); pm.hline(7, 6, 18, P.cloth[1]); pm.hline(7, 9, 18, P.cloth[3]); }
  if (st === 'rustic' || st === 'cottage') { pm.circle(16, 4, 2, hex('#ffffff')); pm.rect(15, 3, 2, 2, hex('#ff8fb3')); pm.set(16, 3, hex('#ffe066')); pm.rect(15, 5, 2, 2, hex('#6aa850')); }
  if (st === 'elegant') { pm.rect(15, 2, 2, 4, hex('#fff6e0')); pm.set(15, 1, hex('#ffd84a')); pm.set(16, 0, hex('#ff9a3c')); pm.rect(14, 6, 4, 1, P.trim[2]); }
  if (st === 'gothic') { pm.rect(15, 2, 2, 4, hex('#e8e0f0')); pm.set(15, 1, hex('#ffb347')); pm.set(15, 0, hex('#ffe066')); }
  if (st === 'modern') { pm.rect(13, 3, 6, 3, hex('#cfeeff')); pm.rect(13, 3, 6, 1, WHITE); }
  if (st === 'rainbow') { pm.poly([[13, 6], [19, 6], [16, 1]], hex('#9ff0e0')); pm.set(16, 2, WHITE); }
  if (st === 'celestial') { pm.circle(16, 3.5, 2.2, hex('#d8e0ff')); pm.set(15, 3, WHITE); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 16, 19, 14, 1.4, 60);
  return pm;
};
D.table_round = (st) => {
  const pm = new Pixmap(16, 18), P = STYLE_PAL[st], w = P.wood;
  pm.rect(7, 9, 2, 6, w[3]); pm.ellipse(8, 16, 5, 1.6, w[3]); pm.ellipse(8, 15.5, 4.4, 1.2, w[2]);
  pm.ellipse(8, 8, 7.4, 3.8, w[2]); pm.ellipse(8, 7, 7, 3.2, w[1]); pm.ellipse(8, 6.6, 5.2, 2.2, w[0]); pm.hline(2, 10, 12, w[3]);
  if (st === 'cottage' || st === 'rustic' || st === 'elegant') { pm.ellipse(8, 7, 3, 1.4, P.cloth[2]); }
  pm.rect(7, 2, 2, 3, st === 'celestial' ? hex('#d8e0ff') : hex('#fff6e0')); pm.set(7, 1, hex('#ffd84a')); pm.set(8, 0, hex('#ff9a3c'));
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 17, 6, 1.2, 55);
  return pm;
};
D.bookshelf = (st) => {
  const pm = new Pixmap(16, 28), P = STYLE_PAL[st], w = P.wood, rng = new RNG(st.length * 17);
  pm.rect(0, 1, 16, 27, w[2]); pm.rect(0, 0, 16, 2, w[1]); pm.rect(0, 0, 16, 1, w[0]); pm.rect(0, 1, 1, 27, w[1]); pm.rect(15, 1, 1, 27, w[3]); pm.rect(0, 26, 16, 2, w[3]);
  const cols = ['#e04a4a', '#4f8cff', '#5fc98a', '#ffd84a', '#b07aff', '#ff8fb3', '#ff9a3c', '#f4f4f8'];
  for (const sy of [3, 10, 17]) {
    pm.rect(2, sy, 12, 6, mixC(w[4], hex('#000000'), 0.2));
    let x = 2;
    while (x < 13) { const bw = 1 + rng.int(2), bh = 4 + rng.int(3); const c = R(rng.pick(cols)); pm.rect(x, sy + 6 - bh, bw + 1, bh, c[2]); pm.set(x, sy + 6 - bh, c[0]); pm.vline(x + bw, sy + 6 - bh, bh, c[3]); x += bw + 1; }
    pm.hline(1, sy + 6, 14, w[3]);
  }
  pm.rect(2, 24, 12, 2, w[3]);
  if (st === 'elegant' || st === 'celestial') { pm.rect(5, 0, 6, 1, P.trim[2]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 27, 7, 1.3, 55);
  return pm;
};
D.wardrobe = (st) => {
  const pm = new Pixmap(16, 28), P = STYLE_PAL[st], w = P.wood;
  pm.rect(0, 1, 16, 26, w[2]); pm.rect(0, 0, 16, 3, w[1]); pm.rect(0, 0, 16, 1, w[0]); pm.rect(0, 1, 1, 26, w[1]); pm.rect(15, 1, 1, 26, w[3]); pm.rect(0, 26, 16, 2, w[4]);
  for (const x of [2, 9]) { pm.rect(x, 4, 5, 20, w[1]); pm.frame(x, 4, 5, 20, w[3]); pm.rect(x + 1, 6, 3, 7, w[2]); pm.rect(x + 1, 15, 3, 7, w[2]); }
  pm.vline(7, 3, 22, w[4]); pm.vline(8, 3, 22, w[4]);
  pm.rect(6, 12, 1, 3, P.trim[2]); pm.rect(9, 12, 1, 3, P.trim[2]); pm.set(6, 12, P.trim[0]);
  pm.rect(1, 25, 14, 1, w[3]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 27, 7, 1.3, 55);
  return pm;
};
D.dresser = (st) => {
  const pm = new Pixmap(16, 20), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [1, 13], 16, 3);
  pm.rect(0, 4, 16, 13, w[2]); pm.rect(0, 3, 16, 2, w[1]); pm.rect(0, 3, 16, 1, w[0]); pm.rect(15, 4, 1, 13, w[3]); pm.rect(0, 16, 16, 1, w[4]);
  for (const y of [5, 9, 13]) { pm.rect(2, y, 12, 3, w[1]); pm.hline(2, y + 3, 12, w[3]); pm.rect(7, y + 1, 2, 1, P.trim[2]); }
  // little decor on top
  pm.rect(2, 0, 3, 3, hex('#cfeeff')); pm.set(3, 0, WHITE); pm.rect(11, 1, 3, 2, P.cloth[2]); pm.set(12, 0, hex('#ff8fb3')); pm.set(12, -0 + 1, hex('#ffd84a'));
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 19, 7, 1.3, 55);
  return pm;
};
D.lamp = (st) => {
  const pm = new Pixmap(16, 28), P = STYLE_PAL[st], w = P.wood;
  const glow = { rustic: '#ffd890', cottage: '#fff0c8', modern: '#e8f8ff', elegant: '#fff0a0', gothic: '#d8b8ff', rainbow: '#ffd8f4', celestial: '#d8e0ff' }[st];
  pm.rect(5, 25, 6, 2, w[3]); pm.rect(6, 24, 4, 1, w[2]); pm.rect(7, 9, 2, 15, w[2]); pm.vline(7, 9, 15, w[1]); pm.vline(8, 9, 15, w[3]);
  // shade
  pm.poly([[3, 9], [13, 9], [11, 2], [5, 2]], hex(glow)); pm.poly([[3, 9], [8, 9], [8, 2], [5, 2]], lighter(hex(glow), 0.5)); pm.poly([[8, 9], [13, 9], [11, 2], [8, 2]], darker(hex(glow), 0.12));
  pm.hline(3, 9, 10, P.trim[2]); pm.hline(5, 2, 6, P.trim[2]); pm.set(6, 5, WHITE); pm.set(6, 6, WHITE);
  if (st === 'celestial' || st === 'rainbow') { pm.set(8, 5, hex('#ffffff')); pm.set(10, 7, hex('#ffe066')); }
  pm.outline(null, { amt: 0.65 }); groundShadow(pm, 8, 27, 5, 1.1, 55);
  return pm;
};
D.rug = (st) => {
  const pm = new Pixmap(32, 32), P = STYLE_PAL[st];
  pm.ellipse(16, 16, 15.5, 14.5, P.cloth[3]);
  pm.ellipse(16, 16, 14, 13, P.cloth[2]);
  pm.ellipse(16, 16, 11, 10, P.cloth2[2]);
  pm.ellipse(16, 16, 9.4, 8.4, P.cloth[2]);
  // motif
  for (let a = 0; a < 6.28; a += 0.785) { const x = 16 + Math.cos(a) * 6.2, y = 16 + Math.sin(a) * 5.6; pm.set(Math.round(x), Math.round(y), P.cloth2[1]); pm.set(Math.round(x) + 1, Math.round(y), P.cloth2[0]); }
  pm.circle(16, 16, 2.4, P.cloth[1]); pm.set(15, 15, P.cloth2[0]); pm.set(17, 15, P.cloth2[0]); pm.set(16, 17, P.cloth2[0]);
  for (let a = 0; a < 6.28; a += 0.4) pm.set(Math.round(16 + Math.cos(a) * 15), Math.round(16 + Math.sin(a) * 14), P.cloth[4]);
  pm.outline(withAlpha(hex('#2a1f3d'), 0));
  return pm;
};
D.nightstand = (st) => {
  const pm = new Pixmap(16, 16), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [2, 12], 12, 3);
  pm.rect(1, 6, 14, 7, w[2]); pm.rect(1, 5, 14, 2, w[1]); pm.rect(1, 5, 14, 1, w[0]); pm.rect(14, 6, 1, 7, w[3]); pm.rect(1, 12, 14, 1, w[4]);
  pm.rect(3, 8, 10, 3, w[1]); pm.hline(3, 11, 10, w[3]); pm.rect(7, 9, 2, 1, P.trim[2]);
  // tiny candle / clock
  pm.rect(10, 2, 3, 3, hex('#fff6e0')); pm.set(11, 1, hex('#ffd84a')); pm.set(11, 0, hex('#ff9a3c')); pm.rect(3, 3, 3, 2, P.cloth[2]); pm.set(4, 2, hex('#ff8fb3'));
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 15.2, 6.5, 1.1, 55);
  return pm;
};

export function registerFurniture(book) {
  for (const st of STYLES) for (const [did] of DESIGNS) {
    const fn = D[did];
    if (!fn) throw new Error('no design ' + did);
    book.add(`t_${st.id}_${did}`, fn(st.id));
  }
}
export const FURNITURE_DESIGNS = D;
