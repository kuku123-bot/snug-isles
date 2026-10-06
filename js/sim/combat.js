// Creatures, damage, projectiles and bosses (host-side).
import { TILE, TAU, clamp, hash32 } from '../util.js';
import { bumpBoss } from './goals.js';
import { MOBS } from '../data/mobs.js';
import { ITEMS } from '../data/items.js';
import { calcStats, addXp, touch } from './player.js';
import { invCount } from './inventory.js';

const MOB_SIM_RANGE = 34 * TILE; // mobs farther than this from every player are frozen / removed
const DESPAWN_RANGE = 44 * TILE;

// ------------------------------------------------------------------ creation
export function spawnMob(sim, type, x, y, o = {}) {
  const def = MOBS[type];
  const w = sim.world, s = w.settings, rng = sim.rng;
  const id = w.nextId++;
  let hp = def.hp;
  if (def.boss) hp *= s.bossPower; else if (def.hostile) hp *= s.enemyHealth;
  hp = Math.round(hp);
  const m = {
    id, type, x, y, vx: 0, vy: 0, hp, maxhp: hp, face: rng.chance(0.5) ? 1 : -1, st: 'idle', stt: rng.next() * 1.2, hit: 0, kx: 0, ky: 0,
    atk: 0.8, z: 0, zv: 0, dir: rng.next() * TAU, avoid: 0, avoidSign: 1, born: w.time, ph: rng.next() * TAU, pat: 0, patT: 2.5, boss: !!def.boss, ...o,
  };
  w.mobs.set(id, m);
  return m;
}

export function spawnBoss(sim, type, x, y) {
  const m = spawnMob(sim, type, x, y);
  sim.world.shared.bossUp = m.id;
  sim.world.emit(['boss', m.id, type]);
  sim.world.fx('bossspawn', x, y, type);
  return m;
}

// ------------------------------------------------------------------ helpers
function nearestPlayer(w, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const p of w.players.values()) {
    if (!p.online || p.dead > 0) continue;
    const dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = p; }
  }
  return best ? { p: best, d: Math.sqrt(bd) } : null;
}

function stepMove(w, m, def, dx, dy) {
  const hw = def.r, hh = Math.max(2, def.r * 0.6);
  const fly = def.ai === 'fly' || def.fly || def.ai === 'boss' && def.fly;
  if (def.ghost) {
    const nx = m.x + dx, ny = m.y + dy;
    if (w.isTileOwned(Math.floor(nx / TILE), Math.floor(ny / TILE))) { m.x = nx; m.y = ny; }
    return { hitX: false, hitY: false };
  }
  const r = w.moveBox(m.x, m.y, dx, dy, hw, hh, !!fly);
  if (fly && !w.isTileOwned(Math.floor(r.x / TILE), Math.floor(r.y / TILE))) return { hitX: true, hitY: true };
  m.x = r.x; m.y = r.y;
  return r;
}

// ------------------------------------------------------------------ damage to players
export function hurtPlayer(sim, p, dmg, sx, sy, kind = 'mob') {
  const w = sim.world;
  if (!p.online || p.dead > 0 || p.shield > 0) return false;
  const st = calcStats(w, p);
  let d = dmg;
  if (kind === 'mob' || kind === 'proj') d *= w.settings.enemyDamage;
  d = Math.max(1, Math.round(d * (1 - st.defense)));
  if (p.hp - d <= 0 && st.secondWind && p.windDay !== w.day) {
    p.windDay = w.day; p.hp = Math.max(1, Math.ceil(st.maxHp * 0.25)); p.shield = 2.5;
    w.fx('secondwind', p.x, p.y - 10, 0); sim.toast(p.pid, 'Second Wind!', 'good'); touch(p);
    return true;
  }
  p.hp -= d;
  p.shield = 0.8;
  w.fx('dmg', p.x, p.y - 18, d, 2);
  w.fx('hurt', p.x, p.y - 8, p.id);
  const a = Math.atan2(p.y - sy, p.x - sx);
  w.tell(p.pid, { t: 'kb', vx: Math.cos(a) * 130, vy: Math.sin(a) * 130 });
  touch(p);
  if (p.hp <= 0) killPlayer(sim, p);
  return true;
}

