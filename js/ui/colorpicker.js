// The color picker for building: swatches, hue / softness / lightness sliders, a hex box, recent colors and a dropper.
// Pure DOM, no game state: the builder gives it the current color and hears about every change.
// The sliders are drawn here (not <input type=range>) so a finger drags them the same on every device, even though the page itself never scrolls or zooms.
import { h, ic } from './dom.js';
import { PALETTE, colorHex, hexToColor, colorToHsl, hslToColor, normColor } from '../data/paint.js';
import { lsGet, lsSet } from '../engine/storage.js';

const RECENT_KEY = 'snug.paint.recent';
export const loadRecent = () => (lsGet(RECENT_KEY, []) || []).map(normColor).filter(Boolean).slice(0, 8);
export function rememberColor(col) {
  col = normColor(col);
  if (!col) return;
  lsSet(RECENT_KEY, [col, ...loadRecent().filter((c) => c !== col)].slice(0, 8));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** a horizontal slider: pointer down/move anywhere on the track sets the value (0..1); emit(v, final) */
function makeSlider(label, emit) {
  const thumb = h('div', { class: 'cp-thumb' });
  const track = h('div', { class: 'cp-track' }, thumb);
  const el = h('div', { class: 'cp-slider' }, h('span', { class: 'cp-lab' }, label), track);
  let v = 0;
  const show = (nv) => { v = clamp01(nv); thumb.style.left = v * 100 + '%'; };
  const at = (e, final) => { const r = track.getBoundingClientRect(); show((e.clientX - r.left) / Math.max(1, r.width)); emit(v, final); };
  track.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { track.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } track.classList.add('on'); at(e, false); });
  track.addEventListener('pointermove', (e) => { if (track.classList.contains('on')) at(e, false); });
  const end = (e) => { if (!track.classList.contains('on')) return; track.classList.remove('on'); try { track.releasePointerCapture(e.pointerId); } catch (x) { /* fine */ } at(e, true); };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  return { el, track, set: show, get: () => v };
}

/**
 * opts: { get: () => current color (0 = original), set: (color, final) => void, pick: () => start the dropper, picking: () => bool }
 * returns { el, sync } (call sync() whenever the color changed from outside: the dropper, a swatch elsewhere)
 */
export function createColorPicker(opts) {
  let hsl = [20, 0.6, 0.6]; // the sliders' own idea of the color while it is theirs (round-tripping through 15-bit color would make the thumbs jitter)
  const preview = h('div', { class: 'cp-preview' });
  const hexIn = h('input', { type: 'text', class: 'cp-hex', maxlength: 7, placeholder: '#rrggbb', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Color code' });
  const dropper = h('button', { class: 'btn small', title: 'Copy the color of a piece you already built', onclick: () => opts.pick() }, ic('ui_dropper', 1), 'Pick');
  const swWrap = h('div', { class: 'cp-swatches' });
  const recentWrap = h('div', { class: 'cp-recent' });
  const commit = (col, final) => { col = normColor(col); opts.set(col, final); if (final && col) rememberColor(col); paint(); };

  const sH = makeSlider('Hue', (v, f) => { hsl[0] = v * 360; fromSliders(f); });
  const sS = makeSlider('Soft', (v, f) => { hsl[1] = v; fromSliders(f); });
  const sL = makeSlider('Light', (v, f) => { hsl[2] = v; fromSliders(f); });
  function fromSliders(final) { commit(hslToColor(hsl[0], hsl[1], hsl[2]), final); }

  const swatch = (col, name, extra = '') => h('button', { class: 'cp-sw' + (col ? '' : ' none') + extra, title: name, 'aria-label': name, style: col ? `background:${colorHex(col)}` : '', 'data-col': col, onclick: () => commit(col, true) });

  function paint() {
    const col = normColor(opts.get());
    preview.style.background = col ? colorHex(col) : '';
    preview.classList.toggle('none', !col);
    if (document.activeElement !== hexIn) hexIn.value = col ? colorHex(col) : '';
    // the sliders keep their own position while the color is theirs; a swatch, the hex box or the dropper moves them
    if (col && hslToColor(hsl[0], hsl[1], hsl[2]) !== col) hsl = colorToHsl(col);
    const [hh, ss, ll] = hsl, hd = hh.toFixed(0);
    sH.set(hh / 360); sS.set(ss); sL.set(ll);
    sH.track.style.background = 'linear-gradient(90deg,' + [0, 60, 120, 180, 240, 300, 360].map((d) => `hsl(${d},85%,58%)`).join(',') + ')';
    sS.track.style.background = `linear-gradient(90deg, hsl(${hd},0%,${(ll * 100).toFixed(0)}%), hsl(${hd},100%,${(ll * 100).toFixed(0)}%))`;
    sL.track.style.background = `linear-gradient(90deg, #000, hsl(${hd},${(ss * 100).toFixed(0)}%,50%), #fff)`;
    for (const b of swWrap.children) b.classList.toggle('on', Number(b.dataset.col) === col);
    recentWrap.replaceChildren(...loadRecent().map((c) => swatch(c, 'Recent color ' + colorHex(c), c === col ? ' on' : '')));
    recentWrap.style.display = recentWrap.children.length ? '' : 'none';
    reclab.style.display = recentWrap.style.display;
    dropper.classList.toggle('good', !!(opts.picking && opts.picking()));
    if (opts.changed) opts.changed(); // the Recent row may have appeared: the panel's height changed
  }
  const reclab = h('div', { class: 'cp-reclab' }, 'Recent');
  swWrap.append(swatch(0, 'Original (as drawn)'), ...PALETTE.map((p) => swatch(p.color, p.name)));
  hexIn.addEventListener('input', () => { const c = hexToColor(hexIn.value); hexIn.classList.toggle('bad', !!hexIn.value && !c); if (c) commit(c, false); });
  hexIn.addEventListener('change', () => { const c = hexToColor(hexIn.value); if (c) commit(c, true); else hexIn.value = colorHex(normColor(opts.get())); });
  hexIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') hexIn.blur(); });

  const el = h('div', { class: 'cp panel', onpointerdown: (e) => e.stopPropagation() },
    h('div', { class: 'cp-top' }, preview, hexIn, dropper),
    h('div', { class: 'cp-cols' }, h('div', { class: 'cp-sliders' }, sH.el, sS.el, sL.el, reclab, recentWrap), h('div', { class: 'cp-right' }, swWrap)));
  paint();
  return { el, sync: paint };
}
