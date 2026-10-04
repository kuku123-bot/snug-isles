// UI manager: one window (or drawer) at a time over the game. Panels live in ./panels/*.js
import { h, ic, clear, hideTip } from './dom.js';
import { PANELS } from './panels/index.js';

export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('ui');
    clear(this.root);
    this.cur = null;
    this.sig = '';
  }
  get isOpen() { return !!this.cur; }
  get blocking() { return !!this.cur && !this.cur.passive; }
  get name() { return this.cur ? this.cur.name : null; }

  open(name, data) {
    const f = PANELS[name];
    if (!f) { console.warn('no panel', name); return null; }
    if (this.cur && this.cur.name === name && !data) return this.cur;
    this.close(true);
    hideTip();
    const g = this.g;
    const panel = f(g, data || {}, this);
    panel.name = name;
    const shell = panel.shell || this.shell(panel);
    this.root.appendChild(shell);
    panel.shellEl = shell;
    this.cur = panel;
    this.sig = panel.sig ? panel.sig() : '';
    g.audio.play('open', { vol: 0.5 });
    if (g.input) { g.input.joy.x = g.input.joy.y = 0; g.input.mouse.down = false; }
    if (panel.onOpen) panel.onOpen();
    return panel;
  }
  toggle(name) { if (this.cur && this.cur.name === name) this.close(); else this.open(name); }
  close(silent) {
    const p = this.cur;
    if (!p) return;
    this.cur = null;
    if (p.onClose) p.onClose();
    if (p.shellEl) p.shellEl.remove();
    hideTip();
    if (!silent) this.g.audio.play('close', { vol: 0.5 });
  }
  closeAll(silent) { this.close(silent); }
  update(dt) {
    const p = this.cur;
    if (!p) return;
    if (p.tick) p.tick(dt);
    if (p.sig) {
      const s = p.sig();
      if (s !== this.sig) { this.sig = s; if (p.refresh) p.refresh(); }
    }
  }
  /** wrap a panel body in a centred window with a title bar */
  shell(panel) {
    const g = this.g;
    const head = h('div', { class: 'win-head' }, panel.icon ? ic(panel.icon, 2) : null, h('h2', null, panel.title || ''), panel.headExtra || null,
      panel.noClose ? null : h('div', { class: 'xbtn', onclick: () => this.close(), title: 'Close' }, ic('ui_cross', 2)));
    const win = h('div', { class: 'panel win', style: panel.style || '' }, head, panel.body);
    const scrim = h('div', { class: 'scrim', onpointerdown: (e) => { if (e.target === scrim && !panel.noScrimClose) this.close(); } }, win);
    return scrim;
  }
}
