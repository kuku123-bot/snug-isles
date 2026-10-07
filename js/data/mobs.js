// Creatures. ai: 'hop' | 'walk' | 'fly' | 'shoot' | 'passive' | 'boss'.
// drops: [item|'coin', min, max, chance]. Passive critters are pettable (E / right-click) and can be hunted: a swing only hits one if it is aimed right at it. A hatched pet can never be hurt.
export const MOBS = {};
const mob = (id, name, o) => {
  MOBS[id] = { id, name, hp: 10, dmg: 2, spd: 24, r: 5, aggro: 80, xp: 3, ai: 'walk', atkcd: 1.0, drops: [], hostile: true, w: 14, h: 12, tier: 1, ...o };
  return MOBS[id];
};

// --- slimes (hop toward you; the classic)
mob('slime_green', 'Green Slime', { hp: 12, dmg: 2, spd: 30, ai: 'hop', xp: 4, tier: 1, drops: [['slime_goo', 1, 2, 0.7], ['coin', 1, 2, 0.45]] });
mob('sand_slime', 'Sand Slime', { hp: 22, dmg: 3, spd: 32, ai: 'hop', xp: 7, tier: 2, drops: [['slime_goo', 1, 2, 0.5], ['sand', 1, 2, 0.6], ['coin', 1, 3, 0.5]] });
mob('snow_slime', 'Snow Slime', { hp: 22, dmg: 3, spd: 32, ai: 'hop', xp: 7, tier: 2, drops: [['slime_goo', 1, 2, 0.5], ['ice_shard', 1, 1, 0.4], ['coin', 1, 3, 0.5]] });
mob('bog_slime', 'Bog Slime', { hp: 34, dmg: 4, spd: 30, ai: 'hop', xp: 11, tier: 3, drops: [['slime_goo', 1, 3, 0.7], ['swamp_moss', 1, 1, 0.4], ['coin', 2, 4, 0.5]] });
mob('magma_slime', 'Magma Slime', { hp: 70, dmg: 7, spd: 34, ai: 'hop', xp: 22, tier: 5, w: 16, drops: [['ember_stone', 1, 2, 0.5], ['coin', 3, 6, 0.6]] });
mob('star_slime', 'Star Slime', { hp: 130, dmg: 11, spd: 36, ai: 'hop', xp: 44, tier: 7, w: 16, drops: [['star_fragment', 0, 1, 0.3], ['void_essence', 0, 1, 0.25], ['coin', 6, 12, 0.6]] });
// a rare shy one: it hops away from you, vanishes after a while, and pays out when caught (a frost bomb stops it)
mob('golden_slime', 'Golden Slime', { hp: 40, dmg: 0, spd: 38, ai: 'hop', shy: true, life: 50, xp: 60, tier: 2, w: 16, aggro: 120, drops: [['coin', 60, 100, 1], ['slime_goo', 2, 4, 1], ['gem_emerald', 0, 1, 0.5], ['gem_ruby', 0, 1, 0.3], ['pet_egg', 0, 1, 0.15]] });

// --- walkers
mob('scarab', 'Dune Scarab', { hp: 20, dmg: 3, spd: 36, ai: 'walk', xp: 7, tier: 2, aggro: 90, drops: [['coin', 1, 3, 0.55], ['sand', 0, 1, 0.4]] });
mob('scorpion', 'Sand Scorpion', { hp: 34, dmg: 5, spd: 42, ai: 'walk', xp: 11, tier: 3, aggro: 100, drops: [['coin', 2, 4, 0.55], ['bone', 0, 1, 0.2]] });
mob('skeleton', 'Wobbly Skeleton', { hp: 36, dmg: 5, spd: 32, ai: 'walk', xp: 13, tier: 4, aggro: 100, w: 14, h: 18, drops: [['bone', 1, 2, 0.8], ['coin', 2, 5, 0.6], ['treasure_key', 0, 1, 0.04]] });
mob('frog', 'Grumpy Frog', { hp: 14, dmg: 3, spd: 34, ai: 'hop', xp: 6, tier: 3, drops: [['swamp_moss', 0, 1, 0.4], ['coin', 1, 2, 0.4]] });
mob('crystal_golem', 'Crystal Golem', { hp: 160, dmg: 12, spd: 22, ai: 'walk', xp: 46, tier: 6, aggro: 90, w: 18, h: 20, r: 7, drops: [['crystal_shard', 2, 4, 0.9], ['gem_amethyst', 0, 1, 0.1], ['coin', 6, 12, 0.7]] });
mob('shadow_knight', 'Shadow Knight', { hp: 220, dmg: 18, spd: 46, ai: 'walk', xp: 70, tier: 7, aggro: 120, w: 16, h: 20, r: 6, drops: [['star_fragment', 1, 2, 0.6], ['void_essence', 1, 2, 0.5], ['coin', 10, 20, 0.8]] });

