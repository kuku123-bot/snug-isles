// The guide: points at what the next Island Goal needs. A chunky arrow bobs over the thing (or sits at the edge of the screen pointing the way, with how far
// it is), and the menu button that goal needs glows. Pure DOM on top of the game; it only reads the world.
import { h } from './dom.js';
import { AIM } from '../data/goals.js';
import { BUILD } from '../data/build.js';
import { NODES } from '../data/nodes.js';
import { MOBS } from '../data/mobs.js';
import { LAND } from '../sim/world.js';
import { TILE } from '../util.js';

const SEARCH = 40 * TILE; // how far around the player it looks
const treeIds = () => Object.values(NODES).filter((n) => n.tree && n.hard <= 1).map((n) => n.id);
let TREE_SET = null;

/** the nearest thing (in pixels) that matches what a goal needs: { x, y, label, d } or null */
export function findTarget(g, find) {
  const w = g.world, me = g.me;
  if (!find || !w || !me) return null;
  let best = null;
  const consider = (x, y, label) => { const d = Math.hypot(x - me.x, y - me.y); if (!best || d < best.d) best = { x, y, label, d }; };
  if (find.nodes || find.things || find.dig || find.altar) {
    if (!TREE_SET) TREE_SET = new Set(treeIds());
    const ids = Array.isArray(find.nodes) ? new Set(find.nodes) : null, things = Array.isArray(find.things) ? new Set(find.things) : null;
    for (const t of w.thingsNear(me.x, me.y, SEARCH)) {
      if (t.dep) continue;
      const nd = NODES[t.type], bd = BUILD[t.type];
      let name = null;
      if (find.nodes) { if (nd && nd.kind === 'node' && (ids ? ids.has(t.type) : TREE_SET.has(t.type))) name = nd.name; }
      else if (find.dig) { if (nd && nd.kind === 'dig') name = 'Buried treasure'; }
      else if (find.altar) { if (bd && bd.behavior === 'altar' && bd.conf.boss === find.altar) name = bd.name; }
      else if (things) { if (bd && things.has(t.type)) name = bd.name; }
      else if (find.things && find.things.behavior) { if (bd && bd.behavior === find.things.behavior) name = bd.name; }
      if (name) consider((t.x + t.w / 2) * TILE, (t.y + t.h / 2) * TILE - 4, name);
    }
  } else if (find.mobs) {
    for (const m of w.mobs.values()) { const d = MOBS[m.type]; if (d && d.hostile && !m.boss && !m.pet && m.hp > 0 && (find.mobs === true || find.mobs === m.type)) consider(m.rx === undefined ? m.x : m.rx, m.y - 6, d.name); }
  } else if (find.water) {
    const tx0 = Math.floor(me.x / TILE), ty0 = Math.floor(me.y / TILE);
    for (let dy = -22; dy <= 22; dy++) for (let dx = -22; dx <= 22; dx++) {
      const x = tx0 + dx, y = ty0 + dy;
      if (!w.inb(x, y) || w.ground[w.idx(x, y)] !== 0 || !(w.isLand(x - 1, y) || w.isLand(x + 1, y) || w.isLand(x, y - 1) || w.isLand(x, y + 1))) continue;
      consider((x + 0.5) * TILE, (y + 0.5) * TILE, 'Water');
    }
  } else if (find.land) {
    for (let gx = 0; gx < w.gw; gx++) for (let gy = 0; gy < w.gh; gy++) {
      if (w.isLandOwned(gx, gy) || !(w.isLandOwned(gx + 1, gy) || w.isLandOwned(gx - 1, gy) || w.isLandOwned(gx, gy + 1) || w.isLandOwned(gx, gy - 1))) continue;
      const [ox, oy] = w.landOrigin(gx, gy);
      consider((ox + LAND / 2) * TILE, (oy + LAND / 2) * TILE, 'New land');
    }
  }
  return best;
}

export class Guide {
  constructor(game, root) {
    this.g = game;
    this.arrow = h('div', { class: 'garrow', html: '<svg viewBox="0 0 44 44"><path d="M5 16h19V7l16 15-16 15v-9H5z" fill="#ff8fb3" stroke="#3a2848" stroke-width="3" stroke-linejoin="round"/><path d="M9 19h17v-6l9 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/></svg>' });
    this.label = h('div', { class: 'glabel' });
    this.el = h('div', { class: 'guide', style: 'display:none' }, this.arrow, this.label);
    root.appendChild(this.el);
    this.t = 0; this.target = null; this.aim = null; this.goalId = null; this.ui = null;
  }
  /** called when the next goal changes */
  setGoal(goal) { this.goalId = goal ? goal.id : null; this.aim = goal ? AIM[goal.id] || null : null; this.target = null; this.t = 0; this.pulse(this.aim && this.aim.ui); }
  pulse(ui) {
    for (const b of document.querySelectorAll('.hbtn[data-ui]')) b.classList.toggle('pulse', !!ui && b.dataset.ui === ui);
    this.ui = ui || null;
  }
  update(dt) {
    const g = this.g, me = g.me;
    const on = me && this.aim && g.settings.showGuide !== false && g.settings.showGoals !== false && !g.ui.blocking && !g.builder.active && me.dead <= 0;
    if (!on) { this.el.style.display = 'none'; return; }
    this.t += dt;
    if (this.t > 0.4 || (!this.target && this.t > 0.15)) { this.t = 0; this.target = this.aim.find ? findTarget(g, this.aim.find) : null; }
    const tg = this.target;
    if (!tg) { this.el.style.display = 'none'; return; }
    // a target that is right next to you does not need an arrow
    if (tg.d < 2.5 * TILE) { this.el.style.display = 'none'; return; }
    const [cx, cy] = g.view.toClient(tg.x - g.camX, tg.y - g.camY);
    const W = window.innerWidth, H = window.innerHeight, mx = 56, top = 90, bot = 120;
    const inside = cx > mx && cx < W - mx && cy > top && cy < H - bot;
    this.el.style.display = 'block';
    this.el.classList.toggle('edge', !inside);
    let x = cx, y = cy, rot = 90; // degrees: 0 points right, 90 points down
    if (inside) y = cy - 34;
    else {
      const mid = [W / 2, (H - bot + top) / 2], a = Math.atan2(cy - mid[1], cx - mid[0]);
      const k = Math.min((W / 2 - mx) / Math.max(1e-3, Math.abs(Math.cos(a))), ((H - bot - top) / 2) / Math.max(1e-3, Math.abs(Math.sin(a))));
      x = mid[0] + Math.cos(a) * k; y = mid[1] + Math.sin(a) * k; rot = a * 180 / Math.PI;
    }
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.arrow.style.transform = `rotate(${rot.toFixed(0)}deg)`;
    const tiles = Math.round(tg.d / TILE);
    const txt = inside ? tg.label : `${tg.label} · ${tiles}`;
    if (this.label.textContent !== txt) this.label.textContent = txt;
  }
}
