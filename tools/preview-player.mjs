import { Pixmap, hex } from '../js/gfx/pixmap.js';
import { playerFrame, playerSleep, SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS } from '../js/gfx/art/player.js';
import { savePixmap } from './png.mjs';
const looks = [];
for (let h = 0; h < 6; h++) looks.push({ skin: h % 5, hair: h, hairColor: [0,1,3,4,5,8][h], outfit: [0,1,2,4,5,6][h], accessory: [0,1,2,3,4,5][h] });
looks.push({ skin: 2, hair: 3, hairColor: 6, outfit: 3, accessory: 6 });
looks.push({ skin: 0, hair: 4, hairColor: 9, outfit: 7, accessory: 0 });
const out = new Pixmap(8 * 76, looks.length ? 3 * 28 * 3 + 10 : 10);
const rows = 6;
const sheet = new Pixmap(looks.length * 18 * 1, 1);
const W = 4 * 18 * 3 + 6, H = looks.length * 24;
const big = new Pixmap(W, H); big.fill(hex('#8fd0ec'));
looks.forEach((l, i) => {
  let x = 2;
  for (const [dir, fr] of [[0,0],[0,1],[0,3],[1,0],[2,0],[2,1],[2,3]]) { big.blit(playerFrame(l, dir, fr), x, i * 24 + 1); x += 17; }
  big.blit(playerSleep(l), x, i * 24 + 6);
});
savePixmap('.scratch/players.png', big, 5, hex('#000000'));
console.log('ok', big.w, big.h);
