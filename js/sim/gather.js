// Using items: tools, weapons, food, seeds, shovels, rods. Host-side.
import { TILE, TAU, stochRound, clamp } from '../util.js';
import { ITEMS } from '../data/items.js';
import { NODES } from '../data/nodes.js';
import { BUILD } from '../data/build.js';
import { MOBS } from '../data/mobs.js';
import { CROPS } from '../data/crops.js';
import { calcStats, addXp, touch, techFx, EQUIP_SLOTS, HOTBAR } from './player.js';
import { meleeAttack, fireBow, castStaff, hurtMob } from './combat.js';
import { lootDig, lootChest, lootFish } from './loot.js';
import { ensureState } from './machines.js';
import { hatchEgg } from './pets.js';
import { invCount, invRemove } from './inventory.js';

// ------------------------------------------------------------------ drops
const RARE_ITEM = (id) => ITEMS[id] && (ITEMS[id].sell >= 40 || id.startsWith('gem_'));

export function rollNodeDrops(sim, def, p, mult = 1) {
  const w = sim.world, rng = sim.rng, s = w.settings;
  const st = p ? calcStats(w, p) : null;
  const ym = (s.resourceYield || 1) * (1 + techFx(w, 'drop')) * mult;
  const out = [];
  const double = st && rng.next() < st.doubleDrop ? 2 : 1;
  for (let i = 0; i < def.drops.length; i++) {
    const [id, min, max, chance = 1] = def.drops[i];
    let c = chance;
    if (c < 1 && st && RARE_ITEM(id)) c = Math.min(1, c * st.rare);
    if (c < 1 && st) c = Math.min(1, c * (1 + st.luck * 0.6));
    if (rng.next() >= c) continue;
    let n = min + rng.int(max - min + 1);
    n = stochRound(n * ym, rng) * double;
    if (st && i === 0) {
      if (def.plant && rng.next() < st.plantBonus) n += 1;
      if (/_ore$|coal|stone|ice_shard|ember|obsidian|crystal_shard|star_fragment|bone|sand|clay/.test(id) && rng.next() < st.oreBonus) n += 1;
    }
    if (n > 0) out.push({ id, n });
  }
  return out;
}

export function depleteNode(sim, t, nd, regrowBonus = 0) {
  const w = sim.world;
  if (nd.respawn > 0) {
    t.t = (nd.respawn / (w.settings.resourceRespawn || 1)) * (1 - Math.min(0.6, regrowBonus)) * (0.85 + sim.rng.next() * 0.3);
    w.patchThing(t.id, { dep: 1, hp: nd.hp });
  } else w.removeThing(t.id);
}

export function breakNode(sim, t, p) {
  const w = sim.world, nd = NODES[t.type];
  const items = rollNodeDrops(sim, nd, p);
  const cx = (t.x + 0.5) * TILE, cy = (t.y + 0.7) * TILE;
  for (const it of items) sim.spawnDrop(it.id, it.n, cx, cy);
  const st = p ? calcStats(w, p) : null;
  if (p) { addXp(w, p, nd.xp * st.gatherXp); sim.bump(nd.tree ? 'chop' : nd.plant ? 'pick' : 'mine'); }
  w.fx('break', cx, cy, nd.fx, nd.tree ? 1 : 0);
  depleteNode(sim, t, nd, st ? st.regrow : 0);
}

// ------------------------------------------------------------------ target picking
export function pickTarget(sim, p, ax, ay, reach, opts = {}) {
  const w = sim.world;
  const px = p.x, py = p.y - 6;
  const aimA = Math.atan2(ay - py, ax - px);
  let best = null, bs = Infinity;
  const consider = (kind, ref, cx, cy, rad) => {
    const dp = Math.hypot(cx - px, cy - py);
    if (dp > reach + rad) return;
    const da = Math.hypot(cx - ax, cy - ay);
    if (da > 34) {
      let ang = Math.abs(Math.atan2(cy - py, cx - px) - aimA);
      if (ang > Math.PI) ang = TAU - ang;
      if (ang > 1.2 && dp > rad + 6) return;
    }
    const score = da + dp * 0.3 - (kind === 'mob' ? 6 : 0);
    if (score < bs) { bs = score; best = { kind, ref, cx, cy }; }
  };
  if (!opts.mobsOnly) {
    for (const t of w.thingsNear(px, py, reach + 28)) {
      if (t.dep) continue;
      const nd = NODES[t.type];
      if (!nd || nd.kind !== 'node') continue;
      if (opts.plantsOnly && !nd.plant) continue;
      consider('node', t, (t.x + 0.5) * TILE, (t.y + 0.5) * TILE - (nd.tree ? 4 : 0), nd.tree ? 9 : 8);
    }
  }
  if (!opts.nodesOnly) {
    for (const m of w.mobs.values()) {
      const def = MOBS[m.type];
      if (!def.hostile || m.hp <= 0) continue;
      consider('mob', m, m.x, m.y - def.h * 0.4, def.r + 1);
    }
  }
  return best;
}

