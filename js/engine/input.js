// Unified input: keyboard, mouse, touch (virtual joystick/buttons feed in via the same methods), gamepad.
export const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'KeyF'],
  inventory: ['Tab', 'KeyI'], craft: ['KeyC'], build: ['KeyB'], tech: ['KeyT'], skills: ['KeyK'], map: ['KeyM'],
  menu: ['Escape'], rotate: ['KeyR'], remove: ['KeyX'], emote: ['KeyG'], zoomIn: ['Equal', 'NumpadAdd'], zoomOut: ['Minus', 'NumpadSubtract'],
  prevSlot: ['KeyQ', 'BracketLeft'], nextSlot: ['BracketRight'], chat: ['Enter'],
};
const CODE_TO_ACTION = {};
for (const a in KEYMAP) for (const c of KEYMAP[a]) (CODE_TO_ACTION[c] = CODE_TO_ACTION[c] || []).push(a);

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.edges = new Set(); // actions pressed since last frame
    this.mouse = { x: 0, y: 0, cx: 0, cy: 0, down: false, right: false, inside: false, moved: false };
    this.pointerType = 'mouse';
    this.joy = { x: 0, y: 0, active: false };
    this.btn = { use: false, dash: false, interact: false };
    this.wheel = 0;
    this.padMove = { x: 0, y: 0 };
    this.padAim = { x: 0, y: 0, active: false };
    this.padBtn = {};
    this.padPrev = {};
    this.enabled = true;
    this.typing = false;
    this.lastInputKind = 'mouse'; // 'mouse' | 'touch' | 'pad'
    this.digitPressed = -1;
    this._bind(target);
  }
  _bind(target) {
    window.addEventListener('keydown', (e) => {
      if (this.typing || e.target.closest && e.target.closest('input,textarea,select')) return;
      if (!this.enabled && e.code !== 'Escape') return;
      const acts = CODE_TO_ACTION[e.code];
      if (acts || /^Digit[1-8]$/.test(e.code)) {
        if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(e.code);
      if (acts) for (const a of acts) this.edges.add(a);
      if (/^Digit[1-8]$/.test(e.code)) this.digitPressed = +e.code.slice(5) - 1;
      this.lastInputKind = this.lastInputKind === 'touch' ? 'mouse' : this.lastInputKind;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.mouse.right = false; this.joy.active = false; this.joy.x = this.joy.y = 0; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('pointermove', (e) => {
      this.pointerType = e.pointerType;
      if (e.pointerType === 'mouse') { this.lastInputKind = 'mouse'; this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.inside = true; this.mouse.moved = true; }
    });
    target.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse.inside = false; });
    target.addEventListener('pointerdown', (e) => {
      this.pointerType = e.pointerType;
      if (e.pointerType === 'mouse') {
        this.lastInputKind = 'mouse';
        this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.inside = true;
        if (e.button === 0) this.mouse.down = true; else if (e.button === 2) this.mouse.right = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 0) this.mouse.down = false; else if (e.button === 2) this.mouse.right = false; }
    });
    target.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  /** clear per-frame edges (call at end of frame) */
  endFrame() { this.edges.clear(); this.wheel = 0; this.digitPressed = -1; this.mouse.moved = false; this._clickEdge = false; }
  pressed(a) { return this.edges.has(a); }
  down(a) { const ks = KEYMAP[a]; if (!ks) return false; for (const c of ks) if (this.keys.has(c)) return true; return false; }

  /** movement vector from keyboard + touch joystick + gamepad, length <= 1 */
  moveVec() {
    let x = 0, y = 0;
    if (this.down('left')) x -= 1; if (this.down('right')) x += 1; if (this.down('up')) y -= 1; if (this.down('down')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    x += this.joy.x + this.padMove.x; y += this.joy.y + this.padMove.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }
  get useHeld() { return this.mouse.down || this.btn.use || !!this.padBtn.use; }
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) { this.padMove.x = this.padMove.y = 0; this.padAim.active = false; this.padBtn = {}; return; }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.padMove.x = dz(pad.axes[0] || 0); this.padMove.y = dz(pad.axes[1] || 0);
    const ax = dz(pad.axes[2] || 0), ay = dz(pad.axes[3] || 0);
    this.padAim.x = ax; this.padAim.y = ay; this.padAim.active = !!(ax || ay);
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const cur = { use: b(7) || b(5) || b(0), dash: b(1) || b(4), interact: b(2), inv: b(3), menu: b(9), build: b(6), prev: b(14), next: b(15) };
    for (const k of ['dash', 'interact', 'inv', 'menu', 'build', 'prev', 'next']) if (cur[k] && !this.padPrev[k]) {
      this.lastInputKind = 'pad';
      this.edges.add(k === 'inv' ? 'inventory' : k === 'prev' ? 'prevSlot' : k === 'next' ? 'nextSlot' : k);
    }
    this.padBtn = cur; this.padPrev = cur;
    if (ax || ay || this.padMove.x || this.padMove.y || cur.use) this.lastInputKind = 'pad';
  }
}
