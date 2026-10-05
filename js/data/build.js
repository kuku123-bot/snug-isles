// Blueprint catalog: everything you can build. Built from the Build menu using materials (no item needed).
// kind: 'thing' (footprint object) | 'wall' (wall layer tile) | 'floor' (floor layer tile) | 'walldeco' (decor on a wall tile)
//       | 'flat' (walkable decor like rugs; drawn under entities, never blocks)
// tech: id of the tech that unlocks it (null = available from the start).
import { prettyId } from '../util.js';

export const BUILD = {};
export const WALL_IDS = [];   // wall-layer codes: index+1
export const FLOOR_IDS = [];  // floor-layer codes: index+1
export const WALLDECO_IDS = [];

function reg(def) {
  const d = { w: 1, h: 1, kind: 'thing', solid: true, tech: null, cost: {}, comfort: 0, ...def };
  if (!d.name) d.name = prettyId(d.id);
  if (BUILD[d.id]) throw new Error('dup build ' + d.id);
  BUILD[d.id] = d;
  if (d.kind === 'wall') WALL_IDS.push(d.id);
  if (d.kind === 'floor') FLOOR_IDS.push(d.id);
  if (d.kind === 'walldeco') WALLDECO_IDS.push(d.id);
  return d;
}
export const wallCode = (id) => WALL_IDS.indexOf(id) + 1;

// ====================================================================== WALLS
// [mat, name, perWallCost, tech, hasGlassWindow]
export const WALL_MATS = [
  ['plank', 'Plank', { plank: 1 }, null, false],
  ['log', 'Log', { wood: 2 }, null, false],
  ['thatch', 'Thatch', { fiber: 3 }, null, false],
  ['plaster', 'Plaster', { plank: 1, clay: 1 }, 'cottage_style', true],
  ['pink', 'Pink Paint', { plank: 1, petal_pink: 1 }, 'cottage_style', true],
  ['mint', 'Mint Paint', { plank: 1, fiber: 1, petal_blue: 1 }, 'cottage_style', true],
  ['sky', 'Sky Paint', { plank: 1, petal_blue: 1 }, 'cottage_style', true],
  ['butter', 'Butter Paint', { plank: 1, petal_yellow: 1 }, 'cottage_style', true],
  ['lilac', 'Lilac Paint', { plank: 1, petal_pink: 1, petal_blue: 1 }, 'pastel_palette', true],
  ['peach', 'Peach Paint', { plank: 1, petal_pink: 1, petal_yellow: 1 }, 'pastel_palette', true],
  ['seafoam', 'Seafoam Paint', { plank: 1, petal_blue: 1, petal_yellow: 1 }, 'pastel_palette', true],
  ['stone', 'Stone', { stone: 2 }, 'stonecraft', true],
  ['brick', 'Brick', { brick: 2 }, 'masonry', true],
  ['glass', 'Glass', { glass: 2 }, 'glassmaking', false],
  ['sandstone', 'Sandstone', { sand: 2, clay: 1 }, 'desertcraft', true],
  ['ice', 'Ice', { ice_shard: 2 }, 'frostcraft', true],
  ['iron', 'Iron', { iron_ingot: 1 }, 'ironworking', true],
  ['gilded', 'Gilded', { plank: 1, gold_ingot: 1 }, 'goldsmithing', true],
  ['bone', 'Bone', { bone: 3 }, 'gothic_style', true],
  ['obsidian', 'Obsidian', { obsidian_plate: 1 }, 'obsidian_craft', true],
  ['crystal', 'Crystal', { crystal_bar: 1 }, 'crystal_craft', true],
  ['star', 'Starlit', { star_bar: 1 }, 'star_forging', true],
];
for (const [mat, name, c, tech, glassWin] of WALL_MATS) {
  reg({ id: `wall_${mat}`, name: `${name} Wall`, cat: 'walls', kind: 'wall', piece: 'wall', mat, cost: { ...c }, tech, solid: true });
  if (mat !== 'glass') {
    const wc = { ...c };
    if (glassWin) wc.glass = (wc.glass || 0) + 1;
    reg({ id: `window_${mat}`, name: `${name} Window`, cat: 'walls', kind: 'wall', piece: 'window', mat, cost: wc, tech: glassWin && tech === null ? 'glassmaking' : tech, solid: true });
  }
  const dc = {};
  for (const k of Object.keys(c)) dc[k] = c[k] * 2;
  reg({ id: `door_${mat}`, name: `${name} Door`, cat: 'walls', kind: 'wall', piece: 'door', mat, cost: dc, tech, solid: true });
}
// windows for wood-ish materials are shutters: no glass needed -> available from the start
BUILD.window_plank.tech = null; BUILD.window_plank.cost = { plank: 1 };
BUILD.window_log.tech = null; BUILD.window_log.cost = { wood: 2 };
BUILD.window_thatch.tech = null; BUILD.window_thatch.cost = { fiber: 3 };

// fences (low, see-through) + gates
const FENCES = [['wood', 'Wooden', { plank: 1 }, null], ['picket', 'White Picket', { plank: 1, clay: 1 }, 'cottage_style'], ['stone', 'Low Stone', { stone: 1 }, 'stonecraft'], ['iron', 'Iron', { iron_ingot: 1 }, 'fortification'], ['bone', 'Bone', { bone: 2 }, 'gothic_style'], ['drift', 'Driftwood', { plank: 1, sand: 1 }, 'driftwood']];
for (const [mat, name, c, tech] of FENCES) {
  reg({ id: `fence_${mat}`, name: `${name} Fence`, cat: 'walls', kind: 'wall', piece: 'fence', mat, cost: { ...c }, tech, solid: true });
  const gc = {}; for (const k of Object.keys(c)) gc[k] = c[k] * 2;
  reg({ id: `gate_${mat}`, name: `${name} Gate`, cat: 'walls', kind: 'wall', piece: 'gate', mat, cost: gc, tech, solid: true });
}

