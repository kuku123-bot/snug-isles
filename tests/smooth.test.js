// The "smooth look" maths (CPU reference of the shader): what it must keep, and what it must round off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothUpscale, nearestUpscale, LOOKS, THRESHOLD, edgeSlope, kernel } from '../js/gfx/smooth.js';

const BG = [102, 194, 78], FG = [42, 31, 61], LINE = [255, 224, 102];
function img(w, h, fn) { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y) || BG, o = (y * w + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } return d; }
const at = (r, x, y) => { const o = (y * r.w + x) * 4; return [r.data[o], r.data[o + 1], r.data[o + 2]]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const K = 6;

test('flat areas come out perfectly flat, at any strength and any scale', () => {
  const d = img(12, 9, () => BG);
  for (const look of ['smooth', 'soft']) for (const k of [3, 5.5, 6]) {
    const r = smoothUpscale(d, 12, 9, k, k, { look });
    for (let i = 0; i < r.data.length; i += 4) assert.deepEqual([r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]], [...BG, 255]);
  }
});

test('low-contrast speckle never makes edges of its own (it stays exactly as drawn)', () => {
  const near = [BG[0] - 10, BG[1] + 8, BG[2] - 6]; // well inside the "same colour" threshold
  const d = img(10, 10, (x, y) => ((x * 7 + y * 3) % 5 === 0 ? near : BG));
  const r = smoothUpscale(d, 10, 10, K), n = nearestUpscale(d, 10, 10, K);
  assert.deepEqual([...r.data], [...n.data]);
});

test('a single dot is protected: it keeps its colour and does not shrink', () => {
  const d = img(9, 9, (x, y) => (x === 4 && y === 4 ? FG : null));
  const r = smoothUpscale(d, 9, 9, K);
  assert.ok(dist(at(r, 4 * K + K / 2, 4 * K + K / 2), FG) < 1, 'the dot is still there');
  // the middle of each of its edges is still dot-coloured (it is not eroded)
  for (const [dx, dy] of [[K / 2, 0.5], [K - 0.5, K / 2], [K / 2, K - 0.5], [0.5, K / 2]]) { const x = Math.floor(4 * K + dx), y = Math.floor(4 * K + dy); assert.ok(dist(at(r, x, y), FG) < dist(at(r, x, y), BG), 'edge midpoint kept'); }
});

test('shapes of two pixels and up are rounded: the corner of a block is cut away', () => {
  const d = img(14, 14, (x, y) => (x >= 4 && x < 9 && y >= 4 && y < 9 ? FG : null));
  const r = smoothUpscale(d, 14, 14, K);
  assert.ok(dist(at(r, 4 * K, 4 * K), BG) < dist(at(r, 4 * K, 4 * K), FG), 'the outer corner is rounded off');
  assert.ok(dist(at(r, 6 * K + K / 2, 4 * K + 1), FG) < dist(at(r, 6 * K + K / 2, 4 * K + 1), BG), 'but the middle of the side is not');
  assert.ok(dist(at(r, 6 * K, 6 * K), FG) < 1, 'and the inside is solid');
});

test('a one-pixel line stays a connected line (thin features are protected)', () => {
  const d = img(14, 7, (x, y) => (y === 3 ? LINE : null));
  const r = smoothUpscale(d, 14, 7, K);
  const row = 3 * K + K / 2;
  for (let x = 0; x < 14 * K; x++) assert.ok(dist(at(r, x, row), LINE) < 1, `line broken at x=${x}`);
  // a diagonal one-pixel line does not fall apart either: every pixel centre keeps the line colour
  const dd = img(10, 10, (x, y) => (x === y ? LINE : null));
  const rr = smoothUpscale(dd, 10, 10, K);
  for (let i = 0; i < 10; i++) assert.ok(dist(at(rr, i * K + K / 2, i * K + K / 2), LINE) < 1, `diagonal pixel ${i} lost`);
});

test('a staircase becomes a smooth slope (much less jumpy than the plain pixels)', () => {
  // 45-degree stairs, one pixel per step
  const W = 24, d = img(W, W, (x, y) => (y > x ? FG : null));
  const edgeY = (res, x) => { // y (fractional) where the colour crosses half-way between BG and FG in this column
    for (let y = 0; y < res.h - 1; y++) { const a = dist(at(res, x, y), FG), b = dist(at(res, x, y + 1), FG), half = dist(BG, FG) / 2; if (a >= half && b < half) return y + (a - half) / (a - b); }
    return -1;
  };
  const roughness = (res) => { let s = 0, prev = null, prevSlope = null; for (let x = 4 * K; x < (W - 4) * K; x++) { const y = edgeY(res, x); if (prev !== null) { const sl = y - prev; if (prevSlope !== null) s += Math.abs(sl - prevSlope); prevSlope = sl; } prev = y; } return s; };
  const rn = roughness(nearestUpscale(d, W, W, K)), rs = roughness(smoothUpscale(d, W, W, K));
  assert.ok(rs < rn * 0.55, `smooth edge roughness ${rs.toFixed(1)} should be well under the pixel one ${rn.toFixed(1)}`);
});

test('edges are anti-aliased (in-between colours appear only along the edge)', () => {
  const d = img(12, 12, (x, y) => ((x - 5.5) ** 2 + (y - 5.5) ** 2 < 14 ? FG : null));
  const r = smoothUpscale(d, 12, 12, K);
  let mid = 0, flat = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = at(r, x, y), a = dist(c, FG), b = dist(c, BG); if (a > 4 && b > 4) mid++; else flat++; }
  assert.ok(mid > 40, 'there is an anti-aliased rim');
  assert.ok(mid < flat * 0.25, 'but most of the picture is flat colour');
});

test('every output colour is a mix of the source colours near it (nothing invented)', () => {
  const d = img(16, 16, (x, y) => (((x >> 1) + (y >> 1)) % 3 === 0 ? FG : (x + y) % 5 === 0 ? LINE : null));
  const r = smoothUpscale(d, 16, 16, K);
  const pal = [BG, FG, LINE];
  for (let i = 0; i < r.data.length; i += 4) {
    const c = [r.data[i], r.data[i + 1], r.data[i + 2]];
    // within the segment of some pair of palette colours (mix of two)
    let best = Infinity;
    for (const a of pal) for (const b of pal) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; const t = len2 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / len2)) : 0; best = Math.min(best, dist(c, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); }
    assert.ok(best < 1.5, 'colour off the palette segments');
  }
});

test('works at fractional scales and on non-square pictures, and the output is sized right', () => {
  const d = img(13, 7, (x, y) => (x > 6 ? FG : y === 3 ? LINE : null));
  const r = smoothUpscale(d, 13, 7, 5.5, 4.25);
  assert.equal(r.w, Math.round(13 * 5.5)); assert.equal(r.h, Math.round(7 * 4.25));
  for (let i = 3; i < r.data.length; i += 4) assert.equal(r.data[i], 255);
});

test('the strengths and constants are sane', () => {
  assert.ok(LOOKS.smooth.sigma > LOOKS.soft.sigma, 'smooth is stronger than soft');
  assert.ok(THRESHOLD > 8 && THRESHOLD < 60);
  const s = edgeSlope(LOOKS.smooth.sigma); assert.ok(s > 2 && s < 8, 'edge slope ' + s);
  const { k0, wc } = kernel(LOOKS.smooth.sigma); assert.ok(k0 > 3 && k0 < 7); assert.equal(wc[0], 0, 'far corner is outside the diamond');
});
