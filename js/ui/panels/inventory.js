// Bag window: inventory grid, equipment, selected-item actions, stats.
import { h, ic, itemIc, tip, esc, clear } from '../dom.js';
import { ITEMS, itemDesc } from '../../data/items.js';
import { calcStats, HOTBAR, EQUIP_SLOTS } from '../../sim/player.js';
import { xpForLevel } from '../../data/skills.js';

export function slotEl(stack, o = {}) {
  const el = h('div', { class: 'slot' + (stack ? '' : ' empty') + (o.sel ? ' sel' : '') + (o.dim ? ' dim' : '') });
  if (o.key) el.appendChild(h('span', { class: 'k' }, o.key));
  if (stack) {
    el.appendChild(itemIc(stack.id, 2));
    if (stack.n > 1) el.appendChild(h('span', { class: 'n' }, stack.n));
    tip(el, () => `<b>${esc(ITEMS[stack.id].name)}</b>${ITEMS[stack.id].sell ? ` <span style="opacity:.7">· ${ITEMS[stack.id].sell}c</span>` : ''}<br>${esc(itemDesc(ITEMS[stack.id])).replace(/\n/g, '<br>')}`);
  } else if (o.ghost) el.appendChild(ic(o.ghost, 2, 'ghost'));
  if (o.onclick) el.addEventListener('click', o.onclick);
  if (o.onlong) { let t = null; el.addEventListener('pointerdown', () => { t = setTimeout(() => { t = null; o.onlong(); }, 420); }); const c = () => { if (t) clearTimeout(t); t = null; }; el.addEventListener('pointerup', c); el.addEventListener('pointerleave', c); el.addEventListener('pointercancel', c); }
  if (o.onctx) el.addEventListener('contextmenu', (e) => { e.preventDefault(); o.onctx(); });
  return el;
}

