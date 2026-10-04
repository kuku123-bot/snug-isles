import { Pixmap, hex } from '../js/gfx/pixmap.js';
import { wallSprite, fenceSprite } from '../js/gfx/art/walls.js';
import { WALL_MATS } from '../js/data/build.js';
import { savePixmap } from './png.mjs';
// build a little house layout per material row: 6 wide row of walls with a window + door
const mats = WALL_MATS.map((m) => m[0]);
const W = 8 * 16, rowH = 56;
const out = new Pixmap(W * 2 + 8, mats.length * rowH / 2 + 8);
out.fill(hex('#6cc24e'));
mats.forEach((mat, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const ox = 4 + col * (W + 0), oy = 4 + row * 56;
  // 2 rows: top row E-W run with window and door, plus a vertical stub below
  const layout = ['wall', 'window', 'wall', 'door', 'wall', 'window', 'wall'];
  if (mat === 'glass') layout[1] = 'wall', layout[5] = 'wall';
  for (let x = 0; x < layout.length; x++) {
    const mask = (x > 0 ? 4 : 0) | (x < layout.length - 1 ? 2 : 0);
    out.blit(wallSprite(mat, layout[x], mask, x === 3 && i % 4 === 1 ? 1 : 0), ox + x * 16, oy);
  }
  // vertical stub: walls stacked down from first and last
  for (let y = 1; y < 3; y++) for (const x of [0, 6]) out.blit(wallSprite(mat, y === 2 ? 'window' : 'wall', (1) | 0 | (0), 0), ox + x * 16, oy + y * 16);
});
savePixmap('.scratch/walls.png', out, 3, hex('#000000'));
const f = new Pixmap(16 * 8, 20 * 2 + 4); f.fill(hex('#6cc24e'));
['wood','picket','stone','iron','bone'].forEach((m, i) => { f.blit(fenceSprite(m, false, 4|2), 2 + i * 17, 2); f.blit(fenceSprite(m, true, 4|2, i%2), 2 + i * 17, 24); });
savePixmap('.scratch/fences.png', f, 4, hex('#000000'));
console.log('ok');
