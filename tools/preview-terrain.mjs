import { SpriteBook } from '../js/gfx/atlas.js';
import { Pixmap, hex } from '../js/gfx/pixmap.js';
import { registerTerrain, composeLand, NB, GROUND_KINDS } from '../js/gfx/art/terrain.js';
import { hashf, hash32 } from '../js/util.js';
import { savePixmap } from './png.mjs';

const book = new SpriteBook(); registerTerrain(book);
// map: 3 lands side by side (grass, desert, snow) + second row (swamp, grave, volcano) with water around
const W = 44, H = 30;
const kindAt = (x, y) => {
  const lx = Math.floor((x - 2) / 12), ly = Math.floor((y - 2) / 12);
  if (x < 2 || y < 2 || lx < 0 || lx > 2 || ly < 0 || ly > 1) return null;
  // chop some corners for shape
  const ix = (x - 2) % 12, iy = (y - 2) % 12;
  if (ix > 10 || iy > 10) { if (hash32(x, y) % 3 === 0 && !(x === 2)) return null; }
  return [['grass', 'sand', 'snow'], ['swamp', 'grave', 'volcano']][ly][lx];
};
const out = new Pixmap(W * 16, H * 16 + 16);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = kindAt(x, y);
  const nbWater = (dx, dy) => kindAt(x + dx, y + dy) === null;
  if (!k) {
    // water
    const near = [-2,-1,0,1,2].some(dy => [-2,-1,0,1,2].some(dx => kindAt(x+dx,y+dy)));
    const tone = near ? 'shallow' : 'deep';
    out.blit(book.get(`water_${tone}_${hash32(x,y)%3}_${(x+y)%4}`), x*16, y*16);
    for (const [s,dx,dy] of [['n',0,-1],['s',0,1],['w',-1,0],['e',1,0]]) if (kindAt(x+dx,y+dy)) { if (s !== 'n') out.blit(book.get(`foam_${s}_0`), x*16, y*16); }
    if (kindAt(x, y-1)) {
      const lk = kindAt(x, y-1);
      const m = (kindAt(x-1,y-1) ? 0 : 1) | (kindAt(x+1,y-1) ? 0 : 2);
      out.blit(book.get(`cliff_${lk}_${m}`), x*16, y*16);
    }
    continue;
  }
  let mask = 0;
  if (nbWater(0,-1)) mask |= NB.N; if (nbWater(1,0)) mask |= NB.E; if (nbWater(0,1)) mask |= NB.S; if (nbWater(-1,0)) mask |= NB.W;
  if (nbWater(1,-1)) mask |= NB.NE; if (nbWater(1,1)) mask |= NB.SE; if (nbWater(-1,1)) mask |= NB.SW; if (nbWater(-1,-1)) mask |= NB.NW;
  const v = hash32(x, y) % 4;
  const base = book.get(`g_${k}_${v}`);
  const nb = {};
  for (const [s,dx,dy] of [['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]]) { const o = kindAt(x+dx,y+dy); nb[s] = o && o !== k ? book.get(`g_${o}_${hash32(x+dx,y+dy)%4}`) : null; }
  out.blit(composeLand(base, k, mask, nb), x*16, y*16);
  if (hashf(x, y, 5) < 0.22) out.blit(book.get(`deco_${k}_${hash32(x,y,9)%4}`), x*16, y*16);
}
savePixmap('.scratch/terrain.png', out, 2, hex('#000000'));
console.log('ok', out.w, out.h);
