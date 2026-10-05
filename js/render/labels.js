// In-world text for the smooth look: name tags, floating numbers and prices are drawn with the round UI font at the screen's full resolution
// on a transparent canvas laid over the smoothed picture (instead of the chunky 3x5 pixel font baked into the art canvas).
// Positions are in art pixels (like everything the renderer draws); sizes follow the zoom so text keeps its proportions.

const FONT = "Fredoka, Nunito, 'Trebuchet MS', system-ui, sans-serif";
const INK = '#2a1f3d';

export class TextLayer {
  constructor(after) {
    const cv = document.createElement('canvas');
    cv.id = 'glabels';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;touch-action:none;';
    this.canvas = cv;
    this.ctx = cv.getContext('2d');
    this.list = [];
    this.scale = 4;
    this.dirty = false;
    this.shown = false;
    after.after(cv);
    try { if (document.fonts && document.fonts.load) document.fonts.load('700 20px Fredoka'); } catch (e) { /* the fallback font is fine */ }
  }
  /** same box as the art canvas, at full device resolution */
  resize({ w, h, scale, cssW, cssH }) {
    const cv = this.canvas;
    this.scale = scale;
    const W = Math.round(w * scale), H = Math.round(h * scale);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    cv.style.width = cssW; cv.style.height = cssH;
    this.dirty = false;
  }
  show(on) { this.shown = on; this.canvas.style.display = on ? 'block' : 'none'; if (!on) this.clear(); }
  begin() { this.list.length = 0; }
  /** t text, c fill colour, (x, y) = centre of the text in art pixels. o: { a alpha, k size factor, align 'left'|'center', stroke colour or null } */
  add(t, c, x, y, o) { this.list.push({ t, c, x, y, o }); }
  px(k = 1) { return Math.max(8, Math.round(this.scale * 4.9 * k)); }
  /** text width in art pixels */
  measure(t, k = 1) {
    const ctx = this.ctx; ctx.font = `600 ${this.px(k)}px ${FONT}`;
    return ctx.measureText(t).width / this.scale;
  }
  clear() { if (this.dirty) { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.dirty = false; } }
  flush() {
    const L = this.list;
    if (!L.length) { this.clear(); return; }
    const ctx = this.ctx, s = this.scale;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineJoin = 'round'; ctx.textBaseline = 'middle';
    let font = '';
    for (const l of L) {
      const o = l.o || {}, k = o.k || 1, px = this.px(k), f = `600 ${px}px ${FONT}`;
      if (f !== font) { ctx.font = f; font = f; }
      ctx.textAlign = o.align || 'center';
      ctx.globalAlpha = o.a === undefined ? 1 : o.a;
      const x = l.x * s, y = l.y * s + px * 0.06, stroke = o.stroke === undefined ? INK : o.stroke;
      if (stroke) { ctx.lineWidth = Math.max(3, px * 0.3); ctx.strokeStyle = stroke; ctx.strokeText(l.t, x, y); }
      ctx.fillStyle = l.c; ctx.fillText(l.t, x, y);
    }
    ctx.globalAlpha = 1;
    this.dirty = true;
  }
  destroy() { this.canvas.remove(); }
}
