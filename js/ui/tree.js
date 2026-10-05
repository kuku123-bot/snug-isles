// The big-button tree used by the Research and Skills screens: square picture buttons joined by lines, one branch at a time.
import { h, ic, clear, sprites } from './dom.js';
import { layoutTree, layoutLayers } from './treelayout.js';

export const BOX = { w: 96, h: 104, gx: 30, gy: 16, pad: 16, head: 30 };

/** a sprite scaled smoothly to fit a square (any sprite size ends up about the same size on screen) */
export function pic(name, size = 52) {
  const S = sprites();
  if (!S || !S.has(name)) return h('span', { class: 'ic', style: `width:${size}px;height:${size}px` });
  const c = S.canvasOf(name, 4);
  c.className = 'ic pic';
  const f = Math.min(size / c.width, size / c.height);
  c.style.width = Math.round(c.width * f) + 'px'; c.style.height = Math.round(c.height * f) + 'px';
  c.style.imageRendering = 'auto';
  return c;
}

/**
 * nodes: [{ id, label, icon, state, color, parents, badge, extras: [{ icon, color, title, ok }] }]  state: css class (done / ready / locked ...)
 * returns { el, render(nodes, selectedId), centerOn(id) }
 */
export function treeView({ onSelect }) {
  const strip = h('div', { class: 'thead-strip' }); // the ages: stays put while the boxes scroll under it
  const inner = h('div', { class: 'tree-in' });
  const el = h('div', { class: 'tree scroll' }, strip, inner);
  let layout = null, head = 0;
  const at = (id) => { const p = layout.pos.get(id); return { x: BOX.pad + p.col * (BOX.w + BOX.gx), y: BOX.pad + p.row * (BOX.h + BOX.gy) }; };

  /** headers(colValue) -> small text above a column (e.g. the age) */
  function render(nodes, selected, headers) {
    const sl = el.scrollLeft, st = el.scrollTop;
    clear(inner); clear(strip);
    layout = nodes.every((n) => n.col !== undefined) ? layoutLayers(nodes) : layoutTree(nodes);
    head = headers ? BOX.head : 0;
    const W = BOX.pad * 2 + layout.cols * (BOX.w + BOX.gx) - BOX.gx, H = BOX.pad * 2 + Math.max(1, layout.rows) * (BOX.h + BOX.gy) - BOX.gy;
    inner.style.width = W + 'px'; inner.style.height = H + 'px';
    strip.style.display = headers ? 'block' : 'none'; strip.style.width = W + 'px'; strip.style.height = head + 'px';
    if (headers) layout.colValues.forEach((cv, i) => strip.appendChild(h('div', { class: 'thead', style: `left:${BOX.pad + i * (BOX.w + BOX.gx)}px;width:${BOX.w}px` }, headers(cv))));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const line = (a, b, cls) => {
      const p = at(a), q = at(b), x1 = p.x + BOX.w, y1 = p.y + BOX.h / 2, x2 = q.x, y2 = q.y + BOX.h / 2, k = Math.min(110, Math.max(24, (x2 - x1) / 2));
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`);
      path.setAttribute('class', 'edge ' + cls);
      svg.appendChild(path);
    };
    const edges = [];
    for (const n of nodes) for (const p of layout.parentsOf.get(n.id)) {
      const a = byId.get(p), done = a.state === 'done';
      edges.push([p, n.id, done && n.state === 'done' ? 'done' : done && n.state !== 'locked' ? 'open' : 'idle']);
    }
    const rank = { idle: 0, done: 1, open: 2 };
    edges.sort((a, b) => rank[a[2]] - rank[b[2]]);
    for (const [a, b, cls] of edges) line(a, b, cls);
    inner.appendChild(svg);
    for (const n of nodes) {
      const { x, y } = at(n.id);
      inner.appendChild(h('div', { class: `tbox ${n.state}${n.id === selected ? ' sel' : ''}`, style: `left:${x}px;top:${y}px;width:${BOX.w}px;height:${BOX.h}px;--bc:${n.color}`, role: 'button', tabindex: '0', 'aria-label': n.label, dataset: { id: n.id }, onclick: () => onSelect(n.id) },
        h('div', { class: 'pic-wrap' }, pic(n.icon)),
        h('div', { class: 'nm' }, n.label),
        n.badge ? h('div', { class: 'bdg' }, n.badge.text !== undefined ? n.badge.text : ic(n.badge.kind === 'lock' ? 'ui_lock' : 'ui_check', 1)) : null,
        n.extras && n.extras.length ? h('div', { class: 'xtra' }, ...n.extras.map((e) => h('span', { class: 'xdot' + (e.ok ? ' ok' : ''), title: e.title, style: `border-color:${e.color}` }, pic(e.icon, 18)))) : null));
    }
    el.scrollLeft = sl; el.scrollTop = st;
  }
  function centerOn(id) {
    if (!layout || !layout.pos.has(id)) return;
    const { x, y } = at(id);
    el.scrollLeft = Math.max(0, x - (el.clientWidth - BOX.w) / 2);
    el.scrollTop = Math.max(0, y + BOX.h / 2 - (el.clientHeight - head) / 2);
  }
  return { el, render, centerOn, get layout() { return layout; } };
}

/** a row of big branch buttons. branches: [{ id, name, color, icon, count, ready }] */
export function branchTabs(branches, current, onPick) {
  return h('div', { class: 'btabs' }, ...branches.map((b) => h('button', { class: 'btab' + (b.id === current ? ' on' : ''), style: `--bc:${b.color}`, title: b.full || b.name, onclick: () => onPick(b.id) },
    pic(b.icon, 24), h('span', { class: 'bn' }, b.name), h('span', { class: 'bc' }, b.count), b.ready ? h('i', { class: 'rdy', title: 'Something here is ready' }) : null)));
}