export function killPlayer(sim, p) {
  const w = sim.world, s = w.settings;
  p.hp = 0; p.dead = 4.5; p.sleeping = false; p.sit = null; p.fish = null;
  w.fx('faint', p.x, p.y - 8, p.id);
  w.tell(p.pid, { t: 'dead' });
  if (s.death === 'coins') {
    const lost = Math.floor(w.coins * 0.1);
    if (lost > 0) { w.coins -= lost; w.emit(['coins', w.coins]); sim.toast(p.pid, `Dropped ${lost} coins...`, 'warn'); }
  } else if (s.death === 'drop' || s.death === 'hardcore') {
    const items = p.inv.filter(Boolean);
    if (items.length) {
      if (s.death === 'drop') {
        const tx = clamp(Math.floor(p.x / TILE), 1, w.W - 2), ty = clamp(Math.floor(p.y / TILE), 1, w.H - 2);
        let spot = null;
        for (let r = 0; r < 4 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
          const x = tx + dx, y = ty + dy;
          if (w.inb(x, y) && w.isTileOwned(x, y) && !w.placeProblem({ w: 1, h: 1, kind: 'thing' }, x, y)) spot = [x, y];
        }
        if (spot) {
          const inv = new Array(Math.max(24, items.length)).fill(null);
          items.forEach((it, i) => { inv[i] = { id: it.id, n: it.n }; });
          w.addThing('gravestone', spot[0], spot[1], { s: { inv, owner: p.pid, ownerName: p.name } });
          sim.toast(p.pid, 'Your pack is in a gravestone nearby.', 'warn');
        }
      }
      p.inv.fill(null);
    }
  }
  touch(p);
}

// ------------------------------------------------------------------ damage to mobs
/** can a swing aimed at (ax, ay) hit this creature? Hostile ones always; a cute critter only when the aim is right on it; a hatched pet never. */
export function canHit(m, ax, ay) {
  const def = MOBS[m.type];
  if (!def || m.hp <= 0) return false;
  if (def.hostile) return true;
  return !m.pet && Math.hypot(m.x - ax, m.y - def.h * 0.4 - ay) <= def.r + 12;
}

export function hurtMob(sim, m, dmg, sx, sy, p = null, o = {}) {
  const w = sim.world, def = MOBS[m.type];
  if (m.hp <= 0 || !def || m.pet || (!def.hostile && !o.force && !o.critter)) return false;
  let d = dmg * (0.92 + sim.rng.next() * 0.16);
  let crit = false;
  if (p) {
    const st = calcStats(w, p);
    if (st.crit > 0 && sim.rng.next() < st.crit) { d *= 2; crit = true; }
  }
  d = Math.max(1, Math.round(d));
  m.hp -= d;
  m.hit = 0.16;
  if (def.hostile) m.agg = true; else { m.panic = 4; m.fx = sx; m.fy = sy; } // a hurt critter runs away from whoever hit it
  const a = Math.atan2(m.y - sy, m.x - sx);
  const kb = (o.knock === undefined ? 60 : o.knock) * (def.boss ? 0.15 : 1);
  m.kx = Math.cos(a) * kb; m.ky = Math.sin(a) * kb;
  w.fx('dmg', m.x, m.y - def.h * 0.8, d, crit ? 1 : 0);
  w.fx('hit', m.x, m.y - def.h * 0.5, 'mob', crit ? 1 : 0);
  if (m.hp <= 0) killMob(sim, m, p);
  return true;
}

