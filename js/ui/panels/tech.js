// Research ("upgrades") and personal skills: one branch at a time, big picture buttons joined by lines. Tap a box to read about it.
import { h, ic, itemIc, clear } from '../dom.js';
import { TECHS, TECH_CATS, TECH_IDS, techUnlocks, researchTierFor } from '../../data/techs.js';
import { SKILLS, SKILL_BRANCHES } from '../../data/skills.js';
import { ITEMS } from '../../data/items.js';
import { BUILD } from '../../data/build.js';
import { RECIPES } from '../../data/recipes.js';
import { spriteName } from '../../game/builder.js';
import { sourcesFor, countAll } from '../../sim/commands.js';
import { treeView, branchTabs, pic } from '../tree.js';
import { techCostMult } from '../../data/difficulty.js';
import { techNodes, skillNodes, TECH_BRANCH_ICON, SKILL_BRANCH_ICON } from '../treedata.js';

const TIER_NAMES = ['', 'Stone Age', 'Copper Age', 'Iron Age', 'Golden Age', 'Arcane Age', 'Volcanic Age', 'Crystal Age', 'Starlit Age'];
let UNLOCKS = null;

export function techPanel(g, data, ui) {
  UNLOCKS = UNLOCKS || techUnlocks();
  const world = () => g.world;
  const state = (id) => (world().techs.has(id) ? 'done' : TECHS[id].req.every((r) => world().techs.has(r)) ? 'ready' : 'locked');
  const readyIn = (cat) => TECH_IDS.some((id) => TECHS[id].cat === cat && state(id) === 'ready');
  let selId = data.focus && TECHS[data.focus] ? data.focus : null;
  let branch = selId ? TECHS[selId].cat : TECH_CATS.some((c) => c.id === g.lastTechBranch) ? g.lastTechBranch : (TECH_CATS.find((c) => readyIn(c.id)) || TECH_CATS[0]).id;
  let tabs = h('div');
  const tree = treeView({ onSelect: (id) => { selId = selId === id ? null : id; g.audio.play('click', { vol: 0.5 }); renderTree(); renderDetail(); } });
  const detail = h('div', { class: 'tdetail' });
  const body = h('div', { class: 'col tree-panel', style: 'gap:8px' }, tabs, tree.el, detail);

  const cost = (t) => { const mult = techCostMult(world().settings), src = sourcesFor({ world: world() }, g.me); return mult === 0 || Object.keys(t.cost).every((k) => countAll(src, k) >= Math.ceil(t.cost[k] * mult)); };
  function canResearchHere(t) {
    const w = world(), p = g.me;
    if (w.settings.techCost === 0) return true;
    const need = researchTierFor(t.tier);
    for (const th of w.thingsNear(p.x, p.y - 6, 7 * 16)) { const d = BUILD[th.type]; if (d && d.behavior === 'research' && d.conf.tier >= need) return true; }
    return false;
  }

  function renderTabs() {
    const w = world();
    const items = TECH_CATS.map((c) => { const ids = TECH_IDS.filter((id) => TECHS[id].cat === c.id); return { id: c.id, name: c.short || c.name, full: c.name, color: c.color, icon: TECH_BRANCH_ICON[c.id] || 'ui_flask', count: `${ids.filter((id) => w.techs.has(id)).length}/${ids.length}`, ready: readyIn(c.id) }; });
    tabs.replaceWith(tabs = branchTabs(items, branch, (id) => { branch = id; g.lastTechBranch = id; if (selId && TECHS[selId].cat !== id) selId = null; g.audio.play('click', { vol: 0.5 }); renderTabs(); renderTree(true); renderDetail(); }));
  }
  function renderTree(center) {
    const cat = TECH_CATS.find((c) => c.id === branch);
    tree.render(techNodes(cat, world().techs, cost), selId);
    if (center) { const first = selId || TECH_IDS.filter((id) => TECHS[id].cat === branch).find((id) => state(id) === 'ready'); tree.el.scrollLeft = 0; tree.el.scrollTop = 0; if (first) tree.centerOn(first); }
  }
  function renderDetail() {
    clear(detail);
    const t = TECHS[selId];
    if (!t) { detail.append(h('div', { class: 'td-empty' }, ic('ui_flask', 2), h('div', null, 'Tap a box to read about it. ', h('b', null, 'Yellow'), ' boxes are ready to research, green ones are done.'))); return; }
    const w = world(), p = g.me, st = state(t.id), src = sourcesFor({ world: w }, p), mult = techCostMult(w.settings), un = UNLOCKS[t.id];
    const costs = h('div', { class: 'cost', style: 'justify-content:flex-start' }, ...(mult === 0 ? [h('span', { class: 'chip ok' }, 'Free research!')] : Object.keys(t.cost).map((k) => { const need = Math.ceil(t.cost[k] * mult), have = countAll(src, k); return h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, itemIc(k, 1), `${have}/${need}`); })));
    // what it unlocks, as little pictures (hover or long-press shows the name)
    const pics = [];
    for (const b of un.build.slice(0, 18)) pics.push({ icon: spriteName(BUILD[b]), name: BUILD[b].name });
    for (const r of un.recipes.slice(0, 8)) { const out = RECIPES.find((x) => x.id === r).out; pics.push({ icon: 'i_' + out, name: ITEMS[out].name }); }
    for (const o of un.process.slice(0, 4)) pics.push({ icon: 'i_' + o, name: ITEMS[o].name });
    const total = un.build.length + un.recipes.length + un.process.length;
    const shown = pics.slice(0, 14);
    const unlocks = total || t.fx ? h('div', { class: 'td-unlocks' }, h('span', { class: 'small muted' }, total ? 'Unlocks' : 'Bonus'), ...shown.map((u) => h('span', { class: 'uic', title: u.name }, pic(u.icon, 30))), total > shown.length ? h('span', { class: 'small muted' }, `+${total - shown.length} more`) : null, t.fx ? h('span', { class: 'chip ok' }, 'Permanent bonus for everyone') : null) : null;
    const act = h('div', { class: 'td-act' });
    if (st === 'done') act.append(h('span', { class: 'chip ok' }, ic('ui_check', 1), 'Researched'));
    else if (st === 'locked') {
      for (const r of t.req.filter((x) => !w.techs.has(x))) act.append(h('button', { class: 'btn small', title: 'Show it', onclick: () => { branch = TECHS[r].cat; g.lastTechBranch = branch; selId = r; renderTabs(); renderTree(true); renderDetail(); } }, ic('ui_lock', 1), 'Needs ' + TECHS[r].name));
    } else {
      const near = canResearchHere(t), afford = cost(t);
      if (!near) act.append(h('span', { class: 'chip bad' }, researchTierFor(t.tier) === 1 ? 'Stand near a Research Table' : researchTierFor(t.tier) === 2 ? 'Needs a Library Desk nearby' : 'Needs an Observatory nearby'));
      act.append(h('button', { class: 'btn good big' + (near && afford ? '' : ' disabled'), onclick: () => { if (!near || !afford) { g.audio.play('error'); g.toast(!near ? 'Go stand next to the right research station.' : 'Not enough materials yet.', 'warn'); return; } g.cmd({ c: 'research', tid: t.id }); } }, ic('ui_flask', 2), 'Research'));
    }
    detail.append(
      h('div', { class: 'td-main' }, pic(t.icon, 64), h('div', { class: 'grow' }, h('div', { class: 'td-name' }, t.name, h('span', { class: 'small muted' }, `  ${TIER_NAMES[t.tier]}`)), h('div', { class: 'td-desc' }, t.desc)), h('div', { class: 'td-cost' }, costs), act),
      unlocks);
  }
  const panel = { title: 'Research', icon: 'ui_flask', body, sig: () => `${world().techs.size}:${g.me.rev}:${world().rev}`, refresh: () => { renderTabs(); renderTree(); renderDetail(); } };
  renderTabs(); renderTree(); renderDetail();
  setTimeout(() => renderTree(true), 30); // once the panel has its real size: open on the first box that is ready (or the one asked for)
  return panel;
}