// ------------------------------------------------------------------ main entry
const SWING_CD = { pick: 0.48, shovel: 0.6, rod: 0.4 };

export function useItem(sim, p, slot, ax, ay) {
  const w = sim.world;
  const s = p.inv[slot];
  if (!s || p.dead > 0) return false;
  const item = ITEMS[s.id];
  if (!item) return false;
  const st = calcStats(w, p);
  if (p.cd > 0) return false;
  p.sleeping = false; p.sit = null;
  const face = Math.atan2(ay - (p.y - 6), ax - p.x);

  if (item.tool === 'pick') {
    const reach = item.reach + st.reachBonus;
    const tgt = pickTarget(sim, p, ax, ay, reach);
    p.cd = SWING_CD.pick / st.toolSpeed;
    w.fx('swing', p.x, p.y - 6, p.id, Math.round(face * 100), item.id);
    if (!tgt) return true;
    if (tgt.kind === 'mob') {
      hurtMob(sim, tgt.ref, item.power * st.toolDmg * 0.7, p.x, p.y, p, { knock: 50 });
      return true;
    }
    const t = tgt.ref, nd = NODES[t.type];
    if (nd.hard > item.tier) {
      w.fx('clink', tgt.cx, tgt.cy, t.id);
      if (!p.warnT || w.time - p.warnT > 2.5) { p.warnT = w.time; sim.toast(p.pid, `Too tough! Needs a tier ${nd.hard} pickaxe.`, 'warn'); }
      return true;
    }
    let dmg = item.power * st.toolDmg * (0.9 + sim.rng.next() * 0.2);
    let crit = false;
    if (st.crit && sim.rng.next() < st.crit) { dmg *= 2; crit = true; }
    dmg = Math.max(1, Math.round(dmg));
    t.hp -= dmg;
    w.fx('hit', tgt.cx, tgt.cy, nd.fx, crit ? 1 : 0);
    w.fx('nodehit', tgt.cx, tgt.cy, t.id, nd.snd === 'chop' ? 1 : 0);
    w.fx('dmg', tgt.cx, tgt.cy - 10, dmg, crit ? 1 : 3 + 1);
    if (t.hp <= 0) breakNode(sim, t, p);
    return true;
  }

  if (item.weapon === 'sword') {
    p.cd = Math.max(0.2, item.cd) / (1 + (st.toolSpeed - 1) * 0.5);
    w.fx('swing', p.x, p.y - 6, p.id, Math.round(face * 100), item.id);
    meleeAttack(sim, p, item, ax, ay);
    // swords also slice through grass, flowers and bushes within reach
    const tgt = pickTarget(sim, p, ax, ay, item.reach, { plantsOnly: true, nodesOnly: true });
    if (tgt) {
      const t = tgt.ref, nd = NODES[t.type];
      t.hp -= Math.max(1, Math.round(item.dmg));
      w.fx('hit', tgt.cx, tgt.cy, nd.fx, 0);
      if (t.hp <= 0) breakNode(sim, t, p);
    }
    return true;
  }
  if (item.weapon === 'bow') {
    if (fireBow(sim, p, item, ax, ay)) { p.cd = item.cd / (1 + (st.toolSpeed - 1) * 0.5); w.fx('swing', p.x, p.y - 6, p.id, Math.round(face * 100), item.id); }
    return true;
  }
  if (item.weapon === 'staff') {
    castStaff(sim, p, item, ax, ay);
    p.cd = item.cd / (1 + (st.toolSpeed - 1) * 0.5);
    w.fx('swing', p.x, p.y - 6, p.id, Math.round(face * 100), item.id);
    return true;
  }
  if (item.tool === 'shovel') {
    p.cd = SWING_CD.shovel;
    w.fx('swing', p.x, p.y - 6, p.id, Math.round(face * 100), item.id);
    const spot = w.thingsNear(clamp(ax, p.x - 40, p.x + 40), clamp(ay, p.y - 40, p.y + 40), 14).find((t) => NODES[t.type] && NODES[t.type].kind === 'dig');
    if (!spot) { sim.toast(p.pid, 'Dig where you see an X!', 'info'); return true; }
    const cx = (spot.x + 0.5) * TILE, cy = (spot.y + 0.5) * TILE;
    if (Math.hypot(cx - p.x, cy - p.y) > item.tier * 4 + 34) { sim.toast(p.pid, 'Get closer to dig.', 'info'); return true; }
    const biome = w.biomeAtTile(spot.x, spot.y);
    const loot = lootDig(sim.rng, biome.tier, st.luck);
    w.removeThing(spot.id);
    w.fx('dig', cx, cy, 0);
    if (loot.coins) sim.spawnDrop('coin', loot.coins, cx, cy);
    for (const it of loot.items) sim.spawnDrop(it.id, it.n, cx, cy);
    addXp(w, p, 6 + biome.tier * 3);
    sim.bump('dug');
    return true;
  }
  if (item.tool === 'rod') {
    p.cd = SWING_CD.rod;
    return castRod(sim, p, item, ax, ay, st);
  }
  if (item.hatch) return hatchEgg(sim, p, slot);
  if (item.food || item.potion) return consume(sim, p, slot, item, st);
  if (item.crop) return plantSeed(sim, p, slot, item, ax, ay);
  if (item.armor || item.charm) return equipFromSlot(sim, p, slot);
  return false;
}

