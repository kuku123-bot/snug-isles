// Crafting recipes (station-based, instant) and machine processing recipes (timed).
// ingredient key '@fish' = any fish item.
import { TIERS, ARMOR_SETS } from './items.js';

export const RECIPES = [];
const rec = (out, n, inp, station, tech = null, xp = 2, id = out) => {
  RECIPES.push({ id, out, n, in: inp, station, tech, xp });
};

// ---- hand
rec('plank', 1, { wood: 1 }, 'hand', null, 0.5);
rec('rope', 1, { fiber: 3 }, 'hand', null, 0.5);
rec('paper', 2, { fiber: 4 }, 'hand', null, 0.5);
rec('fertilizer', 2, { fiber: 4, slime_goo: 1 }, 'hand', 'gardening', 1);
rec('bottle', 1, { glass: 1 }, 'hand', 'glassmaking', 1);
rec('charcoal', 1, { wood: 3 }, 'hand', null, 0, 'charcoal_hand'); // slow way; furnace is better

// ---- workbench
rec('pickaxe_wood', 1, { wood: 10, fiber: 2 }, 'workbench', null, 3);
rec('sword_wood', 1, { wood: 8, fiber: 2 }, 'workbench', null, 3);
rec('rod_wood', 1, { wood: 6, fiber: 4 }, 'workbench', 'fishing', 3);
rec('bow_wood', 1, { wood: 8, rope: 3 }, 'workbench', 'archery', 4);
rec('arrow', 5, { wood: 1, feather: 1, stone: 1 }, 'workbench', 'archery', 1);
rec('staff_twig', 1, { wood: 10, slime_goo: 6, fiber: 4 }, 'workbench', 'archery', 5);
rec('pickaxe_stone', 1, { wood: 6, stone: 8, fiber: 2 }, 'workbench', 'stonecraft', 4);
rec('sword_stone', 1, { wood: 4, stone: 6, fiber: 2 }, 'workbench', 'stonecraft', 4);
rec('shovel_stone', 1, { wood: 4, stone: 6 }, 'workbench', 'stonecraft', 3);
rec('seed_cotton', 2, { cotton: 1 }, 'workbench', 'weaving', 0.5, 'seed_cotton_make');

// ---- sewing
rec('cloth', 1, { cotton: 2 }, 'sewing', 'weaving', 1);
rec('cloth', 1, { wool: 1 }, 'sewing', 'weaving', 1, 'cloth_wool');

// ---- campfire cooking
rec('berry_jam', 1, { berries: 5 }, 'campfire', 'cooking', 2);
rec('grilled_fish', 1, { '@fish': 1 }, 'campfire', 'cooking', 3);
rec('mushroom_soup', 1, { mushroom: 3 }, 'campfire', 'cooking', 3);

// ---- kitchen
rec('bread', 1, { flour: 3 }, 'kitchen', 'kitchen', 3);
rec('omelet', 1, { egg: 2, mushroom: 1 }, 'kitchen', 'kitchen', 3);
rec('veggie_stew', 1, { carrot: 2, tomato: 2, mushroom: 1 }, 'kitchen', 'kitchen', 4);
rec('fish_stew', 1, { '@fish': 2, tomato: 1, carrot: 1 }, 'kitchen', 'kitchen', 5);
rec('fruit_salad', 1, { apple: 2, berries: 3, strawberry: 1 }, 'kitchen', 'gourmet', 4);
rec('honey_cake', 1, { flour: 2, honey: 2, egg: 1 }, 'kitchen', 'gourmet', 5);
rec('apple_pie', 1, { apple: 3, flour: 2, egg: 1 }, 'kitchen', 'gourmet', 5);
rec('pumpkin_pie', 1, { pumpkin: 1, flour: 2, egg: 1 }, 'kitchen', 'gourmet', 6);
rec('strawberry_cake', 1, { strawberry: 3, flour: 3, egg: 2, milk: 1 }, 'kitchen', 'gourmet', 8);
rec('hot_cocoa', 1, { milk: 2, honey: 2 }, 'kitchen', 'gourmet', 5);
rec('cactus_juice', 1, { cactus_flesh: 3, bottle: 1 }, 'kitchen', 'desertcraft', 3);

