// Paint colors for building pieces: any color the players like, kept as one small number per piece.
// A color is PAINT_FLAG | r5 << 10 | g5 << 5 | b5 (5 bits per channel = 32768 colors, about 8 steps apart: far finer than the eye can tell on a 16px sprite).
// 0 means "not painted": the piece looks the way it was drawn. Walls, floors, wall decorations and furniture all carry one.

export const PAINT_FLAG = 0x8000;

const q5 = (v) => Math.max(0, Math.min(31, Math.round(v * 31 / 255)));
const x8 = (v5) => (v5 << 3) | (v5 >> 2); // 0..31 back to 0..255 (31 -> 255 exactly)

/** whatever came in (a command from the other device, an old save) as a valid color: a whole number from PAINT_FLAG to 0xffff, else 0 (not painted) */
export function normColor(v) {
  v = Number(v);
  return Number.isInteger(v) && v >= PAINT_FLAG && v <= 0xffff ? v : 0;
}
export const packColor = (r, g, b) => PAINT_FLAG | (q5(r) << 10) | (q5(g) << 5) | q5(b);
/** [r, g, b] 0..255 of a painted color */
export const colorRGB = (c) => [x8((c >> 10) & 31), x8((c >> 5) & 31), x8(c & 31)];
export function colorHex(c) {
  if (!c) return '';
  return '#' + colorRGB(c).map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** '#rgb' / '#rrggbb' (the # is optional) -> color; 0 if it is not a color */
export function hexToColor(s) {
  s = String(s || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-f]{6}$/i.test(s)) return 0;
  const n = parseInt(s, 16);
  return packColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

// ---- hue / saturation / lightness (all 0..1 except hue in degrees 0..360)
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-9) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (mx === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
export const hslToColor = (h, s, l) => packColor(...hslToRgb(h, s, l));
export const colorToHsl = (c) => rgbToHsl(...colorRGB(c));

/** the swatches the picker offers first: soft pastels (the cozy look), bright colors, then deep and neutral tones */
export const PALETTE = [
  ['Blush', '#f6b8c8'], ['Peach', '#f9c9a4'], ['Butter', '#f7e08e'], ['Mint', '#b6e2bd'], ['Seafoam', '#a9e3d8'], ['Sky', '#a9d3f2'], ['Lilac', '#cdb8ee'], ['Rose', '#e88fb0'],
  ['Red', '#e0525c'], ['Orange', '#f08a3c'], ['Yellow', '#f3cd45'], ['Green', '#5fbf5a'], ['Teal', '#3eb5a6'], ['Blue', '#4a8be0'], ['Purple', '#8a5fd0'], ['Magenta', '#d853a8'],
  ['Maroon', '#8a2f43'], ['Brown', '#8a5a3a'], ['Forest', '#2f6b4a'], ['Navy', '#2f4a8a'], ['Plum', '#5a3a7a'], ['Cream', '#f6f2ea'], ['Stone', '#9a95a3'], ['Charcoal', '#3d3a47'],
].map(([name, h]) => ({ name, color: hexToColor(h) }));
