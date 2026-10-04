// Technology tree (shared by both players). Researched at a Research Table (tiers 1-3), Library Desk (4-6) or Observatory (7-8).
// fx = permanent global bonuses applied by the sim.
import { BUILD } from './build.js';
import { RECIPES, PROCESS } from './recipes.js';

export const TECH_CATS = [
  { id: 'home', name: 'Home & Style', color: '#ff8fb3' },
  { id: 'craft', name: 'Tools & Industry', color: '#ffb347' },
  { id: 'farm', name: 'Farm & Kitchen', color: '#7ed957' },
  { id: 'magic', name: 'Magic & Alchemy', color: '#a77bff' },
  { id: 'adv', name: 'Adventure & Defense', color: '#5cc7ff' },
];

export const TECHS = {};
const T = (id, name, tier, cat, req, cost, desc, fx) => {
  TECHS[id] = { id, name, tier, cat, req, cost, desc, fx: fx || null, xp: tier * 30 };
};

// ------------------------------------------------------------- TIER 1
T('carpentry', 'Carpentry', 1, 'home', [], { wood: 15, fiber: 6 }, 'Dark wood & parquet floors, benches, barrels, crates, shelves.');
T('cottage_style', 'Cottage Charm', 1, 'home', ['weaving', 'carpentry'], { plank: 20, petal_pink: 6, cloth: 4 }, 'Pastel paint, picket fences, cozy cottage furniture.');
T('lighting', 'Lighting', 1, 'home', [], { wood: 10, coal: 2 }, 'Torches, lantern posts and braziers.');
T('storage', 'Storage', 1, 'home', [], { plank: 12, rope: 3 }, 'Large chests.');
T('bridges', 'Bridges', 1, 'home', [], { plank: 15, rope: 4 }, 'Build rope bridges over water.');
T('stonecraft', 'Stonecraft', 1, 'craft', [], { stone: 15, wood: 10 }, 'Stone tools, furnace, stone walls and paths.');
T('weaving', 'Weaving', 1, 'craft', [], { fiber: 15, cotton: 4 }, 'Sewing station, cloth, carpets, banners, curtains.');
T('gardening', 'Gardening', 1, 'farm', [], { berries: 6, fiber: 10, wood: 10 }, 'Farm plots, seeds, plants, hedges and flower beds.');
T('cooking', 'Campfire Cooking', 1, 'farm', [], { berries: 5, stone: 6, wood: 6 }, 'Cook jam, grilled fish and soup over a campfire.');
T('fishing', 'Fishing', 1, 'farm', [], { fiber: 10, plank: 6, wood: 6 }, 'Fishing rod and fish traps.');

// ------------------------------------------------------------- TIER 2
T('masonry', 'Masonry', 2, 'home', ['smelting'], { stone: 30, clay: 6, coal: 4 }, 'Bricks, brick walls & floors, fireplaces, stone bridges.');
T('glassmaking', 'Glassmaking', 2, 'home', ['smelting'], { sand: 10, coal: 6, stone: 10 }, 'Glass, bottles, glass windows and glass houses.');
T('smelting', 'Smelting', 2, 'craft', ['stonecraft'], { stone: 20, coal: 5, clay: 4 }, 'Smelt copper, iron and gold ore into ingots.');
T('metalworking', 'Metalworking', 2, 'craft', ['smelting'], { copper_ingot: 8, plank: 10 }, 'Anvil, copper tools and armor, wall clocks.');
T('kitchen', 'Kitchen', 2, 'farm', ['cooking', 'stonecraft'], { plank: 15, stone: 10, copper_ingot: 3 }, 'Kitchen stove, bread, stews and omelets.');
T('apiary', 'Beekeeping', 2, 'farm', ['gardening'], { plank: 10, petal_yellow: 8, cloth: 2 }, 'Beehives that make honey.');
T('alchemy', 'Alchemy', 2, 'magic', ['glassmaking', 'gardening'], { glass: 4, petal_pink: 4, mushroom: 3 }, 'Alchemy table and healing potions.');
T('archery', 'Archery', 2, 'adv', ['carpentry'], { plank: 10, feather: 5, rope: 4 }, 'Bows, arrows and the twig staff.');
T('trade', 'Trade', 2, 'adv', ['storage'], { plank: 20, cloth: 6, copper_ingot: 4 }, 'Market stall: sell goods for coins.');
T('swift_feet', 'Light Feet', 2, 'adv', ['archery'], { fiber: 10, feather: 6 }, 'Everyone runs 6% faster.', { speed: 0.06 });

