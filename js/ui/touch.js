// On-screen touch controls: floating joystick, big action button (auto-aims), interact + dash buttons.
import { h, ic } from './dom.js';

export class TouchControls {
  constructor(game, root) {
    this.g = game; this.root = root;
    this.dashPressed = false;
    this.enabled = false;
    this.joyId = -1;
    this.lastIcon = '';
    this.build();
  }
  isTouchDevice() {
    return (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  }
  build() {
    const g = this.g, inp = g.input, root = this.root;
    root.replaceChildren();
    // joystick zone (bottom-left)
    this.zone = h('div', { class: 'joyzone' });
    this.base = h('div', { class: 'joybase', style: 'display:none' });
    this.knob = h('div', { class: 'joyknob', style: 'display:none' });
    this.zone.append(this.base, this.knob);
    let start = null;
    const move = (e) => {
      if (e.pointerId !== this.joyId) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const max = 54, d = Math.hypot(dx, dy), k = d > max ? max / d : 1;
      const kx = dx * k, ky = dy * k;
      this.knob.style.left = start.lx + kx + 'px'; this.knob.style.top = start.ly + ky + 'px';
      const dz = 8;
      if (d < dz) { inp.joy.x = inp.joy.y = 0; } else { const m = Math.min(1, (d - dz) / (max - dz)); inp.joy.x = (dx / d) * m; inp.joy.y = (dy / d) * m; }
      inp.joy.active = true;
      inp.lastInputKind = 'touch';
      if (d > 10) start.moved = true;
    };
    const end = (e) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = -1; inp.joy.x = inp.joy.y = 0; inp.joy.active = false;
      this.base.style.display = this.knob.style.display = 'none';
      if (start && !start.moved && performance.now() - start.t < 300) g.onTap(start.x, start.y);
      start = null;
    };
    this.zone.addEventListener('pointerdown', (e) => {
      if (this.joyId >= 0 || g.ui.blocking) return;
      this.joyId = e.pointerId; this.zone.setPointerCapture(e.pointerId);
      const r = this.zone.getBoundingClientRect();
      const lx = e.clientX - r.left, ly = e.clientY - r.top;
      start = { x: e.clientX, y: e.clientY, lx, ly, t: performance.now(), moved: false };
      this.base.style.cssText = `display:block;left:${lx}px;top:${ly}px`; this.knob.style.cssText = `display:block;left:${lx}px;top:${ly}px`;
      g.audio.unlock();
      inp.lastInputKind = 'touch';
    });
    this.zone.addEventListener('pointermove', move);
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);
    // buttons
    const holdBtn = (cls, icon, label, onDown, onUp, big = false) => {
      const b = h('div', { class: 'tbtn ' + cls }, ic(icon, big ? 3 : 2), label ? h('span', { class: 'lab' }, label) : null);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); g.audio.unlock(); inp.lastInputKind = 'touch'; onDown && onDown(); });
      const up = (e) => { b.classList.remove('on'); onUp && onUp(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      return b;
    };
    this.actionBtn = holdBtn('big', 'ui_sword', '', () => { inp.btn.use = true; g.suppressUse = false; }, () => { inp.btn.use = false; }, true);
    this.interactBtn = holdBtn('', 'ui_hand', 'Use', () => g.tryInteract(), null);
    this.dashBtn = holdBtn('sm', 'ui_dash', 'Dash', () => { this.dashPressed = true; }, null);
    this.prevBtn = holdBtn('sm', 'ui_arrow', '', () => g.selectSlot((g.me.sel + 7) % 8), null);
    this.prevBtn.firstChild.style.transform = 'scaleX(-1)';
    this.nextBtn = holdBtn('sm', 'ui_arrow', '', () => g.selectSlot((g.me.sel + 1) % 8), null);
    root.append(this.zone, this.actionBtn, this.interactBtn, this.dashBtn, this.prevBtn, this.nextBtn);
  }
  layout() {
    const g = this.g, root = this.root;
    const on = this.g.settings.touchControls === 'on' || (this.g.settings.touchControls !== 'off' && this.isTouchDevice());
    this.enabled = on;
    root.classList.toggle('hidden', !on);
    if (!on) return;
    const left = !!g.settings.leftHanded;
    const side = left ? 'left' : 'right', other = left ? 'right' : 'left';
    const pos = (el, bottom, off) => { el.style.cssText = `${side}:calc(${off}px + var(--sa${side[0]}));bottom:calc(${bottom}px + var(--sab));${other}:auto`; };
    pos(this.actionBtn, 30, 24); pos(this.interactBtn, 134, 40); pos(this.dashBtn, 36, 132);
    pos(this.prevBtn, 118, 130); pos(this.nextBtn, 190, 100);
    this.zone.style.cssText = left ? 'left:auto;right:0;bottom:0' : '';
    if (left) { this.zone.style.left = 'auto'; this.zone.style.right = '0'; }
    // keep the hotbar clear of the buttons on small screens
  }
  update(dt) {
    if (!this.enabled) return;
    const g = this.g, me = g.me;
    this.root.style.display = g.ui.blocking ? 'none' : '';
    if (!me) return;
    const building = g.builder.active;
    this.zone.classList.toggle('compact', !!building); // while building, only a corner is the joystick so the rest of the screen can paint
    this.actionBtn.style.display = building ? 'none' : '';
    this.dashBtn.style.display = building ? 'none' : '';
    this.prevBtn.style.display = this.nextBtn.style.display = building ? 'none' : '';
    const near = g.nearbyInteractable();
    this.interactBtn.style.opacity = near || building ? 1 : 0.55;
    this.interactBtn.style.display = building ? 'none' : '';
    // action icon follows the selected item
    const sel = me.inv[me.sel];
    const name = sel ? 'i_' + sel.id : 'ui_hand';
    if (name !== this.lastIcon) {
      this.lastIcon = name;
      const it = g.sprites.has(name) ? name : 'ui_sword';
      this.actionBtn.firstChild.replaceWith(ic(it, 3));
    }
  }
}
