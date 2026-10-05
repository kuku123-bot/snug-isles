// The "smooth look" maths, on the CPU. js/render/smooth.js runs exactly this on the GPU (a fragment shader), this copy is the reference
// the tests compare it with and what tools use to preview.
//
// Idea: every nearby art pixel votes for its own colour with a gaussian weight (by distance from the spot being drawn); the colour with the most
// votes wins that spot, and the margin between the winner and the runner-up anti-aliases the edge. Staircases turn into smooth curves, blobs get
// round, flat areas stay perfectly flat. Two guards keep the pixel art readable:
//   * colours closer than THRESHOLD count as one colour (low-contrast speckle never makes its own edges)
//   * thin lines, dots and text strokes are protected: a pixel's colour always wins at its own centre by MIN_CENTRE_MARGIN votes
//     (`bias` is an extra head start every pixel gets for its own colour; 0 lets thick shapes round off completely)

export const LOOKS = {
  smooth: { sigma: 1.0, bias: 0 }, // round: stairs become slopes, circles come out round
  soft: { sigma: 0.8, bias: 0.3 }, // gentler: corners rounded, shapes keep more of their pixel character
};
export const THRESHOLD = 24.5; // rgb distance below which two colours are "the same"
export const MIN_CENTRE_MARGIN = 0.3;
export const RAD = 2; // the vote looks at pixels within 2 steps (|dx|+|dy| <= 2: a 13-pixel diamond)
export const inFootprint = (dx, dy) => Math.abs(dx) + Math.abs(dy) <= RAD;
/** how many votes the margin changes per art pixel when crossing a straight edge (turns "one screen pixel" into vote units) */
export function edgeSlope(sigma) {
  const inv = -1 / (2 * sigma * sigma), h = 0.02;
  const f = (e) => {
    let a = 0, b = 0;
    for (let ty = -RAD; ty <= RAD; ty++) for (let tx = -RAD; tx <= RAD; tx++) {
      if (!inFootprint(tx, ty)) continue;
      const cx = tx + 0.5, cy = ty + 0.5, w = Math.exp(((cx - e) ** 2 + (cy - 0.5) ** 2) * inv);
      if (cx < 0) a += w; else b += w;
    }
    return a - b;
  };
  return (f(-h) - f(h)) / (2 * h);
}
/** the kernel sums the shader needs for a given strength */
export function kernel(sigma) {
  const inv = -1 / (2 * sigma * sigma), wc = new Float32Array(25);
  let k0 = 0;
  for (let j = -RAD; j <= RAD; j++) for (let i = -RAD; i <= RAD; i++) {
    if (!inFootprint(i, j)) continue;
    const w = Math.exp((i * i + j * j) * inv); wc[(j + RAD) * 5 + i + RAD] = w; k0 += w;
  }
  return { inv, wc, k0 };
}

/**
 * src: RGBA bytes (w*h*4, alpha ignored). Returns { data, w, h } (opaque RGBA) at kx/ky output pixels per art pixel (ky defaults to kx; both
 * may be fractional). opts: { look: 'smooth'|'soft' } or { sigma, bias }.
 */
