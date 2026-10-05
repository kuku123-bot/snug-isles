// Player creation and derived stats (skills + techs + gear + buffs + cozy room).
import { ITEMS } from '../data/items.js';
import { SKILLS, xpForLevel, MAX_LEVEL } from '../data/skills.js';
import { TECHS } from '../data/techs.js';
import { makeInv, invAdd, resizeInv } from './inventory.js';

export const BASE_SLOTS = 24;
export const HOTBAR = 8;
export const BASE_HP = 20;
export const EQUIP_SLOTS = ['head', 'body', 'feet', 'charm'];

export const DEFAULT_LOOK = { skin: 1, hair: 0, hairColor: 2, outfit: 0, accessory: 0 };

export function makePlayer(world, pid, name, look) {
  const p = {
    pid, name: (name || 'Friend').slice(0, 14), look: { ...DEFAULT_LOOK, ...(look || {}) },
    x: 0, y: 0, vx: 0, vy: 0, dir: 0, face: 1,
    hp: BASE_HP, energy: 100, hunger: 100,
    inv: makeInv(BASE_SLOTS), equip: { head: null, body: null, feet: null, charm: null }, sel: 0,
    xp: 0, level: 1, sp: 0, skills: {}, buffs: {},
    spawn: null, dead: 0, sleeping: false, sit: null, online: true,
    cd: 0, dashCd: 0, fish: null, cozy: 0, shield: 0, wind: 0, stats: null, pet: null,
    rev: 1, // bumped whenever private state changes (inventory, hp, xp...)
    id: 0,
  };
  return p;
}

export function skillFx(p, key) {
  let v = 0;
  for (const sid in p.skills) {
    const s = SKILLS[sid];
    if (s && s.fx[key] !== undefined) v += s.fx[key] * p.skills[sid];
  }
  return v;
}
export function techFx(world, key) {
  let v = 0;
  for (const tid of world.techs) {
    const t = TECHS[tid];
    if (t && t.fx && t.fx[key] !== undefined) v += t.fx[key];
  }
  return v;
}
export function buffPow(p, type) { const b = p.buffs[type]; return b && b.t > 0 ? b.pow : 0; }

export function equippedDef(p, slot) { const s = p.equip[slot]; return s ? ITEMS[s.id] : null; }

