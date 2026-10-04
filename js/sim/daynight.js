// Day/night curve shared by the sim (spawning, sleep) and the renderer (lighting). Pure.
/** 0 = bright day, 1 = deep night. day 0.06-0.60, dusk 0.60-0.70, night 0.70-0.96, dawn 0.96-1.06 (wraps). */
export function nightness(phase) {
  if (phase >= 0.96) return 1 - (phase - 0.96) / 0.1;
  if (phase < 0.06) return 1 - (phase + 0.04) / 0.1;
  if (phase < 0.6) return 0;
  if (phase < 0.7) return (phase - 0.6) / 0.1;
  return 1;
}
export const phaseOf = (time, dayLength) => (time % dayLength) / dayLength;

const lerp = (a, b, t) => a + (b - a) * t;
/** multiply-colour for the lighting layer (255,255,255 = no darkening). */
export function ambientColor(phase, rain = 0, storm = 0) {
  const n = nightness(phase);
  // warm sunset/sunrise tint around the transitions
  let warm = 0;
  if (phase >= 0.56 && phase < 0.72) warm = 1 - Math.abs(phase - 0.64) / 0.08;
  else if (phase >= 0.94 || phase < 0.1) { const p = phase >= 0.94 ? phase - 0.94 : phase + 0.06; warm = 1 - Math.abs(p - 0.08) / 0.08; }
  warm = Math.max(0, Math.min(1, warm));
  // night colour is a soft blue, never fully black so it stays cozy and readable
  let r = lerp(255, 78, n), g = lerp(255, 92, n), b = lerp(255, 158, n);
  r = lerp(r, 255, warm * 0.5 * (1 - n * 0.4)); g = lerp(g, 196, warm * 0.5 * (1 - n * 0.3)); b = lerp(b, 168, warm * 0.5);
  const dim = rain ? (storm ? 0.62 : 0.8) : 1;
  return [Math.round(r * dim), Math.round(g * dim), Math.round(b * (rain ? Math.min(1, dim + 0.08) : 1))];
}
export function clockText(phase) {
  // phase 0 = 06:00
  const h = Math.floor(((phase * 24 + 6) % 24)), m = Math.floor((((phase * 24 + 6) % 24) - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`;
}
