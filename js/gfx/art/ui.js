// HUD / menu icons (16x16) and small effect sprites.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, INK } from '../pixmap.js';

const WHITE = hex('#ffffff');
const R = (c) => ramp(hex(c));

function icon(name, fn, o = {}) {
  return [name, () => { const pm = new Pixmap(16, 16); fn(pm); if (!o.noOutline) pm.outline(null, { amt: 0.62 }); return pm; }];
}
const ICONS = [
  icon('ui_heart', (pm) => { const c = R('#ff5f8a'); pm.circle(5, 6, 3.2, c[2]); pm.circle(11, 6, 3.2, c[2]); pm.poly([[1.8, 7], [14.2, 7], [8, 14.6]], c[2]); pm.set(4, 4, c[0]); pm.set(5, 4, c[1]); pm.set(3, 5, c[1]); pm.set(11, 9, c[3]); pm.set(10, 10, c[3]); }),
  icon('ui_heart_half', (pm) => { const c = R('#ff5f8a'), e = R('#a898b8'); pm.circle(5, 6, 3.2, e[2]); pm.circle(11, 6, 3.2, e[2]); pm.poly([[1.8, 7], [14.2, 7], [8, 14.6]], e[2]); pm.circle(5, 6, 3.2, c[2]); pm.poly([[1.8, 7], [8, 7], [8, 14.6]], c[2]); pm.set(4, 4, c[0]); pm.set(5, 4, c[1]); pm.set(3, 5, c[1]); }),
  icon('ui_heart_empty', (pm) => { const e = R('#b8a8c8'); pm.circle(5, 6, 3.2, e[2]); pm.circle(11, 6, 3.2, e[2]); pm.poly([[1.8, 7], [14.2, 7], [8, 14.6]], e[2]); pm.set(4, 4, e[0]); pm.set(5, 4, e[1]); }),
  icon('ui_bolt', (pm) => { const c = R('#ffe066'); pm.poly([[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6]], c[2]); pm.poly([[9, 1], [3, 9], [7, 9], [8, 6], [9, 6]], c[1]); pm.set(7, 3, WHITE); }),
  icon('ui_hunger', (pm) => { const m = R('#e08a4a'), b = R('#f4ecd8'); pm.ellipse(6, 6, 5, 4.4, m[2]); pm.poly([[3, 8], [9, 8], [11, 12], [13, 12], [13, 14], [10, 14], [8, 9]], b[2]); pm.circle(12.5, 13.5, 1.5, b[1]); pm.set(4, 4, m[0]); pm.set(5, 4, m[1]); pm.set(8, 8, m[3]); }),
  icon('ui_star', (pm) => { const c = R('#ffd84a'); pm.poly([[8, 0.5], [10, 5.6], [15.4, 6], [11.2, 9.4], [12.6, 14.8], [8, 11.8], [3.4, 14.8], [4.8, 9.4], [0.6, 6], [6, 5.6]], c[2]); pm.poly([[8, 0.5], [8, 11.8], [3.4, 14.8], [4.8, 9.4], [0.6, 6], [6, 5.6]], c[1]); pm.set(7, 5, WHITE); pm.set(6, 7, c[0]); }),
  icon('ui_bag', (pm) => { const c = R('#c88a52'); pm.ellipse(8, 10, 6.2, 5, c[2]); pm.rect(2, 8, 12, 6, c[2]); pm.rect(2, 8, 2, 6, c[1]); pm.rect(12, 8, 2, 6, c[3]); pm.rect(5, 3, 6, 3, c[3]); pm.rect(6, 2, 4, 2, c[2]); pm.rect(3, 9, 10, 1, c[3]); pm.rect(6, 10, 4, 3, c[1]); pm.rect(7, 11, 2, 1, hex('#ffd84a')); pm.set(4, 9, c[0]); }),
  icon('ui_hammer', (pm) => { const m = R('#aab4cc'), w = R('#c88a52'); pm.line(3, 14, 10, 7, w[2]); pm.line(4, 14, 11, 7, w[3]); pm.rect(7, 1, 7, 5, m[2]); pm.rect(7, 1, 7, 1, m[0]); pm.rect(13, 2, 1, 4, m[3]); pm.rect(7, 5, 7, 1, m[3]); }),
  icon('ui_house', (pm) => { const w = R('#fff0d8'), r = R('#e0604a'); pm.poly([[1, 8], [8, 1], [15, 8]], r[2]); pm.poly([[1, 8], [8, 1], [8, 8]], r[1]); pm.rect(3, 8, 10, 7, w[2]); pm.rect(3, 8, 1, 7, w[1]); pm.rect(12, 8, 1, 7, w[3]); pm.rect(7, 10, 3, 5, R('#a86f3d')[2]); pm.rect(4, 9, 2, 2, hex('#9ad8ff')); pm.rect(11, 3, 2, 3, r[3]); pm.set(9, 13, hex('#ffd84a')); }),
  icon('ui_flask', (pm) => { const g = R('#cfeeff'), l = R('#ff6f9a'); pm.rect(6, 1, 4, 5, g[1]); pm.poly([[6, 6], [10, 6], [14, 14], [2, 14]], g[1]); pm.poly([[5, 9], [11, 9], [14, 14], [2, 14]], l[2]); pm.hline(5, 9, 6, l[1]); pm.set(5, 11, l[0]); pm.set(9, 12, WHITE); pm.rect(5, 0, 6, 2, hex('#c88a52')); pm.set(7, 6, WHITE); }),
  icon('ui_skills', (pm) => { const g = R('#7ed957'); pm.rect(7, 8, 2, 7, hex('#a86f3d')); ballShade(pm, 8, 6, 6.2, 5.2, g, { dither: 0.1 }); pm.set(6, 4, hex('#fff3a8')); pm.set(10, 6, hex('#ffe066')); pm.set(8, 3, hex('#ffffff')); pm.set(5, 8, hex('#ffe066')); }),
  icon('ui_map', (pm) => { const p = R('#f4e4c0'); pm.poly([[1, 3], [5, 2], [10, 4], [15, 2], [15, 13], [10, 15], [5, 13], [1, 14]], p[2]); pm.vline(5, 2, 11, p[3]); pm.vline(10, 4, 11, p[3]); pm.set(8, 8, hex('#e0304a')); pm.set(7, 7, hex('#e0304a')); pm.set(9, 7, hex('#e0304a')); pm.set(8, 9, hex('#e0304a')); pm.line(2, 10, 4, 6, hex('#6cc24e')); pm.line(11, 11, 14, 8, hex('#6cc24e')); }),
  icon('ui_gear', (pm) => { const m = R('#aab4cc'); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; pm.rect(Math.round(8 + Math.cos(a) * 6) - 1, Math.round(8 + Math.sin(a) * 6) - 1, 3, 3, m[2]); } pm.circle(8, 8, 5, m[2]); pm.circle(8, 8, 2, hex('#3a3050')); pm.set(5, 5, m[0]); pm.set(6, 4, m[0]); }),
  icon('ui_smile', (pm) => { const c = R('#ffd84a'); pm.circle(8, 8, 6.4, c[2]); pm.circle(7, 6.4, 5, c[1]); pm.circle(8, 8, 6, c[2]); pm.rect(5, 5, 2, 3, hex('#2a1f3d')); pm.rect(10, 5, 2, 3, hex('#2a1f3d')); pm.hline(5, 11, 6, hex('#2a1f3d')); pm.set(4, 10, hex('#2a1f3d')); pm.set(11, 10, hex('#2a1f3d')); pm.set(3, 8, hex('#ff8fa8')); pm.set(12, 8, hex('#ff8fa8')); }),
  icon('ui_hand', (pm) => { const s = R('#ffdcc0'); pm.rect(5, 6, 8, 8, s[2]); for (const [x, h] of [[5, 6], [7, 8], [9, 7], [11, 6]]) pm.rect(x, 14 - h - 2, 2, h, s[2]); pm.rect(2, 8, 3, 2, s[2]); pm.rect(5, 6, 1, 8, s[1]); pm.rect(12, 6, 1, 8, s[3]); pm.hline(5, 13, 8, s[3]); }),
  icon('ui_dash', (pm) => { const w = WHITE, b = R('#8fd0ff'); pm.rect(7, 3, 7, 3, b[2]); pm.rect(2, 7, 11, 3, b[2]); pm.rect(5, 11, 8, 3, b[2]); pm.rect(7, 3, 7, 1, w); pm.rect(2, 7, 11, 1, w); pm.rect(5, 11, 8, 1, w); pm.poly([[13, 6], [15, 8.5], [13, 11]], b[3]); }),
  icon('ui_lock', (pm) => { const m = R('#aab4cc'), g = R('#ffcf45'); pm.ring(8, 5.5, 2.4, 4.4, m[2]); pm.rect(3, 7, 10, 8, g[2]); pm.rect(3, 7, 10, 1, g[0]); pm.rect(3, 14, 10, 1, g[4]); pm.rect(7, 9, 2, 3, g[4]); }),
  icon('ui_check', (pm) => { pm.line(3, 8, 6, 12, hex('#5fe08a')); pm.line(4, 8, 7, 12, hex('#5fe08a')); pm.line(6, 12, 13, 3, hex('#5fe08a')); pm.line(7, 12, 14, 3, hex('#5fe08a')); }),
  icon('ui_cross', (pm) => { pm.line(3, 3, 12, 12, hex('#ff6b7a')); pm.line(4, 3, 13, 12, hex('#ff6b7a')); pm.line(12, 3, 3, 12, hex('#ff6b7a')); pm.line(13, 3, 4, 12, hex('#ff6b7a')); }),
  icon('ui_plus', (pm) => { pm.rect(6, 3, 4, 10, WHITE); pm.rect(3, 6, 10, 4, WHITE); }),
  icon('ui_minus', (pm) => { pm.rect(3, 6, 10, 4, WHITE); }),
  icon('ui_sort', (pm) => { pm.rect(2, 3, 12, 2, WHITE); pm.rect(2, 7, 9, 2, WHITE); pm.rect(2, 11, 6, 2, WHITE); }),
  icon('ui_drop', (pm) => { const c = R('#8fd0ff'); pm.poly([[8, 1], [12, 8], [12, 11], [8, 15], [4, 11], [4, 8]], c[2]); pm.set(6, 8, WHITE); pm.set(6, 9, WHITE); }),
  icon('ui_people', (pm) => { const s = R('#ffdcc0'), a = R('#ff8fb3'), b = R('#6ba8ff'); pm.circle(5, 5, 2.6, s[2]); pm.rect(2, 8, 7, 6, a[2]); pm.circle(11, 6, 2.6, s[2]); pm.rect(8, 9, 7, 5, b[2]); pm.set(4, 4, WHITE); pm.set(10, 5, WHITE); }),
  icon('ui_link', (pm) => { const c = R('#8fb8ff'); pm.ring(5, 10, 2, 3.6, c[2]); pm.ring(11, 6, 2, 3.6, c[2]); pm.line(6, 9, 10, 7, c[1]); }),
  icon('ui_moon', (pm) => { const c = R('#fff0a0'); pm.circle(8, 8, 6, c[2]); pm.circle(11, 6, 5.2, hex('#00000000')); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 11, y + 0.5 - 6) < 5.2) pm.set(x, y, 0); pm.set(5, 9, c[3]); pm.set(6, 11, c[3]); pm.set(4, 6, c[0]); }),
  icon('ui_sun', (pm) => { const c = R('#ffd84a'); pm.circle(8, 8, 4, c[2]); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; pm.rect(Math.round(8 + Math.cos(a) * 6.6) - 0, Math.round(8 + Math.sin(a) * 6.6) - 0, 1, 1, c[1]); pm.set(Math.round(8 + Math.cos(a) * 5.6), Math.round(8 + Math.sin(a) * 5.6), c[2]); } pm.set(6, 6, WHITE); }),
  icon('ui_rain', (pm) => { const c = R('#aab4cc'); pm.circle(5, 7, 3, c[2]); pm.circle(10, 6, 3.6, c[2]); pm.rect(3, 8, 11, 3, c[2]); pm.set(5, 5, c[0]); for (const x of [4, 8, 12]) { pm.line(x, 12, x - 1, 15, hex('#6aa8ff')); } }),
  icon('ui_book', (pm) => { const c = R('#e0504a'); pm.rect(2, 2, 12, 12, c[2]); pm.rect(2, 2, 2, 12, c[3]); pm.rect(4, 2, 10, 1, c[0]); pm.rect(5, 12, 9, 1, hex('#fff6e0')); pm.rect(6, 5, 6, 1, hex('#fff6e0')); pm.rect(6, 7, 5, 1, hex('#fff6e0')); pm.set(12, 3, hex('#ffd84a')); }),
  icon('ui_cozy', (pm) => { const w = R('#fff0d8'), r = R('#ff8fb3'); pm.poly([[1, 8], [8, 2], [15, 8]], r[2]); pm.rect(3, 8, 10, 6, w[2]); pm.circle(6.5, 10.5, 1.5, hex('#ff5f8a')); pm.circle(9.5, 10.5, 1.5, hex('#ff5f8a')); pm.poly([[5.2, 11], [10.8, 11], [8, 13.6]], hex('#ff5f8a')); }),
  icon('ui_pin', (pm) => { const c = R('#ff5f8a'); pm.circle(8, 6, 4.4, c[2]); pm.poly([[4.4, 8], [11.6, 8], [8, 15]], c[2]); pm.circle(8, 6, 1.8, WHITE); pm.set(6, 4, c[0]); }),
  icon('ui_arrow', (pm) => { pm.rect(2, 6, 8, 4, WHITE); pm.poly([[9, 2], [15, 8], [9, 14]], WHITE); }),
  icon('ui_trash', (pm) => { const c = R('#aab4cc'); pm.rect(3, 4, 10, 2, c[2]); pm.rect(6, 2, 4, 2, c[2]); pm.rect(4, 6, 8, 9, c[2]); pm.rect(4, 6, 1, 9, c[1]); pm.rect(11, 6, 1, 9, c[3]); for (const x of [6, 8, 10]) pm.vline(x, 8, 5, c[4]); }),
  icon('ui_unlock', (pm) => { const m = R('#aab4cc'), g = R('#5fe08a'); pm.ring(10, 5.5, 2.2, 4, m[2]); pm.rect(3, 7, 10, 8, g[2]); pm.rect(3, 7, 10, 1, g[0]); pm.rect(7, 9, 2, 3, g[4]); }),
  icon('ui_fish', (pm) => { const c = R('#6ac8ff'); pm.ellipse(7, 8, 5.5, 3.6, c[2]); pm.poly([[11, 8], [15, 4], [15, 12]], c[3]); pm.set(4, 7, hex('#2a1f3d')); pm.set(3, 6, WHITE); }),
  icon('ui_sword', (pm) => { const b = R('#cfd6e8'); for (let i = 0; i < 9; i++) { pm.set(5 + i, 10 - i, b[1]); pm.set(6 + i, 10 - i, b[2]); } pm.line(3, 8, 8, 13, hex('#ffd84a')); pm.line(2, 13, 5, 10, hex('#a86f3d')); }),
];