// ---- alchemy
rec('potion_health_s', 1, { berries: 3, bottle: 1 }, 'alchemy', 'alchemy', 3);
rec('potion_health_m', 1, { frost_berries: 2, honey: 1, bottle: 1 }, 'alchemy', 'potion_mastery', 5);
rec('potion_health_l', 1, { strawberry: 3, spirit_dust: 1, bottle: 1 }, 'alchemy', 'potion_mastery', 8);
rec('potion_speed', 1, { feather: 2, honey: 1, bottle: 1 }, 'alchemy', 'potion_mastery', 5);
rec('potion_mining', 1, { coal: 2, ember_stone: 1, bottle: 1 }, 'alchemy', 'potion_mastery', 5);
rec('potion_night', 1, { glow_mushroom: 3, bottle: 1 }, 'alchemy', 'mycology', 4);
rec('potion_strength', 1, { bone: 2, slime_goo: 2, bottle: 1 }, 'alchemy', 'potion_mastery', 6);
rec('potion_fireproof', 1, { ember_stone: 2, ice_shard: 2, bottle: 1 }, 'alchemy', 'fire_arts', 6);
rec('potion_luck', 1, { petal_pink: 2, petal_yellow: 2, petal_blue: 2, bottle: 1 }, 'alchemy', 'potion_mastery', 6);
rec('elixir_xp', 1, { crystal_shard: 2, spirit_dust: 2, bottle: 1 }, 'alchemy', 'crystal_craft', 10);

// ---- components
rec('gear', 1, { iron_ingot: 2 }, 'anvil', 'mechanics', 4);
rec('lens', 1, { glass: 2, gold_ingot: 1 }, 'anvil', 'optics', 6);
rec('arcane_core', 1, { spirit_dust: 4, gold_ingot: 3, lens: 1 }, 'arcane', 'arcana', 12);
rec('lava_core', 1, { ember_stone: 6, obsidian_plate: 2, steel_ingot: 2 }, 'forge', 'obsidian_craft', 16);
rec('prism_core', 1, { crystal_bar: 4, gold_ingot: 4, lens: 2 }, 'prism', 'crystal_craft', 22);
rec('void_core', 1, { void_bar: 4, star_bar: 3, prism_core: 1 }, 'starforge', 'star_forging', 30);

// ---- metal tools & weapons & armor by tier
const METAL = {
  copper: { st: 'anvil', tech: 'metalworking', mat: 'copper_ingot' },
  iron: { st: 'anvil', tech: 'ironworking', mat: 'iron_ingot' },
  gold: { st: 'anvil', tech: 'goldsmithing', mat: 'gold_ingot' },
  obsidian: { st: 'forge', tech: 'obsidian_craft', mat: 'obsidian_plate' },
  crystal: { st: 'prism', tech: 'crystal_craft', mat: 'crystal_bar' },
  star: { st: 'starforge', tech: 'star_forging', mat: 'star_bar' },
};
for (const t of TIERS) {
  const m = METAL[t.id];
  if (!m) continue;
  const alloy = t.id === 'gold' ? { iron_ingot: 4 } : t.id === 'obsidian' ? { steel_ingot: 3 } : t.id === 'crystal' ? { gold_ingot: 3 } : t.id === 'star' ? { void_bar: 3 } : {};
  rec(`pickaxe_${t.id}`, 1, { [m.mat]: 6 + t.tier, ...alloy, plank: 3 }, m.st, m.tech, 6 * t.tier);
  rec(`sword_${t.id}`, 1, { [m.mat]: 5 + t.tier, ...alloy, plank: 2 }, m.st, m.tech, 6 * t.tier);
}
rec('shovel_iron', 1, { iron_ingot: 4, plank: 2 }, 'anvil', 'treasure_hunting', 8);
rec('shovel_crystal', 1, { crystal_bar: 4, gold_ingot: 1, plank: 2 }, 'prism', 'crystal_craft', 20);
rec('rod_iron', 1, { iron_ingot: 3, rope: 3 }, 'anvil', 'angling', 8);
rec('rod_crystal', 1, { crystal_bar: 3, rope: 3, gold_ingot: 1 }, 'prism', 'crystal_angling', 20);
rec('bow_iron', 1, { iron_ingot: 5, rope: 3, plank: 3 }, 'anvil', 'ironworking', 10);
rec('bow_gold', 1, { gold_ingot: 6, rope: 3, plank: 3 }, 'anvil', 'goldsmithing', 14);
rec('bow_crystal', 1, { crystal_bar: 6, rope: 3, gold_ingot: 2 }, 'prism', 'crystal_craft', 24);
rec('bow_star', 1, { star_bar: 6, void_bar: 2, rope: 3 }, 'starforge', 'star_forging', 36);
rec('staff_arcane', 1, { gold_ingot: 5, arcane_core: 1, spirit_dust: 4 }, 'arcane', 'arcana', 16);
rec('staff_ember', 1, { ember_stone: 10, obsidian_plate: 3, arcane_core: 1 }, 'forge', 'fire_arts', 22);
rec('staff_prism', 1, { crystal_bar: 6, prism_core: 1, gold_ingot: 2 }, 'prism', 'crystal_craft', 28);
rec('staff_void', 1, { void_bar: 5, void_core: 1 }, 'starforge', 'star_forging', 40);

