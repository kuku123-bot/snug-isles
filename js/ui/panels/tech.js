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
  const wrap = h('div', { class: 'tech-wrap scroll', style: 'max-height:46vh;min-width:min(86vw,760px)' });
  const detail = h('div', { class: 'panel', style: 'background:var(--paper2);padding:8px 10px;min-height:92px' });
  const body = h('div', { class: 'col' }, wrap, detail);

  // layout
  const pos = {};
  const bandTop = {};
  let y = 40;
  for (const c of TECH_CATS) {
    let mx = 1;
    for (let t = 1; t <= 8; t++) mx = Math.max(mx, TECH_IDS.filter((id) => TECHS[id].tier === t && TECHS[id].cat === c.id).length);
    bandTop[c.id] = y; y += mx * RH + 30;
  }
  const H = y;
  for (const c of TECH_CATS) for (let t = 1; t <= 8; t++) { TECH_IDS.filter((id) => TECHS[id].tier === t && TECHS[id].cat === c.id).forEach((id, i) => { pos[id] = { x: LEFT + (t - 1) * CW, y: bandTop[c.id] + i * RH }; }); }
  const Wd = LEFT + 8 * CW + 20;

  const state = (id) => {
    const t = TECHS[id], w = world();
    if (w.techs.has(id)) return 'done';
    if (t.req.every((r) => w.techs.has(r))) return 'avail';
    return 'locked';
  };
  function canResearchHere(t) {
    const w = world(), p = g.me;
    if (w.settings.techCost === 0) return true;
    const need = researchTierFor(t.tier);
    for (const th of w.thingsNear(p.x, p.y - 6, 7 * 16)) { const d = BUILD[th.type]; if (d && d.behavior === 'research' && d.conf.tier >= need) return true; }
    return false;
  }
  function renderTree() {
    clear(wrap);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', Wd); svg.setAttribute('height', H);
    // tier headers + band labels
    for (let t = 1; t <= 8; t++) wrap.appendChild(h('div', { class: 'tcat', style: `left:${LEFT + (t - 1) * CW}px;top:8px;font-size:14px;color:#ffe9a0` }, `Tier ${t} · ${TIER_NAMES[t]}`));
    for (const c of TECH_CATS) wrap.appendChild(h('div', { class: 'tcat', style: `left:${LEFT}px;top:${bandTop[c.id] - 20}px;color:${c.color}` }, c.name));
    for (const id of TECH_IDS) {
      const t = TECHS[id], p = pos[id];
      for (const r of t.req) {
        const q = pos[r]; if (!q) continue;
        const x1 = q.x + NW, y1 = q.y + NH / 2, x2 = p.x, y2 = p.y + NH / 2, mx = (x1 + x2) / 2;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
        const st = state(id);
        path.setAttribute('stroke', world().techs.has(r) ? (st === 'done' ? '#8be06a' : '#ffd84a') : '#6a5a88');
        path.setAttribute('stroke-width', '3'); path.setAttribute('fill', 'none'); path.setAttribute('opacity', '.85');
        svg.appendChild(path);
      }
    }
    wrap.appendChild(svg);
    for (const id of TECH_IDS) {
      const t = TECHS[id], p = pos[id], st = state(id);
      const cat = TECH_CATS.find((c) => c.id === t.cat);
      const un = UNLOCKS[id];
      const first = un.build[0] || null;
      const node = h('div', { class: `tnode ${st}${selId === id ? ' sel' : ''}`, style: `left:${p.x}px;top:${p.y}px;width:${NW}px;min-height:${NH}px;border-color:${cat.color === '#ffb347' ? '#3a2848' : '#3a2848'}`, onclick: () => { selId = id; g.audio.play('click', { vol: 0.5 }); renderTree(); renderDetail(); } },
        h('div', { class: 'row', style: 'gap:4px' }, st === 'done' ? ic('ui_check', 1) : st === 'locked' ? ic('ui_lock', 1) : ic('ui_flask', 1), h('b', null, t.name)),
        h('div', { class: 'small muted' }, `${un.build.length + un.recipes.length + un.process.length} unlocks`));
      node.style.borderColor = cat.color;
      wrap.appendChild(node);
    }
    wrap.style.height = Math.min(H + 10, Math.round(window.innerHeight * 0.46)) + 'px';
  }
  function renderDetail() {
    clear(detail);
    const t = TECHS[selId];
    if (!t) { detail.appendChild(h('div', { class: 'muted', style: 'padding:6px' }, 'Tap a technology to see what it unlocks and what it costs. Glowing yellow ones are ready to research!')); return; }
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
  const panel = { title: 'Research', icon: 'ui_flask', body, sig: () => `${world().techs.size}:${g.me.rev}:${world().rev}`, refresh: () => { renderTree(); renderDetail(); } };
  renderTree(); renderDetail();
  // scroll to the first available node
  setTimeout(() => { const f = TECH_IDS.find((id) => state(id) === 'avail'); if (f && !data.focus) { wrap.scrollLeft = Math.max(0, pos[f].x - 140); wrap.scrollTop = Math.max(0, pos[f].y - 60); } else if (data.focus && pos[data.focus]) { wrap.scrollLeft = Math.max(0, pos[data.focus].x - 140); wrap.scrollTop = Math.max(0, pos[data.focus].y - 60); } }, 30);
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