// ====================================================================== FLOORS
const FLOORS = [
  ['plank', 'Plank Floor', { plank: 1 }, null], ['straw', 'Straw Mat', { fiber: 2 }, null], ['path', 'Dirt Path', { fiber: 1 }, null],
  ['dark', 'Dark Wood Floor', { plank: 1, charcoal: 1 }, 'carpentry'], ['parquet', 'Parquet Floor', { plank: 2 }, 'carpentry'],
  ['cobble', 'Cobblestone', { stone: 1 }, 'stonecraft'], ['flagstone', 'Flagstone', { stone: 2 }, 'stonecraft'],
  ['carpet_cream', 'Cream Carpet', { cloth: 1 }, 'weaving'], ['carpet_pink', 'Pink Carpet', { cloth: 1, petal_pink: 1 }, 'weaving'],
  ['carpet_blue', 'Blue Carpet', { cloth: 1, petal_blue: 1 }, 'weaving'], ['carpet_yellow', 'Sunny Carpet', { cloth: 1, petal_yellow: 1 }, 'weaving'],
  ['carpet_red', 'Red Carpet', { cloth: 1, petal_pink: 2 }, 'weaving'], ['carpet_green', 'Green Carpet', { cloth: 1, fiber: 2 }, 'weaving'],
  ['tile_pink', 'Pink Tile', { brick: 1, petal_pink: 1 }, 'cottage_style'], ['tile_blue', 'Blue Tile', { brick: 1, petal_blue: 1 }, 'cottage_style'],
  ['brick', 'Brick Floor', { brick: 1 }, 'masonry'], ['checker', 'Checker Tile', { brick: 1, coal: 1 }, 'masonry'],
  ['sandstone', 'Sandstone Tile', { sand: 1, clay: 1 }, 'desertcraft'], ['ice', 'Ice Tile', { ice_shard: 1 }, 'frostcraft'],
  ['gold', 'Gilded Tile', { brick: 1, gold_ingot: 1 }, 'goldsmithing'], ['bone', 'Bone Tile', { bone: 2 }, 'gothic_style'],
  ['boardwalk', 'Boardwalk', { plank: 1, sand: 1 }, 'driftwood'],
  ['tile_mint', 'Mint Tile', { brick: 1, petal_blue: 1, petal_yellow: 1 }, 'pastel_palette'], ['tile_lilac', 'Lilac Tile', { brick: 1, petal_pink: 1, petal_blue: 1 }, 'pastel_palette'],
  ['tile_butter', 'Butter Tile', { brick: 1, petal_yellow: 2 }, 'pastel_palette'],
  ['carpet_lilac', 'Lilac Carpet', { cloth: 1, petal_pink: 1, petal_blue: 1 }, 'pastel_palette'], ['carpet_teal', 'Teal Carpet', { cloth: 1, petal_blue: 2 }, 'pastel_palette'],
  ['moss', 'Mossy Floor', { swamp_moss: 2 }, 'mycology'], ['obsidian', 'Obsidian Tile', { obsidian_plate: 1 }, 'obsidian_craft'],
  ['crystal', 'Crystal Tile', { crystal_bar: 1 }, 'crystal_craft'], ['star', 'Starlit Tile', { star_bar: 1 }, 'star_forging'],
];
for (const [id, name, cost, tech] of FLOORS) reg({ id: `floor_${id}`, name, cat: 'floors', kind: 'floor', cost, tech, solid: false });
reg({ id: 'bridge_rope', name: 'Rope Bridge', cat: 'floors', kind: 'floor', water: true, cost: { rope: 1, plank: 1 }, tech: 'bridges', solid: false });
reg({ id: 'bridge_stone', name: 'Stone Bridge', cat: 'floors', kind: 'floor', water: true, cost: { stone: 3 }, tech: 'masonry', solid: false });