export function inventoryPanel(g, data, ui) {
  const me = () => g.me;
  let sel = null; // {k:'p', i} | {k:'e', slot}
  const body = h('div', { class: 'row', style: 'align-items:flex-start;gap:14px;flex-wrap:wrap' });
  const gridWrap = h('div', { class: 'col' });
  const side = h('div', { class: 'col', style: 'min-width:230px;max-width:290px;flex:1' });
  body.append(gridWrap, side);

  const selStack = () => { const p = me(); if (!sel) return null; return sel.k === 'p' ? p.inv[sel.i] : p.equip[sel.slot]; };

  function clickSlot(ref) {
    const p = me();
    g.audio.play('click', { vol: 0.5 });
    const cur = selStack();
    if (sel && cur) {
      if (sel.k === ref.k && ((ref.k === 'p' && sel.i === ref.i) || (ref.k === 'e' && sel.slot === ref.slot))) { // second tap on the same slot: use it
        useSelected(); return;
      }
      g.cmd({ c: 'inv', op: 'move', from: sel.k === 'p' ? { k: 'p', i: sel.i } : { k: 'e', slot: sel.slot }, to: ref.k === 'p' ? { k: 'p', i: ref.i } : { k: 'e', slot: ref.slot }, n: 0 });
      sel = null; render(); return;
    }
    const s = ref.k === 'p' ? p.inv[ref.i] : p.equip[ref.slot];
    sel = s ? ref : null;
    render();
  }
  function useSelected() {
    const p = me(), s = selStack(); if (!s) return;
    const it = ITEMS[s.id];
    if (sel.k === 'e') { g.cmd({ c: 'unequip', slot: sel.slot }); sel = null; render(); return; }
    if (it.armor || it.charm) { g.cmd({ c: 'equip', i: sel.i }); sel = null; render(); return; }
    // otherwise put it on the hotbar selection / use directly
    if (sel.i < HOTBAR) { g.selectSlot(sel.i); ui.close(); }
    else if (it.food || it.potion || it.hatch) { g.cmd({ c: 'use', slot: sel.i, ax: p.x, ay: p.y }); }
    else {
      // move to the first hotbar slot that's empty, else swap into the selected slot
      const target = p.inv.slice(0, HOTBAR).findIndex((x) => !x);
      g.cmd({ c: 'inv', op: 'move', from: { k: 'p', i: sel.i }, to: { k: 'p', i: target >= 0 ? target : p.sel }, n: 0 }); sel = null; render();
    }
  }

  function render() {
    const p = me();
    if (!p) return;
    clear(gridWrap); clear(side);
    const cols = 8;
    const grid = h('div', { class: 'grid', style: `grid-template-columns:repeat(${cols},auto)` });
    for (let i = 0; i < p.inv.length; i++) {
      const st = p.inv[i];
      grid.appendChild(slotEl(st, { key: i < HOTBAR ? String(i + 1) : null, sel: sel && sel.k === 'p' && sel.i === i, onclick: () => clickSlot({ k: 'p', i }), onctx: () => { sel = st ? { k: 'p', i } : null; useSelected(); }, onlong: () => { if (st) { sel = { k: 'p', i }; render(); } } }));
    }
    gridWrap.append(h('div', { class: 'row small muted' }, ic('ui_bag', 1), `${p.inv.filter(Boolean).length}/${p.inv.length} slots · tap an item, then tap where it goes. Tap again to use.`), grid,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { g.cmd({ c: 'sort' }); } }, ic('ui_sort', 1), 'Sort')));
    // equipment
    const eq = h('div', { class: 'row', style: 'justify-content:space-between' });
    const eqNames = { head: 'Hat', body: 'Tunic', feet: 'Boots', charm: 'Charm' };
    for (const slot of EQUIP_SLOTS) {
      const st = p.equip[slot];
      eq.appendChild(h('div', { class: 'col', style: 'align-items:center;gap:2px' }, slotEl(st, { sel: sel && sel.k === 'e' && sel.slot === slot, onclick: () => clickSlot({ k: 'e', slot }) }), h('span', { class: 'small muted' }, eqNames[slot])));
    }
    side.append(h('b', null, 'Wearing'), eq);
    // selected item
    const s = selStack();
    const detail = h('div', { class: 'panel', style: 'padding:8px;background:var(--paper2);min-height:92px' });
    if (s) {
      const it = ITEMS[s.id];
      detail.append(h('div', { class: 'row' }, itemIc(s.id, 3), h('div', null, h('b', null, it.name), h('div', { class: 'small muted' }, `${it.cat}${it.sell ? ` · sells for ${it.sell}` : ''}`))),
        h('div', { class: 'small', style: 'margin:4px 0;white-space:pre-line' }, itemDesc(it) || ''));
      const acts = h('div', { class: 'row', style: 'flex-wrap:wrap' });
      const btn = (label, fn, cls = '') => h('button', { class: 'btn small ' + cls, onclick: () => { g.audio.play('click'); fn(); } }, label);
      if (sel.k === 'e') acts.append(btn('Take off', () => { g.cmd({ c: 'unequip', slot: sel.slot }); sel = null; render(); }, 'good'));
      else {
        if (it.armor || it.charm) acts.append(btn('Wear', useSelected, 'good'));
        else if (it.food || it.potion || it.hatch) acts.append(btn(it.hatch ? 'Hatch' : 'Use', () => g.cmd({ c: 'use', slot: sel.i, ax: p.x, ay: p.y }), 'good'));
        else if (sel.i >= HOTBAR) acts.append(btn('To hotbar', useSelected, 'good'));
        else acts.append(btn('Hold', () => { g.selectSlot(sel.i); }, 'good'));
        if (s.n > 1) acts.append(btn('Split', () => { const e = p.inv.findIndex((x) => !x); if (e >= 0) { g.cmd({ c: 'inv', op: 'move', from: { k: 'p', i: sel.i }, to: { k: 'p', i: e }, n: Math.floor(s.n / 2) }); } sel = null; render(); }));
        acts.append(btn('Drop', () => { g.cmd({ c: 'drop', i: sel.i, n: 1 }); }), s.n > 1 ? btn('Drop all', () => { g.cmd({ c: 'drop', i: sel.i, n: s.n }); sel = null; }) : null);
      }
      detail.append(acts);
    } else detail.append(h('div', { class: 'muted small', style: 'padding:8px' }, 'Select an item to see what it does.'));
    side.append(detail);
    // stats
    const st = calcStats(g.world, p);
    const line = (a, b) => h('div', { class: 'row', style: 'justify-content:space-between;font-size:14px' }, h('span', null, a), h('b', null, b));
    side.append(h('div', { class: 'sep' }), line('Level', `${p.level}  (${Math.floor(p.xp)}/${xpForLevel(p.level)} xp)`), line('Hearts', `${Math.ceil(p.hp / 4)} / ${Math.ceil(st.maxHp / 4)}`), line('Defense', `${Math.round(st.defense * 100)}%`),
      line('Move speed', `${Math.round(st.speed / 66 * 100)}%`), line('Pickup range', `${Math.round(st.magnet)}`), line('Luck', `+${Math.round(st.luck * 100)}%`), line('Cozy', p.cozy >= 10 ? `${p.cozy} ♥` : '—'));
  }
  const panel = { title: 'Bag', icon: 'ui_bag', body, sig: () => `${me().rev}:${sel ? (sel.k + (sel.i ?? sel.slot)) : ''}:${me().inv.length}`, refresh: () => render() };
  render();
  return panel;
}