// ------------------------------------------------------------- TIER 3
T('modern_style', 'Modern Living', 3, 'home', ['ironworking', 'glassmaking', 'cottage_style'], { iron_ingot: 10, glass: 10, plank: 20 }, 'Sleek modern furniture, bathtubs and aquariums.');
T('frostcraft', 'Frostcraft', 3, 'home', ['smelting'], { ice_shard: 20, iron_ingot: 4 }, 'Ice walls and tiles, the icebox.');
T('desertcraft', 'Desert Craft', 3, 'home', ['smelting'], { sand: 25, clay: 10, cactus_flesh: 8 }, 'Sandstone walls and tiles, cactus pots and juice.');
T('thrifty_builder', 'Thrifty Builder', 3, 'home', ['carpentry', 'metalworking'], { plank: 30, rope: 6, copper_ingot: 6 }, 'Building costs 10% less materials.', { buildDiscount: 0.1 });
T('ironworking', 'Iron Age', 3, 'craft', ['metalworking'], { iron_ingot: 10, coal: 10, plank: 10 }, 'Iron tools and armor, Library desk, mailbox.');
T('mechanics', 'Mechanics', 3, 'craft', ['metalworking'], { iron_ingot: 8, copper_ingot: 6 }, 'Craft gears.');
T('automation', 'Auto-Mining', 3, 'craft', ['mechanics', 'ironworking'], { gear: 4, iron_ingot: 10, stone: 30 }, 'Iron drills that mine ore by themselves.');
T('sturdy_bags', 'Sturdy Bags', 3, 'craft', ['weaving', 'ironworking'], { cloth: 10, rope: 8, iron_ingot: 4 }, 'Everyone gets 4 more inventory slots.', { slots: 4 });
T('irrigation', 'Irrigation', 3, 'farm', ['mechanics', 'gardening'], { iron_ingot: 4, rope: 6, glass: 2 }, 'Sprinklers boost nearby crops.');
T('husbandry', 'Animal Husbandry', 3, 'farm', ['gardening', 'trade'], { plank: 25, wheat: 15, fiber: 10 }, 'Chicken coops, cow sheds and sheep pens.');
T('milling', 'Milling', 3, 'farm', ['mechanics', 'gardening'], { plank: 20, gear: 2, wheat: 10 }, 'Windmills turn wheat into flour.');
T('fortification', 'Fortification', 3, 'adv', ['ironworking', 'archery'], { stone: 40, iron_ingot: 8, arrow: 20 }, 'Arrow turrets and iron fences.');
T('treasure_hunting', 'Treasure Hunting', 3, 'adv', ['ironworking'], { rope: 4, iron_ingot: 4, paper: 6 }, 'Iron shovels. Buried treasure shows on your map.');

