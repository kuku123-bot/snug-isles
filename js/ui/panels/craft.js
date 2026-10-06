// Crafting window: recipes grouped by station, ingredient have/need, quantity, craft button.
import { h, ic, itemIc, tip, esc, clear } from '../dom.js';
import { ITEMS, itemDesc } from '../../data/items.js';
import { RECIPES, STATION_NAMES } from '../../data/recipes.js';
import { TECHS } from '../../data/techs.js';
import { sourcesFor, countAll, stationNear } from '../../sim/commands.js';

const STATION_ORDER = ['hand', 'workbench', 'campfire', 'kitchen', 'sewing', 'anvil', 'alchemy', 'arcane', 'forge', 'prism', 'starforge'];
const STATION_ICON = { hand: 'ui_hand', workbench: 'ui_hammer', campfire: 'ui_sun', kitchen: 'ui_hunger', sewing: 'ui_book', anvil: 'ui_hammer', alchemy: 'ui_flask', arcane: 'ui_star', forge: 'ui_hammer', prism: 'ui_star', starforge: 'ui_star' };

export function craftPanel(g, data, ui) {
  let tab = data.station || 'avail';
  let selId = null;
  let qty = 1;
  let showLocked = false;
  const w = () => g.world, me = () => g.me;
  const list = h('div', { class: 'scroll col', style: 'gap:4px;min-width:260px;max-width:330px;max-height:56vh;padding-right:4px' });
  const detail = h('div', { class: 'col', style: 'min-width:240px;max-width:320px;flex:1' });
  const tabs = h('div', { class: 'tabs' });
  const body = h('div', { class: 'col' }, tabs, h('div', { class: 'row', style: 'align-items:flex-start;flex-wrap:wrap;gap:12px' }, list, detail));

  const status = (r) => {
    const world = w(), p = me();
    const src = sourcesFor({ world }, p);
    const unlocked = !r.tech || world.techs.has(r.tech);
    const stOk = stationNear({ world }, p, r.station);
    let can = unlocked && stOk;
    const miss = [];
    for (const k in r.in) { const have = countAll(src, k), need = r.in[k]; if (have < need) { can = false; miss.push(k); } }
    return { unlocked, stOk, can, src };
  };
  function visibleRecipes() {
    const world = w();
    return RECIPES.filter((r) => {
      const unlocked = !r.tech || world.techs.has(r.tech);
      if (!unlocked && !showLocked) return false;
      if (tab === 'avail') return unlocked && status(r).can;
      if (tab === 'all') return true;
      return r.station === tab;
    });
  }
  function render() {
    const world = w();
    clear(tabs);
    const mk = (id, label, icon) => h('div', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; selId = null; g.audio.play('click', { vol: 0.5 }); render(); } }, icon ? ic(icon, 1) : null, label);
    tabs.append(mk('avail', 'Can craft', 'ui_check'), mk('all', 'All'));
    for (const st of STATION_ORDER) { if (RECIPES.some((r) => r.station === st && (!r.tech || world.techs.has(r.tech)))) tabs.append(mk(st, STATION_NAMES[st], STATION_ICON[st])); }
    tabs.append(h('div', { class: 'tab', style: 'margin-left:auto', onclick: () => { showLocked = !showLocked; render(); } }, ic(showLocked ? 'ui_unlock' : 'ui_lock', 1), showLocked ? 'Hide locked' : 'Show locked'));
    clear(list);
    const rows = visibleRecipes();
    if (!rows.length) list.appendChild(h('div', { class: 'muted', style: 'padding:14px' }, tab === 'avail' ? 'Nothing you can make right now. Gather materials, or stand next to a workbench or other station!' : 'No recipes here yet. Research more!'));
    for (const r of rows) {
      const s = status(r);
      const row = h('div', { class: 'card' + (selId === r.id ? ' on' : '') + (s.unlocked ? '' : ' locked'), style: 'flex-direction:row;align-items:center;gap:8px;text-align:left', onclick: () => { selId = r.id; qty = 1; g.audio.play('click', { vol: 0.5 }); render(); } },
        itemIc(r.out, 2), h('div', { class: 'grow' }, h('div', { style: 'font-weight:700;font-size:15px' }, ITEMS[r.out].name + (r.n > 1 ? ` ×${r.n}` : '')),
          h('div', { class: 'cost', style: 'justify-content:flex-start' }, ...Object.keys(r.in).map((k) => { const have = countAll(s.src, k), need = r.in[k]; return h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, k === '@fish' ? ic('ui_fish', 1) : itemIc(k, 1), `${Math.min(have, 999)}/${need}`); }))),
        s.unlocked ? (s.can ? ic('ui_check', 1) : null) : ic('ui_lock', 1));
      list.appendChild(row);
    }
    renderDetail();
  }
  function renderDetail() {
    clear(detail);
    const r = RECIPES.find((x) => x.id === selId);
    if (!r) { detail.appendChild(h('div', { class: 'muted', style: 'padding:16px' }, 'Pick a recipe to see what you need.')); return; }
    const s = status(r), it = ITEMS[r.out];
    detail.append(h('div', { class: 'row' }, itemIc(r.out, 4), h('div', null, h('h3', null, it.name), h('div', { class: 'small muted' }, `Makes ${r.n}${r.station === 'hand' ? '' : ' · at ' + STATION_NAMES[r.station]}`))),
      h('div', { class: 'small', style: 'white-space:pre-line;min-height:20px' }, itemDesc(it)),
      h('div', { class: 'sep' }));
    const need = h('div', { class: 'col', style: 'gap:3px' });
    for (const k of Object.keys(r.in)) { const have = countAll(s.src, k), n = r.in[k] * qty; need.appendChild(h('div', { class: 'row small' }, k === '@fish' ? ic('ui_fish', 1) : itemIc(k, 2), h('span', { class: 'grow' }, k === '@fish' ? 'Any fish' : ITEMS[k].name), h('b', { style: have >= n ? '' : 'color:#c0304a' }, `${have} / ${n}`))); }
    detail.append(need);
    if (!s.unlocked) detail.append(h('div', { class: 'chip bad', style: 'align-self:flex-start' }, ic('ui_lock', 1), `Research: ${TECHS[r.tech].name}`));
    else if (!s.stOk) detail.append(h('div', { class: 'chip bad', style: 'align-self:flex-start' }, `Stand near a ${STATION_NAMES[r.station]}`));
    else if (r.station !== 'hand') detail.append(h('div', { class: 'chip ok', style: 'align-self:flex-start' }, ic('ui_check', 1), `${STATION_NAMES[r.station]} nearby`));
    const q = h('div', { class: 'row' },
      h('button', { class: 'btn small icon', onclick: () => { qty = Math.max(1, qty - 1); renderDetail(); } }, ic('ui_minus', 1)), h('b', { style: 'min-width:32px;text-align:center;font-size:20px' }, qty),
      h('button', { class: 'btn small icon', onclick: () => { qty = Math.min(999, qty + 1); renderDetail(); } }, ic('ui_plus', 1)),
      h('button', { class: 'btn small', onclick: () => { qty = Math.max(1, Math.min(999, maxCraft(r, s))); renderDetail(); } }, 'Max'));
    const craft = h('button', { class: 'btn good' + (s.can ? '' : ' disabled'), style: 'font-size:19px', onclick: () => { if (!s.can) { g.audio.play('error'); return; } g.cmd({ c: 'craft', rid: r.id, n: qty }); } }, ic('ui_hammer', 2), 'Craft');
    detail.append(q, craft);
  }
  function maxCraft(r, s) { let m = 999; for (const k in r.in) m = Math.min(m, Math.floor(countAll(s.src, k) / r.in[k])); return m; }
  const panel = { title: 'Crafting', icon: 'ui_hammer', body, sig: () => { const p = me(); return `${p.rev}:${w().techs.size}:${w().rev}:${w().coins}:${Math.floor(g.t * 2)}`; }, refresh: render };
  render();
  return panel;
}