export function skillsPanel(g, data, ui) {
  const me = () => g.me;
  let selId = data.focus && SKILLS[data.focus] ? data.focus : null;
  let branch = selId ? SKILLS[selId].branch : SKILL_BRANCHES.some((b) => b.id === g.lastSkillBranch) ? g.lastSkillBranch : SKILL_BRANCHES[0].id;
  const pts = h('div', { class: 'pill' });
  let tabs = h('div');
  const tree = treeView({ onSelect: (id) => { selId = selId === id ? null : id; g.audio.play('click', { vol: 0.5 }); renderTree(); renderDetail(); } });
  const detail = h('div', { class: 'tdetail' });
  const body = h('div', { class: 'col tree-panel', style: 'gap:8px' }, tabs, tree.el, detail);
  const canLearn = (s) => { const p = me(); return (!s.req || (p.skills[s.req] || 0) > 0) && (p.skills[s.id] || 0) < s.max && p.sp >= s.cost; };

  function renderTabs() {
    const p = me();
    const items = SKILL_BRANCHES.map((b) => { const ids = Object.keys(SKILLS).filter((id) => SKILLS[id].branch === b.id); return { id: b.id, name: b.name, color: b.color, icon: SKILL_BRANCH_ICON[b.id] || 'ui_star', count: `${ids.reduce((n, id) => n + (p.skills[id] || 0), 0)}/${ids.reduce((n, id) => n + SKILLS[id].max, 0)}`, ready: ids.some((id) => canLearn(SKILLS[id])) }; });
    tabs.replaceWith(tabs = branchTabs(items, branch, (id) => { branch = id; g.lastSkillBranch = id; if (selId && SKILLS[selId].branch !== id) selId = null; g.audio.play('click', { vol: 0.5 }); renderTabs(); renderTree(true); renderDetail(); }));
  }
  function renderTree(center) {
    const b = SKILL_BRANCHES.find((x) => x.id === branch);
    tree.render(skillNodes(b, me()), selId);
    if (center) { tree.el.scrollLeft = 0; tree.el.scrollTop = 0; if (selId) tree.centerOn(selId); }
  }
  function renderDetail() {
    clear(detail);
    const p = me(), s = SKILLS[selId];
    if (!s) { detail.append(h('div', { class: 'td-empty' }, ic('ui_star', 2), h('div', null, 'Tap a box to read about it. ', h('b', null, 'Yellow'), ' boxes are ready to learn: every level you earn gives one skill point.'))); return; }
    const rank = p.skills[s.id] || 0, reqOk = !s.req || (p.skills[s.req] || 0) > 0;
    const act = h('div', { class: 'td-act' });
    if (rank >= s.max) act.append(h('span', { class: 'chip ok' }, ic('ui_check', 1), 'Fully learned'));
    else if (!reqOk) act.append(h('button', { class: 'btn small', onclick: () => { selId = s.req; renderTree(true); renderDetail(); } }, ic('ui_lock', 1), 'Needs ' + SKILLS[s.req].name));
    else act.append(h('button', { class: 'btn good big' + (p.sp >= s.cost ? '' : ' disabled'), onclick: () => { if (p.sp < s.cost) { g.audio.play('error'); g.toast('Not enough skill points — level up!', 'warn'); return; } g.cmd({ c: 'skill', sid: s.id }); } }, ic('ui_star', 2), rank ? 'Level up' : 'Learn', s.cost > 1 ? h('span', { class: 'small' }, ` (${s.cost} pts)`) : null));
    detail.append(h('div', { class: 'td-main' }, pic(s.icon, 64), h('div', { class: 'grow' }, h('div', { class: 'td-name' }, s.name), h('div', { class: 'td-desc' }, s.desc), h('div', { class: 'pips' }, ...Array.from({ length: s.max }, (_, i) => h('i', { class: i < rank ? 'on' : '' })))), act));
  }
  function render() { const p = me(); clear(pts); pts.append(ic('ui_star', 2), ` ${p.sp} skill point${p.sp === 1 ? '' : 's'}`); renderTabs(); renderTree(); renderDetail(); }
  render();
  setTimeout(() => renderTree(true), 30);
  return { title: 'Skills', icon: 'ui_skills', headExtra: pts, body, sig: () => `${me().rev}`, refresh: render };
}
