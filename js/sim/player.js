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
  let charm = {};
  const cd = equippedDef(p, 'charm');
  if (cd && cd.charm) charm = cd.charm;
  let defPts = 0;
  for (const slot of ['head', 'body', 'feet']) { const d = equippedDef(p, slot); if (d) defPts += d.def || 0; }
  const speedMul = 1 + skillFx(p, 'speed') + techFx(world, 'speed') + (charm.speed || 0) + 0.1 * buffPow(p, 'speed');
  const s = {
    _k: key,
    maxHp: BASE_HP + skillFx(p, 'maxHp') + (charm.hp || 0),
    defense: Math.min(0.75, defPts * 0.025 + skillFx(p, 'dmgTaken')),
    speed: 66 * speedMul,
    magnet: 26 * (1 + skillFx(p, 'magnet')) * (charm.magnet || 1),
    reachBonus: skillFx(p, 'reach'),
    toolDmg: 1 + skillFx(p, 'toolDmg') + (charm.mining || 0) + 0.2 * buffPow(p, 'mining'),
    toolSpeed: 1 + skillFx(p, 'toolSpeed') + 0.15 * buffPow(p, 'mining'),
    meleeDmg: 1 + skillFx(p, 'meleeDmg') + 0.2 * buffPow(p, 'strength'),
    bowDmg: 1 + skillFx(p, 'bowDmg') + 0.2 * buffPow(p, 'strength'),
    staffDmg: 1 + skillFx(p, 'staffDmg') + 0.2 * buffPow(p, 'strength'),
    crit: skillFx(p, 'crit'),
    dashCd: 1.5 * (1 - Math.min(0.6, skillFx(p, 'dashCd'))),
    maxEnergy: 100 + skillFx(p, 'energy'),
    regenMul: (st.regen === 'fast' ? 2.2 : st.regen === 'none' ? 0 : 1) * (1 + skillFx(p, 'regen')),
    slots: BASE_SLOTS + skillFx(p, 'slots') + techFx(world, 'slots'),
    luck: skillFx(p, 'luck') + (charm.luck || 0) + 0.1 * buffPow(p, 'luck'),
    lightBonus: skillFx(p, 'lightR') + (charm.night ? 0.25 : 0) + 0.25 * buffPow(p, 'night'),
    buildDiscount: Math.min(0.7, skillFx(p, 'buildDiscount') + techFx(world, 'buildDiscount')),
    wallDiscount: skillFx(p, 'wallDiscount'),
    buildReach: 7 + skillFx(p, 'buildReach'),
    xpMul: (1 + techFx(world, 'xp') + (charm.xp || 0) + 0.15 * buffPow(p, 'xp')) * (st.xpRate === undefined ? 1 : st.xpRate),
    gatherXp: 1 + skillFx(p, 'gatherXp'),
    coinMul: 1 + skillFx(p, 'coins'),
    sellMul: 1 + skillFx(p, 'sell'),
    landDiscount: skillFx(p, 'landDiscount'),
    dropMul: techFx(world, 'drop'),
    doubleDrop: skillFx(p, 'doubleDrop'),
    oreBonus: skillFx(p, 'oreBonus'),
    plantBonus: skillFx(p, 'plantBonus'),
    rare: 1 + skillFx(p, 'rare'),
    regrow: skillFx(p, 'regrow'),
    cropGrowth: skillFx(p, 'cropGrowth'),
    cropYield: skillFx(p, 'cropYield'),
    bite: skillFx(p, 'bite'),
    rareFish: skillFx(p, 'rareFish'),
    animal: skillFx(p, 'animal'),
    foodMul: 1 + skillFx(p, 'food'),
    potionMul: 1 + skillFx(p, 'potion'),
    lifesteal: skillFx(p, 'lifesteal'),
    cozyMul: 1 + skillFx(p, 'cozy'),
    comfortMul: 1 + skillFx(p, 'comfort'),
    treasureSense: skillFx(p, 'treasureSense') > 0,
    secondWind: skillFx(p, 'secondWind') > 0,
    rested: skillFx(p, 'rested') > 0,
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
