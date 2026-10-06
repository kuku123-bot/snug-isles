// Container & machine windows: chest, processor, market, warp, land purchase.
import { h, ic, itemIc, clear, esc, tip } from '../dom.js';
import { slotEl } from './inventory.js';
import { ITEMS, fuelValue } from '../../data/items.js';
import { BUILD } from '../../data/build.js';
import { TECHS } from '../../data/techs.js';
import { BIOMES } from '../../data/biomes.js';
import { PROCESS, PROC_CHAIN, PROC_SPEED } from '../../data/recipes.js';
import { processRecipes } from '../../sim/machines.js';
import { landPrice } from '../../sim/worldgen.js';
import { calcStats } from '../../sim/player.js';
import { fmtNum } from '../../util.js';

const stackSig = (s) => (s ? s.id + s.n : '-');

export function chestPanel(g, data, ui) {
  const world = () => g.world;
  const thing = () => world().things.get(data.id);
  const t0 = thing();
  const def = t0 && BUILD[t0.type];
  const bagGrid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(8,auto)' });
  const boxGrid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(8,auto)' });
  const body = h('div', { class: 'col scroll', style: 'max-height:68vh' });
  function render() {
    const t = thing(), p = g.me;
    if (!t || !t.s || !t.s.inv) { ui.close(); return; }
    clear(bagGrid); clear(boxGrid); clear(body);
    t.s.inv.forEach((st, i) => boxGrid.appendChild(slotEl(st, { ref: { k: 't', id: t.id, i }, onclick: () => { if (st) g.cmd({ c: 'inv', op: 'quick', from: { k: 't', id: t.id, i }, to: {} }); } })));
    p.inv.forEach((st, i) => bagGrid.appendChild(slotEl(st, { ref: { k: 'p', i }, hot: i < 8, key: i < 8 ? String(i + 1) : null, onclick: () => { if (st) g.cmd({ c: 'inv', op: 'quick', from: { k: 'p', i }, to: { id: t.id } }); } })));
    const takeAll = () => { t.s.inv.forEach((st, i) => { if (st) g.cmd({ c: 'inv', op: 'quick', from: { k: 't', id: t.id, i }, to: {} }); }); };
    body.append(h('div', { class: 'row' }, h('b', { class: 'grow' }, `${def ? def.name : 'Chest'}  (${t.s.inv.filter(Boolean).length}/${t.s.inv.length})`), h('button', { class: 'btn small good', onclick: takeAll }, 'Take all')), boxGrid,
      h('div', { class: 'sep' }), h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Your bag'), h('button', { class: 'btn small', onclick: () => g.cmd({ c: 'sort' }) }, ic('ui_sort', 1), 'Sort')), bagGrid,
      h('div', { class: 'small muted' }, 'Tap or drag an item to move it across. Chests next to machines feed them automatically, and nearby chests count when you craft & build!'));
  }
  render();
  return { title: def ? def.name : 'Chest', icon: 'ui_bag', body, sig: () => { const t = thing(); return `${g.me.rev}:${t && t.s && t.s.inv ? t.s.inv.map(stackSig).join(',') : ''}`; }, refresh: render };
}

