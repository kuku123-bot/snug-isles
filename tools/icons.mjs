// Generates the app icons (pixel-art island) as PNGs using the game's own art code.
import fs from 'node:fs';
import path from 'node:path';
import { Pixmap, hex, withAlpha } from '../js/gfx/pixmap.js';
import { SpriteBook } from '../js/gfx/atlas.js';
import { registerTerrain, composeLand, NB } from '../js/gfx/art/terrain.js';
import { registerNodes } from '../js/gfx/art/nodes.js';
import { registerFurniture } from '../js/gfx/art/furniture.js';
import { registerStructures } from '../js/gfx/art/structures.js';
import { wallSprite } from '../js/gfx/art/walls.js';
import { playerFrame } from '../js/gfx/art/player.js';
import { encodePNG } from './png.mjs';
import { hash32 } from '../js/util.js';

function scene() {
  const book = new SpriteBook();
  registerTerrain(book); registerNodes(book); registerFurniture(book); registerStructures(book);
  const W = 8, H = 8, T = 16;
  const pm = new Pixmap(W * T, H * T);
  const land = (x, y) => x >= 1 && x <= 6 && y >= 2 && y <= 6 && !((x === 1 || x === 6) && (y === 2 || y === 6));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!land(x, y)) {
      pm.blit(book.get(`water_${y >= 1 ? 'shallow' : 'deep'}_${hash32(x, y) % 3}_${(x + y) % 4}`), x * T, y * T);
      if (land(x, y - 1)) pm.blit(book.get('cliff_grass_0'), x * T, y * T);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!land(x, y)) continue;
    let mask = 0;
    if (!land(x, y - 1)) mask |= NB.N; if (!land(x + 1, y)) mask |= NB.E; if (!land(x, y + 1)) mask |= NB.S; if (!land(x - 1, y)) mask |= NB.W;
    if (!land(x + 1, y - 1)) mask |= NB.NE; if (!land(x + 1, y + 1)) mask |= NB.SE; if (!land(x - 1, y + 1)) mask |= NB.SW; if (!land(x - 1, y - 1)) mask |= NB.NW;
    pm.blit(composeLand(book.get(`g_grass_${hash32(x, y) % 4}`), 'grass', mask, null), x * T, y * T);
  }
  // little cottage
  const walls = [[2, 3], [3, 3], [4, 3], [2, 4], [4, 4]];
  for (const [x, y] of walls) pm.blit(wallSprite('plaster', x === 3 && y === 3 ? 'window' : 'wall', (x > 2 ? 4 : 0) | (x < 4 ? 2 : 0) | (y > 3 ? 1 : 0), 0), x * T, y * T - 4);
  pm.blit(wallSprite('plaster', 'door', 0, 0), 3 * T, 4 * T - 4);
  pm.blit(book.get('t_oak'), 5 * T - 8, 4 * T - 26);
  pm.blit(book.get('t_flower_bed'), 1 * T + 2, 5 * T);
  pm.blit(playerFrame({ skin: 1, hair: 2, hairColor: 4, outfit: 0, accessory: 1 }, 0, 0), 4 * T - 4, 5 * T - 8);
  pm.blit(playerFrame({ skin: 2, hair: 0, hairColor: 1, outfit: 1, accessory: 0 }, 0, 0), 5 * T - 6, 5 * T - 6);
  // heart in the sky
  const heart = new Pixmap(13, 12); const c = hex('#ff5f8a');
  heart.circle(3.5, 3.5, 3.4, c); heart.circle(9.5, 3.5, 3.4, c); heart.poly([[0.4, 4.4], [12.6, 4.4], [6.5, 11.6]], c); heart.set(2, 2, hex('#ffd0e0')); heart.set(3, 1, hex('#ffd0e0')); heart.outline(null, { amt: 0.6 });
  pm.blit(heart, 5 * T - 3, 6);
  return pm;
}

function resample(pm, size) {
  const out = new Uint32Array(size * size);
  const bg = 0xffdc8833; // ABGR of #3388dc
  out.fill(bg);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = pm.d[Math.min(pm.h - 1, Math.floor((y + 0.5) * pm.h / size)) * pm.w + Math.min(pm.w - 1, Math.floor((x + 0.5) * pm.w / size))];
    if ((c >>> 24) > 0) out[y * size + x] = c;
  }
  return Buffer.from(encodePNG(size, size, new Uint8Array(out.buffer)));
}

export async function makeIcons(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const pm = scene();
  const sizes = { 'icon-32.png': 32, 'icon-180.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
  for (const [name, size] of Object.entries(sizes)) fs.writeFileSync(path.join(dir, name), resample(pm, size));
  return Object.keys(sizes);
}
