// Tiny DOM helpers + sprite-backed icons for UI panels.
let SPR = null;
export const setSprites = (s) => { SPR = s; };
export const sprites = () => SPR;

/** hyperscript: h('div', {class:'x', onclick: fn, style:'...'}, child, 'text', [more]) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

/** sprite icon as a span (static atlas sprites) */
export function ic(name, scale = 2, cls = '') {
  const el = document.createElement('span');
  el.className = 'ic ' + cls;
  const st = SPR && SPR.domStyle(name, scale);
  if (st) el.style.cssText = st; else { el.style.cssText = `width:${16 * scale}px;height:${16 * scale}px`; }
  return el;
}
export const itemIc = (id, scale = 2, cls = '') => ic('i_' + id, scale, cls);

/** sprite drawn into a canvas, scaled by an integer so it fits maxPx (for dynamic or odd-sized sprites) */
export function spriteCanvas(name, maxW = 48, maxH = 48) {
  if (!SPR || !SPR.has(name)) return h('span', { class: 'ic', style: `width:${maxW}px;height:${maxH}px` });
  const [w, hh] = SPR.size(name);
  const s = Math.max(1, Math.min(Math.floor(maxW / w) || 1, Math.floor(maxH / hh) || 1, 4));
  const c = SPR.canvasOf(name, s);
  c.className = 'ic';
  return c;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let tipEl = null;
export function showTip(html, x, y) {
  tipEl = tipEl || document.getElementById('tip');
  tipEl.className = '';
  tipEl.replaceChildren(h('div', { class: 'tipbox', html }));
  const r = tipEl.getBoundingClientRect();
  const nx = Math.min(window.innerWidth - r.width - 6, Math.max(6, x + 14)), ny = Math.min(window.innerHeight - r.height - 6, Math.max(6, y + 16));
  tipEl.style.left = nx + 'px'; tipEl.style.top = ny + 'px';
}
export function hideTip() { tipEl = tipEl || document.getElementById('tip'); tipEl.className = 'hidden'; }
/** attach hover/long-press tooltip to an element */
export function tip(el, htmlFn) {
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !document.body.classList.contains('dragging')) showTip(typeof htmlFn === 'function' ? htmlFn() : htmlFn, e.clientX, e.clientY); });
  el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && tipEl && !tipEl.classList.contains('hidden') && !document.body.classList.contains('dragging')) showTip(typeof htmlFn === 'function' ? htmlFn() : htmlFn, e.clientX, e.clientY); });
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('pointerdown', hideTip);
  return el;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
