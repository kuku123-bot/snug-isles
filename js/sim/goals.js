// Island Goals on the host: counts what the players do, looks at the world every couple of seconds, and hands out the rewards.
import { BUILD } from '../data/build.js';
import { GOALS, rewardOf } from '../data/goals.js';
import { wallDefOf } from './world.js';
import { addXp } from './player.js';

const PIECE_CACHE = new Map();
const pieceOf = (code) => { let v = PIECE_CACHE.get(code); if (v === undefined) { const d = wallDefOf(code); v = d ? d.piece : ''; PIECE_CACHE.set(code, v); } return v; };

/** progress counters that only the host keeps (persisted in the world's shared flags) */
export function bump(sim, key, n = 1) {
  const f = sim.world.shared.flags;
  const gs = f.gs || (f.gs = {});
  gs[key] = (gs[key] || 0) + n;
}
export function bumpBoss(sim, mobId) {
  const f = sim.world.shared.flags;
  const gs = f.gs || (f.gs = {});
  const b = gs.boss || (gs.boss = {});
  b[mobId] = (b[mobId] || 0) + 1;
}

/** a snapshot of everything goal conditions look at; works on a client mirror too (minus the host-only counters) */
export function census(world) {
  const c = {
    gs: world.shared.flags.gs || {}, techs: world.techs, things: {}, walls: 0, floors: 0, doors: 0, windows: 0, bridges: 0,
    furniture: 0, lights: 0, beds: 0, chests: 0, drills: 0, items: new Set(), lands: 0, biomes: new Set(), maxLevel: 1, cozy: 0, coins: world.coins,
  };
  for (const t of world.things.values()) {
    const d = BUILD[t.type];
    if (!d) continue;
    c.things[t.type] = (c.things[t.type] || 0) + 1;
    if (d.cat === 'furniture' || d.cat === 'decor') c.furniture++;
    if (d.light) c.lights++;
    if (d.behavior === 'bed') c.beds++;
    if (d.behavior === 'storage' && !(d.conf && d.conf.grave)) c.chests++;
    if (d.behavior === 'drill') c.drills++;
    const s = t.s;
    if (s) {
      if (s.inp) c.items.add(s.inp.id); if (s.out) c.items.add(s.out.id);
      if (s.inv) for (const st of s.inv) if (st) c.items.add(st.id);
    }
  }
  const wl = world.wall, fl = world.floor, gr = world.ground;
  for (let i = 0; i < wl.length; i++) {
    if (wl[i]) { c.walls++; const pc = pieceOf(wl[i]); if (pc === 'door') c.doors++; else if (pc === 'window') c.windows++; }
    if (fl[i]) { c.floors++; if (gr[i] === 0) c.bridges++; }
  }
  for (let gx = 0; gx < world.gw; gx++) for (let gy = 0; gy < world.gh; gy++) if (world.isLandOwned(gx, gy)) { c.lands++; c.biomes.add(world.biomeOfLand(gx, gy).id); }
  for (const p of world.players.values()) {
    if (p.level > c.maxLevel) c.maxLevel = p.level;
    if (p.online && p.cozy > c.cozy) c.cozy = p.cozy;
    for (const st of p.inv) if (st) c.items.add(st.id);
    for (const k in p.equip) if (p.equip[k]) c.items.add(p.equip[k].id);
  }
  return c;
}

export const goalsDone = (world) => world.shared.flags.goals || [];

/** called every ~1.5s by the sim */
export function goalsTick(sim) {
  const w = sim.world, f = w.shared.flags;
  const first = !f.goals;
  const done = f.goals || (f.goals = []);
  if (done.length >= GOALS.length) return;
  const have = new Set(done);
  const c = census(w);
  const online = [...w.players.values()].filter((p) => p.online);
  let announced = 0;
  for (const g of GOALS) {
    if (have.has(g.id)) continue;
    let ok = false;
    try { ok = !!g.check(c); } catch (e) { ok = false; }
    if (!ok) continue;
    done.push(g.id); have.add(g.id);
    if (first) continue; // an older world: quietly tick off what is already true instead of showering rewards
    const rw = rewardOf(w.settings, g);
    if (rw.coins) { w.coins += rw.coins; c.coins = w.coins; }
    for (const p of online) { if (rw.xp) addXp(w, p, rw.xp, true); }
    w.emit(['goal', g.id]);
    announced++;
    // the first two get their own celebration, the third one a combined "more goals" note, the rest are quiet
    for (const p of online) w.tell(p.pid, { t: 'goal', id: g.id, late: announced <= 2 ? 0 : announced === 3 ? 1 : 2 });
    if (rw.coins) w.emit(['coins', w.coins]);
  }
  if (first && done.length) w.emit(['goals', [...done]]);
}
