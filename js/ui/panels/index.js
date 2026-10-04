import { inventoryPanel } from './inventory.js';
import { craftPanel } from './craft.js';
import { buildPanel } from './build.js';
import { techPanel, skillsPanel } from './tech.js';
import { mapPanel } from './map.js';
import { chestPanel, processorPanel, marketPanel, warpPanel, landBuyPanel } from './stations.js';
import { pausePanel, settingsPanel, helpPanel, rulesPanel, emotePanel, deadPanel } from './menus.js';
import { mpPanel } from './mp.js';

export const PANELS = {
  inventory: inventoryPanel,
  craft: craftPanel,
  station: (g, d, ui) => craftPanel(g, { ...d, station: d.station }, ui),
  build: buildPanel,
  tech: techPanel,
  research: (g, d, ui) => techPanel(g, d, ui),
  skills: skillsPanel,
  map: mapPanel,
  chest: chestPanel,
  processor: processorPanel,
  market: marketPanel,
  warp: warpPanel,
  landbuy: landBuyPanel,
  pause: pausePanel,
  settings: settingsPanel,
  help: helpPanel,
  rules: rulesPanel,
  emote: emotePanel,
  dead: deadPanel,
  mp: mpPanel,
};
