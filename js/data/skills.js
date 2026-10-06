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
S('iron_grip', 'Iron Grip', 'forage', 3, 'master_forager', '+8% tool damage per rank.', { toolDmg: 0.08 }, 2);
S('quick_learner', 'Quick Learner', 'forage', 3, 'magnet_pockets', '+12% gathering XP per rank.', { gatherXp: 0.12 });

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
S('battle_cry', 'Battle Cry', 'fight', 3, 'critical_cutie', '+8% melee damage per rank.', { meleeDmg: 0.08 }, 2);
S('survivor', 'Survivor', 'fight', 3, 'thick_hide', '+1 heart per rank.', { maxHp: 4 }, 2);

// ---- Homebody
S('bargain_builder', 'Bargain Builder', 'home', 4, null, 'Building costs 5% less per rank.', { buildDiscount: 0.05 });
S('stonemason', 'Stonemason', 'home', 3, 'bargain_builder', 'Walls and floors cost an extra 8% less per rank.', { wallDiscount: 0.08 });
S('long_reach', 'Long Reach', 'home', 3, null, 'Build from 2 tiles further away per rank.', { buildReach: 2 });
S('cozy_corner', 'Cozy Corner', 'home', 3, null, 'Cozy rooms give 25% stronger bonuses per rank.', { cozy: 0.25 });
S('interior_designer', 'Interior Designer', 'home', 3, 'cozy_corner', 'Furniture counts 15% more toward coziness per rank.', { comfort: 0.15 });
S('night_owl', 'Night Owl', 'home', 3, null, 'See 10% further in the dark per rank.', { lightR: 0.1 });
S('well_rested', 'Well Rested', 'home', 1, 'cozy_corner', 'Sleeping in a cozy bed grants a XP boost for the day.', { rested: 1 }, 2);
S('backpack', 'Bigger Backpack', 'home', 3, null, '+4 inventory slots per rank.', { slots: 4 });
S('master_builder', 'Master Builder', 'home', 3, 'stonemason', 'Building costs 5% less per rank.', { buildDiscount: 0.05 }, 2);
S('pack_mule', 'Pack Mule', 'home', 3, 'backpack', '+6 bag slots per rank.', { slots: 6 }, 2);
S('warehouse', 'Warehouse Keeper', 'home', 3, 'pack_mule', 'Every chest, barrel and cupboard holds 4 more slots per rank, for you and your partner.', { chestSlots: 4 }, 2);
S('fireside_dreams', 'Fireside Dreams', 'home', 2, 'interior_designer', 'Cozy rooms give 20% stronger bonuses per rank.', { cozy: 0.2 });

// ---- Gardener
S('green_thumb', 'Green Thumb', 'nature', 5, null, 'Crops grow 12% faster per rank.', { cropGrowth: 0.12 });
S('bountiful_harvest', 'Bountiful Harvest', 'nature', 4, 'green_thumb', '+20% chance of extra crops per rank.', { cropYield: 0.2 });
S('angler', 'Angler', 'nature', 5, null, 'Fish bite 10% faster per rank.', { bite: 0.1 });
S('fish_whisperer', 'Fish Whisperer', 'nature', 4, 'angler', '+8% chance of rare fish per rank.', { rareFish: 0.08 });
S('animal_friend', 'Animal Friend', 'nature', 4, null, 'Animals and bees produce 12% faster per rank.', { animal: 0.12 });
S('cook', 'Home Cook', 'nature', 4, 'green_thumb', 'Food heals and buffs last 15% more per rank.', { food: 0.15 });
S('herbalist', 'Herbalist', 'nature', 3, 'cook', 'Potions are 20% stronger per rank.', { potion: 0.2 });
S('fertile_hands', 'Fertile Hands', 'nature', 3, 'bountiful_harvest', 'Crops grow 10% faster per rank.', { cropGrowth: 0.1 }, 2);
S('master_angler', 'Master Angler', 'nature', 3, 'fish_whisperer', 'Fish bite 12% faster per rank.', { bite: 0.12 });

