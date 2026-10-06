// Builds the complete sprite book. Any sprite the data refers to but no art module drew gets a clearly-visible
// placeholder so the game never crashes on missing art (a test reports them so none ship).
import { SpriteBook } from '../atlas.js';
import { Pixmap, hex, ramp, withAlpha } from '../pixmap.js';
import { registerTerrain } from './terrain.js';
import { registerNodes } from './nodes.js';
import { registerMobs } from './mobs.js';
import { registerItems } from './items.js';
import { registerWalls } from './walls.js';
import { registerFurniture } from './furniture.js';
import { registerStructures } from './structures.js';
import { registerTurns } from './turns.js';
import { turnsOf } from '../../data/facing.js';
import { registerUi } from './ui.js';
import { registerPlayerBits } from './player.js';
import { renderText } from '../bitfont.js';
import { ITEMS } from '../../data/items.js';
import { NODES } from '../../data/nodes.js';
import { MOBS } from '../../data/mobs.js';
import { BUILD } from '../../data/build.js';

export function expectedSprites() {
  const names = [];
  for (const id in ITEMS) names.push('i_' + id);
  for (const id in NODES) { const n = NODES[id]; names.push('t_' + id); if (n.kind === 'node' && n.respawn > 0 || id === 'chest_wild') names.push('t_' + id + '_dep'); }
  for (const id in MOBS) names.push('m_' + id + '_0');
  for (const id in BUILD) {
    const d = BUILD[id];
    if (d.kind === 'thing' || d.kind === 'flat') { names.push('t_' + id); if (turnsOf(d) && !d.hidden) for (let r = 1; r <= 3; r++) names.push(`t_${id}_r${r}`); }
    else if (d.kind === 'floor') names.push('f_' + id.replace(/^floor_/, '').replace(/^bridge_/, 'bridge_'));
    else if (d.kind === 'walldeco') names.push('d_' + id);
    else if (d.kind === 'wall') names.push('wp_' + (d.piece === 'fence' || d.piece === 'gate' ? `${d.piece}_${d.mat}` : `${d.mat}_${d.piece}`));
  }
  return names;
}

export function buildBook() {
  const book = new SpriteBook();
  registerTerrain(book);
  registerNodes(book);
  registerMobs(book);
  registerItems(book);
  registerWalls(book);
  registerFurniture(book);
  registerStructures(book);
  registerTurns(book);
  registerPlayerBits(book);
  registerUi(book);
  const missing = [];
  for (const name of expectedSprites()) {
    if (book.has(name)) continue;
    missing.push(name);
    const pm = new Pixmap(16, 16);
    pm.rect(1, 1, 14, 14, hex('#ff8fd0')); pm.frame(1, 1, 14, 14, hex('#2a1f3d'));
    pm.blit(renderText(name.replace(/^[a-z]+_/, '').slice(0, 3), hex('#2a1f3d'), { outline: null }), 2, 5);
    book.add(name, pm);
  }
  book.missingArt = missing;
  return book;
}
