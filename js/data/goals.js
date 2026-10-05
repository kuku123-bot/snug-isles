// Island Goals: a gentle checklist that teaches the game and rewards exploring it. Conditions are evaluated on the host from a
// "census" of the world (see sim/goals.js); clients only see which ids are done. Order = the suggested order of play.
import { TECHS } from './techs.js';
import { BIOMES } from './biomes.js';

export const GOAL_SECTIONS = [
  { id: 'start', name: 'First steps', icon: 'ui_star' },
  { id: 'home', name: 'Home sweet home', icon: 'ui_house' },
  { id: 'craft', name: 'Tools & machines', icon: 'ui_hammer' },
  { id: 'farm', name: 'Farm & fish', icon: 'ui_hunger' },
  { id: 'adv', name: 'Adventure', icon: 'ui_sword' },
  { id: 'grow', name: 'Growing the isles', icon: 'ui_map' },
];

export const GOALS = [];
const G = (id, section, icon, title, desc, reward, check, prog) => GOALS.push({ id, section, icon, title, desc, reward, check, prog: prog || null });
const gs = (k) => (c) => (c.gs[k] || 0);
const built = (type) => (c) => (c.things[type] || 0) >= 1;
const made = (item) => (c) => (c.gs['made_' + item] || 0) >= 1; // crafted / smelted / produced by you (the starting kit does not count)
const NT = Object.keys(TECHS).length;

// ---- first steps
G('chop', 'start', 'i_wood', 'Chop a tree', 'Stand next to a tree and hold the big button (or hold the mouse button on it).', { coins: 10, xp: 8 }, (c) => gs('chop')(c) >= 1);
G('mine', 'start', 'i_stone', 'Break a rock', 'Rocks give stone, and sometimes coal.', { coins: 10, xp: 8 }, (c) => gs('mine')(c) >= 1);
G('craft1', 'start', 'ui_hammer', 'Craft something', 'Open the hammer menu and make a few planks by hand.', { coins: 10, xp: 8 }, (c) => gs('crafted')(c) >= 1);
G('workbench', 'start', 't_workbench', 'Build a Workbench', 'Open the little house menu → Stations. A workbench makes tools and weapons.', { coins: 20, xp: 14 }, built('workbench'));
G('research_table', 'start', 't_research_table', 'Build a Research Table', 'This is where the big technology tree begins.', { coins: 20, xp: 14 }, built('research_table'));
G('tech1', 'start', 'ui_flask', 'Research your first technology', 'Open the flask menu. Try Carpentry for floors and furniture!', { coins: 30, xp: 20 }, (c) => c.techs.size >= 1);
G('land1', 'start', 'ui_map', 'Buy a new land', 'Tap one of the glowing price tags around your island.', { coins: 30, xp: 20 }, (c) => c.lands >= 2);
G('lvl3', 'start', 'ui_star', 'Reach level 3', 'Everything you do earns a little XP.', { coins: 15, xp: 0 }, (c) => c.maxLevel >= 3, (c) => [Math.min(c.maxLevel, 3), 3]);