// ====================================================================== FURNITURE SETS (9 styles x 12 designs)
export const STYLES = [
  { id: 'rustic', name: 'Rustic', main: 'plank', soft: 'fiber', acc: null, tech: null, comfort: 0 },
  { id: 'cottage', name: 'Cottage', main: 'plank', soft: 'cloth', acc: 'petal_pink', tech: 'cottage_style', comfort: 1 },
  { id: 'seaside', name: 'Seaside', main: 'plank', soft: 'cloth', acc: 'sand', tech: 'beach_style', comfort: 1 },
  { id: 'modern', name: 'Modern', main: 'iron_ingot', soft: 'cloth', acc: 'glass', tech: 'modern_style', comfort: 1 },
  { id: 'bamboo', name: 'Bamboo', main: 'plank', soft: 'fiber', acc: 'clay', tech: 'zen_garden', comfort: 2 },
  { id: 'elegant', name: 'Elegant', main: 'plank', soft: 'cloth', acc: 'gold_ingot', tech: 'elegant_style', comfort: 2 },
  { id: 'gothic', name: 'Gothic', main: 'bone', soft: 'cloth', acc: 'spirit_dust', tech: 'gothic_style', comfort: 2 },
  { id: 'rainbow', name: 'Rainbow', main: 'prism_wood', soft: 'cloth', acc: 'crystal_bar', tech: 'prism_style', comfort: 3 },
  { id: 'celestial', name: 'Celestial', main: 'star_bar', soft: 'cloth', acc: 'void_bar', tech: 'celestial_style', comfort: 4 },
];
// design: [id, name, w, h, mainQty, softQty, accQty, comfort, extra]
export const DESIGNS = [
  ['bed', 'Bed', 1, 2, 6, 4, 1, 3, { behavior: 'bed' }],
  ['chair', 'Chair', 1, 1, 3, 1, 0, 1, { behavior: 'seat', solid: false }],
  ['stool', 'Stool', 1, 1, 2, 0, 0, 1, { behavior: 'seat', solid: false }],
  ['sofa', 'Sofa', 2, 1, 6, 5, 1, 3, { behavior: 'seat', solid: false }],
  ['table', 'Long Table', 2, 1, 6, 0, 1, 1, {}],
  ['table_round', 'Round Table', 1, 1, 4, 0, 1, 1, {}],
  ['bookshelf', 'Bookshelf', 1, 1, 6, 0, 1, 2, { paper: 2 }],
  ['wardrobe', 'Wardrobe', 1, 1, 8, 1, 1, 1, { behavior: 'storage', conf: { slots: 12 } }],
  ['dresser', 'Dresser', 1, 1, 5, 0, 1, 1, { behavior: 'storage', conf: { slots: 8 } }],
  ['lamp', 'Floor Lamp', 1, 1, 2, 0, 1, 2, { lampLight: true }],
  ['rug', 'Rug', 2, 2, 0, 4, 1, 1, { kind: 'flat', solid: false }],
  ['nightstand', 'Nightstand', 1, 1, 3, 0, 1, 1, {}],
];
const STYLE_LIGHT = { rustic: '#ffc477', cottage: '#ffd6a0', seaside: '#ffe9c0', bamboo: '#e0f0a8', modern: '#d8f2ff', elegant: '#ffe08a', gothic: '#c9a0ff', rainbow: '#ffc8f0', celestial: '#b8c4ff' };
for (const st of STYLES) {
  for (const [did, dname, w, h, mq, sq, aq, comfort, ex] of DESIGNS) {
    const cost = {};
    if (mq) cost[st.main] = (cost[st.main] || 0) + (st.main === 'iron_ingot' || st.main === 'star_bar' ? Math.ceil(mq / 3) : mq);
    if (sq) cost[st.soft] = (cost[st.soft] || 0) + sq;
    if (aq && st.acc) cost[st.acc] = (cost[st.acc] || 0) + aq;
    if (ex.paper) cost.paper = ex.paper;
    const { paper, lampLight, ...rest } = ex;
    const def = { id: `${st.id}_${did}`, name: `${st.name} ${dname}`, cat: 'furniture', set: st.id, design: did, w, h, cost, tech: st.tech, comfort: comfort + st.comfort, ...rest };
    if (lampLight) def.light = { r: 54, c: STYLE_LIGHT[st.id], flick: false };
    reg(def);
  }
}

// ====================================================================== WALL DECOR (hung on a wall tile)
const WALLDECOS = [
  ['painting_meadow', 'Meadow Painting', { plank: 1, paper: 2, petal_yellow: 1 }, null], ['painting_cat', 'Cat Portrait', { plank: 1, paper: 2, petal_pink: 1 }, 'cottage_style'],
  ['painting_sea', 'Seascape', { plank: 1, paper: 2, petal_blue: 2 }, 'cottage_style'], ['painting_stars', 'Night Sky Art', { plank: 1, paper: 2, crystal_shard: 1 }, 'elegant_style'],
  ['wall_clock', 'Wall Clock', { plank: 2, copper_ingot: 1 }, 'metalworking'], ['wreath', 'Flower Wreath', { fiber: 3, petal_pink: 2, petal_yellow: 1 }, 'cottage_style'],
  ['banner_pink', 'Pink Banner', { cloth: 2, petal_pink: 1 }, 'weaving'], ['banner_blue', 'Blue Banner', { cloth: 2, petal_blue: 1 }, 'weaving'],
  ['curtains_cream', 'Cream Curtains', { cloth: 2 }, 'weaving'], ['curtains_pink', 'Pink Curtains', { cloth: 2, petal_pink: 1 }, 'weaving'], ['curtains_blue', 'Blue Curtains', { cloth: 2, petal_blue: 1 }, 'weaving'],
  ['sconce', 'Wall Sconce', { iron_ingot: 1, coal: 1 }, 'ironworking'], ['wall_mirror', 'Wall Mirror', { glass: 2, plank: 1 }, 'glassmaking'],
  ['antlers', 'Antler Trophy', { bone: 3, plank: 1 }, 'gothic_style'], ['wall_shelf', 'Wall Shelf', { plank: 2, rope: 1 }, 'carpentry'],
  ['star_map', 'Star Map', { paper: 3, star_fragment: 1 }, 'celestial_style'],
  ['conch_shell', 'Conch Shell', { sand: 3, clay: 1 }, 'shell_craft'], ['lifebuoy', 'Life Ring', { rope: 3, cloth: 1, petal_pink: 1 }, 'shell_craft'],
  ['string_lights', 'String Lights', { rope: 2, glass: 1, coal: 1 }, 'lantern_festival'],
];
for (const [id, name, cost, tech] of WALLDECOS) reg({ id, name, cat: 'walldeco', kind: 'walldeco', cost, tech, solid: false, comfort: 1, light: id === 'sconce' ? { r: 40, c: '#ffc477', flick: true } : id === 'string_lights' ? { r: 44, c: '#ffe0a0', flick: false } : undefined });