// ------------------------------------------------------------------ fishing
function castRod(sim, p, item, ax, ay, st) {
  const w = sim.world;
  if (p.fish) {
    const f = p.fish;
    if (f.state === 'bite') {
      const biome = w.biomeAtTile(Math.floor(f.x / TILE), Math.floor(f.y / TILE));
      const id = lootFish(sim.rng, biome.id, item.tier, st.luck, st.rareFish);
      p.fish = null;
      sim.award(p, id, 1 + (sim.rng.chance(0.08 + st.luck * 0.2) ? 1 : 0));
      addXp(w, p, 4 + ITEMS[id].sell * 0.15);
      sim.bump('caught'); if (id === 'fish_koi') sim.bump('koi');
      w.fx('catch', f.x, f.y, id);
      return true;
    }
    p.fish = null; w.fx('fishend', f.x, f.y, 0);
    return true;
  }
  // cast toward the aim point (clamped to a max range); must land on water
  const dx = ax - p.x, dy = ay - (p.y - 6), d = Math.hypot(dx, dy) || 1;
  const range = Math.min(d, 54 + item.tier * 6);
  const x = p.x + (dx / d) * range, y = p.y - 6 + (dy / d) * range;
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (!w.inb(tx, ty) || w.ground[w.idx(tx, ty)] !== 0 || w.hasBridge(w.idx(tx, ty)) || !w.isTileOwned(tx, ty)) {
    sim.toast(p.pid, 'Cast onto the water!', 'info');
    return true;
  }
  p.fish = { x, y, t: 0, state: 'wait', biteAt: (2.2 + sim.rng.next() * 4.5) * (1 - Math.min(0.6, st.bite)) };
  w.fx('cast', x, y, p.id);
  return true;
}

// ------------------------------------------------------------------ eating / potions
function consume(sim, p, slot, item, st) {
  const w = sim.world;
  let heal = 0, hunger = 0, buff = null;
  if (item.food) { heal = item.food.heal * st.foodMul; hunger = item.food.hunger; buff = item.food.buff; }
  if (item.potion) { heal = (item.potion.heal || 0) * st.potionMul; buff = item.potion.buff; }
  const needsHeal = p.hp < st.maxHp, needsFood = w.settings.hunger && p.hunger < 99;
  if (!needsHeal && !needsFood && !buff) { sim.toast(p.pid, 'You are full of energy already.', 'info'); return true; }
  p.cd = 0.5;
  const s = p.inv[slot];
  s.n--; if (s.n <= 0) p.inv[slot] = null;
  if (heal) { p.hp = Math.min(st.maxHp, p.hp + Math.round(heal)); w.fx('dmg', p.x, p.y - 18, Math.round(heal), 4); }
  if (hunger) p.hunger = Math.min(100, p.hunger + hunger);
  if (buff) {
    const dur = buff[1] * (item.food ? st.foodMul : st.potionMul);
    const pow = buff[2];
    const cur = p.buffs[buff[0]];
    p.buffs[buff[0]] = { t: cur && cur.pow >= pow ? Math.max(cur.t, dur) : dur, pow: Math.max(pow, cur ? cur.pow : 0) };
    p.stats = null;
    sim.toast(p.pid, `${buff[0][0].toUpperCase() + buff[0].slice(1)} boost!`, 'good');
  }
  w.fx('eat', p.x, p.y - 8, p.id);
  touch(p);
  return true;
}

