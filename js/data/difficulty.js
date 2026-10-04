// World rules / difficulty. Chosen at world creation; the host can tweak most of them later in the pause menu.
export const OPTIONS = [
  { group: 'World', id: 'worldSize', label: 'World size', desc: 'How many lands exist in the world.', opts: [[7, 'Small (7×7)'], [9, 'Medium (9×9)'], [11, 'Large (11×11)']], def: 9, locked: true },
  { group: 'World', id: 'dayLength', label: 'Day length', desc: 'Real minutes for one full day.', opts: [[240, '4 min'], [480, '8 min'], [720, '12 min'], [1200, '20 min']], def: 480 },
  { group: 'World', id: 'weather', label: 'Weather', desc: 'Rain makes crops grow faster.', opts: [[0, 'Always sunny'], [1, 'Gentle'], [2, 'Stormy']], def: 1 },
  { group: 'World', id: 'startKit', label: 'Starting kit', desc: 'What you begin with.', opts: [['bare', 'Just a pickaxe'], ['standard', 'Standard'], ['generous', 'Generous']], def: 'standard', locked: true },

  { group: 'Creatures', id: 'enemyDensity', label: 'Monsters', desc: 'How many monsters roam about.', opts: [[0, 'None (peaceful)'], [0.5, 'Few'], [1, 'Normal'], [1.6, 'Many'], [2.4, 'Swarms']], def: 1 },
  { group: 'Creatures', id: 'enemyDamage', label: 'Monster damage', desc: 'How hard monsters hit.', opts: [[0.5, 'Gentle ×0.5'], [0.75, 'Soft ×0.75'], [1, 'Normal'], [1.5, 'Strong ×1.5'], [2.5, 'Brutal ×2.5']], def: 1 },
  { group: 'Creatures', id: 'enemyHealth', label: 'Monster toughness', desc: 'How much health monsters have.', opts: [[0.75, 'Squishy'], [1, 'Normal'], [1.5, 'Tough'], [2.5, 'Tanky']], def: 1 },
  { group: 'Creatures', id: 'aggro', label: 'Monster alertness', desc: 'How far monsters notice you.', opts: [[0.5, 'Sleepy'], [1, 'Normal'], [1.5, 'Alert']], def: 1 },
  { group: 'Creatures', id: 'nightDanger', label: 'Night danger', desc: 'Extra monsters after dark.', opts: [[0, 'Calm nights'], [1, 'Normal'], [2, 'Fierce']], def: 1 },
  { group: 'Creatures', id: 'bossPower', label: 'Boss strength', desc: 'Boss health and damage.', opts: [[0.6, 'Friendly'], [1, 'Normal'], [1.6, 'Fearsome']], def: 1 },

  { group: 'Economy', id: 'resourceYield', label: 'Resource yield', desc: 'How much you get from nodes.', opts: [[0.5, '×0.5'], [1, 'Normal'], [1.5, '×1.5'], [2, '×2'], [3, '×3']], def: 1 },
  { group: 'Economy', id: 'resourceRespawn', label: 'Regrowth speed', desc: 'How fast trees, rocks and bushes return.', opts: [[0.5, 'Slow'], [1, 'Normal'], [2, 'Fast'], [4, 'Very fast']], def: 1 },
  { group: 'Economy', id: 'xpRate', label: 'XP gain', desc: 'How fast you level up.', opts: [[0.5, '×0.5'], [1, 'Normal'], [1.5, '×1.5'], [2, '×2'], [3, '×3']], def: 1 },
  { group: 'Economy', id: 'landPrice', label: 'Land prices', desc: 'Coins needed to buy new lands.', opts: [[0, 'Free'], [0.5, 'Cheap'], [1, 'Normal'], [1.5, 'Pricey'], [2.5, 'Steep']], def: 1 },
  { group: 'Economy', id: 'buildCost', label: 'Building cost', desc: 'Materials needed to build. Free = creative mode.', opts: [[0, 'Free (creative)'], [0.5, 'Half'], [1, 'Normal'], [1.5, 'Pricey']], def: 1 },
  { group: 'Economy', id: 'techCost', label: 'Research cost', desc: 'Materials needed for research.', opts: [[0, 'Free'], [0.5, 'Half'], [1, 'Normal'], [2, 'Double']], def: 1 },

  { group: 'Survival', id: 'hunger', label: 'Hunger', desc: 'Eat food to stay energised.', opts: [[0, 'Off'], [1, 'On']], def: 0 },
  { group: 'Survival', id: 'regen', label: 'Health regeneration', desc: 'How fast hearts come back by themselves.', opts: [['fast', 'Fast'], ['normal', 'Normal'], ['none', 'None (use food)']], def: 'normal' },
  { group: 'Survival', id: 'death', label: 'If you faint', desc: 'What happens when your hearts run out.', opts: [['none', 'Nothing lost'], ['coins', 'Lose 10% of coins'], ['drop', 'Drop your pack (gravestone)'], ['hardcore', 'Lose everything unequipped']], def: 'coins' },
  { group: 'Survival', id: 'sleep', label: 'Skipping the night', desc: 'Who must be in bed to skip the night.', opts: [['any', 'Either of you'], ['all', 'Both of you']], def: 'all' },
];

