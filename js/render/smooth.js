// "Smooth look": a WebGL2 presenter that shows the low-res art canvas at the device's full resolution with the pixel staircases rounded off.
//
// The game still draws everything into the small art-pixel canvas (so art, hit-testing and the pixel look stay exactly as authored). This presenter
// then upscales that canvas with a small neighbourhood "vote": every nearby art pixel votes for its colour with a gaussian weight, the colour with the
// most votes wins at that spot, and the margin between the winner and runner-up anti-aliases the edge. Staircases turn into smooth curves, blobs get
// round, flat areas stay perfectly flat. Thin lines, dots and text strokes are protected (a pixel's colour always wins at its own centre) so they
// never break up. js/gfx/smooth.js has the same maths on the CPU for tests.
//
// If WebGL2 is missing, the GPU is a software renderer or too slow, the context is lost, or the player picks "Pixel", the plain pixelated canvas
// underneath simply stays visible: the 2D canvas is never hidden, the GL canvas just covers it.

import { LOOKS, THRESHOLD, MIN_CENTRE_MARGIN, kernel, edgeSlope } from '../gfx/smooth.js';
export { LOOKS };
export const LOOK_NAMES = ['smooth', 'soft', 'pixel'];

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform ivec2 uSize;
uniform vec2 uStep;
uniform float uViewH;
uniform float uInvS2;
uniform float uBias;
uniform float uThr2;
uniform float uAA;
uniform float uPx6;
uniform float uK0;
uniform float uMC;
uniform float uWc[25];
out vec4 oCol;

vec3 fetch(ivec2 p) { return texelFetch(uTex, clamp(p, ivec2(0), uSize - 1), 0).rgb; }
float same(vec3 a, vec3 b) { vec3 d = a - b; return dot(d, d) <= uThr2 ? 1.0 : 0.0; }