// ------------------------------------------------------------- TIER 4
T('elegant_style', 'Elegant Living', 4, 'home', ['goldsmithing', 'cottage_style'], { gold_ingot: 8, cloth: 20, plank: 30 }, 'Gilded furniture, chandeliers, pianos and statues.');
T('garden_design', 'Garden Design', 4, 'home', ['gardening', 'masonry'], { stone: 40, petal_pink: 10, petal_blue: 10, clay: 10 }, 'Fountains, bonsai, gnomes and stone lanterns.');
T('vaults', 'Vaults', 4, 'home', ['steelmaking', 'storage'], { steel_ingot: 6, gold_ingot: 4 }, 'Huge vault storage.');
T('goldsmithing', 'Goldsmithing', 4, 'craft', ['ironworking'], { gold_ingot: 10, coal: 15 }, 'Golden tools and armor, gilded walls.');
T('steelmaking', 'Steelmaking', 4, 'craft', ['ironworking', 'masonry'], { iron_ingot: 20, coal: 30, brick: 20 }, 'Blast furnace and steel ingots.');
T('forging', 'Master Forging', 4, 'craft', ['steelmaking'], { steel_ingot: 4, brick: 20, coal: 20 }, 'The Master Forge.');
T('optics', 'Optics', 4, 'craft', ['goldsmithing', 'glassmaking'], { glass: 20, gold_ingot: 6 }, 'Lenses, telescopes, lighthouses and the Observatory.');
T('gourmet', 'Gourmet Cooking', 4, 'farm', ['kitchen', 'apiary'], { honey: 5, flour: 10, strawberry: 5, egg: 5 }, 'Cakes, pies and cocoa.');
T('angling', 'Angling', 4, 'farm', ['fishing', 'ironworking'], { iron_ingot: 6, rope: 10, fish_minnow: 3 }, 'Iron fishing rods.');
T('bountiful', 'Bountiful Harvest', 4, 'farm', ['gourmet'], { honey: 3, fertilizer: 6, gold_ingot: 2 }, '10% more from every resource you gather.', { drop: 0.1 });

// ------------------------------------------------------------- TIER 5
T('gothic_style', 'Gothic Style', 5, 'home', ['arcana', 'cottage_style'], { bone: 20, spirit_dust: 6, iron_ingot: 10 }, 'Dark furniture, candelabras, cauldrons, coffin beds.');
T('arcana', 'Arcana', 5, 'magic', ['goldsmithing', 'alchemy'], { spirit_dust: 10, gold_ingot: 6, lens: 2 }, 'Arcane altar, staves, charms and cores.');
T('potion_mastery', 'Potion Mastery', 5, 'magic', ['alchemy', 'arcana'], { glass: 10, glow_mushroom: 6, spirit_dust: 4 }, 'Stronger healing and buff potions.');
T('warp_tech', 'Warp Pads', 5, 'magic', ['arcana', 'optics'], { lens: 4, gold_ingot: 8, spirit_dust: 10 }, 'Fast travel between warp pads.');
T('mycology', 'Mushroom Lore', 5, 'magic', ['alchemy'], { glow_mushroom: 10, mushroom: 20, swamp_moss: 20 }, 'Mushroom lamps and stools, mossy floors, night potions.');
T('moonlight_study', 'Moonlight Study', 5, 'magic', ['arcana'], { spirit_dust: 6, glow_mushroom: 4, paper: 10 }, 'Everyone earns 10% more XP.', { xp: 0.1 });
T('greenhouse', 'Greenhouse', 5, 'farm', ['glassmaking', 'irrigation'], { glass: 30, gold_ingot: 4, fertilizer: 10 }, 'Greenhouse plots grow crops super fast.');
T('arcane_defense', 'Arcane Defense', 5, 'adv', ['arcana', 'fortification'], { arcane_core: 2, gold_ingot: 6 }, 'Arcane turrets that never need ammo.');
T('deep_pockets', 'Deep Pockets', 5, 'craft', ['sturdy_bags', 'arcana'], { cloth: 20, gold_ingot: 4, spirit_dust: 4 }, 'Everyone gets 4 more inventory slots.', { slots: 4 });