// --- flyers
mob('bat', 'Cave Bat', { hp: 8, dmg: 2, spd: 48, ai: 'fly', xp: 4, tier: 1, aggro: 110, w: 14, h: 10, drops: [['feather', 1, 1, 0.6], ['coin', 1, 1, 0.3]] });
mob('ice_bat', 'Frost Bat', { hp: 14, dmg: 3, spd: 50, ai: 'fly', xp: 7, tier: 2, aggro: 110, w: 14, h: 10, drops: [['feather', 1, 2, 0.6], ['ice_shard', 0, 1, 0.3]] });
mob('ghost', 'Shy Ghost', { hp: 28, dmg: 6, spd: 38, ai: 'fly', ghost: true, xp: 14, tier: 4, aggro: 110, w: 14, h: 16, drops: [['spirit_dust', 1, 2, 0.7], ['coin', 2, 4, 0.4]] });
mob('prism_wisp', 'Prism Wisp', { hp: 60, dmg: 8, spd: 40, ai: 'shoot', fly: true, xp: 26, tier: 6, aggro: 120, keep: 60, proj: { spd: 80, dmg: 8, color: '#ff9fd0' }, drops: [['crystal_shard', 1, 2, 0.7], ['coin', 4, 8, 0.6]] });
mob('void_wisp', 'Void Wisp', { hp: 100, dmg: 12, spd: 42, ai: 'shoot', fly: true, ghost: true, xp: 42, tier: 7, aggro: 130, keep: 70, proj: { spd: 90, dmg: 12, color: '#b79cff' }, drops: [['void_essence', 1, 2, 0.6], ['coin', 6, 12, 0.6]] });

// --- shooters
mob('mushroom_walker', 'Spore Walker', { hp: 40, dmg: 4, spd: 24, ai: 'shoot', xp: 15, tier: 3, aggro: 110, keep: 55, atkcd: 1.8, w: 14, h: 16, proj: { spd: 60, dmg: 4, color: '#c9ff9a' }, drops: [['mushroom', 1, 2, 0.8], ['glow_mushroom', 0, 1, 0.3], ['coin', 2, 4, 0.5]] });
mob('fire_imp', 'Fire Imp', { hp: 52, dmg: 7, spd: 36, ai: 'shoot', xp: 24, tier: 5, aggro: 120, keep: 65, atkcd: 1.5, w: 14, h: 16, proj: { spd: 85, dmg: 7, color: '#ff7a3d' }, drops: [['ember_stone', 1, 2, 0.6], ['charcoal', 1, 2, 0.5], ['coin', 3, 7, 0.6]] });

// --- passive critters
mob('bunny', 'Bunny', { hp: 6, ai: 'passive', hostile: false, spd: 40, flee: true, w: 12, h: 12, xp: 1, drops: [['wool', 1, 2, 0.8], ['coin', 1, 1, 0.3]] });
mob('snow_bunny', 'Snow Bunny', { hp: 6, ai: 'passive', hostile: false, spd: 40, flee: true, w: 12, h: 12, xp: 1, drops: [['wool', 1, 2, 0.8], ['ice_shard', 0, 1, 0.3]] });
mob('chick', 'Chick', { hp: 4, ai: 'passive', hostile: false, spd: 26, w: 10, h: 10, xp: 1, drops: [['feather', 1, 2, 0.9], ['egg', 0, 1, 0.3]] });
mob('duck', 'Duckling', { hp: 4, ai: 'passive', hostile: false, spd: 24, w: 12, h: 10, xp: 1, drops: [['feather', 1, 2, 0.9], ['egg', 0, 1, 0.2]] });
mob('penguin', 'Penguin', { hp: 6, ai: 'passive', hostile: false, spd: 22, w: 12, h: 14, xp: 1, drops: [['feather', 1, 3, 0.9], ['ice_shard', 0, 1, 0.3]] });
mob('lizard', 'Sunny Lizard', { hp: 4, ai: 'passive', hostile: false, spd: 44, flee: true, w: 14, h: 8, xp: 1, drops: [['sand', 0, 1, 0.5], ['coin', 1, 2, 0.5]] });
mob('unicorn', 'Tiny Unicorn', { hp: 10, ai: 'passive', hostile: false, spd: 36, w: 16, h: 16, xp: 3, drops: [['spirit_dust', 1, 2, 0.9], ['petal_pink', 0, 2, 0.5]] });

