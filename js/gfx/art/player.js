// Procedural chibi character: 16x20 frames for 3 views (down, up, right; left = mirrored) x walk frames.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, INK, A } from '../pixmap.js';
import { P } from '../palette.js';

export const SKIN_TONES = ['#ffdcc0', '#f6c39a', '#e0a878', '#b9784a', '#8a5434', '#5e3a24'];
export const HAIR_COLORS = ['#2a2438', '#6b4a32', '#a85a32', '#e8c068', '#ff8fb3', '#6ba8ff', '#b79cff', '#f4f4f8', '#5fc98a', '#e04a4a'];
export const OUTFIT_COLORS = ['#ff8fb3', '#6ba8ff', '#7ed957', '#ffd84a', '#b79cff', '#ff9a3c', '#5fe0c4', '#f4f4f8', '#e04a4a', '#3a3a58'];
export const HAIR_STYLES = ['Short', 'Long', 'Pigtails', 'Bun', 'Ponytail', 'Bob'];
export const ACCESSORIES = ['None', 'Bow', 'Cat ears', 'Flower crown', 'Straw hat', 'Headband', 'Beanie'];

const EYE = hex('#2a1f3d');
const BLUSH = hex('#ff8fa8');

export const lookKey = (l) => `${l.skin}.${l.hair}.${l.hairColor}.${l.outfit}.${l.accessory}`;

function pick(arr, i) { return arr[((i % arr.length) + arr.length) % arr.length]; }

function pal(look) {
  const skin = ramp(hex(pick(SKIN_TONES, look.skin)));
  const hair = ramp(hex(pick(HAIR_COLORS, look.hairColor)));
  const outfit = ramp(hex(pick(OUTFIT_COLORS, look.outfit)));
  return { skin, hair, outfit };
}