// ====================================================================== STATIONS & MACHINES
const S = (o) => reg({ cat: 'stations', ...o });
S({ id: 'workbench', name: 'Workbench', w: 2, h: 1, cost: { wood: 10 }, behavior: 'station', conf: { station: 'workbench' }, desc: 'Craft tools, weapons and basics.' });
S({ id: 'campfire', name: 'Campfire', cost: { wood: 5, stone: 3 }, behavior: 'station', conf: { station: 'campfire' }, light: { r: 62, c: '#ff9a4a', flick: true }, comfort: 2, desc: 'Cook simple meals. Warm and bright.' });
S({ id: 'research_table', name: 'Research Table', w: 2, h: 1, cost: { plank: 8, stone: 5, fiber: 6 }, behavior: 'research', conf: { tier: 1 }, desc: 'Research tier 1-3 technologies.' });
S({ id: 'library', name: 'Library Desk', w: 2, h: 1, cost: { plank: 30, brick: 15, iron_ingot: 10, glass: 8, cloth: 6 }, tech: 'ironworking', behavior: 'research', conf: { tier: 2 }, light: { r: 38, c: '#ffe0a0' }, desc: 'Research tier 4-6 technologies.' });
S({ id: 'observatory', name: 'Observatory', w: 2, h: 2, cost: { steel_ingot: 10, gold_ingot: 10, lens: 4, glass: 20 }, tech: 'optics', behavior: 'research', conf: { tier: 3 }, desc: 'Research tier 7-8 technologies.' });
S({ id: 'furnace', name: 'Furnace', cost: { stone: 15 }, tech: 'stonecraft', behavior: 'processor', conf: { kind: 'furnace' }, light: { r: 30, c: '#ff7a3d', when: 'work', flick: true }, desc: 'Smelts ore and fires clay. Needs fuel.' });
S({ id: 'blast_furnace', name: 'Blast Furnace', cost: { stone: 30, iron_ingot: 10, brick: 10 }, tech: 'steelmaking', behavior: 'processor', conf: { kind: 'blast' }, light: { r: 36, c: '#ff7a3d', when: 'work', flick: true }, desc: 'Hotter and faster. Makes steel.' });
S({ id: 'magma_furnace', name: 'Magma Furnace', w: 2, h: 2, cost: { obsidian_plate: 8, lava_core: 2, brick: 20 }, tech: 'magma_smelting', behavior: 'processor', conf: { kind: 'magma' }, light: { r: 48, c: '#ff5a2a', when: 'work', flick: true }, desc: 'Melts obsidian, crystal and star ore.' });
S({ id: 'windmill', name: 'Windmill', w: 2, h: 2, cost: { plank: 24, rope: 6, stone: 12, gear: 2 }, tech: 'milling', behavior: 'processor', conf: { kind: 'mill', noFuel: true }, desc: 'Grinds wheat into flour. No fuel needed.' });
S({ id: 'sewing_station', name: 'Sewing Station', cost: { plank: 6, fiber: 8, rope: 2 }, tech: 'weaving', behavior: 'station', conf: { station: 'sewing' }, desc: 'Turn cotton into cloth and clothes.' });
S({ id: 'anvil', name: 'Anvil', cost: { stone: 8, copper_ingot: 5 }, tech: 'metalworking', behavior: 'station', conf: { station: 'anvil' }, desc: 'Forge metal tools, weapons and armor.' });
S({ id: 'kitchen', name: 'Kitchen Stove', w: 2, h: 1, cost: { plank: 10, stone: 8, copper_ingot: 2 }, tech: 'kitchen', behavior: 'station', conf: { station: 'kitchen' }, comfort: 2, light: { r: 26, c: '#ffb066', flick: true }, desc: 'Cook proper meals.' });
S({ id: 'alchemy_table', name: 'Alchemy Table', cost: { plank: 8, glass: 4, bottle: 2 }, tech: 'alchemy', behavior: 'station', conf: { station: 'alchemy' }, desc: 'Brew potions.' });
S({ id: 'forge', name: 'Master Forge', w: 2, h: 1, cost: { stone: 20, steel_ingot: 4, brick: 20, coal: 20 }, tech: 'forging', behavior: 'station', conf: { station: 'forge' }, light: { r: 40, c: '#ff8a3d', flick: true }, desc: 'Forge obsidian and fire gear.' });
S({ id: 'arcane_altar', name: 'Arcane Altar', w: 2, h: 1, cost: { stone: 20, gold_ingot: 6, spirit_dust: 5 }, tech: 'arcana', behavior: 'station', conf: { station: 'arcane' }, light: { r: 34, c: '#a77bff' }, desc: 'Craft staves, charms and cores.' });
S({ id: 'prism_workshop', name: 'Prism Workshop', w: 2, h: 1, cost: { crystal_bar: 8, gold_ingot: 6, glass: 10 }, tech: 'crystal_craft', behavior: 'station', conf: { station: 'prism' }, light: { r: 40, c: '#ff9fd0' }, desc: 'Cut crystal gear and prism cores.' });
S({ id: 'star_forge', name: 'Star Forge', w: 2, h: 2, cost: { star_bar: 6, void_bar: 4, crystal_bar: 10 }, tech: 'star_forging', behavior: 'station', conf: { station: 'starforge' }, light: { r: 56, c: '#b8c4ff' }, desc: 'Forge star-metal gear.' });
S({ id: 'market_stall', name: 'Market Stall', w: 2, h: 1, cost: { plank: 14, cloth: 4, rope: 3 }, tech: 'trade', behavior: 'market', comfort: 1, desc: 'Sell goods for coins.' });

