// Contact-sheet preview: node tools/sheet.mjs <out.png> <scale> <module:register[,..]> [includeSubstr] [excludeRegex]
import { SpriteBook } from '../js/gfx/atlas.js';
import { Pixmap, hex } from '../js/gfx/pixmap.js';
import { renderText } from '../js/gfx/bitfont.js';
import { savePixmap } from './png.mjs';

const [out, scaleArg, spec, filter, exclude] = process.argv.slice(2);
const scale = +scaleArg || 3;
const book = new SpriteBook();
for (const s of spec.split(',')) { const [mod, fn] = s.split(':'); const m = await import('../js/gfx/art/' + mod + '.js'); m[fn](book); }
let names = book.names().filter((n) => !filter || n.includes(filter));
if (exclude) names = names.filter((n) => !new RegExp(exclude).test(n));
const maxW = Math.floor(1500 / scale);
// shelf layout with variable cell sizes
const cells = names.map((n) => { const pm = book.get(n); const lw = n.replace(/^t_|^i_|^g_|^m_|^f_/, '').length * 4; return { n, pm, w: Math.max(pm.w, lw) + 4, h: pm.h + 12 }; });
let x = 0, y = 0, rowH = 0; const placed = [];
for (const c of cells) { if (x + c.w > maxW) { x = 0; y += rowH; rowH = 0; } placed.push({ ...c, x, y }); x += c.w; rowH = Math.max(rowH, c.h); }
const sheet = new Pixmap(maxW, y + rowH + 2);
placed.forEach((c, i) => {
  sheet.rect(c.x, c.y, c.w - 1, c.h - 1, (i % 2) ? hex('#8fd0ec') : hex('#76bede'));
  sheet.blit(c.pm, c.x + ((c.w - c.pm.w) >> 1), c.y + 1);
  sheet.blit(renderText(c.n.replace(/^t_|^i_|^g_|^m_|^f_/, ''), hex('#1a1226'), { outline: null }), c.x + 1, c.y + c.pm.h + 3);
});
savePixmap(out, sheet, scale, hex('#000000'));
console.log(names.length, 'sprites ->', out, sheet.w * scale + 'x' + sheet.h * scale);
