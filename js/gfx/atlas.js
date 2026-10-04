// Sprite book + shelf packer. Pure (works in Node for previews); the browser wraps the packed Pixmap in a canvas.
import { Pixmap } from './pixmap.js';

export class SpriteBook {
  constructor() {
    this.sprites = new Map(); // name -> Pixmap
  }
  add(name, pm) {
    if (this.sprites.has(name)) throw new Error('duplicate sprite ' + name);
    this.sprites.set(name, pm);
    return pm;
  }
  has(name) { return this.sprites.has(name); }
  get(name) {
    const s = this.sprites.get(name);
    if (!s) throw new Error('missing sprite ' + name);
    return s;
  }
  names() { return [...this.sprites.keys()]; }
}

/**
 * Pack all sprites of a book into one Pixmap using simple shelves (sorted by height).
 * Returns { pixmap, rects: Map(name -> {x,y,w,h}) }
 */
export function packSprites(book, width = 1024, pad = 1) {
  const items = [...book.sprites.entries()].map(([name, pm]) => ({ name, pm }));
  items.sort((a, b) => b.pm.h - a.pm.h || b.pm.w - a.pm.w);
  const rects = new Map();
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    if (x + it.pm.w + pad > width) { x = 0; y += rowH + pad; rowH = 0; }
    rects.set(it.name, { x, y, w: it.pm.w, h: it.pm.h });
    x += it.pm.w + pad;
    rowH = Math.max(rowH, it.pm.h);
  }
  const H = y + rowH + pad;
  const out = new Pixmap(width, H);
  for (const it of items) {
    const r = rects.get(it.name);
    out.blit(it.pm, r.x, r.y);
  }
  return { pixmap: out, rects };
}