/** frame 0..3 (0 idle, 1/3 steps, 2 idle2). dir 0 down,1 up,2 right. */
export function playerFrame(look, dir, frame, o = {}) {
  const pm = new Pixmap(16, 21);
  const { skin, hair, outfit } = pal(look);
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const hy = 1 + bob; // head offset
  const pants = darker(outfit[3], 0.35), shoe = hex('#5a3a2a');

  const accessoryBehind = () => { /* ponytail & bun drawn per-view */ };

  if (dir === 0) {
    // legs
    pm.rect(5, 17 + (step > 0 ? -1 : 0), 2, 3 + (step > 0 ? 1 : 0) - (step < 0 ? 1 : 0), pants);
    pm.rect(9, 17 + (step < 0 ? -1 : 0), 2, 3 + (step < 0 ? 1 : 0) - (step > 0 ? 1 : 0), pants);
    pm.rect(4, 19 + (step > 0 ? -1 : 0), 3, 2, shoe); pm.rect(9, 19 + (step < 0 ? -1 : 0), 3, 2, shoe);
    // body
    pm.rect(4, 12 + bob, 8, 5, outfit[2]); pm.rect(4, 12 + bob, 1, 5, outfit[1]); pm.rect(11, 12 + bob, 1, 5, outfit[3]);
    pm.rect(4, 16 + bob, 8, 1, outfit[3]);
    pm.rect(7, 12 + bob, 2, 1, lighter(outfit[0], 0.3));
    // arms
    const as = step; // arm swing
    pm.rect(2, 12 + bob + (as > 0 ? 1 : 0), 2, 4, outfit[2]); pm.rect(12, 12 + bob + (as < 0 ? 1 : 0), 2, 4, outfit[3]);
    pm.rect(2, 16 + bob + (as > 0 ? 1 : 0), 2, 1, skin[2]); pm.rect(12, 16 + bob + (as < 0 ? 1 : 0), 2, 1, skin[2]);
    drawHairBack(pm, look, hair, hy, 0);
    // head
    pm.ellipse(8, hy + 6.2, 6, 5.1, skin[2]);
    pm.ellipse(8, hy + 8.4, 5.4, 3.0, skin[2]);
    pm.rect(3, hy + 8, 1, 3, skin[1]); // light edge
    pm.rect(12, hy + 9, 1, 2, skin[3]);
    drawHairFront(pm, look, hair, hy, 0, skin);
    // face
    pm.rect(4, hy + 7, 2, 3, EYE); pm.rect(10, hy + 7, 2, 3, EYE);
    pm.set(4, hy + 7, hex('#ffffff')); pm.set(10, hy + 7, hex('#ffffff'));
    pm.set(5, hy + 9, mixC(EYE, hex('#6a5cff'), 0.4)); pm.set(11, hy + 9, mixC(EYE, hex('#6a5cff'), 0.4));
    pm.set(3, hy + 9, withAlpha(BLUSH, 220)); pm.set(12, hy + 9, withAlpha(BLUSH, 220)); pm.set(3, hy + 10, withAlpha(BLUSH, 140)); pm.set(12, hy + 10, withAlpha(BLUSH, 140));
    pm.set(7, hy + 10, hex('#b8465a')); pm.set(8, hy + 10, hex('#b8465a'));
    drawAccessory(pm, look, hair, outfit, hy, 0);
  } else if (dir === 1) {
    pm.rect(5, 17 + (step < 0 ? -1 : 0), 2, 3 + (step < 0 ? 1 : 0) - (step > 0 ? 1 : 0), pants);
    pm.rect(9, 17 + (step > 0 ? -1 : 0), 2, 3 + (step > 0 ? 1 : 0) - (step < 0 ? 1 : 0), pants);
    pm.rect(4, 19 + (step < 0 ? -1 : 0), 3, 2, shoe); pm.rect(9, 19 + (step > 0 ? -1 : 0), 3, 2, shoe);
    pm.rect(4, 12 + bob, 8, 5, outfit[2]); pm.rect(4, 12 + bob, 1, 5, outfit[1]); pm.rect(11, 12 + bob, 1, 5, outfit[3]); pm.rect(4, 16 + bob, 8, 1, outfit[3]);
    pm.rect(2, 12 + bob + (step < 0 ? 1 : 0), 2, 4, outfit[2]); pm.rect(12, 12 + bob + (step > 0 ? 1 : 0), 2, 4, outfit[3]);
    pm.rect(2, 16 + bob + (step < 0 ? 1 : 0), 2, 1, skin[2]); pm.rect(12, 16 + bob + (step > 0 ? 1 : 0), 2, 1, skin[2]);
    drawHairBack(pm, look, hair, hy, 1);
    pm.ellipse(8, hy + 6.2, 6, 5.1, hair[2]);
    pm.ellipse(8, hy + 8.4, 5.4, 3.0, hair[2]);
    pm.rect(3, hy + 8, 1, 3, hair[1]); pm.rect(12, hy + 9, 1, 2, hair[3]);
    pm.rect(5, hy + 1, 4, 1, hair[1]); pm.rect(6, hy + 3, 1, 3, hair[3]); pm.rect(9, hy + 4, 2, 1, hair[3]); pm.rect(5, hy + 10, 6, 1, hair[3]);
    pm.rect(6, hy + 11, 4, 1, skin[2]); // neck
    drawAccessory(pm, look, hair, outfit, hy, 1);
  } else {
    // right-facing
    const lf = step > 0 ? 1 : step < 0 ? -1 : 0;
    // legs: one forward one back
    pm.rect(6 + lf, 17, 2, 2, pants); pm.rect(8 - lf, 17, 2, 2, darker(pants, 0.15));
    pm.rect(5 + lf, 19, 3, 2, shoe); pm.rect(8 - lf, 19, 3, 2, darker(shoe, 0.2));
    pm.rect(5, 12 + bob, 6, 5, outfit[2]); pm.rect(5, 12 + bob, 1, 5, outfit[1]); pm.rect(10, 12 + bob, 1, 5, outfit[3]); pm.rect(5, 16 + bob, 6, 1, outfit[3]);
    // far arm (behind), near arm swing
    drawHairBack(pm, look, hair, hy, 2);
    pm.ellipse(8.4, hy + 6.2, 5.9, 5.1, skin[2]);
    pm.ellipse(9, hy + 8.4, 5.2, 3.0, skin[2]);
    pm.rect(13, hy + 8, 1, 3, skin[3]);
    drawHairFront(pm, look, hair, hy, 2, skin);
    pm.rect(10, hy + 7, 2, 3, EYE); pm.set(10, hy + 7, hex('#ffffff')); pm.set(11, hy + 9, mixC(EYE, hex('#6a5cff'), 0.4));
    pm.set(9, hy + 9, withAlpha(BLUSH, 220)); pm.set(9, hy + 10, withAlpha(BLUSH, 140));
    pm.set(12, hy + 10, hex('#b8465a'));
    pm.set(13, hy + 8, skin[3]);
    // near arm in front of the body
    const ay = 12 + bob + (lf > 0 ? 0 : lf < 0 ? 1 : 0);
    pm.rect(6, ay, 3, 4, outfit[1]); pm.rect(6, ay + 3, 3, 1, outfit[3]); pm.rect(8, ay + 4, 2, 1, skin[2]);
    drawAccessory(pm, look, hair, outfit, hy, 2);
  }
  pm.outline(null, { amt: 0.68 });
  // soft contact shadow under the feet
  const sh = withAlpha(hex('#1e1440'), 70);
  for (let x = 3; x < 13; x++) pm.under(x, 20, sh);
  return pm;
}