// ---- home
G('floor', 'home', 'f_plank', 'Lay a floor', 'Build → Floors. Drag to paint a whole area at once.', { coins: 15, xp: 10 }, (c) => c.floors >= 6, (c) => [Math.min(c.floors, 6), 6]);
G('walls', 'home', 'wp_plank_wall', 'Raise some walls', 'Build → Walls. The "Rect" button draws a whole room outline in one swipe.', { coins: 15, xp: 10 }, (c) => c.walls >= 8, (c) => [Math.min(c.walls, 8), 8]);
G('door', 'home', 'wp_plank_door', 'Add a door', 'Doors open by themselves when you walk through.', { coins: 15, xp: 10 }, (c) => c.doors >= 1);
G('window', 'home', 'wp_plank_window', 'Add a window', 'Windows let the light in (and look lovely at night).', { coins: 15, xp: 10 }, (c) => c.windows >= 1);
G('bed', 'home', 't_rustic_bed', 'Place a bed', 'Tap it to set your respawn point. Sleep at night to skip it!', { coins: 20, xp: 12 }, (c) => c.beds >= 1);
G('light', 'home', 't_torch', 'Light up the night', 'Torches, lamps and campfires all glow.', { coins: 15, xp: 10 }, (c) => c.lights >= 1);
G('chest', 'home', 't_chest', 'Build a chest', 'Nearby chests count as part of your bag when you craft and build.', { coins: 15, xp: 10 }, (c) => c.chests >= 1);
G('cozy10', 'home', 'ui_heart', 'Make a cozy room', 'Enclose a room with walls and a door, then fill it with furniture.', { coins: 60, xp: 40 }, (c) => c.cozy >= 10, (c) => [Math.min(c.cozy, 10), 10]);
G('sleep', 'home', 'ui_moon', 'Sleep through the night', 'Get into a bed after dark and wake up to a fresh morning.', { coins: 50, xp: 30 }, (c) => gs('slept')(c) >= 1);
G('furn10', 'home', 't_rustic_chair', 'Furnish with 10 pieces', 'Furniture and decorations both count.', { coins: 50, xp: 30 }, (c) => c.furniture >= 10, (c) => [Math.min(c.furniture, 10), 10]);
G('cozy25', 'home', 'ui_heart', 'A truly snug home', 'Cozy score 25: more furniture, rugs, lamps and plants!', { coins: 200, xp: 90 }, (c) => c.cozy >= 25, (c) => [Math.min(c.cozy, 25), 25]);
G('furn30', 'home', 't_cottage_table', 'Furnish with 30 pieces', 'Make every room different.', { coins: 200, xp: 100 }, (c) => c.furniture >= 30, (c) => [Math.min(c.furniture, 30), 30]);
G('cozy45', 'home', 'ui_heart', 'Your dream home', 'Cozy score 45. Wow.', { coins: 600, xp: 250 }, (c) => c.cozy >= 45, (c) => [Math.min(c.cozy, 45), 45]);
G('furn80', 'home', 't_piano', 'A house full of life', 'Furnish with 80 pieces.', { coins: 600, xp: 250 }, (c) => c.furniture >= 80, (c) => [Math.min(c.furniture, 80), 80]);

// ---- tools & machines
G('furnace', 'craft', 't_furnace', 'Build a Furnace', 'Research Stonecraft first. Furnaces turn ore into ingots.', { coins: 30, xp: 20 }, built('furnace'));
G('copper', 'craft', 'i_copper_ingot', 'Smelt a copper ingot', 'Put copper ore and fuel into the furnace (or place a chest next to it!).', { coins: 40, xp: 25 }, made('copper_ingot'));
G('tech5', 'craft', 'ui_flask', 'Research 5 technologies', 'Every tech unlocks something new.', { coins: 50, xp: 40 }, (c) => c.techs.size >= 5, (c) => [Math.min(c.techs.size, 5), 5]);
G('pick_stone', 'craft', 'i_pickaxe_stone', 'Craft a stone pickaxe', 'Stronger pickaxes break harder rocks.', { coins: 30, xp: 20 }, made('pickaxe_stone'));
G('pick_copper', 'craft', 'i_pickaxe_copper', 'Craft a copper pickaxe', 'Needed for iron veins.', { coins: 60, xp: 40 }, made('pickaxe_copper'));
G('tech10', 'craft', 'ui_flask', 'Research 10 technologies', '', { coins: 100, xp: 70 }, (c) => c.techs.size >= 10, (c) => [Math.min(c.techs.size, 10), 10]);
G('pick_iron', 'craft', 'i_pickaxe_iron', 'Craft an iron pickaxe', 'Iron opens up gold and the deeper biomes.', { coins: 120, xp: 70 }, made('pickaxe_iron'));
G('drill', 'craft', 't_drill_iron', 'Build an auto-miner', 'Drills mine nearby rocks by themselves. Put a chest next to one!', { coins: 200, xp: 100 }, (c) => c.drills >= 1);
G('tech20', 'craft', 'ui_flask', 'Research 20 technologies', '', { coins: 200, xp: 120 }, (c) => c.techs.size >= 20, (c) => [Math.min(c.techs.size, 20), 20]);
G('pick_gold', 'craft', 'i_pickaxe_gold', 'Craft a golden pickaxe', '', { coins: 250, xp: 130 }, made('pickaxe_gold'));
G('steel', 'craft', 'i_steel_ingot', 'Make steel', 'The Blast Furnace turns iron into steel.', { coins: 300, xp: 150 }, made('steel_ingot'));
G('tech35', 'craft', 'ui_flask', 'Research 35 technologies', '', { coins: 400, xp: 220 }, (c) => c.techs.size >= 35, (c) => [Math.min(c.techs.size, 35), 35]);
G('pick_obsidian', 'craft', 'i_pickaxe_obsidian', 'Craft an obsidian pickaxe', '', { coins: 500, xp: 250 }, made('pickaxe_obsidian'));
G('tech50', 'craft', 'ui_flask', 'Research 50 technologies', '', { coins: 800, xp: 400 }, (c) => c.techs.size >= 50, (c) => [Math.min(c.techs.size, 50), 50]);
G('pick_crystal', 'craft', 'i_pickaxe_crystal', 'Craft a crystal pickaxe', '', { coins: 900, xp: 450 }, made('pickaxe_crystal'));
G('pick_star', 'craft', 'i_pickaxe_star', 'Craft a star pickaxe', 'The best pickaxe there is.', { coins: 1500, xp: 700 }, made('pickaxe_star'));
G('tech_all', 'craft', 'ui_flask', 'Research everything', 'The whole tree!', { coins: 3000, xp: 1500 }, (c) => c.techs.size >= NT, (c) => [Math.min(c.techs.size, NT), NT]);