export function killMob(sim, m, p) {
  const w = sim.world, def = MOBS[m.type];
  w.mobs.delete(m.id);
  w.emit(['mr', m.id, 1]);
  w.fx('poof', m.x, m.y - def.h * 0.4, 0);
  if (m.id === w.shared.bossUp) { w.shared.bossUp = null; w.emit(['boss', 0]); w.fx('bossdead', m.x, m.y, m.type); }
  const st = p ? calcStats(w, p) : null;
  for (const [item, min, max, chance] of def.drops) {
    if (sim.rng.next() >= chance) continue;
    let n = min + sim.rng.int(max - min + 1);
    if (item === 'coin') {
      n = Math.max(1, Math.round(n * (st ? st.coinMul : 1)));
      // split into little coin pops so it feels fun
      const pieces = Math.min(n, 5);
      for (let i = 0; i < pieces; i++) sim.spawnDrop('coin', Math.floor(n / pieces) + (i < n % pieces ? 1 : 0), m.x, m.y - 2);
    } else sim.spawnDrop(item, n, m.x, m.y - 2);
  }
  if (def.hostile) { if (def.boss) { bumpBoss(sim, m.type); } else sim.bump('kills'); }
  if (p) {
    addXp(w, p, def.xp);
    if (st.lifesteal) { p.hp = Math.min(st.maxHp, p.hp + st.lifesteal); touch(p); }
    // share half the XP with the partner if they are nearby
    for (const o of w.players.values()) if (o !== p && o.online && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 28 * TILE) addXp(w, o, def.xp * 0.5);
  }
}

// ------------------------------------------------------------------ player attacks
/** Melee swing: hits up to `maxHits` hostile mobs in a cone. Returns count hit. */
export function meleeAttack(sim, p, item, ax, ay, o = {}) {
  const w = sim.world, st = calcStats(w, p);
  const cx = p.x, cy = p.y - 6;
  const aim = Math.atan2(ay - cy, ax - cx);
  const reach = (item.reach || 24) + st.reachBonus;
  const arc = o.arc || 1.25; // half-angle radians
  const base = (item.dmg || item.power * 0.8) * (item.weapon === 'sword' ? st.meleeDmg : st.toolDmg * 0.75);
  const hits = [];
  for (const m of w.mobs.values()) {
    const def = MOBS[m.type];
    if (!canHit(m, ax, ay)) continue;
    const mx = m.x, my = m.y - def.h * 0.4;
    const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy);
    if (d > reach + def.r + 2) continue;
    let da = Math.abs(Math.atan2(dy, dx) - aim);
    if (da > Math.PI) da = TAU - da;
    if (da > arc && d > def.r + 4) continue;
    hits.push([d, m]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  let n = 0;
  for (const [, m] of hits.slice(0, o.maxHits || 3)) { if (hurtMob(sim, m, base, cx, cy, p, { knock: item.knock || 60, critter: true })) n++; }
  return n;
}

export function shoot(sim, o) {
  const w = sim.world;
  const id = w.nextId++;
  const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy) || 1;
  const spd = o.spd || 160;
  const pr = { id, x: o.x, y: o.y, vx: dx / d * spd, vy: dy / d * spd, dmg: o.dmg, life: (o.range || 140) / spd, from: o.from, pid: o.pid || null, color: o.color || '#ffffff', r: o.r || 3, pierce: o.pierce || 0, hit: null, kind: o.kind || 'bolt' };
  w.projs.set(id, pr);
  w.emit(['pa', id, Math.round(pr.x), Math.round(pr.y), Math.round(pr.vx), Math.round(pr.vy), pr.color, pr.life, pr.kind]);
  return pr;
}

export function fireBow(sim, p, item, ax, ay) {
  const w = sim.world, st = calcStats(w, p);
  if (invCount(p.inv, 'arrow') < 1) { sim.toast(p.pid, 'Out of arrows!', 'warn'); return false; }
  // remove one arrow
  for (let i = 0; i < p.inv.length; i++) { const s = p.inv[i]; if (s && s.id === 'arrow') { s.n--; if (s.n <= 0) p.inv[i] = null; break; } }
  touch(p);
  const crit = st.crit > 0 && sim.rng.next() < st.crit;
  shoot(sim, { x: p.x, y: p.y - 7, tx: ax, ty: ay, spd: 210, dmg: item.dmg * st.bowDmg * (crit ? 2 : 1), range: item.range || 160, from: 'p', pid: p.pid, color: '#ffe9b0', kind: 'arrow', pierce: item.tier >= 7 ? 1 : 0 });
  return true;
}
export function castStaff(sim, p, item, ax, ay) {
  const st = calcStats(sim.world, p);
  const crit = st.crit > 0 && sim.rng.next() < st.crit;
  shoot(sim, { x: p.x, y: p.y - 7, tx: ax, ty: ay, spd: 150, dmg: item.dmg * st.staffDmg * (crit ? 2 : 1), range: item.range || 130, from: 'p', pid: p.pid, color: item.color || '#a77bff', r: 4, kind: 'magic', pierce: item.tier >= 6 ? 1 : 0 });
  return true;
}