export function processorPanel(g, data, ui) {
  const world = () => g.world;
  const thing = () => world().things.get(data.id);
  const t0 = thing(), def = t0 && BUILD[t0.type], kind = def.conf.kind;
  const body = h('div', { class: 'col scroll', style: 'max-height:68vh;min-width:min(86vw,520px)' });
  let barEl = null, recEl = null;
  function render() {
    const t = thing(), p = g.me;
    if (!t) { ui.close(); return; }
    const s = t.s || {};
    clear(body);
    const recipes = processRecipes(world(), kind);
    const slot = (f, label, ghost) => h('div', { class: 'col', style: 'align-items:center;gap:2px' }, slotEl(s[f], { ghost, ref: { k: 'm', id: t.id, f }, onclick: () => { if (s[f]) g.cmd({ c: 'inv', op: 'quick', from: { k: 'm', id: t.id, f }, to: {} }); } }), h('span', { class: 'small muted' }, label));
    barEl = h('i', { style: 'display:block;height:100%;width:0;background:var(--green)' });
    recEl = h('div', { class: 'small', style: 'min-height:18px' });
    const arrow = h('div', { class: 'col', style: 'align-items:center;flex:1;min-width:90px' }, h('div', { style: 'width:100%;height:14px;border:3px solid var(--ink);border-radius:8px;background:#fff;overflow:hidden' }, barEl), recEl);
    const row = h('div', { class: 'row', style: 'justify-content:center;gap:12px' }, slot('inp', 'Put in', 'ui_plus'), arrow, slot('out', 'Take out', null));
    const fuelRow = def.conf.noFuel ? h('div', { class: 'small muted', style: 'text-align:center' }, 'Powered by the wind — no fuel needed.') : h('div', { class: 'row', style: 'justify-content:center' }, slot('fuel', 'Fuel', 'ui_sun'), h('div', { class: 'small muted', style: 'max-width:240px' }, 'Wood, charcoal, coal or ember stone keep it hot.' + (s.heat > 0 ? ` (${Math.ceil(s.heat)}s of heat left)` : '')));
    // what it can make
    const menu = h('div', { class: 'col', style: 'gap:3px' });
    for (const r of recipes) menu.append(h('div', { class: 'row small' }, itemIc(r.input, 1), `×${r.n}`, ic('ui_arrow', 1), itemIc(r.out, 1), `×${r.on}`, h('span', { class: 'muted' }, `· ${r.t}s ${ITEMS[r.input].name} → ${ITEMS[r.out].name}`)));
    if (!recipes.length) menu.append(h('div', { class: 'muted small' }, 'Research more to unlock recipes here.'));
    // bag
    const bag = h('div', { class: 'grid', style: 'grid-template-columns:repeat(8,auto)' });
    const accepts = (id) => recipes.some((r) => r.input === id) || (!def.conf.noFuel && fuelValue(id) > 0);
    p.inv.forEach((st, i) => bag.appendChild(slotEl(st, { ref: { k: 'p', i }, dim: st && !accepts(st.id), onclick: () => { if (st && accepts(st.id)) g.cmd({ c: 'inv', op: 'quick', from: { k: 'p', i }, to: { id: t.id } }); else if (st) g.toast('It does not take that.', 'info'); } })));
    body.append(row, fuelRow, h('div', { class: 'sep' }), h('b', null, 'Recipes'), menu, h('div', { class: 'sep' }), h('b', null, 'Tap or drag items from your bag to load them'), bag,
      h('div', { class: 'small muted' }, 'Tip: place a chest right next to this machine — it will load itself and unload finished goods into the chest.'));
    tick();
  }
  function tick() {
    const t = thing(); if (!t || !barEl) return;
    const s = t.s || {};
    const rec = s.inp ? processRecipes(world(), kind).find((r) => r.input === s.inp.id && s.inp.n >= r.n) : null;
    let prog = 0;
    if (rec) { prog = (s.ps || 0) + (s.w ? (world().time - (s.pt || world().time)) * PROC_SPEED[kind] : 0); prog = Math.min(1, (prog % (rec.t)) / rec.t); }
    barEl.style.width = (prog * 100) + '%';
    recEl.textContent = !s.inp ? 'Waiting for something to cook…' : !rec ? 'Needs more of that item' : s.w ? 'Working…' : !def.conf.noFuel && !(s.heat > 0) && !(s.fuel && s.fuel.n) ? 'Needs fuel!' : 'Ready';
  }
  render();
  return { title: def.name, icon: 'ui_hammer', body, sig: () => { const t = thing(); const s = (t && t.s) || {}; return `${g.me.rev}:${stackSig(s.inp)}:${stackSig(s.fuel)}:${stackSig(s.out)}:${s.w}:${Math.floor((s.heat || 0) / 10)}`; }, refresh: render, tick };
}

