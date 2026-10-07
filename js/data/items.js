// Item catalog (things that live in inventories). Structures/blueprints are NOT items: see build.js.
import { prettyId } from '../util.js';

export const STACK = 9999; // how many of a normal item fit in one slot
export const ITEMS = {};
const add = (id, name, cat, sell, o = {}) => {
  if (ITEMS[id]) throw new Error('dup item ' + id);
  ITEMS[id] = { id, name: name || prettyId(id), cat, sell, stack: cat === 'tool' || cat === 'weapon' || cat === 'armor' || cat === 'charm' ? 1 : STACK, ...o };
  return ITEMS[id];
};

// ---------------------------------------------------------------- raw resources
const RAW = [
  ['wood', 'Wood', 2], ['stone', 'Stone', 2], ['fiber', 'Plant Fiber', 1], ['coal', 'Coal', 4], ['sand', 'Sand', 1], ['clay', 'Clay', 2],
  ['copper_ore', 'Copper Ore', 5], ['iron_ore', 'Iron Ore', 8], ['gold_ore', 'Gold Ore', 14],
  ['cotton', 'Cotton', 3], ['petal_pink', 'Pink Petals', 2], ['petal_yellow', 'Sunny Petals', 2], ['petal_blue', 'Blue Petals', 2],
  ['ice_shard', 'Ice Shard', 4], ['swamp_moss', 'Swamp Moss', 3], ['bone', 'Bone', 4], ['spirit_dust', 'Spirit Dust', 10],
  ['ember_stone', 'Ember Stone', 12], ['obsidian', 'Obsidian Shard', 18], ['crystal_shard', 'Crystal Shard', 26],
  ['prism_wood', 'Prism Wood', 14], ['star_fragment', 'Star Fragment', 40], ['void_essence', 'Void Essence', 50],
  ['slime_goo', 'Slime Goo', 3], ['feather', 'Feather', 3], ['acorn', 'Acorn', 2], ['charcoal', 'Charcoal', 5],
  ['gem_ruby', 'Ruby', 60], ['gem_sapphire', 'Sapphire', 60], ['gem_emerald', 'Emerald', 60], ['gem_amethyst', 'Amethyst', 70],
  ['wheat', 'Wheat', 3], ['milk', 'Milk', 5], ['wool', 'Wool', 5], ['egg', 'Egg', 4],
];
for (const [id, name, sell] of RAW) add(id, name, 'res', sell);
ITEMS.charcoal.fuel = 40; ITEMS.coal.fuel = 50; ITEMS.wood.fuel = 12; ITEMS.ember_stone.fuel = 110; ITEMS.prism_wood.fuel = 20;

// ---------------------------------------------------------------- processed materials
const MATS = [
  ['plank', 'Plank', 3], ['rope', 'Rope', 3], ['cloth', 'Cloth', 6], ['glass', 'Glass', 6], ['brick', 'Brick', 5], ['bottle', 'Glass Bottle', 8],
  ['paper', 'Paper', 4], ['flour', 'Flour', 6], ['fertilizer', 'Fertilizer', 5],
  ['copper_ingot', 'Copper Ingot', 14], ['iron_ingot', 'Iron Ingot', 22], ['gold_ingot', 'Gold Ingot', 40], ['steel_ingot', 'Steel Ingot', 60],
  ['obsidian_plate', 'Obsidian Plate', 60], ['crystal_bar', 'Crystal Bar', 90], ['star_bar', 'Star Bar', 160], ['void_bar', 'Void Bar', 200],
  ['gear', 'Gear', 40], ['lens', 'Lens', 70], ['arcane_core', 'Arcane Core', 120], ['lava_core', 'Lava Core', 180], ['prism_core', 'Prism Core', 260], ['void_core', 'Void Core', 400],
  ['arrow', 'Arrow', 2],
];
for (const [id, name, sell] of MATS) add(id, name, 'mat', sell);