// ---- farm & fish
G('plant', 'farm', 'i_seed_wheat', 'Plant a crop', 'Build a farm plot, hold seeds and tap the plot. Tall grass sometimes drops seeds.', { coins: 20, xp: 14 }, (c) => gs('planted')(c) >= 1);
G('harvest', 'farm', 'i_wheat', 'Harvest a crop', 'Wait for it to ripen (rain helps!), then tap the plot.', { coins: 25, xp: 18 }, (c) => gs('harvested')(c) >= 1);
G('fish1', 'farm', 'i_fish_minnow', 'Catch a fish', 'Research Fishing, craft a rod, and cast onto water.', { coins: 25, xp: 18 }, (c) => gs('caught')(c) >= 1);
G('hatch', 'farm', 'i_pet_egg', 'Hatch a pet', 'Mystery eggs hide in chests and buried treasure. Use one to meet your new buddy!', { coins: 100, xp: 60 }, (c) => gs('hatched')(c) >= 1);
G('dig1', 'farm', 'i_shovel_stone', 'Dig up buried treasure', 'Look for an X on the ground and use a shovel.', { coins: 25, xp: 18 }, (c) => gs('dug')(c) >= 1);
G('sell1', 'farm', 'i_coin', 'Sell something', 'Build a Market Stall (Trade tech) and sell your goods.', { coins: 25, xp: 18 }, (c) => gs('sold')(c) >= 1);
G('honey', 'farm', 'i_honey', 'Collect honey', 'Beehives need flowers nearby.', { coins: 60, xp: 40 }, made('honey'));
G('cake', 'farm', 'i_strawberry_cake', 'Bake a cake', 'Research Gourmet Cooking, then cook a strawberry cake in the kitchen.', { coins: 150, xp: 80 }, made('strawberry_cake'));
G('koi', 'farm', 'i_fish_koi', 'Catch a Golden Koi', 'A very rare fish. Better rods and luck help.', { coins: 300, xp: 150 }, (c) => gs('koi')(c) >= 1);

