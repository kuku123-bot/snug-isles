// Personal skill tree. One point per level. fx values are PER RANK and summed by key.
export const SKILL_BRANCHES = [
  { id: 'forage', name: 'Forager', color: '#7ed957' },
  { id: 'fight', name: 'Brawler', color: '#ff6b6b' },
  { id: 'home', name: 'Homebody', color: '#ff8fb3' },
  { id: 'nature', name: 'Gardener', color: '#ffd84a' },
  { id: 'wander', name: 'Wanderer', color: '#5cc7ff' },
];

export const SKILLS = {};
const S = (id, name, branch, max, req, desc, fx, cost = 1) => {
  SKILLS[id] = { id, name, branch, max, req, desc, fx, cost };
};

// ---- Forager
S('strong_arms', 'Strong Arms', 'forage', 5, null, '+10% tool damage per rank.', { toolDmg: 0.1 });
S('swift_hands', 'Swift Hands', 'forage', 5, 'strong_arms', '+8% tool speed per rank.', { toolSpeed: 0.08 });
S('lucky_find', 'Lucky Find', 'forage', 5, null, '+4% chance to double a drop per rank.', { doubleDrop: 0.04 });
S('magnet_pockets', 'Magnet Pockets', 'forage', 4, null, '+25% pickup range per rank.', { magnet: 0.25 });
S('eagle_eye', 'Long Arms', 'forage', 3, 'strong_arms', '+2 reach per rank.', { reach: 2 });
S('prospector', 'Prospector', 'forage', 4, 'lucky_find', '+6% chance of an extra ore per rank.', { oreBonus: 0.06 });
S('berry_picker', 'Berry Picker', 'forage', 4, null, '+15% chance of extra plant drops per rank.', { plantBonus: 0.15 });
S('tree_whisperer', 'Tree Whisperer', 'forage', 4, 'berry_picker', 'Plants and trees regrow 10% faster per rank.', { regrow: 0.1 });
S('gem_hunter', 'Gem Hunter', 'forage', 3, 'prospector', '+25% rare drops per rank.', { rare: 0.25 }, 2);
S('master_forager', 'Master Forager', 'forage', 3, 'swift_hands', '+10% gathering XP per rank.', { gatherXp: 0.1 });

// ---- Brawler
S('sharp_edge', 'Sharp Edge', 'fight', 5, null, '+8% melee damage per rank.', { meleeDmg: 0.08 });
S('tough_skin', 'Tough Skin', 'fight', 5, null, '+1 heart per rank.', { maxHp: 4 });
S('quick_recovery', 'Quick Recovery', 'fight', 3, 'tough_skin', '+25% health regeneration per rank.', { regen: 0.25 });
S('critical_cutie', 'Critical Cutie', 'fight', 5, 'sharp_edge', '+4% critical hit chance per rank.', { crit: 0.04 });
S('dash_master', 'Dash Master', 'fight', 3, null, 'Dash recharges 12% faster per rank.', { dashCd: 0.12 });
S('sharpshooter', 'Sharpshooter', 'fight', 4, 'sharp_edge', '+10% bow damage per rank.', { bowDmg: 0.1 });
S('arcane_study', 'Arcane Study', 'fight', 4, null, '+10% staff damage per rank.', { staffDmg: 0.1 });
S('vampiric', 'Sweet Tooth', 'fight', 3, 'critical_cutie', 'Heal 1 HP per monster slain, per rank.', { lifesteal: 1 }, 2);
S('thick_hide', 'Thick Hide', 'fight', 5, 'tough_skin', '-4% damage taken per rank.', { dmgTaken: 0.04 });
S('second_wind', 'Second Wind', 'fight', 1, 'thick_hide', 'Once per day, survive a lethal hit with 25% health.', { secondWind: 1 }, 3);

// ---- Homebody
S('bargain_builder', 'Bargain Builder', 'home', 4, null, 'Building costs 5% less per rank.', { buildDiscount: 0.05 });
S('stonemason', 'Stonemason', 'home', 3, 'bargain_builder', 'Walls and floors cost an extra 8% less per rank.', { wallDiscount: 0.08 });
S('long_reach', 'Long Reach', 'home', 3, null, 'Build from 2 tiles further away per rank.', { buildReach: 2 });
S('cozy_corner', 'Cozy Corner', 'home', 3, null, 'Cozy rooms give 25% stronger bonuses per rank.', { cozy: 0.25 });
S('interior_designer', 'Interior Designer', 'home', 3, 'cozy_corner', 'Furniture counts 15% more toward coziness per rank.', { comfort: 0.15 });
S('night_owl', 'Night Owl', 'home', 3, null, 'See 10% further in the dark per rank.', { lightR: 0.1 });
S('well_rested', 'Well Rested', 'home', 1, 'cozy_corner', 'Sleeping in a cozy bed grants a XP boost for the day.', { rested: 1 }, 2);
S('backpack', 'Bigger Backpack', 'home', 3, null, '+4 inventory slots per rank.', { slots: 4 });

// ---- Gardener
S('green_thumb', 'Green Thumb', 'nature', 5, null, 'Crops grow 12% faster per rank.', { cropGrowth: 0.12 });
S('bountiful_harvest', 'Bountiful Harvest', 'nature', 4, 'green_thumb', '+20% chance of extra crops per rank.', { cropYield: 0.2 });
S('angler', 'Angler', 'nature', 5, null, 'Fish bite 10% faster per rank.', { bite: 0.1 });
S('fish_whisperer', 'Fish Whisperer', 'nature', 4, 'angler', '+8% chance of rare fish per rank.', { rareFish: 0.08 });
S('animal_friend', 'Animal Friend', 'nature', 4, null, 'Animals and bees produce 12% faster per rank.', { animal: 0.12 });
S('cook', 'Home Cook', 'nature', 4, 'green_thumb', 'Food heals and buffs last 15% more per rank.', { food: 0.15 });
S('herbalist', 'Herbalist', 'nature', 3, 'cook', 'Potions are 20% stronger per rank.', { potion: 0.2 });

// ---- Wanderer
S('haggler', 'Haggler', 'wander', 5, null, 'Sell for 5% more per rank.', { sell: 0.05 });
S('coin_magnet', 'Coin Magnet', 'wander', 5, null, '+12% coins from monsters per rank.', { coins: 0.12 });
S('light_feet', 'Light Feet', 'wander', 5, null, '+4% movement speed per rank.', { speed: 0.04 });
S('stamina', 'Stamina', 'wander', 4, 'light_feet', '+10 energy per rank.', { energy: 10 });
S('land_surveyor', 'Land Surveyor', 'wander', 4, 'haggler', 'Lands cost 5% less per rank.', { landDiscount: 0.05 });
S('treasure_sense', 'Treasure Sense', 'wander', 1, 'lucky_find', 'Buried treasure sparkles from afar.', { treasureSense: 1 }, 2);
S('lucky_star', 'Lucky Star', 'wander', 3, 'treasure_sense', '+10% luck: better chest and dig loot.', { luck: 0.1 }, 2);

export const SKILL_IDS = Object.keys(SKILLS);

export function xpForLevel(level) {
  // xp needed to go from `level` to `level+1`
  return Math.round(24 * Math.pow(1.17, level - 1) + level * 4);
}
export const MAX_LEVEL = 60;