// storage
const ST = (o) => reg({ cat: 'storage', behavior: 'storage', ...o });
ST({ id: 'chest', name: 'Chest', cost: { wood: 8 }, conf: { slots: 20 }, desc: 'Shared storage.' });
ST({ id: 'large_chest', name: 'Large Chest', w: 2, h: 1, cost: { plank: 12, rope: 2, iron_ingot: 2 }, tech: 'storage', conf: { slots: 40 } });
ST({ id: 'vault', name: 'Vault', w: 2, h: 1, cost: { steel_ingot: 6, gold_ingot: 4, plank: 10 }, tech: 'vaults', conf: { slots: 70 } });

// farming & animals
const F = (o) => reg({ cat: 'farming', ...o });
F({ id: 'farm_plot', name: 'Farm Plot', cost: { wood: 3, fiber: 2 }, tech: 'gardening', behavior: 'farm', solid: false, conf: { speed: 1 }, desc: 'Plant seeds and harvest crops.' });
F({ id: 'greenhouse_plot', name: 'Greenhouse Plot', cost: { glass: 4, plank: 4, fertilizer: 2 }, tech: 'greenhouse', behavior: 'farm', solid: false, conf: { speed: 2.2, indoor: true }, desc: 'Crops grow much faster.' });
F({ id: 'sprinkler', name: 'Sprinkler', cost: { iron_ingot: 2, rope: 2 }, tech: 'irrigation', behavior: 'sprinkler', conf: { r: 3, boost: 1.6 }, desc: 'Boosts crops within 3 tiles.' });
F({ id: 'beehive', name: 'Beehive', cost: { plank: 8, cloth: 2 }, tech: 'apiary', behavior: 'producer', conf: { out: 'honey', every: 150, cap: 8, flowers: true }, desc: 'Bees make honey if flowers are near.' });
F({ id: 'chicken_coop', name: 'Chicken Coop', w: 2, h: 1, cost: { plank: 14, fiber: 10 }, tech: 'husbandry', behavior: 'producer', conf: { out: 'egg', every: 100, cap: 12, feed: ['wheat', 'seed_wheat', 'berries'], animal: 'chicken' }, desc: 'Fed chickens lay eggs.' });
F({ id: 'cow_shed', name: 'Cow Shed', w: 2, h: 2, cost: { plank: 24, rope: 6 }, tech: 'husbandry', behavior: 'producer', conf: { out: 'milk', every: 160, cap: 10, feed: ['wheat', 'carrot'], animal: 'cow' }, desc: 'Fed cows give milk.' });
F({ id: 'sheep_pen', name: 'Sheep Pen', w: 2, h: 2, cost: { plank: 20, rope: 6 }, tech: 'husbandry', behavior: 'producer', conf: { out: 'wool', every: 200, cap: 10, feed: ['wheat', 'carrot'], animal: 'sheep' }, desc: 'Fed sheep grow wool.' });
F({ id: 'fish_trap', name: 'Fish Trap', cost: { rope: 4, plank: 4 }, tech: 'fishing', behavior: 'producer', water: true, solid: false, conf: { out: '@fishpick', every: 130, cap: 10 }, desc: 'Place on shallow water. Catches fish over time.' });