export function marketPanel(g, data, ui) {
  const me = () => g.me, world = () => g.world;
  let sel = -1;
  const body = h('div', { class: 'col' });
  const mul = (id) => (world().shared.market && world().shared.market[id]) || 1;
  function price(id) { const st = calcStats(world(), me()); return Math.max(1, Math.round(ITEMS[id].sell * mul(id) * st.sellMul)); }
  function render() {
    const p = me();
    clear(body);
    const grid = h('div', { class: 'grid scroll', style: 'grid-template-columns:repeat(8,auto);max-height:34vh' });
    p.inv.forEach((st, i) => {
      const sellable = st && ITEMS[st.id].sell > 0;
      const el = slotEl(st, { sel: sel === i, dim: st && !sellable, onclick: () => { sel = st && sellable ? i : -1; render(); } });
      if (st && sellable) el.appendChild(h('span', { class: 'k', style: `${mul(st.id) > 1.1 ? 'color:#2a9a2a' : mul(st.id) < 0.9 ? 'color:#c0304a' : ''}` }, price(st.id) + 'c'));
      grid.appendChild(el);
    });
    const s = p.inv[sel];
    const box = h('div', { class: 'panel', style: 'background:var(--paper2);padding:8px 10px;min-height:84px' });
    if (s) {
      const each = price(s.id);
      box.append(h('div', { class: 'row' }, itemIc(s.id, 3), h('div', { class: 'grow' }, h('b', { style: 'font-size:18px' }, ITEMS[s.id].name), h('div', { class: 'small' }, `${each} coins each ${mul(s.id) > 1.1 ? '· in demand today! ▲' : mul(s.id) < 0.9 ? '· cheap today ▼' : ''}`)),
        h('div', { class: 'row' }, ...[[1, 'Sell 1'], [10, 'Sell 10'], [s.n, `Sell all (${each * s.n}c)`]].filter(([n], i, a) => n <= s.n && (i < 2 ? n < s.n || i === 0 : true)).map(([n, l]) => h('button', { class: 'btn small good', onclick: () => { g.cmd({ c: 'sell', i: sel, n }); } }, ic('i_coin', 1), l)))));
    } else box.append(h('div', { class: 'muted', style: 'padding:6px' }, 'Pick something from your bag to sell. Cooked food, bars and potions sell for much more than raw materials!'));
    const hot = Object.entries(world().shared.market || {}).filter(([, v]) => v > 1.2).map(([k]) => k);
    body.append(h('div', { class: 'row small' }, ic('i_coin', 2), h('b', null, `${fmtNum(world().coins)} coins`), h('span', { class: 'muted' }, hot.length ? ` · Hot today: ${hot.slice(0, 4).map((k) => ITEMS[k].name).join(', ')}` : '')), grid, box);
  }
  render();
  return { title: 'Market Stall', icon: 'ui_pin', body, sig: () => `${me().rev}:${world().coins}:${sel}`, refresh: render };
}

export function warpPanel(g, data, ui) {
  const body = h('div', { class: 'col scroll', style: 'max-height:60vh;min-width:min(80vw,380px)' });
  const pads = (data.pads || []).filter((p) => p.id !== data.id);
  if (!pads.length) body.append(h('div', { class: 'muted', style: 'padding:14px' }, 'Build another Warp Pad somewhere else, and you can travel between them!'));
  const me = g.me;
  pads.forEach((p, i) => {
    const d = Math.round(Math.hypot((p.x - me.x / 16), (p.y - me.y / 16)));
    body.append(h('div', { class: 'save-card', onclick: () => { g.cmd({ c: 'warp', id: p.id }); ui.close(); } }, ic('ui_pin', 2), h('div', { class: 'grow' }, h('b', null, `Pad ${i + 1}`), h('div', { class: 'small muted' }, `${d} tiles away`)), h('button', { class: 'btn small good' }, 'Go!')));
  });
  return { title: 'Warp Pad', icon: 'ui_star', body, sig: () => '' };
}

export function landBuyPanel(g, data, ui) {
  const w = () => g.world;
  const { gx, gy } = data;
  const b = BIOMES[w().biomeMap[w().landIndex(gx, gy)]] || BIOMES.meadow;
  const body = h('div', { class: 'col', style: 'min-width:min(80vw,340px)' });
  function render() {
    clear(body);
    const price = landPrice(w(), gx, gy, calcStats(w(), g.me).landDiscount);
    const afford = w().coins >= price;
    const owned = w().isLandOwned(gx, gy);
    body.append(h('div', { class: 'row' }, h('div', { style: `width:56px;height:56px;border:3px solid var(--ink);border-radius:12px;background:${b.color}` }), h('div', null, h('b', { style: 'font-size:20px' }, b.name), h('div', { class: 'small' }, b.blurb))),
      h('div', { class: 'small' }, 'Resources here: ' + b.res.slice(0, 6).map((r) => r[0].replace(/_/g, ' ')).join(', ') + '…'),
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', { class: 'pill' }, ic('i_coin', 2), fmtNum(w().coins)), h('div', { class: 'pill', style: afford ? '' : 'background:#ffd0d6' }, 'Price ', ic('i_coin', 2), fmtNum(price))),
      owned ? h('div', { class: 'chip ok' }, 'Already yours!') : h('button', { class: 'btn good' + (afford ? '' : ' disabled'), style: 'font-size:20px', onclick: () => { if (!afford) { g.audio.play('error'); g.toast(`Need ${price - w().coins} more coins — sell things at a Market Stall!`, 'warn'); return; } g.cmd({ c: 'buyLand', gx, gy }); g.audio.play('buy'); ui.close(); } }, ic('ui_check', 2), 'Buy this land'));
  }
  render();
  return { title: 'New Land', icon: 'ui_map', body, sig: () => `${w().coins}:${w().landRev}`, refresh: render };
}