// ------------------------------------------------------------- TIER 6
T('volcanic_decor', 'Volcanic Decor', 6, 'home', ['obsidian_craft', 'modern_style'], { ember_stone: 15, obsidian: 10, glass: 6 }, 'Lava lamps and obsidian style.');
T('obsidian_craft', 'Obsidian Forging', 6, 'craft', ['forging'], { obsidian: 20, ember_stone: 10, steel_ingot: 6 }, 'Obsidian plates, tools, armor and walls.');
T('magma_smelting', 'Magma Smelting', 6, 'craft', ['obsidian_craft'], { obsidian_plate: 6, lava_core: 1, brick: 30 }, 'The Magma Furnace for rare ores.');
T('heavy_drilling', 'Heavy Drilling', 6, 'craft', ['automation', 'forging'], { steel_ingot: 10, obsidian_plate: 4, gear: 10 }, 'Steel drills with huge reach.');
T('efficient_machines', 'Efficient Machines', 6, 'craft', ['heavy_drilling'], { steel_ingot: 6, gear: 6, obsidian_plate: 2 }, 'All machines work 25% faster.', { machine: 0.25 });
T('fire_arts', 'Fire Arts', 6, 'magic', ['obsidian_craft', 'arcana'], { ember_stone: 20, obsidian_plate: 4, arcane_core: 1 }, 'Ember staff, fireproof potions, flame turrets, magma altar.');

// ------------------------------------------------------------- TIER 7
T('prism_style', 'Rainbow Style', 7, 'home', ['crystal_craft', 'elegant_style'], { crystal_bar: 10, prism_wood: 20, petal_pink: 10 }, 'Shimmering rainbow furniture and crystal lamps.');
T('sky_garden', 'Sky Garden', 7, 'home', ['prism_style', 'garden_design'], { crystal_bar: 8, petal_pink: 10, petal_yellow: 10, petal_blue: 10, fertilizer: 10 }, 'Fairy rings and rainbow arches.');
T('crystal_craft', 'Crystal Crafting', 7, 'craft', ['magma_smelting'], { crystal_shard: 20, gold_ingot: 10 }, 'Crystal bars, tools, armor and the Prism Workshop.');
T('solar_power', 'Solar Power', 7, 'craft', ['crystal_craft', 'heavy_drilling'], { crystal_bar: 6, copper_ingot: 20, lens: 4 }, 'Solar drills need no fuel.');
T('crystal_angling', 'Crystal Angling', 7, 'farm', ['crystal_craft', 'angling'], { crystal_bar: 4, rope: 6, fish_salmon: 2 }, 'Crystal fishing rods.');
T('prism_defense', 'Prism Defense', 7, 'adv', ['crystal_craft', 'arcane_defense'], { prism_core: 2, crystal_bar: 8 }, 'Prism turrets.');

// ------------------------------------------------------------- TIER 8
T('celestial_style', 'Celestial Style', 8, 'home', ['star_forging', 'prism_style'], { star_bar: 10, void_bar: 6, cloth: 20 }, 'Furniture woven from starlight, star lanterns, portal rings.');
T('star_forging', 'Star Forging', 8, 'craft', ['crystal_craft', 'fire_arts'], { star_fragment: 20, void_essence: 10, crystal_bar: 10 }, 'Star bars, star gear and the Star Forge.');
T('void_drilling', 'Void Drilling', 8, 'craft', ['star_forging', 'solar_power'], { void_bar: 6, star_bar: 8, prism_core: 2 }, 'The Void Drill eats anything.');
T('void_defense', 'Void Defense', 8, 'adv', ['star_forging', 'prism_defense'], { void_core: 1, star_bar: 8, prism_core: 2 }, 'Void turrets and the Void Altar.');
T('world_heart', 'Heart of the Isles', 8, 'adv', ['celestial_style', 'void_drilling', 'void_defense'], { boss_token: 4, star_bar: 10, void_bar: 10 }, 'Unlock the final monument.');

export const TECH_IDS = Object.keys(TECHS);
export const researchTierFor = (tier) => (tier <= 3 ? 1 : tier <= 6 ? 2 : 3);

/** What each tech unlocks (derived from the catalogs). */
export function techUnlocks() {
  const out = {};
  for (const id of TECH_IDS) out[id] = { build: [], recipes: [], process: [] };
  for (const b of Object.values(BUILD)) if (b.tech && out[b.tech]) out[b.tech].build.push(b.id);
  for (const r of RECIPES) if (r.tech && out[r.tech]) out[r.tech].recipes.push(r.id);
  for (const p of PROCESS) if (p.tech && out[p.tech]) out[p.tech].process.push(p.out);
  return out;
}
