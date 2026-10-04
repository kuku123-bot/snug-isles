// Gatherable resource nodes (trees, rocks, ores, plants) + special lootables.
// drops: [item, min, max, chance=1]. hard = minimum pickaxe tier needed to damage it.
import { prettyId } from '../util.js';

export const NODES = {};
const node = (id, name, o) => {
  NODES[id] = { id, name: name || prettyId(id), kind: 'node', w: 1, h: 1, hp: 6, hard: 0, xp: 1, respawn: 240, solid: true, fx: 'chip', snd: 'mine', drops: [], ...o };
  return NODES[id];
};

// ---- trees (hit with a pickaxe too: this is a cozy game, one tool does it all)
node('oak', 'Oak Tree', { hp: 8, xp: 2, respawn: 300, fx: 'leaf', snd: 'chop', tree: true, drops: [['wood', 2, 3], ['acorn', 0, 1, 0.25], ['apple', 0, 1, 0.12], ['feather', 0, 1, 0.06]] });
node('pine', 'Pine Tree', { hp: 9, xp: 2, respawn: 300, fx: 'snow', snd: 'chop', tree: true, drops: [['wood', 2, 3], ['fiber', 0, 1, 0.2]] });
node('palm', 'Palm Tree', { hp: 8, xp: 2, respawn: 300, fx: 'leaf', snd: 'chop', tree: true, drops: [['wood', 2, 3], ['coconut', 0, 1, 0.3]] });
node('mangrove', 'Mangrove', { hp: 10, xp: 3, respawn: 320, fx: 'leaf', snd: 'chop', tree: true, drops: [['wood', 2, 4], ['swamp_moss', 0, 1, 0.35]] });
node('dead_tree', 'Dead Tree', { hp: 8, xp: 3, respawn: 360, fx: 'dust', snd: 'chop', tree: true, drops: [['wood', 1, 2], ['bone', 0, 1, 0.12]] });
node('burnt_tree', 'Charred Tree', { hp: 12, xp: 4, respawn: 360, fx: 'ember', snd: 'chop', tree: true, drops: [['charcoal', 1, 3], ['wood', 0, 1, 0.3]] });
node('crystal_tree', 'Crystal Tree', { hp: 44, hard: 6, xp: 14, respawn: 420, fx: 'spark', snd: 'mine', tree: true, drops: [['prism_wood', 2, 3], ['crystal_shard', 0, 1, 0.15]] });
node('void_tree', 'Void Tree', { hp: 64, hard: 7, xp: 22, respawn: 480, fx: 'void', snd: 'mine', tree: true, drops: [['void_essence', 1, 2], ['prism_wood', 0, 1, 0.3]] });

// ---- rocks & ores
node('rock', 'Rock', { hp: 10, xp: 2, drops: [['stone', 2, 3], ['coal', 0, 1, 0.08]] });
node('coal_rock', 'Coal Deposit', { hp: 13, hard: 1, xp: 3, drops: [['coal', 2, 3], ['stone', 0, 1, 0.5]] });
node('copper_rock', 'Copper Vein', { hp: 18, hard: 2, xp: 5, drops: [['copper_ore', 2, 3], ['stone', 0, 1, 0.4]] });
node('iron_rock', 'Iron Vein', { hp: 28, hard: 3, xp: 8, drops: [['iron_ore', 2, 3], ['stone', 0, 1, 0.4]] });
node('gold_rock', 'Gold Vein', { hp: 38, hard: 4, xp: 12, drops: [['gold_ore', 1, 3], ['stone', 0, 1, 0.3]] });
node('ice_rock', 'Ice Chunk', { hp: 12, hard: 1, xp: 3, fx: 'snow', drops: [['ice_shard', 2, 3], ['stone', 0, 1, 0.3]] });
node('sandstone', 'Sandstone', { hp: 10, xp: 2, fx: 'dust', drops: [['sand', 2, 4], ['stone', 0, 1, 0.4]] });
node('sand_pile', 'Sand Pile', { hp: 2, xp: 1, respawn: 100, solid: false, fx: 'dust', snd: 'rustle', drops: [['sand', 2, 3]] });
node('clay_deposit', 'Clay Deposit', { hp: 8, hard: 1, xp: 2, fx: 'dust', drops: [['clay', 2, 3]] });
node('tombstone', 'Old Tombstone', { hp: 22, hard: 3, xp: 6, fx: 'dust', drops: [['bone', 2, 3], ['spirit_dust', 0, 1, 0.3], ['stone', 0, 1, 0.4]] });
node('ember_rock', 'Ember Rock', { hp: 44, hard: 5, xp: 14, fx: 'ember', drops: [['ember_stone', 1, 3], ['stone', 0, 1, 0.3]] });
node('obsidian_rock', 'Obsidian Spire', { hp: 62, hard: 5, xp: 18, fx: 'spark', drops: [['obsidian', 1, 3], ['ember_stone', 0, 1, 0.2]] });
node('crystal_rock', 'Crystal Cluster', { hp: 76, hard: 6, xp: 24, fx: 'spark', drops: [['crystal_shard', 1, 3], ['gem_amethyst', 0, 1, 0.05]] });
node('star_rock', 'Star Rock', { hp: 100, hard: 7, xp: 34, fx: 'void', drops: [['star_fragment', 1, 2], ['void_essence', 0, 1, 0.2]] });
node('geode', 'Geode', { hp: 30, hard: 3, xp: 10, fx: 'spark', drops: [['gem_ruby', 0, 1, 0.3], ['gem_sapphire', 0, 1, 0.3], ['gem_emerald', 0, 1, 0.3], ['gem_amethyst', 0, 1, 0.15], ['stone', 1, 2]] });