// ---- Wanderer
S('haggler', 'Haggler', 'wander', 5, null, 'Sell for 5% more per rank.', { sell: 0.05 });
S('coin_magnet', 'Coin Magnet', 'wander', 5, null, '+12% coins from monsters per rank.', { coins: 0.12 });
S('light_feet', 'Light Feet', 'wander', 5, null, '+4% movement speed per rank.', { speed: 0.04 });
S('stamina', 'Stamina', 'wander', 4, 'light_feet', '+10 energy per rank.', { energy: 10 });
S('land_surveyor', 'Land Surveyor', 'wander', 4, 'haggler', 'Lands cost 5% less per rank.', { landDiscount: 0.05 });
S('treasure_sense', 'Treasure Sense', 'wander', 1, 'land_surveyor', 'Buried treasure sparkles from afar.', { treasureSense: 1 }, 2);
S('lucky_star', 'Lucky Star', 'wander', 3, 'treasure_sense', '+10% luck: better chest and dig loot.', { luck: 0.1 }, 2);
S('pathfinder', 'Pathfinder', 'wander', 3, 'stamina', '+4% movement speed per rank.', { speed: 0.04 });
S('deal_maker', 'Deal Maker', 'wander', 3, 'coin_magnet', '+8% coins from monsters per rank.', { coins: 0.08 });

// one picture per skill (sprite names: i_ item, t_ thing, ui_ icon); tests check they all exist
const ICONS = {
  strong_arms: 'i_pickaxe_iron', swift_hands: 'ui_hand', lucky_find: 'i_charm_luck', magnet_pockets: 'i_charm_magnet', eagle_eye: 'ui_arrow', prospector: 'i_gold_ore', berry_picker: 'i_berries',
  tree_whisperer: 't_oak', gem_hunter: 'i_gem_ruby', master_forager: 'ui_star', iron_grip: 'i_pickaxe_gold', quick_learner: 'i_elixir_xp',
  sharp_edge: 'i_sword_iron', tough_skin: 'ui_heart', quick_recovery: 'i_potion_health_m', critical_cutie: 'ui_bolt', dash_master: 'ui_dash', sharpshooter: 'i_bow_iron', arcane_study: 'i_staff_arcane',
  vampiric: 'i_honey_cake', thick_hide: 'i_tunic_iron', second_wind: 'i_charm_heart', battle_cry: 'i_sword_gold', survivor: 'ui_heart_half',
  bargain_builder: 'ui_hammer', stonemason: 'i_stone', long_reach: 'ui_house', cozy_corner: 'ui_cozy', interior_designer: 't_cottage_sofa', night_owl: 'ui_moon', well_rested: 't_cottage_bed', backpack: 'ui_bag',
  master_builder: 'i_brick', fireside_dreams: 't_fireplace', pack_mule: 't_crate', warehouse: 't_large_chest',
  green_thumb: 'i_seed_wheat', bountiful_harvest: 'i_pumpkin', angler: 'i_rod_wood', fish_whisperer: 'i_fish_koi', animal_friend: 'i_milk', cook: 'i_bread', herbalist: 'i_potion_health_s',
  fertile_hands: 't_farm_plot', master_angler: 'i_fish_salmon',
  haggler: 'i_coin', coin_magnet: 'i_gem_sapphire', light_feet: 'i_boots_cloth', stamina: 'ui_bolt', land_surveyor: 'ui_map', treasure_sense: 'i_treasure_key', lucky_star: 'ui_sun',
  pathfinder: 'i_boots_gold', deal_maker: 'i_gold_ingot',
};
for (const id of Object.keys(SKILLS)) SKILLS[id].icon = ICONS[id] || 'ui_star';

export const SKILL_IDS = Object.keys(SKILLS);

export function xpForLevel(level) {
  // xp needed to go from `level` to `level+1`
  return Math.round(24 * Math.pow(1.17, level - 1) + level * 4);
}
export const MAX_LEVEL = 60;
