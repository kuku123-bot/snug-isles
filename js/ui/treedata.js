// What the Research and Skills trees show: pure functions from the game data to "boxes" (no DOM, so tests can check them).
// A box: { id, label, icon, state (css classes), color, parents, col?, badge, extras }
//   badge: { kind: 'check' | 'lock' } or { text } or null; extras: small pictures for prerequisites that live in another branch
import { TECHS, TECH_CATS, TECH_IDS } from '../data/techs.js';
import { SKILLS } from '../data/skills.js';

export const TECH_BRANCH_ICON = { home: 'ui_house', craft: 'ui_hammer', farm: 't_farm_plot', magic: 'ui_flask', adv: 'ui_sword', sea: 'ui_fish' };
export const SKILL_BRANCH_ICON = { forage: 'i_pickaxe_iron', fight: 'ui_sword', home: 'ui_house', nature: 'i_seed_wheat', wander: 'ui_map' };

/** how far along the whole tech chain a technology is (0 = nothing needed): its column, so every line runs left to right */
const DEPTH = {};
export function techDepth(id) {
  if (DEPTH[id] !== undefined) return DEPTH[id];
  DEPTH[id] = 0; // (a cycle in the data cannot recurse forever)
  const reqs = TECHS[id].req;
  return (DEPTH[id] = reqs.length ? 1 + Math.max(...reqs.map(techDepth)) : 0);
}

/** the boxes of one research branch, in the order they are laid out. techs = Set of researched ids; afford(tech) -> can pay now */
export function techNodes(cat, techs, afford) {
  const ids = TECH_IDS.filter((id) => TECHS[id].cat === cat.id).sort((a, b) => TECHS[a].tier - TECHS[b].tier || TECH_IDS.indexOf(a) - TECH_IDS.indexOf(b));
  return ids.map((id) => {
    const t = TECHS[id], done = techs.has(id), open = t.req.every((r) => techs.has(r));
    return {
      id, label: t.name, icon: t.icon, color: cat.color, col: techDepth(id),
      state: done ? 'done' : open ? 'ready' + (afford && afford(t) ? ' can' : '') : 'locked',
      parents: t.req.filter((r) => TECHS[r].cat === cat.id),
      extras: t.req.filter((r) => TECHS[r].cat !== cat.id).map((r) => ({ icon: TECHS[r].icon, color: TECH_CATS.find((c) => c.id === TECHS[r].cat).color, title: `Needs ${TECHS[r].name}`, ok: techs.has(r) })),
      badge: done ? { kind: 'check' } : !open ? { kind: 'lock' } : null,
    };
  });
}

/** the boxes of one skill branch (p = the player: p.skills ranks, p.sp points) */
export function skillNodes(branch, p) {
  return Object.keys(SKILLS).filter((id) => SKILLS[id].branch === branch.id).map((id) => {
    const s = SKILLS[id], rank = p.skills[id] || 0, reqOk = !s.req || (p.skills[s.req] || 0) > 0, can = reqOk && rank < s.max && p.sp >= s.cost;
    return {
      id, label: s.name, icon: s.icon, color: branch.color, parents: s.req && SKILLS[s.req].branch === branch.id ? [s.req] : [],
      state: rank >= s.max ? 'done max' : can ? 'ready can' : !reqOk ? 'locked' : rank > 0 ? 'done own' : 'wait',
      badge: !reqOk ? { kind: 'lock' } : { text: `${rank}/${s.max}` },
    };
  });
}