export const DEFAULTS = Object.fromEntries(OPTIONS.map((o) => [o.id, o.def]));

export const PRESETS = [
  { id: 'dreamy', name: 'Dreamy Builder', emoji: 'heart', blurb: 'No monsters, free building, free research, free land. Pure decorating.', v: { enemyDensity: 0, buildCost: 0, techCost: 0, landPrice: 0, resourceYield: 3, resourceRespawn: 4, xpRate: 3, startKit: 'generous', death: 'none', hunger: 0, nightDanger: 0, regen: 'fast', weather: 1, sleep: 'any' } },
  { id: 'cozy', name: 'Cozy', emoji: 'flower', blurb: 'Relaxed. Few gentle monsters, generous rewards.', v: { enemyDensity: 0.5, enemyDamage: 0.5, resourceYield: 1.5, resourceRespawn: 2, xpRate: 1.5, landPrice: 0.5, buildCost: 0.5, techCost: 0.5, dayLength: 720, hunger: 0, death: 'none', startKit: 'generous', regen: 'fast', nightDanger: 0, sleep: 'any' } },
  { id: 'classic', name: 'Classic', emoji: 'sun', blurb: 'The intended experience.', v: {} },
  { id: 'challenging', name: 'Challenging', emoji: 'sword', blurb: 'Tougher monsters, scarcer resources, hunger on.', v: { enemyDensity: 1.6, enemyDamage: 1.5, enemyHealth: 1.5, aggro: 1.5, resourceYield: 1, landPrice: 1.5, techCost: 1, hunger: 1, death: 'drop', startKit: 'bare', regen: 'normal', nightDanger: 1, bossPower: 1.6 } },
  { id: 'nightmare', name: 'Nightmare', emoji: 'skull', blurb: 'Swarms, brutal hits, and losing it all. Good luck!', v: { enemyDensity: 2.4, enemyDamage: 2.5, enemyHealth: 2.5, aggro: 1.5, resourceYield: 0.75, resourceRespawn: 0.5, landPrice: 2.5, buildCost: 1.5, techCost: 2, hunger: 1, death: 'hardcore', startKit: 'bare', regen: 'none', nightDanger: 2, bossPower: 1.6, xpRate: 0.75 } },
];

export function presetSettings(id) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[2];
  return { ...DEFAULTS, ...p.v };
}

/** Clamp/sanitise settings coming from saves or the network */
export function sanitizeSettings(s) {
  const out = { ...DEFAULTS };
  for (const o of OPTIONS) {
    if (s && o.id in s && o.opts.some((x) => x[0] === s[o.id])) out[o.id] = s[o.id];
  }
  return out;
}

export const START_KITS = {
  bare: { pickaxe_wood: 1 },
  standard: { pickaxe_wood: 1, sword_wood: 1, berries: 6, wood: 10 },
  generous: { pickaxe_stone: 1, sword_stone: 1, berries: 12, wood: 60, stone: 40, fiber: 30, plank: 20, rope: 6 },
};
