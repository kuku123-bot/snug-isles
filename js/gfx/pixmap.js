// Tiny software pixel canvas used to author all sprites in code (works in Node + browser).
// Colors are packed uint32 in little-endian RGBA order (0xAABBGGRR) so the buffer can go straight into ImageData.

export const rgba = (r, g, b, a = 255) => (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;

/** '#rgb' | '#rrggbb' | '#rrggbbaa' -> packed color */
export function hex(s) {
  s = s.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s.slice(0, 6), 16);
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}
export const R = (c) => c & 255;
export const G = (c) => (c >>> 8) & 255;
export const B = (c) => (c >>> 16) & 255;
export const A = (c) => c >>> 24;
export const css = (c) => `rgba(${R(c)},${G(c)},${B(c)},${(A(c) / 255).toFixed(3)})`;
export const withAlpha = (c, a) => ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0;

export function mixC(c1, c2, t) {
  const u = 1 - t;
  return rgba(
    Math.round(R(c1) * u + R(c2) * t),
    Math.round(G(c1) * u + G(c2) * t),
    Math.round(B(c1) * u + B(c2) * t),
    A(c1)
  );
}
const SHADOW_TINT = hex('#2b1d52'); // shadows drift toward violet
const LIGHT_TINT = hex('#fff1c4'); // highlights drift toward warm cream
export const INK = hex('#2a1f3d');
export const darker = (c, t = 0.28) => mixC(c, SHADOW_TINT, t);
export const lighter = (c, t = 0.28) => mixC(c, LIGHT_TINT, t);