void main() {
  vec2 t = vec2(gl_FragCoord.x, uViewH - gl_FragCoord.y) * uStep;
  ivec2 c = ivec2(floor(t));
  vec2 f = t - vec2(c);
  ivec2 s = ivec2(f.x < 0.5 ? -1 : 1, f.y < 0.5 ? -1 : 1);
  vec3 C = fetch(c);
  vec3 H = fetch(c + ivec2(s.x, 0));
  vec3 V = fetch(c + ivec2(0, s.y));
  vec3 D = fetch(c + s);
  // all four nearest pixels are one colour: nothing to smooth here (the vote could not change the winner)
  if (same(C, H) * same(C, V) * same(C, D) > 0.5) { oCol = vec4(C, 1.0); return; }
  // candidate colours: distinct ones among the four nearest pixels
  float v1 = 1.0 - same(H, C);
  float v2 = (1.0 - same(V, C)) * (1.0 - same(V, H));
  float v3 = (1.0 - same(D, C)) * (1.0 - same(D, H)) * (1.0 - same(D, V));
  if (v1 + v2 + v3 < 0.5) { oCol = vec4(C, 1.0); return; }
  float gx[5]; float gy[5]; float ox[5]; float oy[5];
  for (int i = 0; i < 5; i++) {
    float dx = float(i - 2) + 0.5 - f.x, dy = float(i - 2) + 0.5 - f.y;
    ox[i] = dx; oy[i] = dy;
    gx[i] = exp(dx * dx * uInvS2); gy[i] = exp(dy * dy * uInvS2);
  }
  if (v1 + v2 + v3 < 1.5) {
    // the usual case: exactly two colours meet here (this pixel's and one neighbour's)
    vec3 B = v1 > 0.5 ? H : (v2 > 0.5 ? V : D);
    float sa = 0.0, sb = 0.0, own = 0.0;
    vec2 gr = vec2(0.0);
    for (int j = 0; j < 5; j++) {
      for (int i = 0; i < 5; i++) {
        if (abs(i - 2) + abs(j - 2) > 2) continue;
        vec3 T = fetch(c + ivec2(i - 2, j - 2));
        float ma = same(T, C), mb = same(T, B), w = gx[i] * gy[j];
        sa += w * ma; sb += w * mb;
        gr += (w * (ma - mb)) * vec2(ox[i], oy[j]);
        own += uWc[j * 5 + i] * ma;
      }
    }
    sa += max(uBias, uK0 - 2.0 * own + uMC);
    float m = sa - sb;
    // edge width = one screen pixel, measured with the local steepness of the vote (thin shapes stay solid, big edges stay crisp)
    float aaw = max(length(gr) * (-2.0 * uInvS2), 0.5) * uPx6;
    vec3 win = m >= 0.0 ? C : B, lose = m >= 0.0 ? B : C;
    oCol = vec4(mix(win, lose, 0.5 * (1.0 - smoothstep(0.0, aaw, abs(m)))), 1.0);
    return;
  }
  vec4 score = vec4(0.0);
  float own = 0.0;
  for (int j = 0; j < 5; j++) {
    for (int i = 0; i < 5; i++) {
      if (abs(i - 2) + abs(j - 2) > 2) continue;
      vec3 T = fetch(c + ivec2(i - 2, j - 2));
      vec4 m = vec4(same(T, C), same(T, H), same(T, V), same(T, D));
      score += (gx[i] * gy[j]) * m;
      own += uWc[j * 5 + i] * m.x;
    }
  }
  // protect thin features: this pixel's colour must still win at its own centre
  score.x += max(uBias, uK0 - 2.0 * own + uMC);
  score.y = v1 > 0.5 ? score.y : -1.0;
  score.z = v2 > 0.5 ? score.z : -1.0;
  score.w = v3 > 0.5 ? score.w : -1.0;
  vec3 cs[4] = vec3[4](C, H, V, D);
  int bi = 0; float bs = score.x;
  int si = -1; float ss = -1.0;
  for (int k = 1; k < 4; k++) {
    float sk = score[k];
    if (sk > bs) { si = bi; ss = bs; bi = k; bs = sk; }
    else if (sk > ss) { si = k; ss = sk; }
  }
  vec3 col = cs[bi];
  if (si >= 0 && ss >= 0.0) col = mix(col, cs[si], 0.5 * (1.0 - smoothstep(0.0, uAA, bs - ss)));
  oCol = vec4(col, 1.0);
}`;

export class Presenter {
  /** returns a working presenter or null (and says why in Presenter.why) */
  static create(src, opts = {}) {
    Presenter.why = '';
    try {
      const p = new Presenter(src, opts);
      return p;
    } catch (e) {
      Presenter.why = String((e && e.message) || e);
      return null;
    }
  }

  constructor(src, opts = {}) {
    this.src = src;
    this.opts = opts;
    this.look = 'smooth';
    this.ok = false;
    this.lost = false;
    this.frames = 0;
    this.bench = null;
    this.rs = 1; // render scale: <1 draws fewer pixels and lets the browser stretch them (slower GPUs)
    const cv = document.createElement('canvas');
    cv.id = 'glgame';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;touch-action:none;';
    this.canvas = cv;
    this._build();
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.ok = false; this.canvas.style.display = 'none'; });
    cv.addEventListener('webglcontextrestored', () => { try { this._build(); this.resize(this.size); this.lost = false; this.setLook(this.look); } catch (err) { Presenter.why = String(err && err.message); } });
    src.after(cv);
  }

  _build() {
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (!this.opts.force && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(this.renderer)) throw new Error('software renderer: ' + this.renderer);
    const sh = (type, text) => {
      const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    this.prog = prog;
    gl.useProgram(prog);
    this.u = {};
    for (const n of ['uTex', 'uSize', 'uStep', 'uViewH', 'uInvS2', 'uBias', 'uThr2', 'uAA', 'uPx6', 'uK0', 'uMC', 'uWc']) this.u[n] = gl.getUniformLocation(prog, n);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform1f(this.u.uThr2, (THRESHOLD / 255) ** 2);
    gl.uniform1f(this.u.uMC, MIN_CENTRE_MARGIN);
    this.texW = 0; this.texH = 0;
    this.ok = true;
  }

  /** choose strength; 'pixel' (or anything unknown) hides the GL canvas so the plain pixelated canvas shows */
  setLook(name) {
    this.look = name;
    const L = LOOKS[name];
    if (!L || !this.ok) { this.canvas.style.display = 'none'; this.active = false; return; }
    const gl = this.gl, s = L.sigma, { inv, wc, k0 } = kernel(s);
    gl.useProgram(this.prog);
    gl.uniform1f(this.u.uInvS2, inv); gl.uniform1f(this.u.uBias, L.bias); gl.uniform1f(this.u.uK0, k0); gl.uniform1fv(this.u.uWc, wc);
    this.grad = edgeSlope(s);
    this.active = true;
    this.canvas.style.display = 'block';
    this._aaDirty = true;
  }

  /** match the art canvas: device size = art size * scale; same css box as the 2D canvas */
  resize(size) {
    this.size = size;
    if (!size) return;
    const { w, h, scale, cssW, cssH } = size;
    const cv = this.canvas;
    const W = Math.max(8, Math.round(w * scale * this.rs)), H = Math.max(8, Math.round(h * scale * this.rs));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    cv.style.width = cssW; cv.style.height = cssH;
    this._aaDirty = true;
  }

  present() {
    if (!this.ok || !this.active) return;
    const gl = this.gl, src = this.src, cv = this.canvas;
    if (!cv.width || !src.width) return;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (src.width !== this.texW || src.height !== this.texH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      this.texW = src.width; this.texH = src.height; this._aaDirty = true;
    } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (this._aaDirty) {
      const sx = src.width / cv.width, sy = src.height / cv.height;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2i(this.u.uSize, src.width, src.height);
      gl.uniform2f(this.u.uStep, sx, sy);
      gl.uniform1f(this.u.uViewH, cv.height);
      gl.uniform1f(this.u.uAA, this.grad * Math.max(sx, sy) * 0.6);
      gl.uniform1f(this.u.uPx6, Math.max(sx, sy) * 0.6);
      this._aaDirty = false;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.frames++;
  }

  /** draw at a fraction of the screen's pixels (0.5..1); the browser stretches the result */
  setRenderScale(rs) { this.rs = rs; this.resize(this.size); }

  /**
   * time N frames at the real size (forces the GPU to finish) and return the fastest of a few runs, in ms per frame. Other work that was already
   * queued on the GPU (the page's own compositing, the previous frame) only ever makes a run slower, so the minimum is the shader's real cost.
   */
  benchmark(n = 10, runs = 3) {
    if (!this.ok || !this.active) return 0;
    const gl = this.gl, px = new Uint8Array(4);
    this.present(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let best = Infinity;
    for (let r = 0; r < runs; r++) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) this.present();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      best = Math.min(best, (performance.now() - t0) / n);
    }
    this.bench = best;
    return best;
  }

  /** the current picture as a PNG blob, at the screen's resolution (call in the same task as the frame's present(); `over` = canvases to lay on top, e.g. the text layer) */
  snapshot(over = []) {
    return new Promise((res) => {
      this.present();
      if (!over.length) { this.canvas.toBlob((b) => res(b), 'image/png'); return; }
      const W = Math.max(this.canvas.width, ...over.map((c) => c.width)), H = Math.max(this.canvas.height, ...over.map((c) => c.height));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(this.canvas, 0, 0, W, H);
      for (const o of over) x.drawImage(o, 0, 0, W, H);
      c.toBlob((b) => res(b), 'image/png');
    });
  }

  destroy() {
    this.active = false; this.ok = false;
    this.canvas.remove();
  }
}