// ---- adventure
G('kill1', 'adv', 'i_sword_wood', 'Defeat a monster', 'Slimes hop toward you. Hit them with your sword!', { coins: 25, xp: 18 }, (c) => gs('kills')(c) >= 1);
G('kill25', 'adv', 'i_sword_stone', 'Defeat 25 monsters', '', { coins: 100, xp: 60 }, (c) => gs('kills')(c) >= 25, (c) => [Math.min(gs('kills')(c), 25), 25]);
G('boss1', 'adv', 'i_boss_token', 'Defeat the Slime King', 'Build a Slime Altar and offer goo and berries.', { coins: 200, xp: 120 }, (c) => (c.gs.boss || {}).slime_king >= 1);
G('lvl10', 'adv', 'ui_star', 'Reach level 10', '', { coins: 120, xp: 0 }, (c) => c.maxLevel >= 10, (c) => [Math.min(c.maxLevel, 10), 10]);
G('boss2', 'adv', 'i_boss_token', 'Defeat the Bone Lord', 'It guards the graveyard.', { coins: 600, xp: 300 }, (c) => (c.gs.boss || {}).bone_lord >= 1);
G('kill150', 'adv', 'i_sword_iron', 'Defeat 150 monsters', '', { coins: 400, xp: 200 }, (c) => gs('kills')(c) >= 150, (c) => [Math.min(gs('kills')(c), 150), 150]);
G('lvl20', 'adv', 'ui_star', 'Reach level 20', '', { coins: 400, xp: 0 }, (c) => c.maxLevel >= 20, (c) => [Math.min(c.maxLevel, 20), 20]);
G('boss3', 'adv', 'i_boss_token', 'Defeat the Magma Titan', 'Wake it at a Magma Altar. Bring friends and potions!', { coins: 1500, xp: 700 }, (c) => (c.gs.boss || {}).magma_titan >= 1);
G('lvl35', 'adv', 'ui_star', 'Reach level 35', '', { coins: 1200, xp: 0 }, (c) => c.maxLevel >= 35, (c) => [Math.min(c.maxLevel, 35), 35]);
G('boss4', 'adv', 'i_boss_token', 'Defeat the Void Eye', 'The last guardian.', { coins: 4000, xp: 2000 }, (c) => (c.gs.boss || {}).void_eye >= 1);

// ---- growing the isles
G('lands3', 'grow', 'ui_map', 'Own 3 lands', '', { coins: 40, xp: 30 }, (c) => c.lands >= 3, (c) => [Math.min(c.lands, 3), 3]);
G('lands6', 'grow', 'ui_map', 'Own 6 lands', '', { coins: 90, xp: 60 }, (c) => c.lands >= 6, (c) => [Math.min(c.lands, 6), 6]);
G('bridge', 'grow', 'f_bridge_rope', 'Build a bridge', 'Research Bridges to cross the water.', { coins: 40, xp: 30 }, (c) => c.bridges >= 1);
G('biomes3', 'grow', 'ui_sun', 'Own lands in 3 different biomes', 'Desert, tundra, swamp… each has its own treasures.', { coins: 150, xp: 100 }, (c) => c.biomes.size >= 3, (c) => [Math.min(c.biomes.size, 3), 3]);
G('lands12', 'grow', 'ui_map', 'Own 12 lands', '', { coins: 250, xp: 150 }, (c) => c.lands >= 12, (c) => [Math.min(c.lands, 12), 12]);
G('biomes5', 'grow', 'ui_sun', 'Own lands in 5 different biomes', '', { coins: 400, xp: 250 }, (c) => c.biomes.size >= 5, (c) => [Math.min(c.biomes.size, 5), 5]);
G('lands25', 'grow', 'ui_map', 'Own 25 lands', '', { coins: 800, xp: 400 }, (c) => c.lands >= 25, (c) => [Math.min(c.lands, 25), 25]);
G('biomes8', 'grow', 'ui_sun', 'Own a land in every biome', 'From meadow all the way to the starlit void.', { coins: 1500, xp: 800 }, (c) => c.biomes.size >= Object.keys(BIOMES).length, (c) => [Math.min(c.biomes.size, Object.keys(BIOMES).length), Object.keys(BIOMES).length]);
G('lands50', 'grow', 'ui_map', 'Own 50 lands', '', { coins: 2500, xp: 1200 }, (c) => c.lands >= 50, (c) => [Math.min(c.lands, 50), 50]);
G('heart', 'grow', 't_world_heart', 'Build the Heart of the Isles', 'The final monument. You made it!', { coins: 5000, xp: 3000 }, built('world_heart'));

export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));

/** the suggested order for a brand-new player; after that, cheapest-reward first */
const PATH = ['chop', 'mine', 'craft1', 'workbench', 'research_table', 'tech1', 'land1', 'floor', 'walls', 'door', 'window', 'bed', 'light', 'chest', 'cozy10', 'lvl3', 'furnace', 'copper', 'plant', 'harvest', 'sleep', 'fish1', 'kill1', 'dig1', 'sell1', 'tech5', 'pick_stone', 'furn10', 'lands3'];
export function nextGoal(done) {
  for (const id of PATH) if (!done.has(id)) return GOAL_BY_ID[id];
  let best = null;
  for (const g of GOALS) if (!done.has(g.id) && (!best || g.reward.coins < best.reward.coins)) best = g;
  return best;
}