// ------------------------------------------------------------------ projectiles
export function updateProjectiles(sim, dt) {
  const w = sim.world;
  for (const pr of w.projs.values()) {
    pr.life -= dt;
    let dead = pr.life <= 0, impact = false;
    const dist = Math.hypot(pr.vx, pr.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 5));
    for (let s = 0; s < steps && !dead; s++) {
      pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
      const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
      if (!w.inb(tx, ty) || (w.solid[w.idx(tx, ty)] & 2)) { dead = true; impact = true; break; }
      if (pr.from === 'm') {
        for (const p of w.players.values()) {
          if (!p.online || p.dead > 0) continue;
          if (Math.abs(p.x - pr.x) < 7 && Math.abs(p.y - 6 - pr.y) < 9) { if (hurtPlayer(sim, p, pr.dmg, pr.x - pr.vx, pr.y - pr.vy, 'proj')) { dead = true; impact = true; break; } }
        }
      } else {
        for (const m of w.mobs.values()) {
          const def = MOBS[m.type];
          if (!def.hostile || m.hp <= 0 || (pr.hit && pr.hit.has(m.id))) continue;
          if (Math.abs(m.x - pr.x) < def.r + pr.r && Math.abs(m.y - def.h * 0.4 - pr.y) < def.h * 0.5 + pr.r) {
            const owner = pr.pid ? w.players.get(pr.pid) : null;
            hurtMob(sim, m, pr.dmg, pr.x - pr.vx, pr.y - pr.vy, owner, { knock: 40 });
            if (pr.pierce > 0) { pr.pierce--; (pr.hit || (pr.hit = new Set())).add(m.id); } else { dead = true; impact = true; }
            break;
          }
        }
      }
    }
    if (dead) { w.projs.delete(pr.id); w.emit(['pr', pr.id, impact ? 1 : 0, Math.round(pr.x), Math.round(pr.y)]); if (impact) w.fx('hit', pr.x, pr.y, 'spark', 0); }
  }
}

// ------------------------------------------------------------------ spawning
export function spawnTick(sim) {
  const w = sim.world, s = w.settings, rng = sim.rng;
  const night = sim.nightness();
  const dens = s.enemyDensity;
  const players = [...w.players.values()].filter((p) => p.online && p.dead <= 0);
  if (!players.length) return;
  let hostile = 0, passive = 0;
  for (const m of w.mobs.values()) { if (m.boss || m.pet) continue; if (MOBS[m.type].hostile) hostile++; else passive++; }
  const per = players.length;
  const room = Math.min(1, 0.55 + 0.15 * w.ownedCount()); // a lone starting island gets a gentler crowd
  // safe start: nothing hostile for the first two minutes of a new world (time to chop wood and craft a sword), then a gentle ramp
  const age = w.shared.flags.age === undefined ? 1e9 : w.shared.flags.age;
  const ramp = clamp((age - 120) / 240, 0, 1);
  const capH = Math.round((3 + 3 * night * (0.5 + s.nightDanger * 0.5) + (s.nightDanger === 2 ? 2 * night : 0)) * dens * per * room * ramp);
  const capP = 5 * per;
  const wantHostile = dens > 0 && hostile < capH && rng.next() < 0.55;
  const wantPassive = passive < capP && rng.next() < 0.3;
  if (!wantHostile && !wantPassive) return;
  const p = rng.pick(players);
  for (let tries = 0; tries < 20; tries++) {
    // prefer a polite distance; a single 20x20 island is too small for that, so later tries come in closer
    const far = tries < 10, minD = far ? 11 : 7;
    const a = rng.next() * TAU, r = (far ? 14 + rng.next() * 9 : 7 + rng.next() * 7) * TILE;
    const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty)) continue;
    const i = w.idx(tx, ty);
    if (w.solid[i] & 1) continue;
    let tooNear = false;
    for (const q of players) if (Math.hypot(q.x - x, q.y - y) < minD * TILE) tooNear = true;
    if (tooNear) continue;
    // don't spawn in/around player buildings
    let built = false;
    for (let dy = -2; dy <= 2 && !built; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = tx + dx, yy = ty + dy;
      if (!w.inb(xx, yy)) continue;
      const j = w.idx(xx, yy);
      if (w.floor[j] || w.wall[j]) { built = true; break; }
      const oid = w.occ[j];
      if (oid) { const t = w.things.get(oid); if (t && w.thingSolid(t) && t.type && !t.type.match(/^(oak|pine|palm|mangrove|dead_tree|burnt_tree|crystal_tree|void_tree|rock|coal_rock|copper_rock|iron_rock|gold_rock|ice_rock|sandstone|tombstone|ember_rock|obsidian_rock|crystal_rock|star_rock|geode|cactus|clay_deposit|chest_wild)$/)) { built = true; break; } }
    }
    if (built) continue;
    const b = w.biomeAtTile(tx, ty);
    let pool;
    if (wantHostile) {
      pool = b.mobs.filter(([id]) => MOBS[id].hostile).map((e) => [e[0], e[1] * (1 - night * 0.5)]);
      if (night > 0.5 && b.night) pool = pool.concat(b.night.map((e) => [e[0], e[1] * (1 + night * s.nightDanger)]));
    } else pool = b.mobs.filter(([id]) => !MOBS[id].hostile);
    pool = pool.filter((e) => e[1] > 0);
    if (!pool.length) continue;
    const type = rng.weighted(pool);
    spawnMob(sim, type, (tx + 0.5) * TILE, (ty + 0.8) * TILE);
    return;
  }
}

