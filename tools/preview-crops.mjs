// Crops over a real farm plot, every stage, for visual checking. node tools/preview-crops.mjs [out.png] [scale]
import { SpriteBook } from '../js/gfx/atlas.js';
import { Pixmap, hex } from '../js/gfx/pixmap.js';
import { registerStructures } from '../js/gfx/art/structures.js';
import { CROPS } from '../js/data/crops.js';
import { savePixmap } from './png.mjs';
const [out = '.scratch/crops.png', sc = '8'] = process.argv.slice(2);
const book = new SpriteBook(); registerStructures(book);
const ids = Object.keys(CROPS), W = ids.length * 18 + 2, H = 4 * 18 + 2;
const sheet = new Pixmap(W, H); sheet.rect(0, 0, W, H, hex('#6cc24e'));
ids.forEach((id, ci) => { for (let st = 0; st < 4; st++) { const x = 1 + ci * 18, y = 1 + st * 18; sheet.blit(book.get('t_farm_plot'), x, y); sheet.blit(book.get(`crop_${id}_${st}`), x, y); } });
savePixmap(out, sheet, +sc, hex('#000000'));
console.log('saved', out, W * +sc + 'x' + H * +sc);