function drawHairBack(pm, look, hair, hy, dir) {
  const st = look.hair;
  if (st === 1) { // long: falls behind shoulders
    pm.rect(2, hy + 8, 3, 7, hair[2]); pm.rect(11, hy + 8, 3, 7, hair[3]);
    if (dir === 1) pm.rect(4, hy + 9, 8, 6, hair[2]);
    if (dir === 2) { pm.rect(1, hy + 8, 6, 8, hair[2]); pm.rect(1, hy + 14, 6, 2, hair[3]); }
  } else if (st === 2) { // pigtails
    if (dir !== 2) { pm.ellipse(2.5, hy + 11, 2.2, 3.4, hair[2]); pm.ellipse(13.5, hy + 11, 2.2, 3.4, hair[3]); }
    else pm.ellipse(3.5, hy + 11, 2.4, 3.6, hair[2]);
  } else if (st === 3) { // bun
    pm.ellipse(8, hy - 0.5, 3, 2.6, hair[2]); pm.set(7, hy - 1, hair[0]); pm.set(8, hy - 2, hair[1]);
  } else if (st === 4) { // ponytail
    if (dir === 2) { pm.ellipse(2.5, hy + 8, 2.2, 4.2, hair[2]); pm.rect(1, hy + 10, 2, 3, hair[3]); }
    else if (dir === 1) { pm.ellipse(8, hy + 12, 2.4, 4, hair[2]); pm.rect(7, hy + 13, 2, 3, hair[3]); }
    else { pm.ellipse(13.5, hy + 8.5, 2, 3.6, hair[3]); }
  } else if (st === 5) { // bob
    pm.rect(2, hy + 7, 3, 5, hair[2]); pm.rect(11, hy + 7, 3, 5, hair[3]);
    if (dir === 2) pm.rect(2, hy + 7, 6, 5, hair[2]);
  }
}
function drawHairFront(pm, look, hair, hy, dir, skin) {
  const st = look.hair;
  // top cap
  pm.ellipse(8, hy + 4.4, 6.3, 3.9, hair[2]);
  pm.rect(2, hy + 4, 2, 5, hair[2]); pm.rect(12, hy + 4, 2, 5, hair[3]);
  if (dir === 2) { pm.rect(2, hy + 3, 5, 8, hair[2]); pm.ellipse(7.5, hy + 4.4, 6, 3.8, hair[2]); }
  // highlights
  pm.rect(4, hy + 1, 3, 1, hair[0]); pm.set(3, hy + 2, hair[1]); pm.rect(5, hy + 2, 2, 1, hair[1]);
  // bangs
  if (dir === 0) {
    pm.rect(3, hy + 5, 10, 1, hair[2]);
    for (const [x, y] of [[4, 6], [5, 6], [6, 6], [10, 6], [11, 6], [7, 6]]) pm.set(x, hy + y, hair[2]);
    pm.set(8, hy + 6, skin[2]); pm.set(9, hy + 6, hair[3]);
    pm.set(3, hy + 6, hair[2]); pm.set(12, hy + 6, hair[3]);
    pm.rect(4, hy + 5, 8, 1, hair[3]);
    pm.hline(4, hy + 5, 3, hair[2]);
  } else if (dir === 2) {
    pm.rect(6, hy + 5, 6, 1, hair[2]); pm.rect(7, hy + 6, 4, 1, hair[2]); pm.rect(10, hy + 6, 2, 1, hair[3]);
  }
  if (st === 0) { pm.set(8, hy - 1, hair[2]); pm.set(9, hy - 1, hair[1]); pm.set(9, hy, hair[2]); } // tuft
}
function drawAccessory(pm, look, hair, outfit, hy, dir) {
  const a = look.accessory;
  if (a === 1) { // bow
    const b = ramp(hex('#ff6f9a'));
    const x = dir === 2 ? 4 : 11, y = hy + 1;
    pm.rect(x, y, 2, 3, b[2]); pm.rect(x + 3, y, 2, 3, b[2]); pm.rect(x + 2, y + 1, 1, 1, b[4]); pm.set(x, y, b[1]); pm.set(x + 3, y, b[1]);
    pm.set(x + 1, y + 2, b[3]); pm.set(x + 4, y + 2, b[3]);
  } else if (a === 2) { // cat ears
    const c = hair, inner = hex('#ffb3c8');
    for (const x0 of [3, 10]) { pm.set(x0, hy, c[2]); pm.set(x0 + 1, hy, c[2]); pm.set(x0 + 2, hy, c[2]); pm.set(x0, hy - 1, c[2]); pm.set(x0 + 1, hy - 1, c[1]); pm.set(x0, hy - 2, c[2]); if (dir === 0) pm.set(x0 + 1, hy, inner); }
  } else if (a === 3) { // flower crown
    const cols = [hex('#ff8fb3'), hex('#ffe066'), hex('#ffffff'), hex('#8fb8ff')];
    for (let i = 0; i < 6; i++) { const x = 3 + i * 2 - (dir === 2 ? 1 : 0), y = hy + 2 + (i === 0 || i === 5 ? 2 : i === 1 || i === 4 ? 1 : 0); pm.set(x, y, cols[i % 4]); pm.set(x + 1, y, mixC(cols[i % 4], hex('#3f9a45'), 0.5)); }
  } else if (a === 4) { // straw hat
    const h = ramp(hex('#e8c068'));
    pm.ellipse(8, hy + 3.4, 8, 2.3, h[2]); pm.ellipse(8, hy + 2, 4.8, 2.8, h[1]); pm.rect(4, hy + 3, 8, 1, hex('#ff6f9a')); pm.hline(1, hy + 4, 14, h[3]);
    pm.set(6, hy, h[0]); pm.set(7, hy, h[0]);
  } else if (a === 5) { // headband
    const b = hex('#ff6f9a');
    pm.rect(2, hy + 4, 12, 1, b); pm.rect(2, hy + 5, 12, 1, darker(b, 0.25));
    if (dir === 0) { pm.set(4, hy + 3, b); pm.set(5, hy + 2, b); }
  } else if (a === 6) { // beanie
    const b = ramp(outfit[2]);
    pm.ellipse(8, hy + 2.6, 6.4, 3.4, b[2]); pm.rect(2, hy + 4, 12, 2, b[3]); pm.rect(2, hy + 4, 12, 1, b[1]);
    pm.circle(8.5, hy - 1, 1.8, b[0]); pm.set(8, hy - 2, hex('#ffffff'));
  }
}