// ---------------------------------------------------------------- plants, crops, seeds
const PLANTS = [
  ['berries', 'Berries', 2], ['apple', 'Apple', 3], ['mushroom', 'Mushroom', 3], ['glow_mushroom', 'Glow Mushroom', 8],
  ['cactus_flesh', 'Cactus Flesh', 3], ['frost_berries', 'Frost Berries', 4], ['coconut', 'Coconut', 4],
  ['carrot', 'Carrot', 4], ['tomato', 'Tomato', 4], ['pumpkin', 'Pumpkin', 8], ['strawberry', 'Strawberry', 6], ['honey', 'Honey', 8],
];
for (const [id, name, sell] of PLANTS) add(id, name, 'food', sell);
const food = (id, heal, hunger, buff) => { ITEMS[id].food = { heal, hunger, buff: buff || null }; };
food('berries', 3, 8); food('apple', 4, 10); food('mushroom', 3, 8); food('glow_mushroom', 4, 8, ['night', 90, 1]);
food('cactus_flesh', 3, 6); food('frost_berries', 4, 8); food('coconut', 4, 10); food('carrot', 4, 10); food('tomato', 4, 10);
food('pumpkin', 6, 14); food('strawberry', 5, 10); food('honey', 6, 8);
ITEMS.egg.food = null;

const SEEDS = [['wheat', 'Wheat Seeds'], ['carrot', 'Carrot Seeds'], ['tomato', 'Tomato Seeds'], ['pumpkin', 'Pumpkin Seeds'], ['strawberry', 'Strawberry Seeds'], ['cotton', 'Cotton Seeds']];
for (const [c, n] of SEEDS) add('seed_' + c, n, 'seed', 1, { crop: c });

// ---------------------------------------------------------------- cooked food & potions
const COOKED = [
  // id, name, sell, heal, hunger, buff[type, secs, power]
  ['berry_jam', 'Berry Jam', 10, 6, 16], ['bread', 'Warm Bread', 14, 8, 22], ['grilled_fish', 'Grilled Fish', 18, 9, 24],
  ['mushroom_soup', 'Mushroom Soup', 22, 10, 26, ['regen', 90, 1]], ['veggie_stew', 'Veggie Stew', 28, 12, 30, ['regen', 120, 1]],
  ['fish_stew', 'Fish Stew', 36, 14, 32, ['speed', 150, 1]], ['honey_cake', 'Honey Cake', 40, 12, 28, ['mining', 180, 1]],
  ['pumpkin_pie', 'Pumpkin Pie', 46, 16, 32, ['luck', 180, 1]], ['strawberry_cake', 'Strawberry Cake', 60, 18, 34, ['cozy', 240, 1]],
  ['fruit_salad', 'Fruit Salad', 30, 11, 26, ['speed', 90, 1]], ['omelet', 'Cheesy Omelet', 26, 10, 26], ['cactus_juice', 'Cactus Juice', 20, 8, 18, ['speed', 90, 1]],
  ['hot_cocoa', 'Cozy Cocoa', 44, 10, 20, ['cozy', 300, 1]], ['apple_pie', 'Apple Pie', 42, 15, 30, ['mining', 150, 1]],
];
for (const [id, name, sell, heal, hunger, buff] of COOKED) add(id, name, 'food', sell, { food: { heal, hunger, buff: buff || null } });

const POTIONS = [
  ['potion_health_s', 'Small Health Potion', 20, { heal: 12 }], ['potion_health_m', 'Health Potion', 48, { heal: 28 }], ['potion_health_l', 'Grand Health Potion', 120, { heal: 70 }],
  ['potion_speed', 'Swiftness Potion', 40, { buff: ['speed', 180, 2] }], ['potion_mining', 'Miner\'s Brew', 46, { buff: ['mining', 180, 2] }],
  ['potion_night', 'Night Eye Potion', 36, { buff: ['night', 300, 1] }], ['potion_strength', 'Might Potion', 56, { buff: ['strength', 180, 2] }],
  ['potion_fireproof', 'Fireproof Potion', 60, { buff: ['fireproof', 240, 1] }], ['potion_luck', 'Lucky Potion', 70, { buff: ['luck', 240, 2] }],
  ['elixir_xp', 'Elixir of Wisdom', 140, { buff: ['xp', 300, 2] }],
];
for (const [id, name, sell, p] of POTIONS) add(id, name, 'potion', sell, { potion: p, stack: 999 });