// armor
const ARMOR_ST = { cloth: ['sewing', 'weaving', 'cloth'], copper: ['anvil', 'metalworking', 'copper_ingot'], iron: ['anvil', 'ironworking', 'iron_ingot'], gold: ['anvil', 'goldsmithing', 'gold_ingot'], obsidian: ['forge', 'obsidian_craft', 'obsidian_plate'], crystal: ['prism', 'crystal_craft', 'crystal_bar'], star: ['starforge', 'star_forging', 'star_bar'] };
for (const s of ARMOR_SETS) {
  const [st, tech, mat] = ARMOR_ST[s.id];
  const mul = s.id === 'cloth' ? 1 : 1;
  rec(`hat_${s.id}`, 1, { [mat]: 3 * mul + (s.id === 'cloth' ? 0 : 1) }, st, tech, 4 * s.tier);
  rec(`tunic_${s.id}`, 1, { [mat]: 5 * mul + (s.id === 'cloth' ? 0 : 2) }, st, tech, 6 * s.tier);
  rec(`boots_${s.id}`, 1, { [mat]: 3 * mul + (s.id === 'cloth' ? 0 : 1) }, st, tech, 4 * s.tier);
}

// ---- charms
rec('charm_speed', 1, { feather: 8, gold_ingot: 2, spirit_dust: 3 }, 'arcane', 'arcana', 14);
rec('charm_magnet', 1, { iron_ingot: 6, gold_ingot: 2, spirit_dust: 3 }, 'arcane', 'arcana', 14);
rec('charm_luck', 1, { petal_yellow: 6, gold_ingot: 3, gem_emerald: 1 }, 'arcane', 'arcana', 16);
rec('charm_heart', 1, { gem_ruby: 1, gold_ingot: 3, strawberry: 4 }, 'arcane', 'arcana', 16);
rec('charm_miner', 1, { gem_sapphire: 1, gold_ingot: 3, ember_stone: 2 }, 'arcane', 'arcana', 16);
rec('charm_xp', 1, { gem_amethyst: 1, lens: 1, paper: 4 }, 'arcane', 'arcana', 18);
rec('charm_night', 1, { glow_mushroom: 6, crystal_shard: 2, gold_ingot: 2 }, 'arcane', 'mycology', 16);
rec('charm_fire', 1, { ember_stone: 8, obsidian_plate: 2, gem_ruby: 1 }, 'forge', 'fire_arts', 20);

// ============================================================ machine processing (timed)
// kind speed multipliers
export const PROC_SPEED = { furnace: 1, blast: 1.7, magma: 2.6, mill: 1 };
export const PROC_CHAIN = { furnace: ['furnace'], blast: ['furnace', 'blast'], magma: ['furnace', 'blast', 'magma'], mill: ['mill'] };
// [kind, input item, input count, output item, output count, seconds, tech]
export const PROCESS = [
  ['furnace', 'copper_ore', 1, 'copper_ingot', 1, 6, 'smelting'],
  ['furnace', 'iron_ore', 1, 'iron_ingot', 1, 8, 'smelting'],
  ['furnace', 'gold_ore', 1, 'gold_ingot', 1, 10, 'smelting'],
  ['furnace', 'wood', 2, 'charcoal', 1, 5, 'smelting'],
  ['furnace', 'sand', 2, 'glass', 1, 5, 'glassmaking'],
  ['furnace', 'clay', 2, 'brick', 1, 5, 'masonry'],
  ['blast', 'iron_ingot', 2, 'steel_ingot', 1, 12, 'steelmaking'],
  ['blast', 'obsidian', 3, 'obsidian_plate', 1, 12, 'obsidian_craft'],
  ['magma', 'crystal_shard', 3, 'crystal_bar', 1, 14, 'crystal_craft'],
  ['magma', 'star_fragment', 3, 'star_bar', 1, 16, 'star_forging'],
  ['magma', 'void_essence', 3, 'void_bar', 1, 18, 'star_forging'],
  ['mill', 'wheat', 1, 'flour', 1, 4, 'milling'],
].map(([kind, input, n, out, on, t, tech]) => ({ kind, input, n, out, on, t, tech }));

export const STATION_NAMES = {
  hand: 'By Hand', workbench: 'Workbench', campfire: 'Campfire', kitchen: 'Kitchen', sewing: 'Sewing Station', anvil: 'Anvil', alchemy: 'Alchemy Table',
  forge: 'Master Forge', arcane: 'Arcane Altar', prism: 'Prism Workshop', starforge: 'Star Forge',
};

/** Recipes grouped by output category for UI filters */
export function recipeCat(r, ITEMS) {
  const it = ITEMS[r.out];
  return it ? it.cat : 'misc';
}