export function smoothUpscale(src, w, h, kx, ky = kx, opts = {}) {
  const L = opts.sigma !== undefined ? opts : LOOKS[opts.look || 'smooth'];
  const { inv, wc, k0 } = kernel(L.sigma), bias = L.bias, mc = opts.minCentre ?? MIN_CENTRE_MARGIN;
  const thr2 = (opts.threshold ?? THRESHOLD) ** 2;
  const px6 = Math.max(1 / kx, 1 / ky) * 0.6, aaw = edgeSlope(L.sigma) * px6; // (px6: 0.6 of a screen pixel, in art pixels)
  const W = Math.round(w * kx), H = Math.round(h * ky), out = new Uint8ClampedArray(W * H * 4);
  const stepX = w / W, stepY = h / H;
  const idx = (x, y) => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const same = (a, b) => { const dr = src[a] - src[b], dg = src[a + 1] - src[b + 1], db = src[a + 2] - src[b + 2]; return dr * dr + dg * dg + db * db <= thr2; };
  const gx = new Float64Array(5), gy = new Float64Array(5);
  for (let oy = 0; oy < H; oy++) {
    const ty = (oy + 0.5) * stepY, cy = Math.floor(ty), fy = ty - cy, sy = fy < 0.5 ? -1 : 1;
    for (let ox = 0; ox < W; ox++) {
      const tx = (ox + 0.5) * stepX, cx = Math.floor(tx), fx = tx - cx, sx = fx < 0.5 ? -1 : 1;
      const o = (oy * W + ox) * 4;
      const C = idx(cx, cy), Hh = idx(cx + sx, cy), V = idx(cx, cy + sy), D = idx(cx + sx, cy + sy);
      let r = src[C], g = src[C + 1], b = src[C + 2];
      out[o + 3] = 255;
      if (same(C, Hh) && same(C, V) && same(C, D)) { out[o] = r; out[o + 1] = g; out[o + 2] = b; continue; }
      const v1 = !same(Hh, C), v2 = !same(V, C) && !same(V, Hh), v3 = !same(D, C) && !same(D, Hh) && !same(D, V);
      for (let i = 0; i < 5; i++) { const dx = i - 2 + 0.5 - fx, dy = i - 2 + 0.5 - fy; gx[i] = Math.exp(dx * dx * inv); gy[i] = Math.exp(dy * dy * inv); }
      const nv = (v1 ? 1 : 0) + (v2 ? 1 : 0) + (v3 ? 1 : 0);
      if (nv === 0) { out[o] = r; out[o + 1] = g; out[o + 2] = b; continue; }
      const mixIn = (L2, m) => { r += (src[L2] - r) * m; g += (src[L2 + 1] - g) * m; b += (src[L2 + 2] - b) * m; };
      const smooth01 = (t, aa) => { const u = t >= aa ? 1 : t <= 0 ? 0 : t / aa; return u * u * (3 - 2 * u); };
      if (nv === 1) {
        // the usual case: exactly two colours meet here (this pixel's and one neighbour's)
        const B = v1 ? Hh : v2 ? V : D;
        let sa = 0, sb = 0, own = 0, grx = 0, gry = 0;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          if (!inFootprint(i - 2, j - 2)) continue;
          const T = idx(cx + i - 2, cy + j - 2), w2 = gx[i] * gy[j];
          const ma = same(T, C) ? 1 : 0, mb = same(T, B) ? 1 : 0;
          sa += w2 * ma; sb += w2 * mb; own += wc[j * 5 + i] * ma;
          grx += w2 * (ma - mb) * (i - 2 + 0.5 - fx); gry += w2 * (ma - mb) * (j - 2 + 0.5 - fy);
        }
        sa += Math.max(bias, k0 - 2 * own + mc);
        const m = sa - sb;
        // edge width = one screen pixel, measured with the local steepness of the vote
        const aa = Math.max(Math.hypot(grx, gry) * (-2 * inv), 0.5) * px6;
        const win = m >= 0 ? C : B, lose = m >= 0 ? B : C;
        r = src[win]; g = src[win + 1]; b = src[win + 2];
        mixIn(lose, 0.5 * (1 - smooth01(Math.abs(m), aa)));
      } else {
        const cand = [C, Hh, V, D], score = [0, 0, 0, 0];
        let own = 0;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          if (!inFootprint(i - 2, j - 2)) continue;
          const T = idx(cx + i - 2, cy + j - 2), w2 = gx[i] * gy[j];
          if (same(T, C)) { score[0] += w2; own += wc[j * 5 + i]; }
          if (v1 && same(T, Hh)) score[1] += w2;
          if (v2 && same(T, V)) score[2] += w2;
          if (v3 && same(T, D)) score[3] += w2;
        }
        score[0] += Math.max(bias, k0 - 2 * own + mc);
        if (!v1) score[1] = -1; if (!v2) score[2] = -1; if (!v3) score[3] = -1;
        let bi = 0, bs = score[0], si = -1, ss = -1;
        for (let k = 1; k < 4; k++) { const sk = score[k]; if (sk > bs) { si = bi; ss = bs; bi = k; bs = sk; } else if (sk > ss) { si = k; ss = sk; } }
        r = src[cand[bi]]; g = src[cand[bi] + 1]; b = src[cand[bi] + 2];
        if (si >= 0 && ss >= 0) mixIn(cand[si], 0.5 * (1 - smooth01(bs - ss, aaw)));
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
  }
  return { data: out, w: W, h: H };
}

/** plain nearest-neighbour for comparison */
export function nearestUpscale(src, w, h, k) {
  const W = w * k, H = h * k, out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.floor(y / k) * w + Math.floor(x / k)) * 4, o = (y * W + x) * 4; out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2]; out[o + 3] = 255; }
  return { data: out, w: W, h: H };
}
