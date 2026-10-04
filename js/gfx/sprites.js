// Browser-side sprite manager: packs the SpriteBook into an atlas canvas and keeps dynamic (lazily generated) sprites
// in extra atlas pages so every draw call samples from a handful of big textures.
import { packSprites } from './atlas.js';
import { Pixmap } from './pixmap.js';

const PAGE = 1024;

class Page {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = PAGE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.x = 0; this.y = 0; this.rowH = 0;
  }
  alloc(w, h) {
    if (this.x + w + 1 > PAGE) { this.x = 0; this.y += this.rowH + 1; this.rowH = 0; }
    if (this.y + h + 1 > PAGE) return null;
    const r = { x: this.x, y: this.y };
    this.x += w + 1;
    this.rowH = Math.max(this.rowH, h);
    return r;
  }
  put(pm, x, y) {
    const img = new ImageData(pm.bytes(), pm.w, pm.h);
    this.ctx.putImageData(img, x, y);
  }
}

export class Sprites {
  constructor(book) {
    this.book = book;
    this.map = new Map(); // name -> {page, x, y, w, h}
    this.pages = [];
    const { pixmap, rects } = packSprites(book, PAGE);
    const first = document.createElement('canvas');
    first.width = PAGE; first.height = Math.max(8, pixmap.h);
    first.getContext('2d').putImageData(new ImageData(pixmap.bytes(), pixmap.w, pixmap.h), 0, 0);
    this.staticCanvas = first;
    this.staticPage = { canvas: first };
    for (const [name, r] of rects) this.map.set(name, { page: this.staticPage, x: r.x, y: r.y, w: r.w, h: r.h });
    this.dynPages = [new Page()];
    this.dynCount = 0;
    this.urlCache = null;
    this.missing = new Set();
  }

  has(name) { return this.map.has(name); }
  get(name) {
    const s = this.map.get(name);
    if (!s) {
      if (!this.missing.has(name)) { this.missing.add(name); console.warn('missing sprite', name); }
      return this.map.get('ui_missing') || null;
    }
    return s;
  }
  /** register a sprite generated at runtime. fn() must return a Pixmap. Cached by key. */
  dyn(key, fn) {
    let s = this.map.get(key);
    if (s) return s;
    const pm = fn();
    s = this.addPixmap(key, pm);
    return s;
  }
  addPixmap(key, pm) {
    for (let i = this.dynPages.length - 1; i >= 0; i--) {
      const page = this.dynPages[i];
      const pos = page.alloc(pm.w, pm.h);
      if (pos) {
        page.put(pm, pos.x, pos.y);
        const s = { page, x: pos.x, y: pos.y, w: pm.w, h: pm.h };
        this.map.set(key, s);
        this.dynCount++;
        return s;
      }
    }
    const page = new Page();
    this.dynPages.push(page);
    return this.addPixmap(key, pm);
  }

  draw(ctx, name, x, y) {
    const s = this.get(name);
    if (s) ctx.drawImage(s.page.canvas, s.x, s.y, s.w, s.h, x | 0, y | 0, s.w, s.h);
  }
  drawS(ctx, s, x, y) { ctx.drawImage(s.page.canvas, s.x, s.y, s.w, s.h, x | 0, y | 0, s.w, s.h); }
  /** draw a part of a sprite */
  drawPart(ctx, name, sx, sy, sw, sh, x, y) {
    const s = this.get(name);
    if (s) ctx.drawImage(s.page.canvas, s.x + sx, s.y + sy, sw, sh, x | 0, y | 0, sw, sh);
  }
  size(name) { const s = this.get(name); return s ? [s.w, s.h] : [16, 16]; }

  /** horizontally mirrored copy of a (static or dynamic) sprite */
  flipped(name) {
    const key = name + '|flip';
    let s = this.map.get(key);
    if (s) return s;
    const src = this.get(name);
    const pm = this.pixmapOf(src);
    return this.addPixmap(key, pm.flipX());
  }
  /** white (or flat colored) silhouette used for hit flashes */
  silhouette(name, color = 0xffffffff) {
    const key = name + '|sil' + color;
    let s = this.map.get(key);
    if (s) return s;
    return this.addPixmap(key, this.pixmapOf(this.get(name)).silhouette(color));
  }
  pixmapOf(s) {
    const c = s.page.canvas;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(s.x, s.y, s.w, s.h);
    const pm = new Pixmap(s.w, s.h);
    pm.d.set(new Uint32Array(d.data.buffer));
    return pm;
  }

  /** CSS helpers for DOM icons: returns {url, x, y, w, h, W, H} for static sprites only */
  async prepareDom() {
    const blob = await new Promise((res) => this.staticCanvas.toBlob(res, 'image/png'));
    this.urlCache = URL.createObjectURL(blob);
    return this.urlCache;
  }
  domStyle(name, scale = 2, extra = '') {
    const s = this.map.get(name);
    if (!s || s.page !== this.staticPage || !this.urlCache) return '';
    const W = this.staticCanvas.width, H = this.staticCanvas.height;
    return `width:${s.w * scale}px;height:${s.h * scale}px;background:url(${this.urlCache}) -${s.x * scale}px -${s.y * scale}px / ${W * scale}px ${H * scale}px no-repeat;image-rendering:pixelated;${extra}`;
  }
  /** Render a sprite into a fresh canvas element (works for dynamic sprites too). */
  canvasOf(name, scale = 2) {
    const s = this.get(name);
    const c = document.createElement('canvas');
    c.width = s.w * scale; c.height = s.h * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.page.canvas, s.x, s.y, s.w, s.h, 0, 0, c.width, c.height);
    c.style.imageRendering = 'pixelated';
    return c;
  }
}
