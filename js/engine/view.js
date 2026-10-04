// Pixel-perfect view: the game renders into a small "art pixel" canvas which CSS upscales by an integer device-pixel factor.
export class View {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.w = 480; this.h = 270; // internal art-pixel size
    this.scale = 4; // device px per art px
    this.dpr = 1;
    this.cssScale = 4; // css px per art px
    this.bias = 0; // user zoom bias (-1, 0, +1, ...)
    this.targetH = 270; // art px tall we aim for
    this.listeners = [];
    this.resize();
  }
  resize() {
    const vw = Math.max(320, this.host.clientWidth || window.innerWidth), vh = Math.max(240, this.host.clientHeight || window.innerHeight);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const devH = vh * dpr, devW = vw * dpr;
    // aim for ~targetH art pixels tall in landscape, ~ targetH*0.62 wide-ish in portrait (so portrait isn't absurdly zoomed out)
    const aspect = vw / vh;
    const target = aspect < 1 ? this.targetH * 0.78 : this.targetH;
    let s = Math.round(devH / target) + this.bias;
    s = Math.max(2, Math.min(14, s));
    // keep at least ~300 art px across so phones/portrait still see enough
    while (devW / s < 300 && s > 2) s--;
    this.dpr = dpr; this.scale = s;
    this.w = Math.ceil(devW / s); this.h = Math.ceil(devH / s);
    this.cssScale = s / dpr;
    const c = this.canvas;
    if (c.width !== this.w) c.width = this.w;
    if (c.height !== this.h) c.height = this.h;
    c.style.width = `${this.w * this.cssScale}px`;
    c.style.height = `${this.h * this.cssScale}px`;
    this.rect = c.getBoundingClientRect();
    for (const f of this.listeners) f(this);
  }
  onResize(fn) { this.listeners.push(fn); }
  /** client (css) coords -> art pixel coords on the canvas */
  toArt(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    return [(cx - r.left) / this.cssScale, (cy - r.top) / this.cssScale];
  }
  /** art pixel -> client coords */
  toClient(ax, ay) {
    const r = this.canvas.getBoundingClientRect();
    return [r.left + ax * this.cssScale, r.top + ay * this.cssScale];
  }
  zoom(d) { this.bias = Math.max(-2, Math.min(3, this.bias + d)); this.resize(); }
}
