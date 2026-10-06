// Turned pictures made from a front picture, for the pieces that have no hand-drawn side and back (stations, chests, machines, lamps, plants...).
// Nothing here is a real 3D turn; it is the trick a pixel artist would use in a hurry, and it keeps the look of the piece:
//   side view  = the plain side of the thing: what is drawn on the front (doors, windows, handles) is smoothed away, a long piece is squeezed to its new
//                depth, and when it is deeper than it was its top is stretched back so it still fills the tiles it covers
//   back view  = the same plain picture seen from behind (mirrored)
//   mirror     = round or symmetric props (a plant, a lamp, a statue): a quarter turn simply mirrors the picture
// Pure (Node + browser).
import { Pixmap, A, R, G, B } from '../pixmap.js';

const colorDist = (a, b) => Math.abs(R(a) - R(b)) + Math.abs(G(a) - G(b)) + Math.abs(B(a) - B(b));

/** smooth away what is drawn on a front: inside every row the colors far from the row's main color become that color (outline pixels are kept) */
export function plainFace(src) {
  const w = src.w, h = src.h, out = src.clone(), rowMain = new Array(h).fill(0), rowLum = new Array(h).fill(0);
  const lum = (c) => 0.3 * R(c) + 0.59 * G(c) + 0.11 * B(c);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src.d[y * w + x]) > 0;
  for (let y = 0; y < h; y++) {
    const counts = new Map();
    let n = 0;
    for (let x = 0; x < w; x++) { const c = src.d[y * w + x]; if (A(c) === 255) { counts.set(c, (counts.get(c) || 0) + 1); n++; } }
    if (n < 4) continue;
    let main = 0, best = 0;
    for (const [c, k] of counts) if (k > best) { best = k; main = c; }
    rowMain[y] = main; rowLum[y] = lum(main);
    for (let x = 0; x < w; x++) {
      const c = src.d[y * w + x];
      if (A(c) !== 255 || !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue; // the edge of the picture and soft shadows stay
      if (colorDist(c, main) > 70) out.d[y * w + x] = main;
    }
  }
  // a band of rows that is much darker (or lighter) than the rows above and below it, with those two alike, is something let into the front
  // (an oven opening, a row of piano keys, a fireplace): fill it in with what is above it
  let widest = 0;
  const widths = [];
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (A(src.d[y * w + x])) n++; widths.push(n); if (n > widest) widest = n; }
  const body = Math.max(0, widths.findIndex((n) => n >= widest * 0.85)); // what stands on top of the piece (a pot, a chimney) lies above this row and is left alone
  for (let a = body + 2; a < h - 2; a++) {
    if (!rowMain[a] || !rowMain[a - 1]) continue;
    for (let b = a; b < Math.min(h - 1, a + 8); b++) {
      if (!rowMain[b + 1]) break;
      const into = Math.abs(rowLum[a] - rowLum[a - 1]) > 45, back = Math.abs(rowLum[b + 1] - rowLum[a - 1]) < 35 && Math.abs(rowLum[b] - rowLum[a - 1]) > 45;
      if (!into || !back) continue;
      for (let y = a; y <= b; y++) for (let x = 0; x < w; x++) {
        const c = out.d[y * w + x], up = src.d[(a - 1) * w + x];
        if (A(c) === 255 && A(up) === 255 && solid(x - 1, y) && solid(x + 1, y)) out.d[y * w + x] = up;
      }
      a = b;
      break;
    }
  }
  return out;
}

/** the picture squeezed (or stretched) sideways to newW pixels; the first and last column always stay the first and last */
export function resizeX(src, newW) {
  if (newW === src.w) return src.clone();
  const out = new Pixmap(newW, src.h);
  for (let x = 0; x < newW; x++) {
    const sx = newW === 1 ? 0 : Math.round(x * (src.w - 1) / (newW - 1));
    for (let y = 0; y < src.h; y++) out.d[y * newW + x] = src.d[y * src.w + sx];
  }
  return out;
}

/** make the piece look deeper: the first row that is (nearly) as wide as the piece is repeated `rows` more times, so its top reaches further back */
export function extendTop(src, rows) {
  if (rows <= 0) return src.clone();
  const w = src.w, h = src.h;
  let widest = 0;
  const widths = [];
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (A(src.d[y * w + x])) n++; widths.push(n); if (n > widest) widest = n; }
  let at = widths.findIndex((n) => n >= widest * 0.85);
  if (at < 0) at = 0;
  at = Math.min(h - 1, at + 1); // one row below the edge, so the outline on top stays on top
  const out = new Pixmap(w, h + rows);
  for (let y = 0; y < h + rows; y++) {
    const sy = y < at ? y : y < at + rows ? at : y - rows;
    for (let x = 0; x < w; x++) out.d[y * w + x] = src.d[sy * w + x];
  }
  return out;
}

/**
 * the piece seen from the side. front = its picture; (w, h) = its footprint in tiles as built; swap = the turned piece covers h x w tiles.
 * Without a swap the picture keeps its size and is just the plain side.
 */
export function boxSide(front, w, h, swap) {
  let pm = plainFace(front);
  if (swap && w !== h) {
    const newW = h * 16, deeper = (w - h) * 16; // the new width is the old depth; the new depth is the old width (so a long piece turned sideways is deeper)
    pm = resizeX(pm, newW);
    if (deeper > 0) pm = extendTop(pm, Math.round(deeper * 0.5));
  }
  return pm;
}

/** the piece seen from behind */
export const boxBack = (front) => plainFace(front).flipX();

/**
 * A window, door or gate turned: `plain` is the same wall (same material and neighbours) without the opening, `piece` the picture with it. Only the opening
 * is turned, so the wall keeps its edges and stays joined to its neighbours: rot 2 (from behind) mirrors it, a quarter turn shows it from the side,
 * narrower and to one side (1 = to the right, 3 = to the left).
 */
export function turnOpening(plain, piece, rot) {
  if (!rot) return piece;
  const out = plain.clone(), mid = (piece.w - 1) / 2;
  for (let y = 0; y < piece.h; y++) for (let x = 0; x < piece.w; x++) {
    const c = piece.d[y * piece.w + x];
    if (c === plain.d[y * plain.w + x]) continue; // part of the wall, not of the opening
    const nx = rot === 2 ? piece.w - 1 - x : Math.round(mid + (x - mid) * 0.5 + (rot === 1 ? 3 : -3));
    if (nx >= 0 && nx < out.w) out.d[y * out.w + nx] = c;
  }
  return out;
}
