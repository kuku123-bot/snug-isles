// Island Goals: the cozy checklist (what's next, what you've done, what each one pays).
import { h, ic, clear } from '../dom.js';
import { GOALS, GOAL_SECTIONS, nextGoal } from '../../data/goals.js';
import { census } from '../../sim/goals.js';

export function goalsPanel(g, data, ui) {
  const body = h('div', { class: 'col scroll', style: 'max-height:68vh;min-width:min(90vw,580px);gap:8px;padding-right:4px' });
  const row = (x, done, isNext, c) => {
    const pr = !done && x.prog ? x.prog(c) : null;
    return h('div', { class: 'goal' + (done ? ' done' : '') + (isNext ? ' next' : '') },
      h('div', { class: 'gicon' }, ic(x.icon, 2)),
      h('div', { class: 'grow' },
        h('b', null, x.title),
        x.desc ? h('div', { class: 'small muted' }, x.desc) : null,
        pr ? h('div', { class: 'row', style: 'gap:6px;margin-top:2px' }, h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.round(100 * pr[0] / pr[1])}%` })), h('span', { class: 'small' }, `${pr[0]}/${pr[1]}`)) : null),
      done ? ic('ui_check', 2) : h('div', { class: 'rw' }, x.reward.coins ? h('span', { class: 'chip' }, ic('i_coin', 1), x.reward.coins) : null, x.reward.xp ? h('span', { class: 'chip' }, ic('ui_star', 1), x.reward.xp) : null));
  };
  function render() {
    clear(body);
    const w = g.world, done = new Set(w.shared.flags.goals || []);
    const c = census(w);
    const nxt = nextGoal(done);
    const earned = GOALS.filter((x) => done.has(x.id)).reduce((a, x) => a + (x.reward.coins || 0), 0);
    body.append(h('div', { class: 'row' }, h('b', { style: 'font-size:18px' }, `${done.size} of ${GOALS.length} goals`), h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.round(100 * done.size / GOALS.length)}%` })), h('span', { class: 'chip' }, ic('i_coin', 1), earned)));
    if (nxt) body.append(h('div', { class: 'small' }, 'Up next: ', h('b', null, nxt.title), nxt.desc ? ' — ' + nxt.desc : ''));
    for (const sec of GOAL_SECTIONS) {
      const list = GOALS.filter((x) => x.section === sec.id);
      const n = list.filter((x) => done.has(x.id)).length;
      body.append(h('div', { class: 'row', style: 'margin-top:8px' }, ic(sec.icon, 2), h('b', { style: 'font-size:17px' }, sec.name), h('span', { class: 'chip' }, `${n}/${list.length}`)));
      // unfinished first, finished at the end of each section
      for (const x of list.filter((y) => !done.has(y.id))) body.append(row(x, false, nxt && x.id === nxt.id, c));
      for (const x of list.filter((y) => done.has(y.id))) body.append(row(x, true, false, c));
    }
  }
  render();
  return { title: 'Island Goals', icon: 'ui_star', body, sig: () => `${(g.world.shared.flags.goals || []).length}:${g.world.rev}`, refresh: render };
}