/** Build a 5-tone ramp [hi2, hi, base, lo, lo2] from a base color. */
export function ramp(base) {
  return [lighter(base, 0.5), lighter(base, 0.25), base, darker(base, 0.25), darker(base, 0.5)];
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** ordered-dither threshold in [0,1) for pixel x,y */
export const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

export class Pixmap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  clone() {
    const p = new Pixmap(this.w, this.h);
    p.d.set(this.d);
    return p;
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x];
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = c;
    return this;
  }
  /** set only where currently transparent */
  under(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    if (A(this.d[y * this.w + x]) === 0) this.d[y * this.w + x] = c;
    return this;
  }
  /** alpha-composite c over the existing pixel */
  over(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const a = A(c);
    if (a === 255) { this.d[y * this.w + x] = c; return this; }
    if (a === 0) return this;
    const dst = this.d[y * this.w + x];
    const da = A(dst);
    if (da === 0) { this.d[y * this.w + x] = c; return this; }
    const t = a / 255;
    const outA = a + da * (1 - t);
    this.d[y * this.w + x] = rgba(
      Math.round(R(c) * t + R(dst) * (1 - t)),
      Math.round(G(c) * t + G(dst) * (1 - t)),
      Math.round(B(c) * t + B(dst) * (1 - t)),
      Math.round(outA)
    );
    return this;
  }
  fill(c) { this.d.fill(c); return this; }
  clear() { this.d.fill(0); return this; }
  isOpaque(x, y) { return A(this.get(x, y)) > 0; }

  rect(x, y, w, h, c) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.d[yy * this.w + xx] = c;
    return this;
  }
  /** 1px rectangle outline */
  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c).rect(x, y + h - 1, w, 1, c).rect(x, y, 1, h, c).rect(x + w - 1, y, 1, h, c);
    return this;
  }
  hline(x, y, len, c) { return this.rect(x, y, len, 1, c); }
  vline(x, y, len, c) { return this.rect(x, y, 1, len, c); }
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** Filled ellipse. Center in continuous coords (pixel centers at +0.5). */
  ellipse(cx, cy, rx, ry, c) {
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.d[y * this.w + x] = c;
      }
    }
    return this;
  }
  circle(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  /** Ring between r0 and r1 */
  ring(cx, cy, r0, r1, c) {
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) {
      for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r1 && d >= r0) this.set(x, y, c);
      }
    }
    return this;
  }
  /** Filled polygon (even-odd) from [[x,y],...] */
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs = [];
      const yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
    return this;
  }
  /** Fill every pixel p where test(x,y) is true with color(x,y) (or constant). */
  paint(test, color) {
    const isFn = typeof color === 'function';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x, y)) this.d[y * this.w + x] = isFn ? color(x, y) : color;
    return this;
  }

  /** Copy opaque pixels of src onto this at (dx,dy). */
  blit(src, dx = 0, dy = 0, o = null) {
    const fx = o ? o.flipX : false, fy = o ? o.flipY : false, tint = o ? o.tint : undefined, alpha = o ? o.alpha : undefined;
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        let c = src.d[y * src.w + x];
        if (A(c) === 0) continue;
        if (tint !== undefined) c = withAlpha(tint, A(c));
        if (alpha !== undefined) c = withAlpha(c, Math.round(A(c) * alpha));
        const px = dx + (fx ? src.w - 1 - x : x), py = dy + (fy ? src.h - 1 - y : y);
        if (A(c) === 255) this.set(px, py, c); else this.over(px, py, c);
      }
    }
    return this;
  }
  /** blit a sub-rect of src */
  blitRect(src, sx, sy, sw, sh, dx, dy) {
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const c = src.get(sx + x, sy + y);
      if (A(c) !== 0) this.set(dx + x, dy + y, c);
    }
    return this;
  }
  flipX() {
    const p = new Pixmap(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return p;
  }
  crop(x, y, w, h) {
    const p = new Pixmap(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) p.d[yy * w + xx] = this.get(x + xx, y + yy);
    return p;
  }
  /** Bounding box of opaque pixels or null */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (A(this.d[y * this.w + x])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  replace(from, to) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to;
    return this;
  }
  /** Map every opaque pixel through fn(color)->color */
  mapColors(fn) {
    for (let i = 0; i < this.d.length; i++) if (A(this.d[i])) this.d[i] = fn(this.d[i]);
    return this;
  }
  /** Same shape, flat color. Used for hit flashes. */
  silhouette(c) {
    const p = new Pixmap(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) if (A(this.d[i])) p.d[i] = withAlpha(c, A(this.d[i]));
    return p;
  }

  /**
   * 1px outline on transparent pixels touching opaque ones.
   * color === null => "selective" outline: a darkened version of the neighbouring fill (softer, cuter than pure black).
   */
  outline(color = null, o = {}) {
    const diag = !!o.diag, amt = o.amt === undefined ? 0.62 : o.amt;
    const w = this.w, h = this.h, src = this.d.slice();
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (A(src[y * w + x])) continue;
        let n = 0;
        if (op(x, y + 1)) n = src[(y + 1) * w + x];
        else if (op(x + 1, y)) n = src[y * w + x + 1];
        else if (op(x - 1, y)) n = src[y * w + x - 1];
        else if (op(x, y - 1)) n = src[(y - 1) * w + x];
        else if (diag) {
          if (op(x + 1, y + 1)) n = src[(y + 1) * w + x + 1];
          else if (op(x - 1, y + 1)) n = src[(y + 1) * w + x - 1];
          else if (op(x + 1, y - 1)) n = src[(y - 1) * w + x + 1];
          else if (op(x - 1, y - 1)) n = src[(y - 1) * w + x - 1];
        }
        if (n) this.d[y * w + x] = color === null ? withAlpha(mixC(n, INK, amt), 255) : color;
      }
    }
    return this;
  }

  /**
   * Edge-lighting: opaque pixels whose top/left neighbour is empty get lighter, bottom/right get darker.
   * only: optional Set/array of colors to affect.
   */
  bevel(o = {}) {
    const hi = o.hi === undefined ? 0.3 : o.hi, lo = o.lo === undefined ? 0.28 : o.lo;
    const only = o.only ? new Set(o.only) : null;
    const w = this.w, h = this.h, src = this.d.slice();
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A(src[y * w + x]) > 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        if (!A(c) || (only && !only.has(c))) continue;
        const top = !op(x, y - 1) || !op(x - 1, y);
        const bot = !op(x, y + 1) || !op(x + 1, y);
        if (top && !bot) this.d[y * w + x] = lighter(c, hi);
        else if (bot && !top) this.d[y * w + x] = darker(c, lo);
      }
    }
    return this;
  }

  /** Dithered vertical gradient fill inside rect (top color -> bottom color). */
  gradientV(x, y, w, h, top, bottom) {
    for (let yy = 0; yy < h; yy++) {
      const t = h <= 1 ? 0 : yy / (h - 1);
      for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, bayer(x + xx, y + yy) < t ? bottom : top);
    }
    return this;
  }
  /** Sprinkle single pixels of color c (only over opaque pixels if onlyOpaque) */
  speckle(rng, count, c, o = {}) {
    const x0 = o.x || 0, y0 = o.y || 0, w = o.w || this.w, h = o.h || this.h;
    for (let i = 0; i < count; i++) {
      const x = x0 + rng.int(w), y = y0 + rng.int(h);
      if (!o.onlyOpaque || A(this.get(x, y))) this.set(x, y, c);
    }
    return this;
  }

  /** ImageData-compatible byte view over the same memory. */
  bytes() { return new Uint8ClampedArray(this.d.buffer, this.d.byteOffset, this.d.byteLength); }
}

/**
 * Filled disc with 5-band "ball" shading, light from upper-left. pal = [hi2, hi, base, lo, lo2].
 * Dithers the band edges a little so big round shapes don't look like flat rings.
 */
export function ballShade(pm, cx, cy, rx, ry, pal, o = {}) {
  const lx = o.lx === undefined ? -0.55 : o.lx, ly = o.ly === undefined ? -0.8 : o.ly;
  const dith = o.dither === undefined ? 0.12 : o.dither;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const t = nx * lx + ny * ly + d2 * 0.35 + (bayer(x, y) - 0.5) * dith; // -1..1ish
      const idx = t < -0.62 ? 0 : t < -0.22 ? 1 : t < 0.32 ? 2 : t < 0.7 ? 3 : 4;
      pm.set(x, y, pal[idx]);
    }
  }
  return pm;
}

/** Create a pixmap from rows of characters using a {char: color} map ('.' or ' ' = transparent). */
export function fromRows(rows, map) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const pm = new Pixmap(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const c = map[ch];
      if (c === undefined) throw new Error(`fromRows: no color for '${ch}'`);
      pm.d[y * w + x] = c;
    }
  }
  return pm;
}