// ---------------------------------------------------------------- tools & weapons
export const TIERS = [
  { id: 'wood', name: 'Wooden', tier: 1 }, { id: 'stone', name: 'Stone', tier: 2 }, { id: 'copper', name: 'Copper', tier: 3 }, { id: 'iron', name: 'Iron', tier: 4 },
  { id: 'gold', name: 'Golden', tier: 5 }, { id: 'obsidian', name: 'Obsidian', tier: 6 }, { id: 'crystal', name: 'Crystal', tier: 7 }, { id: 'star', name: 'Star', tier: 8 },
];
const PICK_POWER = [2, 3, 4, 6, 8, 11, 15, 20];
const SWORD_DMG = [4, 6, 8, 11, 15, 20, 27, 36];
for (const t of TIERS) {
  const i = t.tier - 1;
  add(`pickaxe_${t.id}`, `${t.name} Pickaxe`, 'tool', 20 * t.tier * t.tier, { tool: 'pick', tier: t.tier, power: PICK_POWER[i], mat: t.id, reach: 22 + t.tier });
  add(`sword_${t.id}`, `${t.name} Sword`, 'weapon', 24 * t.tier * t.tier, { weapon: 'sword', tier: t.tier, dmg: SWORD_DMG[i], mat: t.id, reach: 24 + t.tier, cd: 0.42 - t.tier * 0.01, knock: 70 + t.tier * 6 });
}
const BOWS = [['wood', 1, 5], ['iron', 4, 12], ['gold', 5, 18], ['crystal', 7, 30], ['star', 8, 44]];
for (const [m, tier, dmg] of BOWS) add(`bow_${m}`, `${TIERS.find((t) => t.id === m).name} Bow`, 'weapon', 30 * tier * tier, { weapon: 'bow', tier, dmg, mat: m, cd: 0.55, range: 150 + tier * 8 });
const STAFFS = [['twig', 'Twig Staff', 2, 6, '#7ee27a'], ['arcane', 'Arcane Staff', 5, 16, '#a77bff'], ['ember', 'Ember Staff', 6, 24, '#ff7a3d'], ['prism', 'Prism Staff', 7, 34, '#ff9fd0'], ['void', 'Void Staff', 8, 48, '#b79cff']];
for (const [m, name, tier, dmg, color] of STAFFS) add(`staff_${m}`, name, 'weapon', 40 * tier * tier, { weapon: 'staff', tier, dmg, mat: m, color, cd: 0.7, range: 120 + tier * 8 });
const SHOVELS = [['stone', 2], ['iron', 4], ['crystal', 7]];
for (const [m, tier] of SHOVELS) add(`shovel_${m}`, `${TIERS.find((t) => t.id === m).name} Shovel`, 'tool', 18 * tier * tier, { tool: 'shovel', tier, mat: m, power: tier });
const RODS = [['wood', 1], ['iron', 4], ['crystal', 7]];
for (const [m, tier] of RODS) add(`rod_${m}`, `${TIERS.find((t) => t.id === m).name} Fishing Rod`, 'tool', 18 * tier * tier, { tool: 'rod', tier, mat: m, power: tier });

// ---------------------------------------------------------------- armor
export const ARMOR_SETS = [
  { id: 'cloth', name: 'Cloth', def: 1, tier: 1 }, { id: 'copper', name: 'Copper', def: 2, tier: 3 }, { id: 'iron', name: 'Iron', def: 3, tier: 4 },
  { id: 'gold', name: 'Golden', def: 4, tier: 5 }, { id: 'obsidian', name: 'Obsidian', def: 6, tier: 6 }, { id: 'crystal', name: 'Crystal', def: 8, tier: 7 }, { id: 'star', name: 'Star', def: 11, tier: 8 },
];
const SLOTS = [['head', 'Hat', 0.8], ['body', 'Tunic', 1.4], ['feet', 'Boots', 0.8]];
for (const s of ARMOR_SETS) for (const [slot, nm, m] of SLOTS) {
  add(`${slot === 'head' ? 'hat' : slot === 'body' ? 'tunic' : 'boots'}_${s.id}`, `${s.name} ${nm}`, 'armor', Math.round(18 * s.tier * s.tier * m), { armor: slot, def: Math.round(s.def * m), mat: s.id, tier: s.tier });
}

// ---------------------------------------------------------------- charms (accessory slot)
const CHARMS = [
  ['charm_speed', 'Swift Charm', 120, { speed: 0.12 }], ['charm_magnet', 'Magnet Charm', 110, { magnet: 1.6 }], ['charm_luck', 'Clover Charm', 160, { luck: 0.15 }],
  ['charm_heart', 'Heart Charm', 180, { hp: 8 }], ['charm_miner', 'Miner Charm', 150, { mining: 0.2 }], ['charm_xp', 'Wisdom Charm', 220, { xp: 0.2 }],
  ['charm_fire', 'Cinder Charm', 260, { fireproof: 1 }], ['charm_night', 'Moon Charm', 200, { night: 1 }],
];
for (const [id, name, sell, fx] of CHARMS) add(id, name, 'charm', sell, { charm: fx });