/** sleeping head peeking out of a blanket (12x9) */
export function playerSleep(look) {
  const { skin, hair, outfit } = pal(look);
  const pm = new Pixmap(14, 12);
  pm.rect(1, 5, 12, 6, outfit[2]); pm.rect(1, 5, 12, 1, outfit[1]); pm.rect(1, 10, 12, 1, outfit[3]);
  pm.ellipse(7, 4.2, 4.6, 3.6, skin[2]);
  pm.ellipse(7, 2.6, 5, 2.6, hair[2]);
  pm.rect(4, 5, 2, 1, EYE); pm.rect(8, 5, 2, 1, EYE);
  pm.set(3, 6, withAlpha(BLUSH, 200)); pm.set(10, 6, withAlpha(BLUSH, 200));
  pm.outline(null, { amt: 0.65 });
  return pm;
}

/** 24x24 portrait for menus (front, idle) */
export function playerPortrait(look) { return playerFrame(look, 0, 0); }

export function registerPlayerBits(book) {
  // emotes
  const mk = (name, fn) => { const pm = new Pixmap(12, 12); fn(pm); pm.outline(null, { amt: 0.6 }); book.add(name, pm); };
  mk('emote_heart', (pm) => { const c = ramp(hex('#ff5f8a')); pm.circle(4, 4, 2.6, c[2]); pm.circle(8, 4, 2.6, c[2]); pm.poly([[1.5, 5], [10.5, 5], [6, 10.5]], c[2]); pm.set(3, 3, c[0]); pm.set(4, 3, c[1]); });
  mk('emote_bang', (pm) => { const c = ramp(hex('#ffd84a')); pm.rect(5, 1, 3, 6, c[2]); pm.rect(5, 8, 3, 2, c[2]); pm.set(5, 1, c[0]); pm.rect(7, 2, 1, 5, c[3]); });
  mk('emote_ask', (pm) => { const c = ramp(hex('#5cc7ff')); pm.rect(4, 1, 4, 2, c[2]); pm.rect(7, 3, 2, 3, c[2]); pm.rect(5, 5, 3, 2, c[2]); pm.rect(5, 8, 2, 2, c[2]); pm.set(4, 1, c[0]); });
  mk('emote_note', (pm) => { const c = ramp(hex('#a77bff')); pm.rect(7, 1, 2, 7, c[2]); pm.circle(5, 8, 2, c[2]); pm.rect(7, 1, 4, 2, c[1]); pm.set(4, 7, c[0]); });
  mk('emote_star', (pm) => { const c = ramp(hex('#ffd84a')); pm.poly([[6, 0.5], [7.5, 4.3], [11.5, 4.5], [8.3, 7], [9.5, 11], [6, 8.7], [2.5, 11], [3.7, 7], [0.5, 4.5], [4.5, 4.3]], c[2]); pm.set(5, 4, c[0]); });
  mk('emote_sweat', (pm) => { const c = ramp(hex('#8fd8ff')); pm.poly([[6, 1], [9, 6], [9, 8.5], [6, 11], [3, 8.5], [3, 6]], c[2]); pm.set(5, 6, c[0]); pm.set(5, 7, c[0]); });
  mk('emote_happy', (pm) => { const c = ramp(hex('#ffd84a')); pm.circle(6, 6, 5, c[2]); pm.rect(3, 4, 1, 2, EYE); pm.rect(8, 4, 1, 2, EYE); pm.hline(4, 8, 4, EYE); pm.set(3, 7, EYE); pm.set(8, 7, EYE); });
  mk('emote_zzz', (pm) => { const c = hex('#8fb8ff'); pm.hline(2, 2, 4, c); pm.set(5, 3, c); pm.set(4, 4, c); pm.hline(2, 5, 4, c); pm.hline(6, 6, 3, c); pm.set(8, 7, c); pm.set(7, 8, c); pm.hline(6, 9, 3, c); });
}