// ---- plants (walk-through ones are solid:false)
node('berry_bush', 'Berry Bush', { hp: 3, xp: 1, respawn: 90, solid: false, fx: 'leaf', snd: 'rustle', plant: true, drops: [['berries', 2, 4]] });
node('frost_bush', 'Frost Berry Bush', { hp: 3, xp: 2, respawn: 120, solid: false, fx: 'snow', snd: 'rustle', plant: true, drops: [['frost_berries', 2, 3]] });
node('cactus', 'Cactus', { hp: 6, xp: 2, respawn: 160, fx: 'leaf', snd: 'rustle', plant: true, drops: [['cactus_flesh', 1, 2]] });
node('mushroom_patch', 'Mushrooms', { hp: 3, xp: 2, respawn: 100, solid: false, fx: 'leaf', snd: 'rustle', plant: true, drops: [['mushroom', 1, 3], ['glow_mushroom', 0, 1, 0.2]] });
node('tall_grass', 'Tall Grass', { hp: 1, xp: 0.5, respawn: 60, solid: false, fx: 'leaf', snd: 'rustle', plant: true, drops: [['fiber', 1, 2], ['seed_wheat', 0, 1, 0.06], ['seed_carrot', 0, 1, 0.03], ['feather', 0, 1, 0.04]] });
node('flower_pink', 'Pink Flowers', { hp: 1, xp: 1, respawn: 120, solid: false, fx: 'petal', snd: 'rustle', plant: true, drops: [['petal_pink', 1, 2]] });
node('flower_yellow', 'Sunny Flowers', { hp: 1, xp: 1, respawn: 120, solid: false, fx: 'petal', snd: 'rustle', plant: true, drops: [['petal_yellow', 1, 2]] });
node('flower_blue', 'Blue Flowers', { hp: 1, xp: 1, respawn: 120, solid: false, fx: 'petal', snd: 'rustle', plant: true, drops: [['petal_blue', 1, 2]] });
node('cotton_plant', 'Cotton Plant', { hp: 2, xp: 1, respawn: 150, solid: false, fx: 'leaf', snd: 'rustle', plant: true, drops: [['cotton', 1, 3], ['seed_cotton', 0, 1, 0.1]] });
node('reeds', 'Swamp Reeds', { hp: 1, xp: 1, respawn: 80, solid: false, fx: 'leaf', snd: 'rustle', plant: true, drops: [['fiber', 1, 3]] });
node('bone_pile', 'Bone Pile', { hp: 3, xp: 2, respawn: 200, solid: false, fx: 'dust', snd: 'mine', drops: [['bone', 1, 3]] });
node('spirit_flower', 'Spirit Flower', { hp: 2, xp: 4, respawn: 240, solid: false, fx: 'spirit', snd: 'rustle', plant: true, drops: [['spirit_dust', 1, 2], ['petal_blue', 0, 1, 0.5]] });
node('ember_bloom', 'Ember Bloom', { hp: 3, xp: 5, respawn: 240, solid: false, fx: 'ember', snd: 'rustle', plant: true, drops: [['ember_stone', 0, 1, 0.5], ['charcoal', 1, 2]] });
node('crystal_bloom', 'Crystal Bloom', { hp: 3, xp: 6, respawn: 240, solid: false, fx: 'spark', snd: 'rustle', plant: true, drops: [['crystal_shard', 0, 1, 0.35], ['petal_pink', 1, 2]] });
node('star_bloom', 'Star Bloom', { hp: 3, xp: 8, respawn: 260, solid: false, fx: 'void', snd: 'rustle', plant: true, drops: [['void_essence', 0, 1, 0.35], ['petal_blue', 1, 2]] });

// ---- specials (non-hittable; handled by interact/use rules)
NODES.dig_spot = { id: 'dig_spot', name: 'Dig Spot', kind: 'dig', w: 1, h: 1, solid: false, hp: 1 };
NODES.chest_wild = { id: 'chest_wild', name: 'Treasure Chest', kind: 'treasure', w: 1, h: 1, solid: true, hp: 1 };

/** Sprite names: t_<id> and t_<id>_dep when the node can deplete + regrow. */
export const NODE_IDS = Object.keys(NODES);
export const nodeHasDepleted = (n) => n.kind === 'node' && n.respawn > 0;