// ------------------------------------------------------------------ AI
export function updateMobs(sim, dt) {
  const w = sim.world, s = w.settings;
  for (const m of w.mobs.values()) {
    const def = MOBS[m.type];
    if (m.pet) { petAI(sim, m, def, dt); continue; }
    const near = nearestPlayer(w, m.x, m.y, MOB_SIM_RANGE);
    if (!near) {
      // far from everyone: despawn (bosses stick around for a while)
      const far = nearestPlayer(w, m.x, m.y, DESPAWN_RANGE);
      if (!far && !m.boss) { w.mobs.delete(m.id); w.emit(['mr', m.id, 0]); }
      continue;
    }
    // global timers
    m.hit = Math.max(0, m.hit - dt);
    m.atk = Math.max(0, m.atk - dt);
    if (m.kx || m.ky) {
      stepMove(w, m, def, m.kx * dt, m.ky * dt);
      const decay = Math.max(0, 1 - 9 * dt);
      m.kx *= decay; m.ky *= decay;
      if (Math.abs(m.kx) < 2 && Math.abs(m.ky) < 2) { m.kx = 0; m.ky = 0; }
    }
    const tgt = near.p, d = near.d;
    const aggroR = (def.aggro || 80) * s.aggro * (def.hostile ? 1 : 0);
    const chasing = def.hostile && d < aggroR || m.agg;
    switch (def.ai) {
      case 'hop': aiHop(sim, m, def, tgt, d, chasing, dt); break;
      case 'walk': aiWalk(sim, m, def, tgt, d, chasing, dt); break;
      case 'fly': aiFly(sim, m, def, tgt, d, chasing, dt); break;
      case 'shoot': aiShoot(sim, m, def, tgt, d, chasing, dt); break;
      case 'passive': aiPassive(sim, m, def, tgt, d, dt); break;
      case 'boss': aiBoss(sim, m, def, tgt, d, dt); break;
    }
    // contact damage
    if (def.hostile && m.atk <= 0 && d < def.r + 6 && !(def.ai === 'hop' && m.z > 5)) {
      if (hurtPlayer(sim, tgt, def.dmg, m.x, m.y, 'mob')) m.atk = def.atkcd;
    }
  }
}

