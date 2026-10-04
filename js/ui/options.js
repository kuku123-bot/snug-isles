// Difficulty presets + per-option editor (used by "New world" and the in-game Rules menu).
import { h, ic, clear } from './dom.js';
import { OPTIONS, PRESETS, DEFAULTS, presetSettings } from '../data/difficulty.js';

const EMOJI = { heart: 'ui_heart', flower: 'ui_cozy', sun: 'ui_sun', sword: 'ui_sword', skull: 'ui_bolt' };

/** returns {el, get(), set(obj)}; onChange(settings) fires on any change. lockLocked disables world-creation-only options. */
export function optionsEditor(initial, { lockLocked = false, onChange = () => {}, showPresets = true } = {}) {
  let cur = { ...DEFAULTS, ...initial };
  let preset = detectPreset(cur);
  const root = h('div', { class: 'col' });
  function detectPreset(s) {
    for (const p of PRESETS) {
      const ps = presetSettings(p.id);
      if (OPTIONS.every((o) => o.locked || s[o.id] === ps[o.id])) return p.id;
    }
    return 'custom';
  }
  function render() {
    clear(root);
    if (showPresets) {
      const row = h('div', { class: 'opt-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(210px,1fr))' });
      for (const p of PRESETS) {
        row.appendChild(h('div', { class: 'preset' + (preset === p.id ? ' on' : ''), onclick: () => { const ps = presetSettings(p.id); for (const o of OPTIONS) if (!(lockLocked && o.locked)) cur[o.id] = ps[o.id]; preset = p.id; onChange(cur); render(); } },
          ic(EMOJI[p.emoji] || 'ui_star', 3), h('div', null, h('b', null, p.name), h('div', { class: 'small', style: 'line-height:1.1' }, p.blurb))));
      }
      root.append(row);
      if (preset === 'custom') root.append(h('div', { class: 'chip warn', style: 'align-self:flex-start' }, 'Custom rules'));
    }
    const groups = [...new Set(OPTIONS.map((o) => o.group))];
    for (const gname of groups) {
      root.append(h('b', { style: 'margin-top:6px;font-size:17px' }, gname));
      const grid = h('div', { class: 'opt-grid' });
      for (const o of OPTIONS.filter((x) => x.group === gname)) {
        const disabled = lockLocked && o.locked;
        const sel = h('select', { disabled, onchange: (e) => { const raw = e.target.value; const v = o.opts.find((x) => String(x[0]) === raw)[0]; cur[o.id] = v; preset = detectPreset(cur); onChange(cur); render(); } },
          ...o.opts.map(([v, label]) => h('option', { value: String(v), selected: v === cur[o.id] }, label)));
        grid.append(h('div', { class: 'opt' }, h('label', { class: 'small', style: 'font-weight:700' }, o.label + (disabled ? ' (set at creation)' : '')), sel, h('div', { class: 'small muted', style: 'line-height:1.1' }, o.desc)));
      }
      root.append(grid);
    }
  }
  render();
  return { el: root, get: () => ({ ...cur }), set: (s) => { cur = { ...DEFAULTS, ...s }; preset = detectPreset(cur); render(); } };
}
