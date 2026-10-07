// Crafting window: recipes grouped by station, ingredient have/need, quantity, craft button.
import { h, ic, itemIc, tip, esc, clear } from '../dom.js';
import { ITEMS, itemDesc } from '../../data/items.js';
import { RECIPES, STATION_NAMES } from '../../data/recipes.js';
import { TECHS } from '../../data/techs.js';
import { sourcesFor, countAll, stationNear } from '../../sim/commands.js';

const STATION_ORDER = ['hand', 'workbench', 'campfire', 'kitchen', 'sewing', 'anvil', 'alchemy', 'arcane', 'forge', 'prism', 'starforge'];
// the station's own picture (what you build), so the side list looks like the things you stand next to
const STATION_ICON = { hand: 'ui_hand', workbench: 't_workbench', campfire: 't_campfire', kitchen: 't_kitchen', sewing: 't_sewing_station', anvil: 't_anvil', alchemy: 't_alchemy_table', arcane: 't_arcane_altar', forge: 't_forge', prism: 't_prism_workshop', starforge: 't_star_forge', fireworks: 't_workbench' };

export function craftPanel(g, data, ui) {
  let tab = data.station || 'avail';
  let selId = null;
  let qty = 1;
  let showLocked = false;
  const w = () => g.world, me = () => g.me;
  // side list of stations (big pictures), grid of big item pictures, details
  const rail = h('div', { class: 'crrail scroll' });
  const grid = h('div', { class: 'crgrid scroll' });
  const detail = h('div', { class: 'col crdetail' });
  const body = h('div', { class: 'crafter' }, rail, grid, detail);

  const status = (r) => {
    const world = w(), p = me();
    const src = sourcesFor({ world }, p);
    const unlocked = !r.tech || world.techs.has(r.tech);
    const stOk = stationNear({ world }, p, r.station);
    let can = unlocked && stOk;
    const miss = [];
    for (const k in r.in) { const have = countAll(src, k), need = r.in[k]; if (have < need) { can = false; miss.push(k); } }
    return { unlocked, stOk, can, src, haveAll: miss.length === 0 };
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
  const stationPic = (st) => { const name = STATION_ICON[st] || 'ui_hammer', [sw] = g.sprites.size(name); return h('div', { class: 'crpic' }, ic(name, sw <= 16 ? 3 : 2)); };
  function render() {
    const world = w();
    clear(rail);
    const count = (st) => RECIPES.filter((r) => (st === 'avail' ? true : r.station === st) && (!r.tech || world.techs.has(r.tech)) && status(r).can).length;
    const mk = (id, label, pic) => {
      const n = id === 'all' ? 0 : count(id);
      return h('div', { class: 'crst' + (tab === id ? ' on' : ''), title: label, onclick: () => { tab = id; selId = null; g.audio.play('click', { vol: 0.5 }); render(); } },
        pic, h('span', { class: 'crname' }, label), n ? h('span', { class: 'crbadge' }, n) : null);
    };
    rail.append(mk('avail', 'Can craft', h('div', { class: 'crpic' }, ic('ui_check', 3))), mk('all', 'Everything', h('div', { class: 'crpic' }, ic('ui_bag', 3))));
    for (const st of STATION_ORDER) { if (RECIPES.some((r) => r.station === st && (!r.tech || world.techs.has(r.tech)))) rail.append(mk(st, STATION_NAMES[st], stationPic(st))); }
    rail.append(h('div', { class: 'crst lock', onclick: () => { showLocked = !showLocked; render(); } }, h('div', { class: 'crpic' }, ic(showLocked ? 'ui_unlock' : 'ui_lock', 2)), h('span', { class: 'crname' }, showLocked ? 'Hide locked' : 'Show locked')));
    clear(grid);
    const rows = visibleRecipes();
    if (!rows.length) grid.appendChild(h('div', { class: 'muted', style: 'padding:14px;grid-column:1/-1' }, tab === 'avail' ? 'Nothing you can make right now. Gather materials, or stand next to a workbench or other station!' : 'No recipes here yet. Research more!'));
    for (const r of rows) {
      const s = status(r);
      const card = h('div', { class: 'crcard' + (selId === r.id ? ' on' : '') + (s.unlocked ? (s.can ? ' can' : s.haveAll ? ' far' : '') : ' locked'), title: ITEMS[r.out].name,
        onclick: () => { selId = r.id; qty = 1; g.audio.play('click', { vol: 0.5 }); render(); } },
        itemIc(r.out, 3), h('span', { class: 'crtitle' }, ITEMS[r.out].name), r.n > 1 ? h('span', { class: 'crqty' }, '×' + r.n) : null,
        s.unlocked ? (s.can ? h('span', { class: 'crok' }, ic('ui_check', 1)) : null) : h('span', { class: 'crok' }, ic('ui_lock', 1)));
      tip(card, () => `<b>${esc(ITEMS[r.out].name)}</b><br>` + Object.keys(r.in).map((k) => `${r.in[k]} ${esc(k === '@fish' ? 'any fish' : ITEMS[k].name)}`).join(', '));
      grid.appendChild(card);
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