/** a hatched pet trots after its owner, hops to catch up, and pops back to them if it gets stuck or left far behind */
function petAI(sim, m, def, dt) {
  const w = sim.world, owner = w.players.get(m.pet);
  if (!owner || !owner.online || owner.pet !== m.type) { w.mobs.delete(m.id); w.emit(['mr', m.id, 0]); return; }
  m.hit = 0; m.atk = 0;
  const dx = owner.x - m.x, dy = owner.y - 2 - m.y, d = Math.hypot(dx, dy);
  const home = () => { const side = owner.face >= 0 ? -1 : 1; m.x = owner.x + side * 12; m.y = owner.y; m.stuck = 0; w.fx('poof', m.x, m.y - 4, 0); };
  if (d > 170) return home();
  if (d > 26) {
    const x0 = m.x, y0 = m.y;
    seekMove(sim, m, def, Math.atan2(dy, dx), def.spd * (d > 70 ? 2.2 : 1.2), dt);
    m.st = 'run';
    m.stuck = Math.hypot(m.x - x0, m.y - y0) < dt * 6 ? (m.stuck || 0) + dt : 0; // walking into a wall? after a few seconds, pop over
    if (m.stuck > 3) home();
  } else {
    m.st = 'idle'; m.stuck = 0; m.face = dx >= 0 ? 1 : -1;
    m.stt -= dt;
    if (m.stt <= 0) { m.stt = 2 + sim.rng.next() * 3; if (sim.rng.next() < 0.35) { m.st = 'wander'; wanderDir(sim, m); } }
    if (m.st === 'wander') seekMove(sim, m, def, m.dir, def.spd * 0.35, dt);
  }
}

function wanderDir(sim, m) { m.dir = sim.rng.next() * TAU; }

function aiHop(sim, m, def, tgt, d, chasing, dt) {
  const rng = sim.rng, w = sim.world;
  if (m.st === 'idle') {
    m.stt -= dt;
    if (m.stt <= 0) {
      let ang;
      if (chasing) ang = Math.atan2(tgt.y - m.y, tgt.x - m.x) + (rng.next() - 0.5) * 0.7;
      else if (rng.next() < 0.7) ang = rng.next() * TAU;
      else { m.stt = 0.6 + rng.next() * 1.2; return; }
      m.dir = ang; m.st = 'hop'; m.stt = def.boss ? 0.55 : 0.36; m.zv = 62; m.face = Math.cos(ang) >= 0 ? 1 : -1;
    }
  } else if (m.st === 'hop') {
    m.stt -= dt;
    const sp = def.spd * 2.3;
    const r = stepMove(w, m, def, Math.cos(m.dir) * sp * dt, Math.sin(m.dir) * sp * dt);
    m.zv -= 340 * dt;
    m.z = Math.max(0, m.z + m.zv * dt);
    if (m.stt <= 0 || (m.z === 0 && m.zv < 0)) { m.st = 'idle'; m.z = 0; m.zv = 0; m.stt = chasing ? 0.3 + rng.next() * 0.35 : 0.8 + rng.next() * 1.3; if (r.hitX || r.hitY) m.dir += Math.PI; }
  }
}

function seekMove(sim, m, def, ang, speed, dt) {
  const w = sim.world, rng = sim.rng;
  if (m.avoid > 0) { m.avoid -= dt; ang += m.avoidSign * 1.1; }
  const dx = Math.cos(ang) * speed * dt, dy = Math.sin(ang) * speed * dt;
  const r = stepMove(w, m, def, dx, dy);
  if ((r.hitX && Math.abs(dx) > 0.01) || (r.hitY && Math.abs(dy) > 0.01)) { if (m.avoid <= 0) { m.avoid = 0.45; m.avoidSign = rng.sign(); } }
  if (Math.abs(dx) > 0.01) m.face = dx > 0 ? 1 : -1;
}

function aiWalk(sim, m, def, tgt, d, chasing, dt) {
  const rng = sim.rng;
  if (chasing) {
    seekMove(sim, m, def, Math.atan2(tgt.y - m.y, tgt.x - m.x), def.spd, dt);
    m.st = 'chase';
  } else {
    m.stt -= dt;
    if (m.stt <= 0) { m.stt = 1 + rng.next() * 2.2; if (rng.next() < 0.45) { m.st = 'idle'; } else { m.st = 'wander'; wanderDir(sim, m); } }
    if (m.st === 'wander') seekMove(sim, m, def, m.dir, def.spd * 0.45, dt);
  }
}

