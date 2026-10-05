// Research tree + personal skill tree.
import { h, ic, itemIc, clear, esc } from '../dom.js';
import { TECHS, TECH_CATS, TECH_IDS, techUnlocks, researchTierFor } from '../../data/techs.js';
import { SKILLS, SKILL_BRANCHES } from '../../data/skills.js';
import { ITEMS } from '../../data/items.js';
import { BUILD } from '../../data/build.js';
import { RECIPES } from '../../data/recipes.js';
import { sourcesFor, countAll } from '../../sim/commands.js';

const TIER_NAMES = ['', 'Stone Age', 'Copper Age', 'Iron Age', 'Golden Age', 'Arcane Age', 'Volcanic Age', 'Crystal Age', 'Starlit Age'];
const NW = 158, NH = 64, CW = 190, RH = 74, LEFT = 22;
let UNLOCKS = null;

export function techPanel(g, data, ui) {
  UNLOCKS = UNLOCKS || techUnlocks();
  const world = () => g.world;
  let selId = data.focus || null;
  let filter = g.lastTechFilter || 'all';
  const tabs = h('div', { class: 'tabs', style: 'flex-wrap:wrap;align-items:center' });
  const wrap = h('div', { class: 'tech-wrap scroll', style: 'min-width:min(86vw,760px)' });
  const detail = h('div', { class: 'panel', style: 'background:var(--paper2);padding:8px 10px' });
  const body = h('div', { class: 'col', style: 'gap:8px' }, tabs, wrap, detail);

  // graph helpers: everything a tech needs (up) and everything it leads to (down)
  const kids = {};
  for (const id of TECH_IDS) kids[id] = [];
  for (const id of TECH_IDS) for (const r of TECHS[id].req) kids[r].push(id);
  const closure = (start, next) => { const out = new Set(), st = [start]; while (st.length) { const c = st.pop(); for (const n of next(c)) if (!out.has(n)) { out.add(n); st.push(n); } } return out; };

  // layout: columns are tiers, bands are categories; a category tab shows just its own band
  let pos = {}, bandTop = {}, H = 0;
  const Wd = LEFT + 8 * CW + 20;
  const inCat = (c, t) => TECH_IDS.filter((id) => TECHS[id].tier === t && TECHS[id].cat === c.id);
  function layout() {
    pos = {}; bandTop = {};
    const cats = filter === 'all' ? TECH_CATS : TECH_CATS.filter((c) => c.id === filter);
    let y = 40;
    for (const c of cats) {
      let mx = 1;
      for (let t = 1; t <= 8; t++) mx = Math.max(mx, inCat(c, t).length);
      bandTop[c.id] = y; y += mx * RH + 30;
    }
    H = y;
    for (const c of cats) for (let t = 1; t <= 8; t++) inCat(c, t).forEach((id, i) => { pos[id] = { x: LEFT + (t - 1) * CW, y: bandTop[c.id] + i * RH }; });
  }

  const state = (id) => {
    const t = TECHS[id], w = world();
    if (w.techs.has(id)) return 'done';
    if (t.req.every((r) => w.techs.has(r))) return 'avail';
    return 'locked';
  };
  const readyList = () => TECH_IDS.filter((id) => state(id) === 'avail').sort((a, b) => TECHS[a].tier - TECHS[b].tier);
  function canResearchHere(t) {
    const w = world(), p = g.me;
    if (w.settings.techCost === 0) return true;
    const need = researchTierFor(t.tier);
    for (const th of w.thingsNear(p.x, p.y - 6, 7 * 16)) { const d = BUILD[th.type]; if (d && d.behavior === 'research' && d.conf.tier >= need) return true; }
    return false;
  }

  function renderTabs() {
    clear(tabs);
    const w = world();
    const tab = (id, label, color, count) => h('div', { class: 'tab' + (filter === id ? ' on' : ''), onclick: () => { filter = id; g.lastTechFilter = id; if (selId && id !== 'all' && TECHS[selId].cat !== id) selId = null; g.audio.play('click', { vol: 0.5 }); renderTabs(); renderTree(true); renderDetail(); } },
      color ? h('span', { style: `width:11px;height:11px;border-radius:50%;background:${color};border:2px solid var(--ink);display:inline-block` }) : null, label, count ? h('span', { class: 'small muted' }, ` ${count}`) : null);
    tabs.append(tab('all', 'All', null, `${w.techs.size}/${TECH_IDS.length}`));
    for (const c of TECH_CATS) { const ids = TECH_IDS.filter((id) => TECHS[id].cat === c.id); tabs.append(tab(c.id, c.name, c.color, `${ids.filter((id) => w.techs.has(id)).length}/${ids.length}`)); }
    const ready = readyList();
    tabs.append(h('div', { class: 'grow' }), h('button', { class: 'btn small good' + (ready.length ? '' : ' disabled'), onclick: () => {
      if (!ready.length) { g.toast('Nothing is ready yet: gather materials for the glowing ones, or research a prerequisite.', 'info'); return; }
      const i = ready.indexOf(selId);
      selId = ready[(i + 1) % ready.length];
      if (filter !== 'all' && TECHS[selId].cat !== filter) { filter = 'all'; g.lastTechFilter = 'all'; renderTabs(); }
      g.audio.play('click', { vol: 0.5 }); renderTree(); renderDetail(); centerOn(selId);
    } }, ic('ui_flask', 1), `Ready now (${ready.length})`));
  }

  function centerOn(id) {
    const p = pos[id]; if (!p) return;
    wrap.scrollLeft = Math.max(0, p.x - (wrap.clientWidth - NW) / 2);
    wrap.scrollTop = Math.max(0, p.y - (wrap.clientHeight - NH) / 2);
  }

  function renderTree(resetScroll) {
    const sl = wrap.scrollLeft, stp = wrap.scrollTop; // a refresh (picked something up, built something…) must not throw you back to the top
    layout(); clear(wrap);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', Wd); svg.setAttribute('height', H);
    for (let t = 1; t <= 8; t++) wrap.appendChild(h('div', { class: 'tcat', style: `left:${LEFT + (t - 1) * CW}px;top:8px;font-size:14px;color:#ffe9a0` }, `Tier ${t} · ${TIER_NAMES[t]}`));
    for (const c of TECH_CATS) if (bandTop[c.id] !== undefined) wrap.appendChild(h('div', { class: 'tcat', style: `left:${LEFT}px;top:${bandTop[c.id] - 20}px;color:${c.color}` }, c.name));
    // edges: quiet by default, bright for what the selected tech needs (gold) and what it leads to (pink)
    const anc = selId ? closure(selId, (id) => TECHS[id].req) : null;
    const dec = selId ? closure(selId, (id) => kids[id]) : null;
    const rel = selId ? new Set([selId, ...anc, ...dec]) : null;
    const edges = [];
    for (const id of TECH_IDS) { if (!pos[id]) continue; for (const r of TECHS[id].req) if (pos[r]) edges.push([r, id]); }
    const STYLE = { dim: ['#6a5a88', 2, 0.14], idle: ['#7a6a98', 2, 0.5], done: ['#8be06a', 3, 0.75], ready: ['#ffd84a', 3, 1], up: ['#ffe066', 4, 1], down: ['#ff9fd0', 4, 1] };
    const kindOf = ([r, id]) => {
      if (selId) return (id === selId || anc.has(id)) ? 'up' : (r === selId || dec.has(r)) ? 'down' : 'dim';
      // at rest: green = finished, gold = ready to research, faint = same band; long cross-band links stay hidden until you select something
      if (state(id) === 'done') return 'done';
      if (state(id) === 'avail') return 'ready';
      return TECHS[r].cat === TECHS[id].cat ? 'idle' : 'far';
    };
    const order = ['dim', 'idle', 'done', 'ready', 'up', 'down'];
    edges.sort((a, b) => order.indexOf(kindOf(a)) - order.indexOf(kindOf(b)));
    for (const e of edges) {
      if (kindOf(e) === 'far') continue;
      const q = pos[e[0]], p = pos[e[1]];
      let d;
      if (p.x <= q.x + 4) { // same column: leave from the bottom/top edge instead of looping back
        const down = p.y >= q.y, x1 = q.x + NW / 2, y1 = q.y + (down ? NH : 0), x2 = p.x + NW / 2, y2 = p.y + (down ? 0 : NH), my = (y1 + y2) / 2;
        d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
      } else {
        const x1 = q.x + NW, y1 = q.y + NH / 2, x2 = p.x, y2 = p.y + NH / 2, k = Math.max(40, (x2 - x1) * 0.5);
        d = `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
      }
      const [col, wd, op] = STYLE[kindOf(e)];
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d); path.setAttribute('stroke', col); path.setAttribute('stroke-width', wd); path.setAttribute('fill', 'none'); path.setAttribute('opacity', op); path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }
    wrap.appendChild(svg);
    for (const id of TECH_IDS) {
      const t = TECHS[id], p = pos[id];
      if (!p) continue;
      const st = state(id), cat = TECH_CATS.find((c) => c.id === t.cat), un = UNLOCKS[id];
      const node = h('div', { class: `tnode ${st}${selId === id ? ' sel' : ''}${rel && !rel.has(id) ? ' dim' : ''}`, style: `left:${p.x}px;top:${p.y}px;width:${NW}px;min-height:${NH}px;border-color:${cat.color}`, onclick: () => { selId = selId === id ? null : id; g.audio.play('click', { vol: 0.5 }); renderTree(); renderDetail(); } },
        h('div', { class: 'row', style: 'gap:4px' }, st === 'done' ? ic('ui_check', 1) : st === 'locked' ? ic('ui_lock', 1) : ic('ui_flask', 1), h('b', null, t.name)),
        h('div', { class: 'small muted' }, `${un.build.length + un.recipes.length + un.process.length} unlocks`));
      wrap.appendChild(node);
    }
    wrap.style.height = Math.min(H + 10, Math.round(window.innerHeight * 0.5)) + 'px';
    if (resetScroll) { wrap.scrollLeft = 0; wrap.scrollTop = 0; const f = selId && pos[selId] ? selId : readyList().find((id) => pos[id]); if (f) centerOn(f); } else { wrap.scrollLeft = sl; wrap.scrollTop = stp; }
  }

  function renderDetail() {
    clear(detail);
    const t = TECHS[selId];
    if (!t) { detail.appendChild(h('div', { class: 'muted small', style: 'padding:2px 4px' }, 'Tap a technology to see its cost and what it unlocks. Yellow ones are ready to research! Its path lights up: gold = needs, pink = leads to.')); return; }
    const w = world(), p = g.me, st = state(t.id), src = sourcesFor({ world: w }, p), mult = w.settings.techCost;
    const un = UNLOCKS[t.id];
    detail.append(h('div', { class: 'row', style: 'flex-wrap:wrap' },
      h('div', { class: 'grow', style: 'min-width:220px' }, h('b', { style: 'font-size:19px' }, t.name), h('span', { class: 'small muted' }, `  Tier ${t.tier}`), h('div', { class: 'small' }, t.desc),
        t.fx ? h('div', { class: 'small', style: 'color:#3f9a2e' }, 'Permanent bonus for everyone') : null),
      h('div', { class: 'col', style: 'min-width:190px' }, h('div', { class: 'cost', style: 'justify-content:flex-start' }, ...(mult === 0 ? [h('span', { class: 'chip ok' }, 'Free research!')] : Object.keys(t.cost).map((k) => { const need = Math.ceil(t.cost[k] * mult), have = countAll(src, k); return h('span', { class: 'chip ' + (have >= need ? 'ok' : 'bad') }, itemIc(k, 1), `${have}/${need}`); })))),
    ));
    const ul = h('div', { class: 'row small', style: 'flex-wrap:wrap;gap:4px;margin-top:4px' });
    const names = [];
    for (const b of un.build.slice(0, 14)) names.push(BUILD[b].name);
    for (const r of un.recipes.slice(0, 8)) names.push(ITEMS[RECIPES.find((x) => x.id === r).out].name);
    for (const o of un.process.slice(0, 4)) names.push(ITEMS[o].name);
    const more = un.build.length + un.recipes.length + un.process.length - names.length;
    ul.append(h('span', { class: 'muted' }, 'Unlocks:'), ...names.map((n) => h('span', { class: 'chip' }, n)), more > 0 ? h('span', { class: 'muted' }, `+${more} more`) : null);
    detail.append(ul);
    const row = h('div', { class: 'row', style: 'margin-top:6px;justify-content:flex-end' });
    if (st === 'done') row.append(h('span', { class: 'chip ok' }, ic('ui_check', 1), 'Researched'));
    else if (st === 'locked') row.append(h('span', { class: 'chip bad' }, ic('ui_lock', 1), 'Needs: ' + t.req.filter((r) => !w.techs.has(r)).map((r) => TECHS[r].name).join(', ')));
    else {
      const near = canResearchHere(t);
      const afford = mult === 0 || Object.keys(t.cost).every((k) => countAll(src, k) >= Math.ceil(t.cost[k] * mult));
      if (!near) row.append(h('span', { class: 'chip bad' }, researchTierFor(t.tier) === 1 ? 'Stand near a Research Table' : researchTierFor(t.tier) === 2 ? 'Needs a Library Desk nearby' : 'Needs an Observatory nearby'));
      row.append(h('button', { class: 'btn good' + (near && afford ? '' : ' disabled'), onclick: () => { if (!near || !afford) { g.audio.play('error'); g.toast(!near ? 'Go stand next to the right research station.' : 'Not enough materials yet.', 'warn'); return; } g.cmd({ c: 'research', tid: t.id }); } }, ic('ui_flask', 2), 'Research'));
    }
    detail.append(row);
  }
  const panel = { title: 'Research', icon: 'ui_flask', body, sig: () => `${world().techs.size}:${g.me.rev}:${world().rev}`, refresh: () => { renderTabs(); renderTree(); renderDetail(); } };
  renderTabs(); renderTree(); renderDetail();
  // open centred on what you asked for, else on the first tech that is ready to research
  setTimeout(() => { const f = data.focus && TECHS[data.focus] ? data.focus : readyList()[0]; if (!f) return; if (!pos[f] && filter !== 'all') { filter = 'all'; renderTabs(); renderTree(); } centerOn(f); }, 30);
  return panel;
}

export function skillsPanel(g, data, ui) {
  const me = () => g.me;
  const cols = h('div', { class: 'row scroll', style: 'align-items:flex-start;gap:10px;max-height:60vh;flex-wrap:wrap;min-width:min(88vw,820px)' });
  const pts = h('div', { class: 'pill' });
  function render() {
    const p = me();
    clear(cols); clear(pts);
    pts.append(ic('ui_star', 2), ` ${p.sp} skill point${p.sp === 1 ? '' : 's'}`);
    for (const b of SKILL_BRANCHES) {
      const col = h('div', { class: 'skill-col' }, h('b', { style: `color:${b.color};text-shadow:0 2px 0 var(--ink);font-size:18px` }, b.name));
      for (const s of Object.values(SKILLS).filter((x) => x.branch === b.id)) {
        const rank = p.skills[s.id] || 0;
        const reqOk = !s.req || (p.skills[s.req] || 0) > 0;
        const can = reqOk && rank < s.max && p.sp >= s.cost;
        const el = h('div', { class: 'skill' + (rank >= s.max ? ' max' : can ? ' can' : !reqOk ? ' locked' : ''), onclick: () => { if (rank >= s.max) return; if (!reqOk) { g.toast(`Needs ${SKILLS[s.req].name} first`, 'warn'); return; } if (p.sp < s.cost) { g.toast('Not enough skill points — level up!', 'warn'); return; } g.cmd({ c: 'skill', sid: s.id }); } },
          h('b', null, s.name, s.cost > 1 ? h('span', { class: 'muted' }, ` (${s.cost} pts)`) : null), h('div', { class: 'small', style: 'opacity:.85' }, s.desc),
          h('div', { class: 'pips' }, ...Array.from({ length: s.max }, (_, i) => h('i', { class: i < rank ? 'on' : '' }))));
        col.appendChild(el);
      }
      cols.appendChild(col);
    }
  }
  render();
  return { title: 'Skills', icon: 'ui_skills', headExtra: pts, body: cols, sig: () => `${me().rev}`, refresh: render };
}