// --- bosses (summoned at altars; see structures)
mob('slime_king', 'Slime King', { boss: true, hp: 320, dmg: 6, spd: 26, ai: 'boss', xp: 160, tier: 2, aggro: 400, w: 40, h: 32, r: 14, patterns: ['hop', 'summon', 'slam'], summon: 'slime_green', drops: [['coin', 40, 60, 1], ['slime_goo', 6, 10, 1], ['boss_token', 1, 1, 1], ['pet_egg', 0, 1, 0.5]] });
mob('mushroom_mother', 'Mushroom Mother', { boss: true, hp: 560, dmg: 9, spd: 26, ai: 'boss', xp: 260, tier: 3, aggro: 400, w: 44, h: 42, r: 14, orb: '#d7a0ff', patterns: ['volley', 'summon', 'hop'], summon: 'mushroom_walker', drops: [['coin', 70, 110, 1], ['glow_mushroom', 6, 10, 1], ['boss_token', 1, 1, 1], ['gem_emerald', 1, 2, 1], ['pet_egg', 0, 1, 0.5]] });
mob('sand_pharaoh', 'Sand Pharaoh', { boss: true, hp: 760, dmg: 10, spd: 28, ai: 'boss', xp: 330, tier: 3, aggro: 400, w: 38, h: 44, r: 12, orb: '#ffd35c', patterns: ['quake', 'summon', 'charge'], summon: 'scarab', drops: [['coin', 90, 150, 1], ['sand', 12, 20, 1], ['boss_token', 1, 1, 1], ['gem_sapphire', 1, 2, 1], ['bone', 4, 8, 1]] });
mob('bone_lord', 'Bone Lord', { boss: true, hp: 900, dmg: 12, spd: 30, ai: 'boss', xp: 420, tier: 4, aggro: 400, w: 36, h: 40, r: 12, patterns: ['charge', 'summon', 'ring'], summon: 'skeleton', drops: [['coin', 120, 200, 1], ['spirit_dust', 10, 16, 1], ['boss_token', 1, 1, 1], ['gem_ruby', 1, 2, 1]] });
mob('frost_yeti', 'Frost Yeti', { boss: true, hp: 1500, dmg: 15, spd: 30, ai: 'boss', xp: 600, tier: 5, aggro: 400, w: 46, h: 48, r: 15, orb: '#bfe8ff', patterns: ['charge', 'volley', 'slam', 'summon'], summon: 'ice_bat', drops: [['coin', 200, 320, 1], ['ice_shard', 12, 18, 1], ['boss_token', 1, 1, 1], ['gem_sapphire', 1, 3, 1], ['frost_berries', 3, 6, 1]] });
mob('magma_titan', 'Magma Titan', { boss: true, hp: 2400, dmg: 20, spd: 28, ai: 'boss', xp: 900, tier: 5, aggro: 400, w: 48, h: 48, r: 16, patterns: ['slam', 'ring', 'charge'], summon: 'magma_slime', drops: [['coin', 300, 500, 1], ['obsidian', 8, 14, 1], ['ember_stone', 8, 12, 1], ['boss_token', 1, 1, 1], ['gem_ruby', 1, 3, 1]] });
mob('crystal_colossus', 'Crystal Colossus', { boss: true, hp: 3800, dmg: 24, spd: 26, ai: 'boss', xp: 1400, tier: 6, aggro: 400, w: 54, h: 54, r: 18, orb: '#ff9fd0', patterns: ['spin', 'quake', 'summon', 'charge'], summon: 'crystal_golem', drops: [['coin', 500, 800, 1], ['crystal_shard', 10, 16, 1], ['boss_token', 1, 1, 1], ['gem_amethyst', 2, 3, 1], ['gem_ruby', 1, 2, 1]] });
mob('void_eye', 'The Void Eye', { boss: true, hp: 6000, dmg: 30, spd: 34, ai: 'boss', xp: 2400, tier: 7, aggro: 500, w: 48, h: 48, r: 16, fly: true, patterns: ['ring', 'summon', 'charge'], summon: 'void_wisp', drops: [['coin', 800, 1200, 1], ['star_fragment', 8, 14, 1], ['void_essence', 8, 14, 1], ['boss_token', 2, 2, 1], ['gem_amethyst', 2, 4, 1]] });

export const MOB_IDS = Object.keys(MOBS);
