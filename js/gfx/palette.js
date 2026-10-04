// Master palette. Warm, saturated, soft-shaded: the "cozy" look. Everything else derives from these via ramp().
import { hex, ramp, darker, lighter, mixC } from './pixmap.js';

export const P = {
  ink: hex('#2a1f3d'),
  white: hex('#ffffff'),
  cream: hex('#fff6dc'),
  black: hex('#1a1226'),
  // skin tones
  skin: [hex('#ffdcc0'), hex('#f6c39a'), hex('#d9966a'), hex('#a8683f'), hex('#6e4126')],
  // accents
  pink: hex('#ff8fb3'), rose: hex('#ff5f8a'), red: hex('#f2545b'), orange: hex('#ff9a3c'), yellow: hex('#ffd84a'),
  lime: hex('#a8e05f'), green: hex('#5fc15a'), teal: hex('#4fd1b5'), sky: hex('#5cc7ff'), blue: hex('#4f8cff'),
  indigo: hex('#6a5cff'), purple: hex('#a77bff'), lilac: hex('#d4b8ff'), brown: hex('#a9703e'),
};

// base colors for materials (each becomes a 5-tone ramp: [hi2, hi, base, lo, lo2])
const base = {
  wood: '#c68a52', darkwood: '#8a5a38', birch: '#e8d4aa', stone: '#aab0c4', brick: '#d4684f', plaster: '#f3e9d6',
  copper: '#e8894a', iron: '#b9c2d4', gold: '#ffcf45', crystal: '#9be8ff', obsidian: '#5a4a7a', star: '#ffe9a0',
  cloth: '#f4a6c0', leaf: '#5fc15a', dirt: '#a8703f', sand: '#f1dc9a', snow: '#f4f8ff', coal: '#4a4660', glass: '#bfeaff',
  bone: '#f1ead7', slime: '#7ee27a', ice: '#c9ecff', marble: '#f1eef7', bamboo: '#b4d36a', candy: '#ff9ccd',
};
export const M = {};
for (const k of Object.keys(base)) M[k] = ramp(hex(base[k]));

export const GROUND = {
  grass: { base: '#6cc24e', lo: '#58ab42', hi: '#86d960', tuft: '#a3ec78', edge: '#2e7a3b', dirt: '#a8703f' },
  sand: { base: '#f1dc9a', lo: '#e6c985', hi: '#fbefc2', tuft: '#d9b867', edge: '#a7843a', dirt: '#c79a58' },
  snow: { base: '#f2f7ff', lo: '#dce8f8', hi: '#ffffff', tuft: '#c4d9f2', edge: '#7a9bc4', dirt: '#9aa8c8' },
  swamp: { base: '#4f8f62', lo: '#3f7853', hi: '#66a877', tuft: '#8cc98d', edge: '#244f43', dirt: '#6b5638' },
  grave: { base: '#7f7392', lo: '#6c617f', hi: '#9488a8', tuft: '#a89f6c', edge: '#3b3350', dirt: '#5b4b5a' },
  volcano: { base: '#5d4a53', lo: '#4b3a45', hi: '#74606a', tuft: '#ff7a3d', edge: '#2a1a24', dirt: '#3a2832' },
  crystal: { base: '#cbb8f4', lo: '#b8a3e8', hi: '#e6d9ff', tuft: '#ffb8e0', edge: '#6f56b8', dirt: '#8a74c8' },
  void: { base: '#2b2158', lo: '#221a48', hi: '#3d3080', tuft: '#fffbd0', edge: '#0f0a24', dirt: '#1a1238' },
};
export const WATER = { shallow: '#58c4f4', mid: '#43a8ec', deep: '#3388dc', hi: '#9adcff', glint: '#e8f9ff', foam: '#ffffff' };

export { ramp, darker, lighter, mixC, hex };
