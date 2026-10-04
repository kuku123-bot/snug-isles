// Loot tables: treasure chests, dig spots and fishing. Tier = biome tier (0 meadow .. 7 void).
import { ITEMS } from '../data/items.js';

// [item, minTier, weight, min, max]
const POOL = [
  ['plank', 0, 3, 4, 10], ['rope', 0, 3, 2, 5], ['cloth', 0, 2, 2, 5], ['paper', 0, 2, 3, 6],
  ['copper_ingot', 1, 3, 2, 5], ['iron_ingot', 2, 3, 2, 5], ['gold_ingot', 3, 2, 1, 3], ['steel_ingot', 4, 2, 1, 3],
  ['obsidian_plate', 5, 2, 1, 3], ['crystal_bar', 6, 2, 1, 3], ['star_bar', 7, 2, 1, 2],
  ['potion_health_s', 0, 3, 1, 2], ['potion_health_m', 2, 2, 1, 2], ['potion_health_l', 4, 2, 1, 2], ['potion_speed', 2, 1.2, 1, 1], ['potion_luck', 3, 1, 1, 1], ['potion_mining', 2, 1, 1, 1],
  ['gem_ruby', 2, 1.4, 1, 1], ['gem_sapphire', 2, 1.4, 1, 1], ['gem_emerald', 2, 1.4, 1, 1], ['gem_amethyst', 3, 1, 1, 1],
  ['seed_pumpkin', 0, 2, 2, 4], ['seed_strawberry', 0, 2, 2, 4], ['seed_tomato', 0, 2, 2, 4], ['seed_carrot', 0, 2, 2, 4], ['seed_wheat', 0, 2, 3, 6],
  ['honey', 1, 1.2, 1, 3], ['fish_koi', 1, 0.5, 1, 1], ['arrow', 1, 2, 8, 16], ['fertilizer', 1, 1.5, 2, 5], ['bottle', 2, 1, 2, 4],
  ['pet_egg', 2, 0.5, 1, 1], ['charm_speed', 3, 0.35, 1, 1], ['charm_magnet', 3, 0.35, 1, 1], ['charm_luck', 3, 0.3, 1, 1], ['charm_heart', 4, 0.3, 1, 1], ['charm_xp', 4, 0.3, 1, 1],
  ['gear', 3, 1.5, 1, 3], ['lens', 4, 0.8, 1, 2], ['arcane_core', 5, 0.4, 1, 1],
];

function pick(rng, tier, luck, pool) {
  const cand = pool.filter((e) => tier >= e[1] && tier <= e[1] + 4);
  const total = cand.reduce((a, e) => a + e[2] * (e[2] < 1 ? 1 + luck * 2 : 1), 0);
  let r = rng.next() * total;
  for (const e of cand) {
    r -= e[2] * (e[2] < 1 ? 1 + luck * 2 : 1);
    if (r <= 0) return e;
  }
  return cand[cand.length - 1];
}

export function lootChest(rng, tier, luck = 0) {
  const items = [];
  const coins = Math.round((12 + rng.int(18)) * (1 + tier * 1.3) * (1 + luck));
  const n = 3 + rng.int(3) + (rng.chance(0.2 + luck) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const e = pick(rng, tier, luck, POOL);
    items.push({ id: e[0], n: e[3] + rng.int(e[4] - e[3] + 1) });
  }
  return { coins, items };
}

const DIG_POOL = [
  ['clay', 0, 3, 2, 4], ['sand', 0, 3, 2, 4], ['stone', 0, 2, 2, 4], ['seed_wheat', 0, 1.5, 1, 3], ['seed_carrot', 0, 1.2, 1, 2], ['fertilizer', 0, 1.2, 1, 2], ['bone', 1, 1.5, 1, 2],
  ['gem_ruby', 1, 0.5, 1, 1], ['gem_sapphire', 1, 0.5, 1, 1], ['gem_emerald', 1, 0.5, 1, 1], ['copper_ingot', 1, 1, 1, 2], ['iron_ore', 2, 1, 1, 3], ['gold_ore', 3, 1, 1, 2],
  ['treasure_key', 0, 0.35, 1, 1], ['pet_egg', 1, 0.3, 1, 1], ['spirit_dust', 3, 1, 1, 2], ['ember_stone', 5, 1, 1, 2], ['crystal_shard', 6, 1, 1, 2], ['star_fragment', 7, 1, 1, 1],
];
export function lootDig(rng, tier, luck = 0) {
  const items = [];
  const coins = Math.round((4 + rng.int(10)) * (1 + tier * 0.9) * (1 + luck));
  const n = 1 + (rng.chance(0.4 + luck) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const e = pick(rng, tier, luck, DIG_POOL);
    items.push({ id: e[0], n: e[3] + rng.int(e[4] - e[3] + 1) });
  }
  return { coins, items };
}

// fishing: by biome id => [[fish, weight], ...]; rod tier & luck shift weight toward rare entries
const FISH_BY_BIOME = {
  meadow: [['fish_minnow', 60], ['fish_carp', 30], ['fish_salmon', 8], ['fish_koi', 1.2]],
  desert: [['fish_cactus', 55], ['fish_carp', 25], ['fish_salmon', 12], ['fish_koi', 1.5]],
  tundra: [['fish_frost', 55], ['fish_minnow', 20], ['fish_salmon', 20], ['fish_koi', 2]],
  swamp: [['fish_glow', 45], ['fish_carp', 35], ['fish_salmon', 15], ['fish_koi', 2]],
  graveyard: [['fish_glow', 40], ['fish_carp', 30], ['fish_salmon', 20], ['fish_koi', 3]],
  volcano: [['fish_lava', 55], ['fish_salmon', 25], ['fish_koi', 4]],
  crystal: [['fish_star', 20], ['fish_salmon', 40], ['fish_koi', 8], ['fish_frost', 30]],
  void: [['fish_star', 50], ['fish_koi', 12], ['fish_glow', 30]],
};
export function lootFish(rng, biomeId, rodTier = 1, luck = 0, rareBonus = 0) {
  const tbl = FISH_BY_BIOME[biomeId] || FISH_BY_BIOME.meadow;
  const boost = 1 + (rodTier - 1) * 0.12 + luck + rareBonus;
  const entries = tbl.map(([id, w]) => [id, ITEMS[id].sell > 10 ? w * boost : w]);
  return rng.weighted(entries);
}