function aiFly(sim, m, def, tgt, d, chasing, dt) {
  const w = sim.world;
  const t = w.time;
  let ang;
  if (chasing) ang = Math.atan2(tgt.y - 6 - m.y, tgt.x - m.x) + Math.sin(t * 3.1 + m.ph) * 0.9;
  else { m.stt -= dt; if (m.stt <= 0) { m.stt = 0.8 + sim.rng.next() * 1.6; wanderDir(sim, m); } ang = m.dir + Math.sin(t * 2 + m.ph) * 0.6; }
  const sp = chasing ? def.spd : def.spd * 0.5;
  m.vx += (Math.cos(ang) * sp - m.vx) * Math.min(1, 4 * dt);
  m.vy += (Math.sin(ang) * sp - m.vy) * Math.min(1, 4 * dt);
  stepMove(w, m, def, m.vx * dt, m.vy * dt);
  if (Math.abs(m.vx) > 4) m.face = m.vx > 0 ? 1 : -1;
  m.z = 8 + Math.sin(t * 6 + m.ph) * 2;
}

function aiShoot(sim, m, def, tgt, d, chasing, dt) {
  const w = sim.world;
  if (!chasing) { aiWalk(sim, m, def, tgt, d, false, dt); return; }
  const keep = def.keep || 60;
  const toward = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  m.ph2 = (m.ph2 || 0) + dt;
  let ang = toward, sp = def.spd;
  if (d > keep + 14) ang = toward;
  else if (d < keep - 14) ang = toward + Math.PI;
  else { ang = toward + Math.PI / 2 * (Math.sin(m.ph2 * 0.7 + m.ph) > 0 ? 1 : -1); sp *= 0.6; }
  if (def.fly) { m.vx += (Math.cos(ang) * sp - m.vx) * Math.min(1, 4 * dt); m.vy += (Math.sin(ang) * sp - m.vy) * Math.min(1, 4 * dt); stepMove(w, m, def, m.vx * dt, m.vy * dt); m.z = 8 + Math.sin(w.time * 5 + m.ph) * 2; }
  else seekMove(sim, m, def, ang, sp, dt);
  m.face = tgt.x >= m.x ? 1 : -1;
  m.shoot = (m.shoot === undefined ? 1.2 : m.shoot) - dt;
  if (m.shoot <= 0 && d < (def.aggro || 100) * w.settings.aggro) {
    m.shoot = def.atkcd || 1.5;
    shoot(sim, { x: m.x, y: m.y - def.h * 0.5, tx: tgt.x, ty: tgt.y - 6, spd: def.proj.spd, dmg: def.proj.dmg, range: 150, from: 'm', color: def.proj.color, r: 3, kind: 'orb' });
  }
}

function aiPassive(sim, m, def, tgt, d, dt) {
  const rng = sim.rng;
  if (m.panic > 0) { // just got hit: bolt away from the attacker
    m.panic -= dt;
    seekMove(sim, m, def, Math.atan2(m.y - (m.fy === undefined ? tgt.y : m.fy), m.x - (m.fx === undefined ? tgt.x : m.fx)), def.spd * 2.1, dt);
    m.st = 'run';
    return;
  }
  if (def.flee && d < 46) { seekMove(sim, m, def, Math.atan2(m.y - tgt.y, m.x - tgt.x), def.spd * 1.5, dt); m.st = 'run'; return; }
  m.stt -= dt;
  if (m.stt <= 0) { m.stt = 1 + rng.next() * 3; if (rng.next() < 0.55) m.st = 'idle'; else { m.st = 'wander'; wanderDir(sim, m); } }
  if (m.st === 'wander') seekMove(sim, m, def, m.dir, def.spd * 0.4, dt);
}