// automation & defense
const A = (o) => reg({ cat: 'industry', ...o });
A({ id: 'drill_iron', name: 'Iron Drill', w: 2, h: 2, cost: { iron_ingot: 8, gear: 4, stone: 20 }, tech: 'automation', behavior: 'drill', conf: { tier: 4, r: 3, every: 2.4, dmg: 8, fuel: true }, desc: 'Auto-mines nearby ore. Burns fuel. Feeds an adjacent chest.' });
A({ id: 'drill_steel', name: 'Steel Drill', w: 2, h: 2, cost: { steel_ingot: 8, gear: 6, obsidian_plate: 2 }, tech: 'heavy_drilling', behavior: 'drill', conf: { tier: 5, r: 4, every: 1.8, dmg: 14, fuel: true }, desc: 'Bigger reach, bites harder rock.' });
A({ id: 'drill_solar', name: 'Solar Drill', w: 2, h: 2, cost: { crystal_bar: 8, gear: 6, lens: 4 }, tech: 'solar_power', behavior: 'drill', conf: { tier: 6, r: 5, every: 1.5, dmg: 22, fuel: false, solar: true }, desc: 'Runs on sunlight. No fuel needed (daytime).' });
A({ id: 'drill_void', name: 'Void Drill', w: 2, h: 2, cost: { void_bar: 8, star_bar: 8, prism_core: 2 }, tech: 'void_drilling', behavior: 'drill', conf: { tier: 8, r: 6, every: 0.9, dmg: 40, fuel: false }, desc: 'Eats anything. Runs on void energy.' });
A({ id: 'turret_arrow', name: 'Arrow Turret', cost: { plank: 10, iron_ingot: 5, gear: 2 }, tech: 'fortification', behavior: 'turret', conf: { range: 100, dmg: 8, cd: 1.0, ammo: 'arrow', proj: '#ffe9b0' }, desc: 'Shoots monsters. Loads arrows from itself or a chest.' });
A({ id: 'turret_magic', name: 'Arcane Turret', cost: { arcane_core: 2, gold_ingot: 6, stone: 10 }, tech: 'arcane_defense', behavior: 'turret', conf: { range: 112, dmg: 20, cd: 0.9, ammo: null, proj: '#a77bff' }, light: { r: 24, c: '#a77bff' }, desc: 'Magic bolts. Needs no ammo.' });
A({ id: 'turret_fire', name: 'Flame Turret', cost: { lava_core: 2, obsidian_plate: 6, steel_ingot: 4 }, tech: 'fire_arts', behavior: 'turret', conf: { range: 104, dmg: 34, cd: 0.8, ammo: null, proj: '#ff7a3d' }, light: { r: 28, c: '#ff7a3d', flick: true }, desc: 'Burning bolts.' });
A({ id: 'turret_prism', name: 'Prism Turret', cost: { prism_core: 2, crystal_bar: 8, gold_ingot: 6 }, tech: 'prism_defense', behavior: 'turret', conf: { range: 130, dmg: 60, cd: 0.7, ammo: null, proj: '#ff9fd0' }, light: { r: 30, c: '#ff9fd0' }, desc: 'Rainbow beams.' });
A({ id: 'turret_void', name: 'Void Turret', cost: { void_core: 2, void_bar: 6, star_bar: 6 }, tech: 'void_defense', behavior: 'turret', conf: { range: 150, dmg: 110, cd: 0.6, ammo: null, proj: '#b79cff' }, light: { r: 34, c: '#b79cff' }, desc: 'Erases monsters.' });
A({ id: 'warp_pad', name: 'Warp Pad', cost: { crystal_shard: 6, gold_ingot: 3, lens: 1 }, tech: 'warp_tech', behavior: 'warp', solid: false, light: { r: 30, c: '#9be8ff' }, desc: 'Step on to travel to another pad.' });
A({ id: 'slime_altar', name: 'Slime Altar', w: 2, h: 1, cost: { stone: 30, slime_goo: 20, petal_pink: 10 }, tech: 'gardening', behavior: 'altar', conf: { boss: 'slime_king', offer: { slime_goo: 10, berries: 10 } }, desc: 'Offer goo and berries to call the Slime King.' });
A({ id: 'bone_altar', name: 'Bone Altar', w: 2, h: 1, cost: { bone: 30, spirit_dust: 10, stone: 20 }, tech: 'gothic_style', behavior: 'altar', conf: { boss: 'bone_lord', offer: { bone: 20, spirit_dust: 6 } }, desc: 'Awakens the Bone Lord.' });
A({ id: 'magma_altar', name: 'Magma Altar', w: 2, h: 1, cost: { obsidian_plate: 6, ember_stone: 20 }, tech: 'fire_arts', behavior: 'altar', conf: { boss: 'magma_titan', offer: { ember_stone: 16, obsidian: 8 } }, desc: 'Wakes the Magma Titan.' });
A({ id: 'void_altar', name: 'Void Altar', w: 2, h: 1, cost: { void_bar: 6, star_bar: 6 }, tech: 'void_defense', behavior: 'altar', conf: { boss: 'void_eye', offer: { void_essence: 12, star_fragment: 8 } }, desc: 'Opens the Void Eye.' });
reg({ id: 'world_heart', name: 'Heart of the Isles', cat: 'industry', w: 3, h: 3, cost: { star_bar: 20, void_bar: 20, crystal_bar: 20, gold_ingot: 40, plank: 100 }, tech: 'world_heart', behavior: 'monument', light: { r: 90, c: '#ffd0f0', flick: false }, comfort: 20, desc: 'The final monument. Your isles shine for everyone.' });

// ====================================================================== LIGHTS
const L = (o) => reg({ cat: 'light', ...o });
L({ id: 'torch', name: 'Torch', cost: { wood: 1, coal: 1 }, tech: 'lighting', solid: false, light: { r: 46, c: '#ffb050', flick: true }, comfort: 1 });
L({ id: 'lantern_post', name: 'Lantern Post', cost: { wood: 4, coal: 2, fiber: 2 }, tech: 'lighting', light: { r: 60, c: '#ffd080', flick: false }, comfort: 1 });
L({ id: 'brazier', name: 'Stone Brazier', cost: { stone: 4, coal: 3 }, tech: 'lighting', light: { r: 64, c: '#ff9a4a', flick: true }, comfort: 1 });
L({ id: 'candelabra', name: 'Candelabra', cost: { bone: 2, iron_ingot: 1, spirit_dust: 1 }, tech: 'gothic_style', light: { r: 44, c: '#c9a0ff', flick: true }, comfort: 2 });
L({ id: 'chandelier', name: 'Chandelier', cost: { gold_ingot: 2, glass: 4, rope: 2 }, tech: 'elegant_style', light: { r: 80, c: '#ffe8a0', flick: false }, comfort: 3, solid: false });
L({ id: 'lava_lamp', name: 'Lava Lamp', cost: { ember_stone: 4, glass: 2, obsidian: 1 }, tech: 'volcanic_decor', light: { r: 46, c: '#ff6a3a', flick: true }, comfort: 2 });
L({ id: 'crystal_lamp', name: 'Crystal Lamp', cost: { crystal_shard: 3, gold_ingot: 1 }, tech: 'prism_style', light: { r: 60, c: '#ffb8f0', flick: false }, comfort: 3 });
L({ id: 'star_lantern', name: 'Star Lantern', cost: { star_bar: 1, void_bar: 1 }, tech: 'celestial_style', light: { r: 80, c: '#c8d0ff', flick: false }, comfort: 4 });
L({ id: 'stone_lantern', name: 'Stone Lantern', cost: { stone: 6, coal: 2 }, tech: 'garden_design', light: { r: 52, c: '#ffd8a0', flick: false }, comfort: 2 });
L({ id: 'paper_lantern', name: 'Paper Lantern', cost: { paper: 3, plank: 2, coal: 1 }, tech: 'lantern_festival', light: { r: 56, c: '#ffb89c', flick: false }, comfort: 2 });