// ------------------------------------------------------------------ farming
function plantSeed(sim, p, slot, item, ax, ay) {
  const w = sim.world;
  const tx = Math.floor(ax / TILE), ty = Math.floor(ay / TILE);
  const plot = w.thingAt(tx, ty) || w.flatAt(tx, ty);
  const d = plot && BUILD[plot.type];
  if (!d || d.behavior !== 'farm') { sim.toast(p.pid, 'Plant seeds on a farm plot.', 'info'); return true; }
  if (Math.hypot((plot.x + 0.5) * TILE - p.x, (plot.y + 0.5) * TILE - p.y) > 44) { sim.toast(p.pid, 'Move closer to plant.', 'info'); return true; }
  const s = ensureState(plot);
  if (s.c) { sim.toast(p.pid, 'Something is already growing here.', 'info'); return true; }
  const inv = p.inv[slot];
  inv.n--; if (inv.n <= 0) p.inv[slot] = null;
  plot.s = { ...s, c: item.crop, g: 0, st: 0, by: p.pid };
  w.patchThing(plot.id, { s: plot.s });
  sim.bump('planted');
  w.fx('plant', (plot.x + 0.5) * TILE, (plot.y + 0.5) * TILE, 0);
  p.cd = 0.3;
  touch(p);
  return true;
}

export function harvestPlot(sim, p, plot) {
  const w = sim.world;
  const s = ensureState(plot);
  if (!s.c) return false;
  const crop = CROPS[s.c];
  if (s.g < crop.time) { sim.toast(p.pid, `${crop.name} isn't ready yet.`, 'info'); return true; }
  const st = calcStats(w, p);
  let n = crop.yield[0] + sim.rng.int(crop.yield[1] - crop.yield[0] + 1);
  if (sim.rng.next() < st.cropYield) n += 1;
  n = stochRound(n * (1 + techFx(w, 'drop')), sim.rng);
  sim.award(p, crop.item, n);
  if (sim.rng.next() < 0.55) sim.award(p, 'seed_' + s.c, 1 + sim.rng.int(2));
  addXp(w, p, 4 + n);
  sim.bump('harvested');
  const cx = (plot.x + 0.5) * TILE, cy = (plot.y + 0.5) * TILE;
  w.fx('harvest', cx, cy, 0);
  plot.s = crop.regrow ? { ...s, g: crop.time * 0.45 } : { ...s, c: null, g: 0, st: 0 };
  plot.s.st = crop.regrow ? 1 : 0;
  w.patchThing(plot.id, { s: plot.s });
  return true;
}

// ------------------------------------------------------------------ equipment
export function equipFromSlot(sim, p, slot) {
  const s = p.inv[slot];
  if (!s) return false;
  const item = ITEMS[s.id];
  const eq = item.armor || (item.charm ? 'charm' : null);
  if (!eq) return false;
  const cur = p.equip[eq];
  p.equip[eq] = { id: s.id, n: 1 };
  p.inv[slot] = cur;
  p.stats = null;
  sim.world.fx('equip', p.x, p.y - 8, p.id);
  touch(p);
  return true;
}
export function unequip(sim, p, eq) {
  const cur = p.equip[eq];
  if (!cur) return false;
  const free = p.inv.findIndex((x) => !x);
  if (free < 0) { sim.toast(p.pid, 'Bag is full!', 'warn'); return false; }
  p.inv[free] = cur; p.equip[eq] = null; p.stats = null;
  touch(p);
  return true;
}

export function openWildChest(sim, p, t) {
  const w = sim.world;
  if (t.dep) return;
  const biome = w.biomeAtTile(t.x, t.y);
  const st = calcStats(w, p);
  const loot = lootChest(sim.rng, biome.tier, st.luck);
  // an Old Key in the bag unlocks a second helping of treasure
  if (invCount(p.inv, 'treasure_key') > 0) {
    invRemove(p.inv, 'treasure_key', 1); touch(p);
    const bonus = lootChest(sim.rng, biome.tier, st.luck + 0.2);
    loot.coins += bonus.coins; loot.items.push(...bonus.items);
    sim.toast(p.pid, 'The Old Key unlocked a bonus: double treasure!', 'good');
  }
  const cx = (t.x + 0.5) * TILE, cy = (t.y + 0.5) * TILE;
  w.patchThing(t.id, { dep: 1 });
  w.fx('chestopen', cx, cy, 0);
  sim.spawnDrop('coin', loot.coins, cx, cy);
  for (const it of loot.items) sim.spawnDrop(it.id, it.n, cx, cy);
  addXp(w, p, 12 + biome.tier * 6);
}