// ------------------------------------------------------------------ bosses
function bossShockwave(sim, m, def, radius, dmg) {
  const w = sim.world;
  w.fx('shock', m.x, m.y, radius);
  for (const p of w.players.values()) {
    if (!p.online || p.dead > 0) continue;
    if (Math.hypot(p.x - m.x, p.y - m.y) < radius) hurtPlayer(sim, p, dmg, m.x, m.y, 'mob');
  }
}
function bossRing(sim, m, def, n, spd, dmg) {
  const off = sim.rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    shoot(sim, { x: m.x, y: m.y - def.h * 0.4, tx: m.x + Math.cos(a) * 100, ty: m.y - def.h * 0.4 + Math.sin(a) * 100, spd, dmg, range: 170, from: 'm', color: '#ff9fd0', r: 3, kind: 'orb' });
  }
}
function aiBoss(sim, m, def, tgt, d, dt) {
  const w = sim.world, rng = sim.rng;
  const base = def.dmg;
  if (m.st === 'idle' || m.st === 'chase') {
    m.st = 'chase';
    seekMove(sim, m, def, Math.atan2(tgt.y - m.y, tgt.x - m.x), def.spd * 0.7, dt);
    m.patT -= dt;
    if (m.patT <= 0) {
      const pat = def.patterns[m.pat % def.patterns.length]; m.pat++;
      m.st = pat; m.stt = pat === 'hop' ? 0.9 : pat === 'summon' ? 0.8 : pat === 'slam' ? 0.9 : pat === 'charge' ? 0.8 : 0.9; m.stt0 = m.stt;
      m.dir = Math.atan2(tgt.y - m.y, tgt.x - m.x);
      w.fx('bosswarn', m.x, m.y - def.h * 0.6, pat);
    }
  } else if (m.st === 'hop') {
    m.stt -= dt;
    const prog = 1 - m.stt / m.stt0;
    m.z = Math.sin(clamp(prog, 0, 1) * Math.PI) * 26;
    stepMove(w, m, def, Math.cos(m.dir) * 90 * dt, Math.sin(m.dir) * 90 * dt);
    if (m.stt <= 0) { m.z = 0; bossShockwave(sim, m, def, 38, base * 1.3); m.st = 'chase'; m.patT = 1.6 + rng.next(); }
  } else if (m.st === 'summon') {
    m.stt -= dt;
    if (m.stt <= 0) {
      let cnt = 0; for (const o of w.mobs.values()) if (o.type === def.summon) cnt++;
      for (let i = 0; i < 3 && cnt < 8; i++, cnt++) { const a = rng.next() * TAU; const mm = spawnMob(sim, def.summon, m.x + Math.cos(a) * 26, m.y + Math.sin(a) * 20); mm.agg = true; }
      w.fx('poof', m.x, m.y, 1);
      m.st = 'chase'; m.patT = 2 + rng.next();
    }
  } else if (m.st === 'slam') {
    m.stt -= dt;
    if (m.stt <= 0) { bossShockwave(sim, m, def, 46, base * 1.4); bossRing(sim, m, def, 8, 65, base * 0.6); m.st = 'chase'; m.patT = 2 + rng.next(); }
  } else if (m.st === 'charge') {
    m.stt -= dt;
    if (m.stt > 0.1 && m.stt0 - m.stt < 0.7) { m.dir = Math.atan2(tgt.y - m.y, tgt.x - m.x); }
    else if (m.stt <= 0.1) {
      const r = stepMove(w, m, def, Math.cos(m.dir) * 170 * dt, Math.sin(m.dir) * 170 * dt);
      m.stt -= dt;
      if (m.stt < -0.8 || r.hitX || r.hitY) { m.st = 'chase'; m.patT = 1.5 + rng.next(); }
    }
    if (m.atk <= 0 && d < def.r + 8) { if (hurtPlayer(sim, tgt, base * 1.2, m.x, m.y, 'mob')) m.atk = 0.8; }
  } else if (m.st === 'ring') {
    m.stt -= dt;
    if (m.stt <= 0) { bossRing(sim, m, def, 14, 72, base * 0.55); m.st = 'chase'; m.patT = 2 + rng.next(); }
  }
  m.face = tgt.x >= m.x ? 1 : -1;
  // lose interest if everyone is far away / dead
  if (d > 60 * TILE) { w.mobs.delete(m.id); w.emit(['mr', m.id, 0]); if (w.shared.bossUp === m.id) { w.shared.bossUp = null; w.emit(['boss', 0]); } }
}