// ====================================================================== DECOR & OUTDOORS
const D = (o) => reg({ cat: 'decor', ...o });
D({ id: 'plant_fern', name: 'Potted Fern', cost: { clay: 1, fiber: 3 }, tech: 'gardening', comfort: 1, solid: false });
D({ id: 'plant_flowerpot', name: 'Flower Pot', cost: { clay: 1, petal_pink: 2 }, tech: 'gardening', comfort: 1, solid: false });
D({ id: 'plant_sunflower', name: 'Sunflower Pot', cost: { clay: 1, petal_yellow: 3 }, tech: 'gardening', comfort: 1, solid: false });
D({ id: 'plant_cactus', name: 'Cactus Pot', cost: { clay: 1, cactus_flesh: 2 }, tech: 'desertcraft', comfort: 1, solid: false });
D({ id: 'plant_bonsai', name: 'Bonsai', cost: { clay: 2, wood: 2, fiber: 4 }, tech: 'garden_design', comfort: 2 });
D({ id: 'plant_tulips', name: 'Tulip Vase', cost: { glass: 1, petal_pink: 3, petal_yellow: 2 }, tech: 'glassmaking', comfort: 1, solid: false });
D({ id: 'plant_monstera', name: 'Big Leafy Plant', cost: { clay: 2, fiber: 8 }, tech: 'garden_design', comfort: 2 });
D({ id: 'bench', name: 'Garden Bench', w: 2, h: 1, cost: { plank: 5 }, tech: 'carpentry', behavior: 'seat', solid: false, comfort: 1 });
D({ id: 'picnic', name: 'Picnic Blanket', w: 2, h: 2, kind: 'flat', cost: { cloth: 3, petal_pink: 2 }, tech: 'weaving', solid: false, comfort: 2 });
D({ id: 'signpost', name: 'Signpost', cost: { plank: 3 }, tech: 'carpentry', comfort: 0 });
D({ id: 'mailbox', name: 'Mailbox', cost: { plank: 3, iron_ingot: 1 }, tech: 'ironworking', comfort: 1 });
D({ id: 'barrel', name: 'Barrel', cost: { plank: 4, rope: 1 }, tech: 'carpentry', behavior: 'storage', conf: { slots: 10 } });
D({ id: 'crate', name: 'Crate', cost: { plank: 5 }, tech: 'carpentry', behavior: 'storage', conf: { slots: 10 } });
D({ id: 'haystack', name: 'Haystack', cost: { fiber: 12 }, tech: 'gardening', comfort: 1 });
D({ id: 'log_pile', name: 'Log Pile', cost: { wood: 8 }, tech: null });
D({ id: 'hedge', name: 'Hedge', cost: { fiber: 4, wood: 1 }, tech: 'gardening', comfort: 1 });
D({ id: 'flower_bed', name: 'Flower Bed', cost: { petal_pink: 2, petal_yellow: 2, petal_blue: 2 }, tech: 'gardening', solid: false, comfort: 1 });
D({ id: 'scarecrow', name: 'Scarecrow', cost: { plank: 3, cloth: 2, fiber: 6 }, tech: 'gardening', comfort: 1 });
D({ id: 'gnome', name: 'Garden Gnome', cost: { clay: 3, petal_pink: 1 }, tech: 'garden_design', comfort: 2 });
D({ id: 'well', name: 'Stone Well', w: 2, h: 2, cost: { stone: 20, plank: 4, rope: 2 }, tech: 'stonecraft', comfort: 2 });
D({ id: 'bird_bath', name: 'Bird Bath', cost: { stone: 8 }, tech: 'garden_design', comfort: 2 });
D({ id: 'fountain', name: 'Fountain', w: 2, h: 2, cost: { stone: 40, glass: 4, gem_sapphire: 1 }, tech: 'garden_design', comfort: 5 });
D({ id: 'statue_cat', name: 'Cat Statue', cost: { stone: 14, gold_ingot: 1 }, tech: 'goldsmithing', comfort: 3 });
D({ id: 'statue_angel', name: 'Angel Statue', w: 1, h: 2, cost: { stone: 30, gold_ingot: 2 }, tech: 'elegant_style', comfort: 4 });
D({ id: 'tent', name: 'Cozy Tent', w: 2, h: 2, cost: { cloth: 6, plank: 4, rope: 2 }, tech: 'weaving', behavior: 'bed', comfort: 2 });
D({ id: 'hammock', name: 'Hammock', w: 2, h: 1, cost: { rope: 6, cloth: 3, plank: 2 }, tech: 'weaving', behavior: 'bed', solid: false, comfort: 3 });
D({ id: 'swing', name: 'Garden Swing', w: 2, h: 2, cost: { plank: 8, rope: 6 }, tech: 'cottage_style', comfort: 3, behavior: 'seat', solid: false });
D({ id: 'beach_umbrella', name: 'Beach Umbrella', w: 1, h: 2, cost: { plank: 4, cloth: 5, rope: 1 }, tech: 'beach_decor', comfort: 2 });
D({ id: 'deck_chair', name: 'Deck Chair', cost: { plank: 4, cloth: 3 }, tech: 'beach_decor', behavior: 'seat', solid: false, comfort: 2 });
D({ id: 'sandcastle', name: 'Sandcastle', cost: { sand: 12 }, tech: 'beach_decor', comfort: 1 });
D({ id: 'shell_lamp', name: 'Shell Lamp', cost: { sand: 4, glass: 2, clay: 2 }, tech: 'shell_craft', light: { r: 46, c: '#ffd6c0', flick: false }, comfort: 2 });
D({ id: 'hot_tub', name: 'Hot Tub', w: 2, h: 2, cost: { stone: 24, brick: 8, clay: 6, glass: 2 }, tech: 'hot_springs', comfort: 6 });
D({ id: 'lighthouse', name: 'Lighthouse', w: 2, h: 3, cost: { stone: 60, brick: 30, glass: 8, lens: 2 }, tech: 'optics', light: { r: 110, c: '#fff0b0', flick: false }, comfort: 6 });
// kitchen & bath & living extras
D({ id: 'counter', name: 'Kitchen Counter', cost: { plank: 6, stone: 2 }, tech: 'kitchen', comfort: 1 });
D({ id: 'sink', name: 'Sink Counter', cost: { plank: 6, stone: 2, iron_ingot: 1 }, tech: 'kitchen', comfort: 1 });
D({ id: 'fridge', name: 'Icebox', cost: { plank: 8, ice_shard: 6, iron_ingot: 2 }, tech: 'frostcraft', behavior: 'storage', conf: { slots: 16, foodOnly: true }, comfort: 2 });
D({ id: 'bathtub', name: 'Bathtub', w: 2, h: 1, cost: { clay: 6, iron_ingot: 2, plank: 4 }, tech: 'modern_style', comfort: 3 });
D({ id: 'fireplace', name: 'Fireplace', w: 2, h: 1, cost: { stone: 20, brick: 10, coal: 4 }, tech: 'masonry', light: { r: 78, c: '#ff9a4a', flick: true }, comfort: 5 });
D({ id: 'piano', name: 'Piano', w: 2, h: 1, cost: { plank: 20, iron_ingot: 4, bone: 4 }, tech: 'elegant_style', behavior: 'piano', comfort: 5 });
D({ id: 'aquarium', name: 'Aquarium', w: 2, h: 1, cost: { glass: 10, plank: 6, fish_minnow: 3 }, tech: 'modern_style', light: { r: 36, c: '#8fe0ff' }, comfort: 4 });
D({ id: 'globe', name: 'Globe', cost: { plank: 4, paper: 4, copper_ingot: 2 }, tech: 'optics', comfort: 2 });
D({ id: 'telescope', name: 'Telescope', w: 1, h: 2, cost: { iron_ingot: 4, lens: 2, plank: 4 }, tech: 'optics', comfort: 3 });
D({ id: 'grandfather_clock', name: 'Grandfather Clock', w: 1, h: 2, cost: { plank: 14, gear: 3, gold_ingot: 1 }, tech: 'elegant_style', comfort: 3 });
D({ id: 'rocking_chair', name: 'Rocking Chair', cost: { plank: 6, cloth: 2 }, tech: 'cottage_style', behavior: 'seat', solid: false, comfort: 2 });
D({ id: 'armchair', name: 'Cozy Armchair', cost: { plank: 5, cloth: 5, petal_pink: 1 }, tech: 'cottage_style', behavior: 'seat', solid: false, comfort: 3 });
D({ id: 'mushroom_lamp', name: 'Mushroom Lamp', cost: { glow_mushroom: 3, clay: 1 }, tech: 'mycology', light: { r: 44, c: '#8fffd0' }, comfort: 2 });
D({ id: 'mushroom_stool', name: 'Mushroom Stool', cost: { mushroom: 4, plank: 1 }, tech: 'mycology', behavior: 'seat', solid: false, comfort: 1 });
D({ id: 'cauldron', name: 'Cauldron', cost: { iron_ingot: 4, bone: 2 }, tech: 'gothic_style', comfort: 2 });
D({ id: 'coffin', name: 'Coffin Bed', w: 1, h: 2, cost: { plank: 8, bone: 4, cloth: 3 }, tech: 'gothic_style', behavior: 'bed', comfort: 3 });
D({ id: 'crystal_ball', name: 'Crystal Ball', cost: { crystal_shard: 3, gold_ingot: 1 }, tech: 'arcana', light: { r: 34, c: '#c8a0ff' }, comfort: 3 });
D({ id: 'fairy_ring', name: 'Fairy Ring', w: 2, h: 2, kind: 'flat', cost: { petal_pink: 6, petal_blue: 6, spirit_dust: 2 }, tech: 'sky_garden', solid: false, light: { r: 40, c: '#ffd0ff' }, comfort: 3 });
D({ id: 'rainbow_arch', name: 'Rainbow Arch', w: 2, h: 1, cost: { crystal_bar: 4, prism_wood: 4 }, tech: 'sky_garden', comfort: 4, solid: false });
D({ id: 'star_orb', name: 'Floating Star Orb', cost: { star_fragment: 4, void_essence: 2 }, tech: 'celestial_style', light: { r: 56, c: '#d8e0ff' }, comfort: 4 });
D({ id: 'portal_ring', name: 'Void Portal Ring', w: 2, h: 2, cost: { void_bar: 4, star_bar: 4 }, tech: 'celestial_style', light: { r: 56, c: '#8a6cff' }, comfort: 5 });

reg({ id: 'gravestone', name: 'Gravestone', cat: 'decor', hidden: true, behavior: 'storage', conf: { slots: 60, grave: true }, solid: false, cost: {}, tech: null });

export const BUILD_IDS = Object.keys(BUILD);
export const BUILD_CATS = [
  ['stations', 'Stations'], ['storage', 'Storage'], ['walls', 'Walls & Doors'], ['floors', 'Floors'], ['furniture', 'Furniture'], ['walldeco', 'Wall Decor'],
  ['decor', 'Decor'], ['light', 'Lighting'], ['farming', 'Farming'], ['industry', 'Industry & Defense'],
];
export const wallDefById = (id) => BUILD[id];