export function registerUi(book) {
  for (const [name, make] of ICONS) book.add(name, make());
  // missing-sprite marker
  const m = new Pixmap(16, 16).fill(hex('#ff00ff'));
  for (let i = 0; i < 16; i += 2) for (let j = 0; j < 16; j += 2) if (((i + j) / 2) % 2) m.rect(i, j, 2, 2, hex('#2a1f3d'));
  book.add('ui_missing', m);
  // shadow blob used under characters/drops
  const sh = new Pixmap(16, 6);
  sh.ellipse(8, 3, 6.6, 2.4, withAlpha(hex('#1e1440'), 90)); sh.ellipse(8, 3, 4.6, 1.6, withAlpha(hex('#1e1440'), 60));
  book.add('fx_shadow', sh);
  // soft-edged circle used by lights (white)
  // coin spin frames for HUD
  // selection corners / build ghost frames
  const sel = new Pixmap(16, 16);
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) { for (let k = 0; k < 4; k++) { sel.set(x + sx * k, y, WHITE); sel.set(x, y + sy * k, WHITE); } }
  book.add('fx_select', sel);
  // price tag for lands
  const tag = new Pixmap(24, 16);
  tag.rect(1, 3, 22, 11, hex('#fff6dc')); tag.frame(1, 3, 22, 11, hex('#8a5a30')); tag.rect(8, 0, 8, 4, hex('#c88a52')); tag.rect(10, 1, 4, 2, hex('#fff6dc'));
  tag.outline(null, { amt: 0.6 });
  book.add('fx_tag', tag);
  // exclamation bite marker
  const ex = new Pixmap(8, 12); ex.rect(2, 0, 4, 7, hex('#ffe066')); ex.rect(2, 8, 4, 3, hex('#ffe066')); ex.rect(2, 0, 1, 7, hex('#fff3a8')); ex.outline(null, { amt: 0.6 });
  book.add('fx_bite', ex);
  // bobber
  const bob = new Pixmap(8, 8); bob.circle(4, 4, 3, hex('#ffffff')); bob.rect(1, 4, 6, 3, hex('#ff5a6a')); bob.set(3, 2, hex('#ffffff')); bob.outline(null, { amt: 0.6 });
  book.add('fx_bobber', bob);
  // arrow / bolt sprites for projectiles are drawn directly
}
