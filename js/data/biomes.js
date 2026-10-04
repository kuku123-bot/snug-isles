// Biomes: ground type, what grows there, what lives there, and how land is priced.
// res: [nodeId, countPerLand]  (scaled by the resource-abundance setting)
// mobs: [mobId, weight]; night mobs spawn mostly after dark.

export const BIOMES = {
  meadow: {
    id: 'meadow', name: 'Sunny Meadow', ground: 'grass', tier: 0, price: 1.0, color: '#6cc24e', blurb: 'Gentle hills, berries and oaks.',
    res: [['oak', 12], ['rock', 7], ['berry_bush', 4], ['tall_grass', 22], ['flower_pink', 6], ['flower_yellow', 6], ['flower_blue', 5], ['cotton_plant', 3], ['coal_rock', 2], ['copper_rock', 2], ['clay_deposit', 1], ['sand_pile', 2]],
    mobs: [['slime_green', 10], ['bunny', 6], ['chick', 5]], night: [['slime_green', 6], ['bat', 5]],
  },
  desert: {
    id: 'desert', name: 'Golden Dunes', ground: 'sand', tier: 2, price: 1.3, color: '#f1dc9a', blurb: 'Hot sand, cacti and glittering gold.',
    res: [['palm', 6], ['cactus', 7], ['sandstone', 8], ['gold_rock', 3], ['iron_rock', 3], ['copper_rock', 2], ['clay_deposit', 2], ['tall_grass', 3]],
    mobs: [['scarab', 8], ['sand_slime', 6], ['lizard', 4]], night: [['scarab', 8], ['scorpion', 6]],
  },
  tundra: {
    id: 'tundra', name: 'Frosty Tundra', ground: 'snow', tier: 2, price: 1.3, color: '#e1efff', blurb: 'Snowy pines and sparkling ice.',
    res: [['pine', 10], ['ice_rock', 7], ['frost_bush', 4], ['iron_rock', 4], ['coal_rock', 3], ['gold_rock', 2], ['geode', 1]],
    mobs: [['snow_slime', 8], ['snow_bunny', 6], ['penguin', 4]], night: [['snow_slime', 6], ['ice_bat', 6]],
  },
  swamp: {
    id: 'swamp', name: 'Misty Swamp', ground: 'swamp', tier: 3, price: 1.6, color: '#4f8f62', blurb: 'Glowing mushrooms and murky ponds.',
    res: [['mangrove', 8], ['mushroom_patch', 6], ['reeds', 12], ['clay_deposit', 4], ['iron_rock', 3], ['coal_rock', 3], ['gold_rock', 2], ['geode', 1]],
    mobs: [['bog_slime', 8], ['frog', 6], ['duck', 3]], night: [['mushroom_walker', 6], ['bog_slime', 6]],
  },
  graveyard: {
    id: 'graveyard', name: 'Whispering Graveyard', ground: 'grave', tier: 4, price: 2.0, color: '#7f7392', blurb: 'Quiet tombs and spirit lights.',
    res: [['dead_tree', 6], ['tombstone', 8], ['bone_pile', 6], ['spirit_flower', 5], ['iron_rock', 3], ['gold_rock', 3], ['geode', 2]],
    mobs: [['skeleton', 8], ['bat', 4]], night: [['ghost', 8], ['skeleton', 8]],
  },
  volcano: {
    id: 'volcano', name: 'Ember Peaks', ground: 'volcano', tier: 5, price: 2.5, color: '#5d4a53', blurb: 'Rivers of lava and shining obsidian.',
    res: [['burnt_tree', 5], ['ember_rock', 7], ['obsidian_rock', 5], ['ember_bloom', 5], ['gold_rock', 3], ['coal_rock', 4], ['geode', 2]],
    mobs: [['magma_slime', 8], ['fire_imp', 5]], night: [['fire_imp', 8], ['magma_slime', 6]],
  },
  crystal: {
    id: 'crystal', name: 'Prism Fields', ground: 'crystal', tier: 6, price: 3.2, color: '#cbb8f4', blurb: 'Rainbow crystals hum softly.',
    res: [['crystal_tree', 5], ['crystal_rock', 8], ['crystal_bloom', 8], ['gold_rock', 3], ['geode', 3], ['flower_pink', 4]],
    mobs: [['prism_wisp', 8], ['crystal_golem', 4], ['unicorn', 2]], night: [['prism_wisp', 8], ['crystal_golem', 5]],
  },
  void: {
    id: 'void', name: 'Starlit Void', ground: 'void', tier: 7, price: 4.5, color: '#2b2158', blurb: 'Where the sky meets the sea.',
    res: [['void_tree', 4], ['star_rock', 7], ['star_bloom', 8], ['crystal_rock', 3], ['geode', 3]],
    mobs: [['void_wisp', 8], ['star_slime', 6]], night: [['shadow_knight', 6], ['void_wisp', 8]],
  },
};
export const BIOME_IDS = Object.keys(BIOMES);

/** Ground type ids stored in the ground layer (0 = water). Order is part of the save format: append only. */
export const GROUND_IDS = ['water', 'grass', 'sand', 'snow', 'swamp', 'grave', 'volcano', 'crystal', 'void'];
export const GROUND_CODE = Object.fromEntries(GROUND_IDS.map((g, i) => [g, i]));