// ---------------------------------------------------------------- fish
const FISH = [['fish_minnow', 'Minnow', 3], ['fish_carp', 'Carp', 7], ['fish_salmon', 'Salmon', 12], ['fish_koi', 'Golden Koi', 55], ['fish_frost', 'Frost Trout', 16], ['fish_glow', 'Glow Eel', 26], ['fish_lava', 'Magma Guppy', 34], ['fish_star', 'Star Ray', 80], ['fish_cactus', 'Sand Darter', 14]];
for (const [id, name, sell] of FISH) add(id, name, 'food', sell, { fish: true, food: { heal: 3, hunger: 8, buff: null } });

// ---------------------------------------------------------------- misc
add('pet_egg', 'Mystery Egg', 'misc', 90, { stack: 5, hatch: true });
add('treasure_key', 'Old Key', 'misc', 30, { stack: 5, key: true });
add('boss_token', 'Boss Trophy', 'misc', 300, { stack: 999 });

// ---------------------------------------------------------------- bombs and fireworks: thrown with the action button, they go off after a short fuse
// radius: pixels; dmg: to monsters at the centre (less further out); nodes: the toughest rock (pickaxe tier) it breaks; trees: it fells trees too; freeze/burn: seconds
export const BOMB_IDS = ['bomb', 'mega_bomb', 'frost_bomb', 'fire_bomb', 'firework'];
const BOMBS = [
  ['bomb', 'Bomb', 14, 'Breaks rocks and ores, hurts monsters, and opens cracked boulders.', { radius: 34, dmg: 16, nodes: 2, kind: 'boom' }],
  ['mega_bomb', 'Mega Bomb', 70, 'A huge blast: breaks even hard ores and trees, and hits monsters hard.', { radius: 56, dmg: 45, nodes: 5, trees: true, kind: 'boom' }],
  ['frost_bomb', 'Frost Bomb', 34, 'Freezes monsters in place for a few seconds.', { radius: 46, dmg: 8, freeze: 4, kind: 'frost' }],
  ['fire_bomb', 'Fire Bomb', 34, 'Sets monsters alight: they keep burning for a while.', { radius: 42, dmg: 10, burn: 5, kind: 'fire' }],
  ['firework', 'Firework', 10, 'Pure fun: a big colourful burst in the sky.', { radius: 0, dmg: 0, kind: 'firework' }],
];
for (const [id, name, sell, desc, o] of BOMBS) add(id, name, 'bomb', sell, { stack: 99, bomb: o, desc });

export const isTool = (it) => it && (it.cat === 'tool' || it.cat === 'weapon');
export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : prettyId(id));
export const ITEM_IDS = Object.keys(ITEMS);

/** Fuel value in "heat units" (seconds of burning) */
export const fuelValue = (id) => (ITEMS[id] && ITEMS[id].fuel) || 0;

export function itemDesc(it) {
  const p = [];
  if (it.tool === 'pick') p.push(`Mining power ${it.power} (tier ${it.tier})`);
  if (it.weapon) p.push(`${it.weapon === 'sword' ? 'Melee' : it.weapon === 'bow' ? 'Ranged' : 'Magic'} · ${it.dmg} damage`);
  if (it.armor) p.push(`Defense +${it.def}`);
  if (it.tool === 'shovel') p.push('Digs up buried treasure');
  if (it.bomb) p.push(it.desc);
  if (it.tool === 'rod') p.push('Catches fish');
  if (it.hatch) p.push('Use it to hatch a pet that follows you around');
  if (it.key) p.push('Carry it: the next treasure chest you open gives double treasure');
  if (it.food) p.push(`Heals ${it.food.heal} · fills ${it.food.hunger}`);
  if (it.potion && it.potion.heal) p.push(`Heals ${it.potion.heal}`);
  const b = (it.food && it.food.buff) || (it.potion && it.potion.buff);
  if (b) p.push(`${b[0]} +${b[2]} for ${b[1]}s`);
  if (it.charm) p.push(Object.entries(it.charm).map(([k, v]) => `${k} ${v}`).join(', '));
  if (it.fuel) p.push(`Fuel ${it.fuel}s`);
  if (it.crop) p.push('Plant on a farm plot');
  return p.join('\n');
}