/** Derived stats. Cheap enough to recompute on demand; cached by p.rev + world.techs.size. */
export function calcStats(world, p) {
  const key = p.rev * 1000 + world.techs.size + (world.shared.flags.statsRev || 0) * 100000;
  if (p.stats && p.stats._k === key) return p.stats;
  const st = world.settings || {};
  const fx = (k) => skillFx(p, k) + techFx(world, k); // skills and technologies share the same effect keys
  let charm = {};
  const cd = equippedDef(p, 'charm');
  if (cd && cd.charm) charm = cd.charm;
  let defPts = 0;
  for (const slot of ['head', 'body', 'feet']) { const d = equippedDef(p, slot); if (d) defPts += d.def || 0; }
  const speedMul = 1 + fx('speed') + (charm.speed || 0) + 0.1 * buffPow(p, 'speed');
  const s = {
    _k: key,
    maxHp: BASE_HP + fx('maxHp') + (charm.hp || 0),
    defense: Math.min(0.75, defPts * 0.025 + fx('dmgTaken')),
    speed: 66 * speedMul,
    magnet: 26 * (1 + fx('magnet')) * (charm.magnet || 1),
    reachBonus: fx('reach'),
    toolDmg: 1 + fx('toolDmg') + (charm.mining || 0) + 0.2 * buffPow(p, 'mining'),
    toolSpeed: 1 + fx('toolSpeed') + 0.15 * buffPow(p, 'mining'),
    meleeDmg: 1 + fx('meleeDmg') + 0.2 * buffPow(p, 'strength'),
    bowDmg: 1 + fx('bowDmg') + 0.2 * buffPow(p, 'strength'),
    staffDmg: 1 + fx('staffDmg') + 0.2 * buffPow(p, 'strength'),
    crit: fx('crit'),
    dashCd: 1.5 * (1 - Math.min(0.6, fx('dashCd'))),
    maxEnergy: 100 + fx('energy'),
    regenMul: (st.regen === 'fast' ? 2.2 : st.regen === 'none' ? 0 : 1) * (1 + fx('regen')),
    slots: BASE_SLOTS + fx('slots'),
    luck: fx('luck') + (charm.luck || 0) + 0.1 * buffPow(p, 'luck'),
    lightBonus: fx('lightR') + (charm.night ? 0.25 : 0) + 0.25 * buffPow(p, 'night'),
    buildDiscount: Math.min(0.7, fx('buildDiscount')),
    wallDiscount: fx('wallDiscount'),
    buildReach: 7 + fx('buildReach'),
    xpMul: (1 + techFx(world, 'xp') + (charm.xp || 0) + 0.15 * buffPow(p, 'xp')) * (st.xpRate === undefined ? 1 : st.xpRate),
    gatherXp: 1 + fx('gatherXp'),
    coinMul: 1 + fx('coins'),
    sellMul: 1 + fx('sell'),
    landDiscount: fx('landDiscount'),
    dropMul: techFx(world, 'drop'),
    doubleDrop: fx('doubleDrop'),
    oreBonus: fx('oreBonus'),
    plantBonus: fx('plantBonus'),
    rare: 1 + fx('rare'),
    regrow: fx('regrow'),
    cropGrowth: fx('cropGrowth'),
    cropYield: fx('cropYield'),
    bite: fx('bite'),
    rareFish: fx('rareFish'),
    animal: fx('animal'),
    foodMul: 1 + fx('food'),
    potionMul: 1 + fx('potion'),
    lifesteal: fx('lifesteal'),
    cozyMul: 1 + fx('cozy'),
    comfortMul: 1 + fx('comfort'),
    treasureSense: fx('treasureSense') > 0,
    secondWind: fx('secondWind') > 0,
    rested: fx('rested') > 0,
    fireproof: !!charm.fireproof || buffPow(p, 'fireproof') > 0,
    machineMul: 1 + techFx(world, 'machine'),
  };
  p.stats = s;
  return s;
}

export function touch(p) { p.rev++; }

/** Award XP (already multiplied by caller if needed). Handles level ups. */
export function addXp(world, p, amount, raw = false) {
  if (amount <= 0 || p.level >= MAX_LEVEL) return;
  const st = calcStats(world, p);
  const gained = raw ? amount : amount * st.xpMul * (1 + (p.cozy >= 12 ? 0.1 * st.cozyMul : 0));
  p.xp += gained;
  let ups = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++; p.sp++; ups++;
  }
  if (ups) {
    p.stats = null;
    p.hp = calcStats(world, p).maxHp;
    world.fx('levelup', p.x, p.y - 10, p.level);
    world.tell(p.pid, { t: 'toast', text: `Level ${p.level}! +${ups} skill point${ups > 1 ? 's' : ''}`, kind: 'level' });
  }
  touch(p);
}

export function levelSkill(world, p, sid) {
  const s = SKILLS[sid];
  if (!s) return 'Unknown skill';
  const cur = p.skills[sid] || 0;
  if (cur >= s.max) return 'Already maxed';
  if (s.req && !(p.skills[s.req] > 0)) return 'Needs ' + SKILLS[s.req].name;
  if (p.sp < s.cost) return 'Not enough skill points';
  p.sp -= s.cost; p.skills[sid] = cur + 1; p.stats = null;
  resizeInv(p.inv, calcStats(world, p).slots);
  touch(p);
  return null;
}

/** Make sure the inventory has at least the right number of slots (skills/techs add slots). */
export function syncSlots(world, p) {
  const n = calcStats(world, p).slots;
  if (p.inv.length < n) { resizeInv(p.inv, n); touch(p); }
}

export function maxHpOf(world, p) { return calcStats(world, p).maxHp; }

/** Give items to a player; overflow is returned as number not added. */
export function giveItem(p, id, n) {
  const left = invAdd(p.inv, id, n);
  if (n - left > 0) touch(p);
  return left;
}
