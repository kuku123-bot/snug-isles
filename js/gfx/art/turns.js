// Furniture seen from the side and from behind (the views you get when you turn a piece), drawn from the same style palettes as the
// front views in furniture.js. Names: t_<id>_r1 (faces right), _r2 (faces up / seen from behind), _r3 (faces left = mirror of _r1).
import { Pixmap, hex, darker, lighter, mixC, withAlpha } from '../pixmap.js';
import { STYLES, BUILD } from '../../data/build.js';
import { DESIGN_TURNS, DECOR_TURNS, turnsOf, authoredTurns, autoKind } from '../../data/facing.js';
import { boxSide, boxBack } from './autoturn.js';
import { STYLE_PAL, patternFill, legs } from './furniture.js';
import { groundShadow } from './nodes.js';

const WHITE = hex('#ffffff');
const A = {}; // art key -> (style id | null) => Pixmap

// ---------------------------------------------------------------- chair
A.chair_side = (st) => {
  const pm = new Pixmap(16, 20), P = STYLE_PAL[st], w = P.wood, c = P.cloth;
  pm.rect(3, 14, 2, 5, w[3]); pm.set(3, 14, w[2]); pm.rect(11, 14, 2, 5, w[3]); pm.set(11, 14, w[2]);
  pm.rect(2, 1, 4, 14, w[2]); pm.rect(2, 1, 1, 14, w[1]); pm.rect(5, 1, 1, 14, w[3]); pm.hline(2, 0, 4, w[0]); pm.hline(2, 14, 4, w[4]);
  pm.rect(3, 9, 11, 5, c[2]); pm.hline(3, 9, 11, c[1]); pm.hline(3, 13, 11, c[3]); pm.vline(13, 10, 3, c[3]);
  pm.rect(6, 2, 2, 7, c[2]); pm.vline(6, 2, 7, c[1]); pm.vline(7, 3, 6, c[3]);
  if (st === 'elegant' || st === 'celestial' || st === 'rainbow') { pm.set(3, 0, P.trim[2]); pm.set(4, 0, P.trim[2]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 19, 6, 1.5, 60);
  return pm;
};
A.chair_back = (st) => {
  const pm = new Pixmap(16, 20), P = STYLE_PAL[st], w = P.wood;
  legs(pm, w, [4, 10], 14, 5);
  pm.rect(3, 12, 10, 3, w[3]);
  pm.rect(3, 1, 10, 12, w[2]); pm.hline(3, 1, 10, w[0]); pm.vline(3, 1, 12, w[1]); pm.vline(12, 1, 12, w[3]); pm.hline(3, 12, 10, w[4]);
  pm.rect(5, 3, 6, 7, w[1]); pm.frame(5, 3, 6, 7, w[3]);
  if (st === 'elegant' || st === 'celestial' || st === 'rainbow') { pm.set(6, 0, P.trim[2]); pm.set(9, 0, P.trim[2]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 19, 6, 1.5, 60);
  return pm;
};

// ---------------------------------------------------------------- sofa
A.sofa_side = (st) => {
  const pm = new Pixmap(16, 31), P = STYLE_PAL[st], w = P.wood, c = P.cloth;
  pm.rect(1, 27, 2, 4, w[3]); pm.rect(13, 27, 2, 4, w[3]);
  // far arm (north end) and the backrest running down the left
  pm.rect(0, 1, 16, 7, c[2]); pm.hline(0, 1, 16, c[1]); pm.hline(0, 7, 16, c[3]);
  pm.rect(0, 3, 6, 23, c[2]); pm.vline(0, 3, 23, c[1]); pm.vline(5, 8, 18, c[3]); pm.rect(1, 3, 4, 2, c[1]);
  // seat cushions between the arms
  pm.rect(6, 8, 10, 8, c[2]); pm.hline(6, 8, 10, c[1]); pm.hline(6, 15, 10, c[3]);
  pm.rect(6, 16, 10, 8, c[2]); pm.hline(6, 16, 10, c[1]); pm.hline(6, 23, 10, c[3]);
  patternFill(pm, 7, 9, 8, 5, st); patternFill(pm, 7, 17, 8, 5, st);
  // near arm (south end): its end panel faces us
  pm.rect(0, 23, 16, 7, c[2]); pm.hline(0, 23, 16, c[1]); pm.rect(0, 28, 16, 2, c[3]); pm.hline(0, 29, 16, c[4]); pm.vline(0, 24, 5, c[1]); pm.vline(15, 24, 5, c[3]);
  if (st === 'elegant' || st === 'celestial') { pm.set(3, 26, P.trim[2]); pm.set(12, 26, P.trim[2]); pm.hline(0, 29, 16, P.trim[3]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 30, 7, 1.4, 60);
  return pm;
};
A.sofa_back = (st) => {
  const pm = new Pixmap(32, 22), P = STYLE_PAL[st], w = P.wood, c = P.cloth;
  legs(pm, w, [2, 28], 18, 3);
  pm.rect(2, 1, 28, 17, c[2]); pm.rect(2, 1, 28, 2, c[1]); pm.hline(2, 17, 28, c[4]);
  pm.rect(0, 5, 3, 13, c[3]); pm.rect(29, 5, 3, 13, c[3]); pm.hline(0, 5, 3, c[2]); pm.hline(29, 5, 3, c[2]);
  for (const x of [11, 21]) pm.vline(x, 3, 14, c[3]);
  pm.hline(0, 18, 32, w[3]);
  if (st === 'elegant' || st === 'celestial') pm.hline(2, 1, 28, P.trim[2]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 16, 21, 14, 1.4, 60);
  return pm;
};

// ---------------------------------------------------------------- bed (rot = the way the foot points)
const PILLOW = hex('#ffffff');
function pillow(pm, x, y, w, h) { pm.rect(x, y, w, h, PILLOW); pm.hline(x, y, w, hex('#ffffff')); pm.hline(x, y + h - 1, w, hex('#d8d8f0')); pm.vline(x + w - 1, y, h, hex('#e0e0f4')); pm.set(x + 1, y + 1, hex('#f4f4ff')); }
A.bed_side = (st) => { // head on the left
  const pm = new Pixmap(32, 22), P = STYLE_PAL[st], w = P.wood;
  pm.rect(1, 18, 2, 4, w[4]); pm.rect(29, 18, 2, 4, w[4]);
  pm.rect(4, 7, 25, 11, hex('#fff6ec'));
  patternFill(pm, 13, 7, 16, 10, st); pm.rect(13, 7, 2, 10, P.cloth[1]); pm.vline(15, 7, 10, P.cloth[3]);
  pillow(pm, 5, 6, 8, 7);
  pm.rect(0, 0, 5, 19, w[2]); pm.hline(0, 0, 5, w[0]); pm.vline(0, 0, 19, w[1]); pm.vline(4, 1, 18, w[3]); pm.hline(0, 18, 5, w[4]); pm.rect(1, 2, 2, 6, w[1]);
  pm.rect(28, 6, 4, 13, w[2]); pm.hline(28, 6, 4, w[0]); pm.vline(31, 7, 12, w[3]); pm.hline(28, 18, 4, w[4]);
  pm.rect(0, 16, 32, 3, w[2]); pm.hline(0, 16, 32, w[1]); pm.hline(0, 18, 32, w[4]);
  if (st === 'elegant' || st === 'celestial') { pm.set(1, 0, P.trim[2]); pm.set(3, 0, P.trim[2]); }
  if (st === 'gothic') { pm.set(0, -1 + 1, P.trim[2]); pm.set(4, 0, P.trim[2]); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 16, 21, 15, 1.4, 60);
  return pm;
};
A.bed_back = (st) => { // head at the bottom, seen from behind the headboard
  const pm = new Pixmap(16, 32), P = STYLE_PAL[st], w = P.wood;
  pm.rect(0, 0, 16, 5, w[2]); pm.hline(0, 0, 16, w[0]); pm.hline(1, 1, 14, w[1]); pm.hline(0, 4, 16, w[3]);
  pm.rect(0, 5, 16, 21, w[2]); pm.vline(0, 5, 21, w[1]); pm.vline(15, 5, 21, w[3]);
  pm.rect(1, 5, 14, 20, hex('#fff6ec'));
  patternFill(pm, 1, 6, 14, 13, st); pm.rect(1, 6, 14, 2, P.cloth[1]); pm.hline(1, 8, 14, P.cloth[3]);
  pillow(pm, 3, 18, 10, 5);
  pm.rect(0, 23, 16, 8, w[2]); pm.hline(0, 23, 16, w[0]); pm.hline(1, 24, 14, w[1]); pm.vline(0, 23, 8, w[1]); pm.vline(15, 24, 7, w[3]); pm.hline(0, 30, 16, w[4]); pm.rect(3, 26, 10, 3, w[1]); pm.frame(3, 26, 10, 3, w[3]);
  if (st === 'elegant' || st === 'celestial') pm.rect(6, 24, 4, 1, P.trim[2]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 31, 7, 1.4, 60);
  return pm;
};

// ---------------------------------------------------------------- long table seen end-on (1x2)
A.table_side = (st) => {
  const pm = new Pixmap(16, 34), P = STYLE_PAL[st], w = P.wood;
  pm.rect(1, 29, 2, 5, w[3]); pm.rect(13, 29, 2, 5, w[3]);
  pm.rect(0, 2, 16, 28, w[1]); pm.rect(0, 1, 16, 1, w[0]); pm.vline(0, 2, 28, w[0]); pm.vline(15, 2, 28, w[2]);
  pm.rect(0, 28, 16, 2, w[2]); pm.hline(0, 29, 16, w[4]);
  pm.rect(2, 4, 12, 23, mixC(w[2], w[1], 0.4));
  if (st !== 'modern') { pm.rect(5, 3, 6, 25, P.cloth[2]); pm.vline(5, 3, 25, P.cloth[1]); pm.vline(10, 3, 25, P.cloth[3]); }
  if (st === 'rustic' || st === 'cottage') { pm.circle(8, 12, 2, WHITE); pm.rect(7, 11, 2, 2, hex('#ff8fb3')); pm.set(8, 11, hex('#ffe066')); pm.rect(7, 13, 2, 2, hex('#6aa850')); }
  if (st === 'elegant') { pm.rect(7, 9, 2, 4, hex('#fff6e0')); pm.set(7, 8, hex('#ffd84a')); pm.set(8, 7, hex('#ff9a3c')); }
  if (st === 'gothic') { pm.rect(7, 9, 2, 4, hex('#e8e0f0')); pm.set(7, 8, hex('#ffb347')); }
  if (st === 'modern') { pm.rect(5, 10, 6, 3, hex('#cfeeff')); pm.hline(5, 10, 6, WHITE); }
  if (st === 'rainbow') pm.poly([[5, 15], [11, 15], [8, 9]], hex('#9ff0e0'));
  if (st === 'celestial') { pm.circle(8, 12, 2.2, hex('#d8e0ff')); pm.set(7, 11, WHITE); }
  if (st === 'seaside' || st === 'bamboo') { pm.rect(6, 12, 4, 3, st === 'seaside' ? hex('#ffd2b8') : hex('#9ad870')); pm.hline(6, 12, 4, WHITE); }
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 33, 7, 1.4, 60);
  return pm;
};

// ---------------------------------------------------------------- cabinets: a plain side panel, a plain back
function cabSide(st, H, legH = 0) {
  const pm = new Pixmap(16, H), P = STYLE_PAL[st], w = P.wood, top = legH ? 3 : 1;
  if (legH) { legs(pm, w, [4, 10], H - legH, legH); }
  const bot = H - legH;
  pm.rect(3, top, 11, bot - top, w[2]); pm.rect(3, top - 1 < 0 ? 0 : top - 1, 11, 2, w[1]); pm.hline(3, top - 1 < 0 ? 0 : top - 1, 11, w[0]);
  pm.vline(3, top, bot - top, w[1]); pm.vline(13, top, bot - top, w[3]); pm.hline(3, bot - 1, 11, w[4]);
  const ih = Math.max(3, bot - top - 6);
  pm.rect(5, top + 3, 7, ih, w[1]); pm.frame(5, top + 3, 7, ih, w[3]);
  if (st === 'elegant' || st === 'celestial') pm.hline(5, top, 7, P.trim[2]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, H - 1, 6, 1.3, 55);
  return pm;
}
function cabBack(st, H, legH = 0) {
  const pm = new Pixmap(16, H), P = STYLE_PAL[st], w = P.wood, top = legH ? 3 : 1;
  if (legH) legs(pm, w, [1, 13], H - legH, legH);
  const bot = H - legH;
  pm.rect(0, top, 16, bot - top, w[3]); pm.rect(0, top - 1 < 0 ? 0 : top - 1, 16, 2, w[1]); pm.hline(0, top - 1 < 0 ? 0 : top - 1, 16, w[0]);
  for (let x = 3; x < 15; x += 4) pm.vline(x, top + 1, bot - top - 2, w[4]);
  pm.hline(0, bot - 1, 16, w[4]); pm.vline(0, top, bot - top, w[2]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, H - 1, 7, 1.3, 55);
  return pm;
}
A.bookshelf_side = (st) => cabSide(st, 28); A.bookshelf_back = (st) => cabBack(st, 28);
A.wardrobe_side = (st) => cabSide(st, 28); A.wardrobe_back = (st) => cabBack(st, 28);
A.dresser_side = (st) => cabSide(st, 20, 4); A.dresser_back = (st) => cabBack(st, 20, 4);
A.nightstand_side = (st) => cabSide(st, 16, 3); A.nightstand_back = (st) => cabBack(st, 16, 3);

// ---------------------------------------------------------------- garden bench
const WOODC = (c) => { const base = hex(c); return [lighter(base, 0.5), lighter(base, 0.25), base, darker(base, 0.25), darker(base, 0.5)]; };
A.bench_side = () => {
  const pm = new Pixmap(16, 34), w = WOODC('#c68a52'), dw = WOODC('#8a5a38');
  pm.rect(3, 30, 2, 4, dw[3]); pm.rect(13, 30, 2, 4, dw[3]);
  pm.rect(0, 2, 4, 28, w[2]); pm.rect(0, 2, 1, 28, w[1]); pm.rect(3, 3, 1, 26, w[3]); pm.hline(0, 1, 4, w[0]);
  pm.rect(4, 6, 12, 25, w[2]);
  for (let y = 9; y < 30; y += 5) pm.hline(4, y, 12, w[3]);
  pm.hline(4, 6, 12, w[0]); pm.hline(4, 30, 12, w[4]); pm.vline(15, 6, 25, w[3]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 8, 33, 7, 1.4, 60);
  return pm;
};
A.bench_back = () => {
  const pm = new Pixmap(32, 20), w = WOODC('#c68a52'), dw = WOODC('#8a5a38');
  for (const x of [3, 27]) pm.rect(x, 12, 2, 7, dw[3]);
  pm.rect(1, 2, 30, 11, w[2]); pm.hline(1, 2, 30, w[0]); pm.hline(1, 6, 30, w[3]); pm.hline(1, 10, 30, w[3]); pm.vline(1, 2, 11, w[1]); pm.vline(30, 3, 10, w[3]); pm.hline(1, 12, 30, w[4]);
  pm.outline(null, { amt: 0.7 }); groundShadow(pm, 16, 19, 14, 1.4, 60);
  return pm;
};

const turnPixmap = (pm, k) => { let out = pm; for (let i = 0; i < k; i++) out = out.rot90(); return out; };

/** the extra pictures a piece has beside its front (animation frames, working, variants): t_<id>_a0, _on, _v1... */
const COMPANION = /^t_(.+?)_(a\d+|on\d?|v\d)$/;

/** turned pictures for a piece that has no hand-drawn ones, made from its front picture (see data/facing.js autoKind and ./autoturn.js) */
function registerAutoTurns(book, d, tv, companions) {
  const front = book.get('t_' + d.id), w = d.w || 1, h = d.h || 1, kind = autoKind(d);
  for (let r = 1; r <= 3; r++) {
    const v = tv[r];
    let pm;
    if (v.same !== undefined) pm = v.same === 0 ? front : book.get(`t_${d.id}_r${v.same}`);
    else if (v.auto === 'mirror') pm = front.flipX();
    else if (v.auto === 'side') { pm = boxSide(front, w, h, !!v.swap); if (v.mirror) pm = pm.flipX(); }
    else if (v.auto === 'back') pm = boxBack(front);
    else if (v.auto === 'turn') pm = turnPixmap(front, v.k);
    else throw new Error('no way to make turn ' + JSON.stringify(v));
    book.add(`t_${d.id}_r${r}`, pm.clone());
    // symmetric props keep their animation, working look and variants when turned (mirrored for the mirrored turns)
    if (kind === 'sym') for (const [suffix, src] of companions) book.add(`t_${d.id}_r${r}_${suffix}`, (v.auto === 'mirror' ? src.flipX() : src.clone()));
  }
}

/** add every turned view to the sprite book (after the front views exist) */
export function registerTurns(book) {
  const styleIds = new Set(STYLES.map((s) => s.id));
  const extras = new Map(); // piece id -> [[suffix, picture]]
  for (const name of book.names()) {
    const m = COMPANION.exec(name);
    if (m && !/_r\d$/.test(m[1])) { if (!extras.has(m[1])) extras.set(m[1], []); extras.get(m[1]).push([m[2], book.get(name)]); }
  }
  for (const d of Object.values(BUILD)) {
    const tv = turnsOf(d);
    if (!tv || d.hidden) continue;
    if (!authoredTurns(d)) { registerAutoTurns(book, d, tv, extras.get(d.id) || []); continue; }
    if (d.kind === 'flat') { // rugs and blankets: simply turn the picture
      const base = book.get('t_' + d.id);
      for (let r = 1; r <= 3; r++) book.add(`t_${d.id}_r${r}`, turnPixmap(base, r));
      continue;
    }
    const cache = new Map();
    const make = (art, mirror) => {
      const key = art + (mirror ? '~' : '');
      if (!cache.has(key)) { const pm = A[art](d.set && styleIds.has(d.set) ? d.set : null); cache.set(key, mirror ? pm.flipX() : pm); }
      return cache.get(key);
    };
    for (let r = 1; r <= 3; r++) {
      let v = tv[r];
      if (v.same !== undefined) { const src = book.get(v.same === 0 ? 't_' + d.id : `t_${d.id}_r${v.same}`); book.add(`t_${d.id}_r${r}`, src.clone()); continue; }
      if (!A[v.art]) throw new Error('no art for turn ' + v.art);
      book.add(`t_${d.id}_r${r}`, make(v.art, v.mirror).clone());
    }
  }
}
export const TURN_ART = A;
