// Painting a sprite: the piece keeps all of its shading (highlights, shadows, outline) but takes on the chosen color.
// Every opaque pixel keeps how much lighter or darker it is than the piece as a whole; the average pixel becomes exactly the chosen color.
// Pure (Node + browser); the renderer asks for each (sprite, color) once and keeps the result.
import { Pixmap, A, R, G, B, rgba } from './pixmap.js';
import { colorRGB, rgbToHsl, hslToRgb } from '../data/paint.js';

const GAIN = 1.12; // a little more contrast than the original, so a pale or a very dark paint still reads as a shape
const SHADOW_HUE = 268, LIGHT_HUE = 48; // the game's shadows lean violet and its highlights lean warm; paint does too

/** move hue h toward `to` by at most `deg` degrees along the shorter way round */
function lean(h, to, deg) {
  let d = ((to - h + 540) % 360) - 180;
  if (Math.abs(d) <= deg) return to;
  return h + Math.sign(d) * deg;
}

export function tintPixmap(src, col) {
  const [tr, tg, tb] = colorRGB(col);
  const [th, ts, tl] = rgbToHsl(tr, tg, tb);
  const out = new Pixmap(src.w, src.h);
  const n = src.w * src.h;
  // the piece's overall lightness (its darkest outline pixels are left out so they do not drag it down)
  let sum = 0, cnt = 0;
  const lights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = src.d[i];
    if (!A(c)) continue;
    const l = (Math.max(R(c), G(c), B(c)) + Math.min(R(c), G(c), B(c))) / 510;
    lights[i] = l;
    if (l > 0.18) { sum += l; cnt++; }
  }
  const ref = cnt ? sum / cnt : 0.5;
  for (let i = 0; i < n; i++) {
    const c = src.d[i], a = A(c);
    if (!a) continue;
    const l = Math.max(0, Math.min(1, tl + (lights[i] - ref) * GAIN));
    const dl = l - tl;
    const hue = ts < 0.02 ? th : dl < 0 ? lean(th, SHADOW_HUE, Math.min(14, -dl * 80)) : lean(th, LIGHT_HUE, Math.min(10, dl * 60));
    const [r, g, b] = hslToRgb(hue, ts, l);
    out.d[i] = rgba(Math.round(r), Math.round(g), Math.round(b), a);
  }
  return out;
}
