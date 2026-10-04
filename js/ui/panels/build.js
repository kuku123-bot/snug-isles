// Build menu (bottom drawer): categories, sub-filters (wall piece / furniture style), piece cards with live costs.
import { h, ic, itemIc, spriteCanvas, tip, clear, esc } from '../dom.js';
import { BUILD, BUILD_CATS, STYLES, WALL_MATS } from '../../data/build.js';
import { ITEMS } from '../../data/items.js';
import { TECHS } from '../../data/techs.js';
import { spriteName } from '../../game/builder.js';
import { sourcesFor, countAll, buildMult } from '../../sim/commands.js';

const CAT_ICON = { stations: 'ui_hammer', storage: 'ui_bag', walls: 'ui_house', floors: 'ui_sort', furniture: 'ui_cozy', walldeco: 'ui_star', decor: 'ui_heart', light: 'ui_sun', farming: 'ui_hunger', industry: 'ui_gear' };

export function buildPanel(g, data, ui) {
  let cat = g.lastBuildCat || 'walls';
  let sub = g.lastBuildSub || {};
  const world = () => g.world;
  const tabs = h('div', { class: 'tabs' });
  const subtabs = h('div', { class: 'tabs', style: 'margin-top:-2px' });
  const grid = h('div', { class: 'grid scroll', style: 'grid-template-columns:repeat(auto-fill,minmax(104px,1fr));max-height:30vh;padding:4px 2px 6px' });
  const head = h('div', { class: 'row' }, h('h3', { class: 'grow', style: 'font-size:20px' }, 'Build'),
    h('button', { class: 'btn small red', onclick: () => { g.builder.startRemove(); } }, ic('ui_trash', 1), 'Remove tool'),
    h('div', { class: 'xbtn', style: 'width:36px;height:36px', onclick: () => ui.close() }, ic('ui_cross', 2)));
  const inner = h('div', { class: 'panel' }, head, tabs, subtabs, grid);
  const shell = h('div', { class: 'drawer' }, inner);

  function isUnlocked(d) { return !d.tech || world().techs.has(d.tech); }
  function pieces() {
    const list = Object.values(BUILD).filter((d) => d.cat === cat && !d.hidden);
    if (cat === 'walls') {
      const pc = sub.walls || 'wall';
      return list.filter((d) => (pc === 'fence' ? d.piece === 'fence' || d.piece === 'gate' : d.piece === pc));
    }
    if (cat === 'furniture') { const st = sub.furniture || 'rustic'; return list.filter((d) => d.set === st); }
    if (cat === 'floors') return list;
    return list;
  }
  function render() {
    clear(tabs); clear(subtabs); clear(grid);
    for (const [id, name] of BUILD_CATS) tabs.append(h('div', { class: 'tab' + (cat === id ? ' on' : ''), onclick: () => { cat = id; g.lastBuildCat = id; g.audio.play('click', { vol: 0.5 }); render(); } }, ic(CAT_ICON[id] || 'ui_star', 1), name));
    if (cat === 'walls') {
      for (const [id, name] of [['wall', 'Walls'], ['window', 'Windows'], ['door', 'Doors'], ['fence', 'Fences & Gates']]) subtabs.append(h('div', { class: 'tab' + ((sub.walls || 'wall') === id ? ' on' : ''), onclick: () => { sub.walls = id; g.lastBuildSub = sub; render(); } }, name));
    } else if (cat === 'furniture') {
      for (const st of STYLES) {
        const unlocked = !st.tech || world().techs.has(st.tech);
        subtabs.append(h('div', { class: 'tab' + ((sub.furniture || 'rustic') === st.id ? ' on' : ''), style: unlocked ? '' : 'opacity:.55', onclick: () => { sub.furniture = st.id; g.lastBuildSub = sub; render(); } }, unlocked ? null : ic('ui_lock', 1), st.name));
      }
    }
    subtabs.style.display = subtabs.children.length ? '' : 'none';
    const p = g.me;
    const src = sourcesFor({ world: world() }, p);
    for (const d of pieces()) {
      const ok = isUnlocked(d);
      const mult = buildMult({ world: world() }, p, d);
      const cost = h('div', { class: 'cost' });
      if (mult === 0) cost.append(h('span', { class: 'chip ok' }, 'Free'));
      else for (const k of Object.keys(d.cost).slice(0, 4)) { const need = Math.ceil(d.cost[k] * mult - 1e-9), have = countAll(src, k); cost.append(h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, itemIc(k, 1), need)); }
      const card = h('div', { class: 'card' + (ok ? '' : ' locked'), onclick: () => {
        if (!ok) { g.toast(`Research "${TECHS[d.tech].name}" to unlock`, 'warn'); return; }
        g.lastBuildCat = cat; g.audio.play('click', { vol: 0.6 }); g.builder.start(d.id);
      } },
        h('div', { class: 'thumb' }, spriteCanvas(spriteName(d), 72, 52)), h('div', { class: 'nm' }, d.name), ok ? cost : h('div', { class: 'chip bad' }, ic('ui_lock', 1), TECHS[d.tech].name));
      tip(card, () => `<b>${esc(d.name)}</b>${d.desc ? '<br>' + esc(d.desc) : ''}${d.comfort ? `<br>Comfort +${d.comfort}` : ''}${d.light ? '<br>Gives light' : ''}`);
      grid.appendChild(card);
    }
  }
  render();
  return { title: 'Build', shell, body: null, passive: true, sig: () => `${g.me.rev}:${world().techs.size}:${world().rev}`, refresh: render, onClose: () => {} };
}
