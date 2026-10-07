// Creature sprites. Names: m_<id>_<frame>. Frames: slimes 0 idle,1 squash,2 stretch; walkers 0..3; flyers 0..1.
import { Pixmap, hex, ramp, darker, lighter, mixC, withAlpha, ballShade, INK, A } from '../pixmap.js';
import { RNG } from '../../util.js';
import { groundShadow } from './nodes.js';

const EYE = hex('#2a1f3d');
const WHITE = hex('#ffffff');

function eyes(pm, x, y, gap, size = 2, color = EYE) {
  for (const ex of [x, x + gap]) { pm.rect(ex, y, size, size + 1, color); pm.set(ex, y, WHITE); }
}

// ------------------------------------------------------------------ slimes
function slime(base, o = {}) {
  const frames = [];
  const w = o.w || 16, h = o.h || 14;
  for (let f = 0; f < 3; f++) {
    const pm = new Pixmap(w, h);
    const pal = ramp(hex(base));
    const sq = f === 1 ? 1 : f === 2 ? -1 : 0;
    const rx = (o.rx || 6.4) + sq * 1.2, ry = (o.ry || 5) - sq * 1.2;
    const cy = h - 2 - ry;
    ballShade(pm, w / 2, cy, rx, ry, pal, { dither: 0.1 });
    pm.ellipse(w / 2 - rx * 0.35, cy - ry * 0.45, rx * 0.28, ry * 0.2, withAlpha(WHITE, 190));
    // face
    const ey = Math.round(cy - 0.5), ex = Math.round(w / 2 - 3.2);
    if (o.angry) { eyes(pm, ex, ey, 4); pm.set(ex, ey - 1, EYE); pm.set(ex + 1, ey - 1, EYE); pm.set(ex + 4, ey - 1, EYE); pm.set(ex + 5, ey - 1, EYE); }
    else eyes(pm, ex, ey, 4);
    pm.hline(Math.round(w / 2 - 1), ey + 3, 2, hex('#7a2a4a'));
    if (o.decor) o.decor(pm, w, h, cy, rx, ry, pal);
    pm.outline(null, { amt: 0.68 });
    groundShadow(pm, w / 2, h - 0.8, rx * 0.95, 1.3, 70);
    frames.push(pm);
  }
  return frames;
}

// ------------------------------------------------------------------ flyers
function bat(base, eye = '#ff5a6a') {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(16, 12);
    const pal = ramp(hex(base));
    const up = f === 0;
    // wings
    const wing = (sx) => {
      for (let i = 0; i < 6; i++) {
        const x = 8 + sx * (2 + i), top = up ? 2 + Math.abs(i - 2) * 0.5 : 5 + i * 0.3, bot = up ? 6 + (i > 3 ? 1 : 0) : 9;
        pm.vline(x, Math.round(top), Math.round(bot - top) + 1, i < 3 ? pal[2] : pal[3]);
        if (i > 1 && i % 2 === 1) pm.set(x, Math.round(bot) + 1, pal[3]);
      }
    };
    wing(-1); wing(1);
    ballShade(pm, 8, 7, 3.4, 3.2, pal, { dither: 0 });
    pm.set(6, 3, pal[2]); pm.set(10, 3, pal[2]); pm.set(6, 4, pal[1]); pm.set(10, 4, pal[1]); // ears
    pm.rect(6, 6, 1, 2, hex(eye)); pm.rect(9, 6, 1, 2, hex(eye)); pm.set(6, 6, WHITE); pm.set(9, 6, WHITE);
    pm.set(7, 9, WHITE); pm.set(9, 9, WHITE);
    pm.outline(null, { amt: 0.7 });
    frames.push(pm);
  }
  return frames;
}
function ghost() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(16, 18);
    const pal = ramp(hex('#e8eeff'));
    pm.ellipse(8, 7, 6, 6, pal[1]);
    pm.rect(2, 7, 12, 8, pal[1]);
    for (let x = 2; x < 14; x++) { const wave = Math.round(Math.sin((x + f * 3) * 0.9) * 1.2); pm.set(x, 15 + wave, pal[1]); pm.set(x, 16 + wave, x % 3 === 0 ? pal[2] : 0); }
    pm.rect(11, 5, 3, 10, pal[2]); pm.rect(12, 8, 2, 7, pal[3]);
    pm.rect(4, 4, 3, 1, pal[0]); pm.rect(3, 5, 1, 2, pal[0]);
    pm.rect(4, 7, 2, 3, EYE); pm.rect(9, 7, 2, 3, EYE); pm.set(4, 7, WHITE); pm.set(9, 7, WHITE);
    pm.rect(7, 11, 2, 2, hex('#6a5ca0'));
    pm.set(3, 10, withAlpha(hex('#ff8fa8'), 200)); pm.set(12, 10, withAlpha(hex('#ff8fa8'), 200));
    pm.outline(hex('#6a6aa8'), { amt: 0.6 });
    // translucency
    for (let i = 0; i < pm.d.length; i++) if (A(pm.d[i])) pm.d[i] = withAlpha(pm.d[i], 225);
    frames.push(pm);
  }
  return frames;
}
function wisp(color, core) {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(16, 16);
    const pal = ramp(hex(color));
    const sway = f ? 1 : -1;
    pm.poly([[8 + sway, 15], [4, 8], [12, 8]], pal[3]);
    ballShade(pm, 8, 7, 5, 5, pal, { dither: 0.1 });
    pm.circle(8, 7, 2.2, hex(core));
    pm.rect(6, 6, 1, 2, EYE); pm.rect(9, 6, 1, 2, EYE);
    for (const [x, y] of [[2, 3], [13, 4], [3, 11], [13, 12]]) pm.set(x + (f ? 1 : 0), y, hex(core));
    pm.outline(null, { amt: 0.6 });
    frames.push(pm);
  }
  return frames;
}

// ------------------------------------------------------------------ walkers
function beetle(base, o = {}) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(16, 12);
    const pal = ramp(hex(base));
    const lg = f % 2 ? 1 : 0;
    for (const x of [4, 7, 10]) { pm.set(x + lg, 10, EYE); pm.set(x - 1 + lg, 9, EYE); pm.set(x + 2 - lg, 10, EYE); }
    ballShade(pm, 8, 6.5, 6, 4, pal, { dither: 0.1 });
    pm.hline(8, 3, 6, pal[3]); pm.vline(8, 3, 7, pal[4]);
    if (o.gem) { pm.set(5, 5, hex(o.gem)); pm.set(11, 5, hex(o.gem)); }
    pm.rect(3, 6, 2, 2, hex('#ffffff')); pm.set(3, 7, EYE); pm.set(4, 7, EYE); pm.set(3, 6, EYE);
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 8, 11, 6, 1.2, 60);
    frames.push(pm);
  }
  return frames;
}
function scorpion() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(18, 14);
    const pal = ramp(hex('#e0a050'));
    const lg = f % 2;
    for (const x of [5, 8, 11]) { pm.set(x + lg, 12, EYE); pm.set(x - 1 + lg, 11, EYE); }
    ballShade(pm, 8, 8.5, 5.6, 3.6, pal, { dither: 0.1 });
    // tail curling over
    for (const [x, y] of [[13, 8], [14, 6], [14, 4], [13, 2], [11, 1]]) { pm.rect(x, y, 2, 2, pal[2]); pm.set(x, y, pal[1]); }
    pm.set(10, 1, hex('#ff5a6a')); pm.set(10, 2, hex('#ff5a6a'));
    // claws
    pm.rect(1, 5 + lg, 3, 3, pal[2]); pm.set(1, 5 + lg, pal[1]); pm.set(2, 4 + lg, pal[3]);
    pm.rect(4, 6, 1, 1, EYE); pm.rect(7, 6, 1, 1, EYE);
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 9, 13, 7, 1.2, 60);
    frames.push(pm);
  }
  return frames;
}
function skeleton() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(16, 20);
    const b = ramp(hex('#f1ead7'));
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(5, 15, 2, 4 + (step > 0 ? -1 : 0), b[2]); pm.rect(9, 15, 2, 4 + (step < 0 ? -1 : 0), b[3]);
    pm.rect(4, 19, 3, 1, b[3]); pm.rect(9, 19, 3, 1, b[3]);
    pm.rect(5, 9 + bob, 6, 6, b[2]); for (let y = 10; y < 14; y += 2) pm.hline(5, y + bob, 6, b[4]);
    pm.vline(8, 9 + bob, 6, b[3]);
    pm.rect(3, 9 + bob, 2, 5, b[2]); pm.rect(11, 9 + bob, 2, 5, b[3]);
    ballShade(pm, 8, 5 + bob, 5.2, 4.6, b, { dither: 0 });
    pm.rect(4, 4 + bob, 3, 3, EYE); pm.rect(9, 4 + bob, 3, 3, EYE); pm.set(5, 5 + bob, hex('#ff6a8a')); pm.set(10, 5 + bob, hex('#ff6a8a'));
    pm.rect(6, 8 + bob, 4, 1, EYE); for (const x of [6, 8, 9]) pm.set(x, 8 + bob, b[1]);
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 8, 19.5, 6, 1.2, 60);
    frames.push(pm);
  }
  return frames;
}
function frog() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const pm = new Pixmap(14, 12);
    const pal = ramp(hex('#6fbf5a'));
    const sq = f === 1 ? 1 : 0;
    ballShade(pm, 7, 7.5 + sq, 5.2, 3.6 - sq * 0.5, pal, { dither: 0.1 });
    pm.circle(3.5, 3.5, 1.9, pal[2]); pm.circle(10.5, 3.5, 1.9, pal[2]);
    pm.rect(3, 3, 1, 2, EYE); pm.rect(10, 3, 1, 2, EYE); pm.set(3, 3, WHITE); pm.set(10, 3, WHITE);
    pm.hline(5, 8 + sq, 4, hex('#3a6a3a')); pm.rect(5, 10, 2, 1, pal[3]); pm.rect(8, 10, 2, 1, pal[3]);
    pm.set(3, 7, withAlpha(hex('#ff8fa8'), 200)); pm.set(11, 7, withAlpha(hex('#ff8fa8'), 200));
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 7, 11, 5, 1, 60);
    frames.push(pm);
  }
  return frames;
}
function mushroomWalker() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(16, 18);
    const cap = ramp(hex('#e0508a')), st = ramp(hex('#f4ecd8'));
    const bob = f % 2 ? -1 : 0, lg = f === 1 ? 1 : f === 3 ? -1 : 0;
    pm.rect(5 + lg, 15, 2, 3, st[3]); pm.rect(9 - lg, 15, 2, 3, st[3]);
    pm.rect(5, 9 + bob, 6, 6, st[2]); pm.rect(5, 9 + bob, 1, 6, st[1]); pm.rect(10, 9 + bob, 1, 6, st[3]);
    ballShade(pm, 8, 6 + bob, 7, 5, cap, { dither: 0.1 });
    for (const [x, y] of [[4, 4], [8, 3], [11, 5], [6, 7]]) { pm.rect(x, y + bob, 2, 2, hex('#ffffff')); pm.set(x, y + bob + 1, hex('#e8d8e0')); }
    pm.rect(6, 10 + bob, 1, 2, EYE); pm.rect(9, 10 + bob, 1, 2, EYE); pm.set(6, 10 + bob, WHITE); pm.set(9, 10 + bob, WHITE);
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 8, 17.5, 6, 1.2, 60);
    frames.push(pm);
  }
  return frames;
}
function fireImp() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(16, 18);
    const pal = ramp(hex('#e2503a'));
    const bob = f ? -1 : 0;
    // flame tail
    pm.poly([[12, 14], [15, 10 + f], [14, 15], [12, 16]], hex('#ffb347')); pm.set(14, 11 + f, hex('#ffe066'));
    pm.rect(5, 15, 2, 3, pal[3]); pm.rect(9, 15, 2, 3, pal[3]);
    pm.rect(4, 8 + bob, 8, 7, pal[2]); pm.rect(4, 8 + bob, 1, 7, pal[1]); pm.rect(11, 8 + bob, 1, 7, pal[3]);
    pm.rect(2, 9 + bob, 2, 4, pal[2]); pm.rect(12, 9 + bob, 2, 4, pal[3]);
    ballShade(pm, 8, 6 + bob, 5.6, 4.6, pal, { dither: 0.1 });
    pm.poly([[3, 3 + bob], [4, 0 + bob], [6, 2 + bob]], pal[3]); pm.poly([[13, 3 + bob], [12, 0 + bob], [10, 2 + bob]], pal[3]);
    pm.rect(5, 5 + bob, 2, 2, hex('#ffe066')); pm.rect(9, 5 + bob, 2, 2, hex('#ffe066')); pm.set(6, 6 + bob, EYE); pm.set(10, 6 + bob, EYE);
    pm.hline(6, 9 + bob, 4, EYE); pm.set(6, 10 + bob, WHITE); pm.set(9, 10 + bob, WHITE);
    pm.outline(null, { amt: 0.7 });
    frames.push(pm);
  }
  return frames;
}
function crystalGolem() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(22, 24);
    const pal = ramp(hex('#b49af0')), pink = ramp(hex('#ff9fd0')), teal = ramp(hex('#8fe8d8'));
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(5, 18 - (step > 0 ? 1 : 0), 4, 6, pal[3]); pm.rect(13, 18 - (step < 0 ? 1 : 0), 4, 6, pal[3]);
    ballShade(pm, 11, 13 + bob, 8, 6.5, pal, { dither: 0.1 });
    ballShade(pm, 11, 5 + bob, 4.6, 4.2, pal, { dither: 0.1 });
    pm.rect(1, 9 + bob, 4, 8, pal[2]); pm.rect(17, 9 + bob, 4, 8, pal[3]);
    const prism = (x, y, w, h, p) => { for (let j = 0; j < h; j++) { const hw = Math.max(0, Math.round(w / 2 * (1 - j / h))); for (let i = -hw; i <= hw; i++) pm.set(x + i, y - j, i < 0 ? p[1] : i > 0 ? p[3] : p[2]); } };
    prism(5, 9 + bob, 4, 7, pink); prism(17, 9 + bob, 4, 6, teal); prism(11, 3 + bob, 3, 5, pink); prism(14, 13 + bob, 3, 5, teal);
    pm.rect(8, 5 + bob, 2, 2, hex('#ffffff')); pm.rect(12, 5 + bob, 2, 2, hex('#ffffff')); pm.set(9, 6 + bob, EYE); pm.set(13, 6 + bob, EYE);
    pm.outline(null, { amt: 0.6 });
    groundShadow(pm, 11, 23, 9, 1.4, 60);
    frames.push(pm);
  }
  return frames;
}
function shadowKnight() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(18, 24);
    const pal = ramp(hex('#4a3a7a')), glow = hex('#b79cff');
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(5, 17 - (step > 0 ? 1 : 0), 3, 7, pal[3]); pm.rect(10, 17 - (step < 0 ? 1 : 0), 3, 7, pal[3]);
    pm.rect(4, 9 + bob, 10, 9, pal[2]); pm.rect(4, 9 + bob, 1, 9, pal[1]); pm.rect(13, 9 + bob, 1, 9, pal[3]); pm.rect(4, 17 + bob, 10, 1, pal[4]);
    pm.rect(1, 9 + bob, 3, 8, pal[2]); pm.rect(14, 9 + bob, 3, 8, pal[3]);
    pm.circle(2.5, 9 + bob, 2.4, pal[1]); pm.circle(15.5, 9 + bob, 2.4, pal[2]);
    ballShade(pm, 9, 5 + bob, 4.8, 4.6, pal, { dither: 0 });
    pm.rect(6, 5 + bob, 6, 2, hex('#14102a')); pm.set(7, 5 + bob, glow); pm.set(10, 5 + bob, glow); pm.set(7, 6 + bob, glow); pm.set(10, 6 + bob, glow);
    pm.poly([[9, 0 + bob], [11, 3 + bob], [7, 3 + bob]], pal[1]); // crest
    pm.rect(8, 11 + bob, 2, 4, glow);
    pm.outline(null, { amt: 0.75 });
    groundShadow(pm, 9, 23, 7, 1.3, 70);
    frames.push(pm);
  }
  return frames;
}

// ------------------------------------------------------------------ passive critters
function bunny(base, ear) {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const pm = new Pixmap(14, 14);
    const pal = ramp(hex(base));
    const hop = f === 1 ? -2 : 0;
    ballShade(pm, 7, 10 + hop, 4.8, 3.6, pal, { dither: 0 });
    ballShade(pm, 8.5, 7 + hop, 3.2, 3, pal, { dither: 0 });
    pm.rect(6, 1 + hop, 2, 5, pal[2]); pm.rect(9, 1 + hop, 2, 5, pal[2]); pm.rect(7, 2 + hop, 1, 3, hex(ear)); pm.rect(10, 2 + hop, 1, 3, hex(ear)); pm.set(6, 1 + hop, pal[1]);
    pm.set(10, 7 + hop, EYE); pm.set(10, 6 + hop, EYE); pm.set(12, 8 + hop, hex('#ff8fa8'));
    pm.circle(2.5, 10 + hop, 1.4, hex('#ffffff'));
    pm.outline(null, { amt: 0.65 });
    groundShadow(pm, 7, 13, 5, 1.1, 60);
    frames.push(pm);
  }
  return frames;
}
function chick() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(12, 12);
    const pal = ramp(hex('#ffe066'));
    const bob = f ? -1 : 0;
    ballShade(pm, 6, 7 + bob, 4.6, 4.2, pal, { dither: 0 });
    pm.set(4, 6 + bob, EYE); pm.set(8, 6 + bob, EYE);
    pm.rect(5, 8 + bob, 2, 1, hex('#ff9a3c'));
    pm.set(5, 0 + bob + 2, pal[2]); pm.set(6, 1 + bob + 1, pal[1]);
    pm.set(3, 9 + bob, pal[3]); pm.rect(5, 11, 1, 1, hex('#ff9a3c')); pm.rect(8, 11, 1, 1, hex('#ff9a3c'));
    pm.outline(null, { amt: 0.65 });
    frames.push(pm);
  }
  return frames;
}
function duck() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(14, 12);
    const pal = ramp(hex('#ffe9a0'));
    const bob = f ? -1 : 0;
    ballShade(pm, 6, 8 + bob, 5, 3.4, pal, { dither: 0 });
    ballShade(pm, 9.5, 4.5 + bob, 3, 3, pal, { dither: 0 });
    pm.rect(11, 5 + bob, 3, 2, hex('#ff9a3c')); pm.set(10, 4 + bob, EYE);
    pm.set(3, 7 + bob, pal[3]); pm.set(4, 8 + bob, pal[3]);
    pm.outline(null, { amt: 0.65 });
    groundShadow(pm, 7, 11, 5, 1, 55);
    frames.push(pm);
  }
  return frames;
}
function penguin() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(14, 16);
    const bob = f ? -1 : 0;
    ballShade(pm, 7, 9 + bob, 4.8, 5.4, ramp(hex('#3a4a78')), { dither: 0 });
    pm.ellipse(7.5, 10 + bob, 3, 4, hex('#ffffff'));
    ballShade(pm, 7, 4.5 + bob, 3.6, 3.4, ramp(hex('#3a4a78')), { dither: 0 });
    pm.set(5, 4 + bob, WHITE); pm.set(9, 4 + bob, WHITE); pm.set(5, 5 + bob, EYE); pm.set(9, 5 + bob, EYE);
    pm.rect(6, 6 + bob, 3, 1, hex('#ff9a3c'));
    pm.rect(5, 15, 2, 1, hex('#ff9a3c')); pm.rect(8, 15, 2, 1, hex('#ff9a3c'));
    pm.rect(2, 8 + bob, 1, 4, hex('#2a3a68')); pm.rect(12, 8 + bob, 1, 4, hex('#2a3a68'));
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 7, 15.5, 5, 1, 55);
    frames.push(pm);
  }
  return frames;
}
function lizard() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(16, 9);
    const pal = ramp(hex('#8fd45a'));
    ballShade(pm, 8, 5, 5, 2.8, pal, { dither: 0 });
    ballShade(pm, 13, 4.5, 2.4, 2, pal, { dither: 0 });
    for (let i = 0; i < 5; i++) pm.set(1 + i, 6 - Math.floor(i / 2) + (f ? 0 : 0), pal[2]);
    pm.set(13, 3, EYE); pm.set(15, 5, hex('#ff6a8a'));
    for (const x of [5, 10]) pm.set(x + f, 8, pal[3]);
    pm.set(7, 3, hex('#ffe066')); pm.set(9, 3, hex('#ffe066'));
    pm.outline(null, { amt: 0.65 });
    frames.push(pm);
  }
  return frames;
}
function unicorn() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(20, 18);
    const pal = ramp(hex('#fdf4ff')), mane = ramp(hex('#ff9fd0')), teal = hex('#9ff0e0');
    const bob = f ? -1 : 0;
    for (const x of [5, 7, 12, 14]) pm.rect(x, 13, 2, 4, pal[3]);
    ballShade(pm, 9, 10 + bob, 6.5, 3.8, pal, { dither: 0 });
    ballShade(pm, 14, 6 + bob, 3.6, 3.4, pal, { dither: 0 });
    pm.rect(12, 8 + bob, 4, 3, pal[2]);
    pm.poly([[14, 0 + bob], [16, 4 + bob], [13, 4 + bob]], hex('#ffe066')); pm.set(14, 1 + bob, hex('#fff6b0'));
    pm.rect(8, 4 + bob, 4, 8, mane[2]); pm.rect(9, 3 + bob, 3, 2, mane[1]); pm.rect(7, 6 + bob, 2, 7, teal);
    pm.rect(2, 9 + bob, 2, 5, mane[2]); pm.rect(1, 12 + bob, 2, 3, teal);
    pm.set(15, 6 + bob, EYE); pm.set(15, 7 + bob, EYE); pm.set(14, 8 + bob, withAlpha(hex('#ff8fa8'), 220));
    pm.outline(null, { amt: 0.6 });
    groundShadow(pm, 10, 17, 7, 1.2, 55);
    frames.push(pm);
  }
  return frames;
}

// ------------------------------------------------------------------ bosses
function bossSlime() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const w = 44, h = 36;
    const pm = new Pixmap(w, h);
    const pal = ramp(hex('#7ee27a'));
    const sq = f === 1 ? 1 : f === 2 ? -1 : 0;
    const rx = 18 + sq * 2.5, ry = 13 - sq * 2.5, cy = h - 3 - ry;
    ballShade(pm, w / 2, cy, rx, ry, pal, { dither: 0.12 });
    pm.ellipse(w / 2 - 8, cy - 6, 6, 3, withAlpha(WHITE, 180));
    eyes(pm, 14, Math.round(cy - 1), 12, 3);
    pm.hline(19, Math.round(cy + 5), 6, hex('#7a2a4a')); pm.set(18, Math.round(cy + 4), hex('#7a2a4a')); pm.set(25, Math.round(cy + 4), hex('#7a2a4a'));
    // crown
    const g = ramp(hex('#ffd84a'));
    pm.rect(14, Math.round(cy - ry) - 2, 16, 4, g[2]);
    for (const x of [14, 20, 26]) pm.poly([[x, Math.round(cy - ry) - 2], [x + 3, Math.round(cy - ry) - 8], [x + 5, Math.round(cy - ry) - 2]], g[2]);
    pm.set(22, Math.round(cy - ry) - 1, hex('#ff5f8a')); pm.set(17, Math.round(cy - ry) - 1, hex('#5cc7ff')); pm.set(27, Math.round(cy - ry) - 1, hex('#5cc7ff'));
    pm.rect(14, Math.round(cy - ry) + 1, 16, 1, g[3]);
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, w / 2, h - 1, rx, 2, 70);
    frames.push(pm);
  }
  return frames;
}
function bossBone() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(40, 44);
    const b = ramp(hex('#e8e0cc')), purple = ramp(hex('#6a4a9a'));
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(12, 30 - (step > 0 ? 1 : 0), 5, 13, b[3]); pm.rect(23, 30 - (step < 0 ? 1 : 0), 5, 13, b[3]);
    pm.rect(11, 42, 7, 2, b[3]); pm.rect(22, 42, 7, 2, b[3]);
    // cape
    pm.poly([[8, 14 + bob], [32, 14 + bob], [36, 36], [4, 36]], purple[2]); pm.rect(8, 14 + bob, 24, 2, purple[1]); pm.hline(4, 36, 32, purple[3]);
    pm.rect(11, 14 + bob, 18, 16, b[2]); for (let y = 16; y < 28; y += 3) pm.hline(11, y + bob, 18, b[4]); pm.vline(20, 14 + bob, 16, b[3]);
    pm.rect(5, 14 + bob, 6, 14, b[2]); pm.rect(29, 14 + bob, 6, 14, b[3]);
    pm.circle(7, 14 + bob, 4, b[1]); pm.circle(33, 14 + bob, 4, b[2]);
    ballShade(pm, 20, 8 + bob, 9, 8, b, { dither: 0 });
    pm.rect(13, 6 + bob, 5, 5, EYE); pm.rect(22, 6 + bob, 5, 5, EYE); pm.set(15, 8 + bob, hex('#ff5a8a')); pm.set(24, 8 + bob, hex('#ff5a8a'));
    pm.rect(15, 13 + bob, 10, 2, EYE); for (const x of [16, 18, 20, 22]) pm.set(x, 13 + bob, b[1]);
    // horns / crown
    const g = ramp(hex('#ffd84a'));
    pm.poly([[11, 3 + bob], [13, -1 + bob], [16, 3 + bob]], g[2]); pm.poly([[24, 3 + bob], [27, -1 + bob], [29, 3 + bob]], g[2]); pm.poly([[17, 1 + bob], [20, -3 + bob], [23, 1 + bob]], g[2]);
    pm.outline(null, { amt: 0.72 });
    groundShadow(pm, 20, 43, 14, 2, 70);
    frames.push(pm);
  }
  return frames;
}
function bossMagma() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(52, 52);
    const pal = ramp(hex('#4a3a48')), lava = hex('#ff6a2e'), core = hex('#ffd27a');
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(12, 36 - (step > 0 ? 1 : 0), 10, 16, pal[3]); pm.rect(30, 36 - (step < 0 ? 1 : 0), 10, 16, pal[3]);
    ballShade(pm, 26, 28 + bob, 17, 13, pal, { dither: 0.1 });
    ballShade(pm, 26, 11 + bob, 9.5, 8.5, pal, { dither: 0.1 });
    pm.rect(3, 22 + bob, 8, 17, pal[2]); pm.rect(41, 22 + bob, 8, 17, pal[3]); pm.circle(7, 40 + bob, 5, pal[2]); pm.circle(45, 40 + bob, 5, pal[3]);
    for (const [x, y, l] of [[18, 22, 6], [30, 26, 7], [24, 34, 5], [36, 20, 4], [8, 26, 5], [44, 28, 5]]) { for (let k = 0; k < l; k++) { pm.set(x + k, y + (k % 2) + bob, lava); if (k % 2 === 0) pm.set(x + k, y + 1 + bob, core); } }
    pm.rect(20, 9 + bob, 5, 4, lava); pm.rect(29, 9 + bob, 5, 4, lava); pm.set(21, 10 + bob, core); pm.set(30, 10 + bob, core);
    pm.rect(21, 16 + bob, 10, 2, EYE);
    pm.poly([[18, 4 + bob], [20, -2 + bob], [23, 4 + bob]], pal[1]); pm.poly([[29, 4 + bob], [32, -2 + bob], [34, 4 + bob]], pal[1]);
    pm.outline(null, { amt: 0.75 });
    groundShadow(pm, 26, 51, 18, 2.4, 70);
    frames.push(pm);
  }
  return frames;
}
function bossEye() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const pm = new Pixmap(52, 52);
    const pal = ramp(hex('#3a2a7a')), glow = hex('#b79cff');
    const bob = f ? -1 : 0;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + f * 0.2; const x = 26 + Math.cos(a) * 21, y = 26 + Math.sin(a) * 21 + bob; pm.line(26, 26 + bob, Math.round(x), Math.round(y), pal[3]); pm.circle(x, y, 2.4, pal[2]); }
    ballShade(pm, 26, 26 + bob, 17, 17, pal, { dither: 0.1 });
    pm.ellipse(26, 26 + bob, 12, 9, hex('#ffffff'));
    pm.ellipse(26, 26 + bob, 8, 8, glow); pm.ellipse(26, 26 + bob, 4, 5, hex('#14102a')); pm.set(23, 23 + bob, hex('#ffffff')); pm.set(24, 23 + bob, hex('#ffffff'));
    for (let i = 0; i < 10; i++) pm.set(8 + ((i * 17) % 36), 8 + ((i * 11) % 36) + bob, hex('#fffbd0'));
    pm.outline(null, { amt: 0.8 });
    frames.push(pm);
  }
  return frames;
}

// ------------------------------------------------------------------ more bosses
function bossMushroom() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(48, 46);
    const cap = ramp(hex('#d6457f')), st = ramp(hex('#f4ecd8')), glow = hex('#d7a0ff');
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(15, 38 - (step > 0 ? 1 : 0), 6, 7, st[3]); pm.rect(27, 38 - (step < 0 ? 1 : 0), 6, 7, st[3]); pm.rect(14, 43, 8, 2, st[3]); pm.rect(26, 43, 8, 2, st[3]);
    pm.rect(13, 20 + bob, 22, 19, st[2]); pm.rect(13, 20 + bob, 3, 19, st[1]); pm.rect(32, 20 + bob, 3, 19, st[3]);
    pm.rect(5, 24 + bob, 8, 5, st[2]); pm.rect(35, 24 + bob, 8, 5, st[3]); // arms
    pm.circle(5, 28 + bob, 3, st[1]); pm.circle(43, 28 + bob, 3, st[2]);
    ballShade(pm, 24, 14 + bob, 21, 12, cap, { dither: 0.12 });
    pm.hline(5, 22 + bob, 38, cap[3]); pm.hline(8, 23 + bob, 32, cap[4]); // gills
    for (const [x, y, r] of [[12, 9, 3], [24, 5, 3.4], [35, 10, 3], [19, 14, 2.4], [31, 17, 2.2], [8, 16, 2]]) pm.circle(x, y + bob, r, WHITE);
    for (const x of [8, 40]) { pm.rect(x - 1, 2 + bob, 3, 4, st[1]); pm.circle(x, 1 + bob, 2.4, cap[1]); } // little sprouts on the cap
    pm.rect(17, 27 + bob, 5, 5, EYE); pm.rect(26, 27 + bob, 5, 5, EYE); pm.set(18, 28 + bob, WHITE); pm.set(27, 28 + bob, WHITE);
    pm.set(17, 25 + bob, EYE); pm.set(18, 25 + bob, EYE); pm.set(29, 25 + bob, EYE); pm.set(30, 25 + bob, EYE);
    pm.hline(20, 35 + bob, 8, hex('#7a2a4a')); pm.set(20, 34 + bob, hex('#7a2a4a')); pm.set(27, 34 + bob, hex('#7a2a4a'));
    for (let i = 0; i < 6; i++) pm.set(4 + ((i * 19 + f * 7) % 40), 2 + ((i * 13 + f * 5) % 26), glow); // drifting spores
    pm.outline(null, { amt: 0.7 });
    groundShadow(pm, 24, 45, 16, 2, 70);
    frames.push(pm);
  }
  return frames;
}
function bossPharaoh() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(40, 46);
    const w = ramp(hex('#e8dcb8')), g = ramp(hex('#ffd84a')), blue = ramp(hex('#3a7ad8'));
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(12, 32 - (step > 0 ? 1 : 0), 6, 12, w[3]); pm.rect(22, 32 - (step < 0 ? 1 : 0), 6, 12, w[3]);
    for (let y = 34; y < 43; y += 3) { pm.hline(12, y, 6, w[4]); pm.hline(22, y, 6, w[4]); }
    pm.rect(11, 43, 8, 2, w[3]); pm.rect(21, 43, 8, 2, w[3]);
    pm.rect(10, 16 + bob, 20, 17, w[2]); for (let y = 18; y < 32; y += 3) pm.hline(10, y + bob, 20, w[4]); pm.vline(10, 16 + bob, 17, w[1]); pm.vline(29, 16 + bob, 17, w[3]);
    pm.rect(4, 16 + bob, 6, 14, w[2]); pm.rect(30, 16 + bob, 6, 14, w[3]); // arms
    pm.circle(7, 31 + bob, 3, w[1]); pm.circle(33, 31 + bob, 3, w[2]);
    pm.poly([[9, 14 + bob], [31, 14 + bob], [28, 19 + bob], [12, 19 + bob]], g[2]); pm.hline(12, 17 + bob, 16, blue[2]); // broad collar
    for (const x of [14, 19, 24]) pm.set(x, 15 + bob, blue[1]);
    pm.rect(6, 14 + bob, 3, 14, g[2]); pm.rect(31, 14 + bob, 3, 14, g[3]); // staff-hand rods
    ballShade(pm, 20, 8 + bob, 8, 7, w, { dither: 0 });
    pm.poly([[9, 4 + bob], [20, -1 + bob], [31, 4 + bob], [33, 17 + bob], [28, 17 + bob], [28, 6 + bob], [12, 6 + bob], [12, 17 + bob], [7, 17 + bob]], g[2]); // striped headdress
    for (const x of [9, 12, 28, 31]) for (let y = 7; y < 16; y += 3) pm.hline(x, y + bob, 2, blue[2]);
    pm.hline(11, 4 + bob, 18, blue[2]);
    pm.rect(15, 7 + bob, 3, 3, EYE); pm.rect(23, 7 + bob, 3, 3, EYE); pm.set(16, 8 + bob, hex('#ff5a3a')); pm.set(24, 8 + bob, hex('#ff5a3a'));
    pm.hline(17, 13 + bob, 7, EYE); pm.rect(17, 14 + bob, 7, 3, g[2]); // false beard
    pm.set(20, -2 + bob, hex('#5ccf6a')); pm.set(20, -3 + bob, hex('#5ccf6a')); // little cobra on the brow
    pm.outline(null, { amt: 0.72 });
    groundShadow(pm, 20, 45, 14, 2, 70);
    frames.push(pm);
  }
  return frames;
}
function bossYeti() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(48, 50);
    const fur = ramp(hex('#eaf4ff')), ice = ramp(hex('#7fc6f0')), face = ramp(hex('#9fd0ee'));
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(11, 38 - (step > 0 ? 1 : 0), 10, 11, fur[3]); pm.rect(27, 38 - (step < 0 ? 1 : 0), 10, 11, fur[3]);
    pm.rect(9, 46, 13, 4, ice[3]); pm.rect(26, 46, 13, 4, ice[3]);
    ballShade(pm, 24, 27 + bob, 16, 14, fur, { dither: 0.14 });
    pm.rect(3, 20 + bob, 9, 20, fur[2]); pm.rect(36, 20 + bob, 9, 20, fur[3]); pm.circle(7, 41 + bob, 5, fur[1]); pm.circle(41, 41 + bob, 5, fur[2]);
    for (const [x, y] of [[8, 38], [6, 43], [40, 38], [43, 43]]) pm.set(x, y + bob, ice[2]); // icy claws
    for (const [x, y] of [[16, 28], [30, 32], [24, 36], [20, 22], [32, 24]]) { pm.hline(x, y + bob, 3, fur[3]); pm.set(x + 1, y + 1 + bob, fur[4]); } // fur tufts
    ballShade(pm, 24, 11 + bob, 11, 9.5, fur, { dither: 0.1 });
    pm.ellipse(24, 13 + bob, 7.4, 5.6, face[1]); pm.ellipse(24, 14 + bob, 6.4, 4.4, face[2]);
    pm.rect(17, 10 + bob, 4, 3, EYE); pm.rect(27, 10 + bob, 4, 3, EYE); pm.set(18, 11 + bob, hex('#9ff0ff')); pm.set(28, 11 + bob, hex('#9ff0ff'));
    pm.hline(16, 9 + bob, 5, EYE); pm.hline(27, 9 + bob, 5, EYE);
    pm.rect(19, 16 + bob, 10, 3, EYE); for (const x of [20, 22, 25, 27]) pm.set(x, 16 + bob, WHITE);
    pm.poly([[12, 6 + bob], [10, -2 + bob], [16, 3 + bob]], ice[1]); pm.poly([[36, 6 + bob], [38, -2 + bob], [32, 3 + bob]], ice[1]); // icicle horns
    pm.poly([[22, 3 + bob], [24, -3 + bob], [26, 3 + bob]], ice[2]);
    pm.outline(null, { amt: 0.72 });
    groundShadow(pm, 24, 49, 18, 2.4, 70);
    frames.push(pm);
  }
  return frames;
}
function bossColossus() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const pm = new Pixmap(56, 56);
    const c = ramp(hex('#c46ae8')), deep = ramp(hex('#6a3a9a')), glow = hex('#ffe0ff'), core = hex('#ff9fd0');
    const step = f === 1 ? 1 : f === 3 ? -1 : 0, bob = f % 2 ? -1 : 0;
    pm.rect(14, 42 - (step > 0 ? 1 : 0), 11, 14, deep[2]); pm.rect(31, 42 - (step < 0 ? 1 : 0), 11, 14, deep[3]);
    pm.poly([[12, 55], [16, 49], [24, 49], [26, 55]], deep[3]); pm.poly([[30, 55], [32, 49], [40, 49], [44, 55]], deep[3]);
    pm.poly([[28, 16 + bob], [44, 26 + bob], [40, 46], [16, 46], [12, 26 + bob]], c[2]); // chest crystal
    pm.poly([[28, 16 + bob], [44, 26 + bob], [28, 30 + bob]], c[1]); pm.poly([[12, 26 + bob], [28, 16 + bob], [28, 30 + bob]], glow);
    pm.poly([[28, 30 + bob], [44, 26 + bob], [40, 46], [28, 46]], c[3]);
    pm.ellipse(28, 33 + bob, 5, 6, core); pm.ellipse(28, 33 + bob, 2.4, 3.4, glow); // glowing heart
    pm.poly([[3, 20 + bob], [12, 17 + bob], [14, 30 + bob], [4, 36 + bob]], c[2]); pm.poly([[53, 20 + bob], [44, 17 + bob], [42, 30 + bob], [52, 36 + bob]], c[3]); // shoulders
    pm.rect(2, 30 + bob, 8, 16, deep[2]); pm.rect(46, 30 + bob, 8, 16, deep[3]); pm.poly([[1, 46 + bob], [6, 52 + bob], [11, 46 + bob]], c[1]); pm.poly([[45, 46 + bob], [50, 52 + bob], [55, 46 + bob]], c[2]); // fists
    pm.poly([[4, 20 + bob], [7, 9 + bob], [11, 18 + bob]], glow); pm.poly([[45, 18 + bob], [49, 9 + bob], [52, 20 + bob]], c[1]); // shoulder spikes
    pm.poly([[18, 12 + bob], [28, 0 + bob], [38, 12 + bob], [28, 20 + bob]], c[2]); pm.poly([[28, 0 + bob], [38, 12 + bob], [28, 20 + bob]], c[3]); pm.poly([[18, 12 + bob], [28, 0 + bob], [26, 12 + bob]], glow); // head
    pm.rect(21, 10 + bob, 5, 3, core); pm.rect(31, 10 + bob, 5, 3, core); pm.set(22, 10 + bob, WHITE); pm.set(32, 10 + bob, WHITE);
    for (const [x, y] of [[8, 14], [48, 12], [20, 40], [38, 42]]) { pm.set(x, y + bob, glow); pm.set(x - 1, y + bob, glow); pm.set(x, y - 1 + bob, glow); pm.set(x, y + 1 + bob, glow); } // glints
    pm.outline(null, { amt: 0.75 });
    groundShadow(pm, 28, 55, 20, 2.6, 70);
    frames.push(pm);
  }
  return frames;
}

export function registerMobs(book) {
  const addFrames = (id, frames) => frames.forEach((pm, i) => book.add(`m_${id}_${i}`, pm));
  addFrames('slime_green', slime('#7ee27a'));
  addFrames('sand_slime', slime('#f0d070', { decor: (pm, w, h, cy, rx, ry) => { for (const x of [5, 8, 11]) { pm.set(x, Math.round(cy - ry) - 1, hex('#e0b040')); } } }));
  addFrames('snow_slime', slime('#cfe8ff', { decor: (pm, w, h, cy, rx, ry, pal) => { pm.ellipse(w / 2, Math.round(cy - ry) + 0.5, 3.4, 1.4, hex('#ffffff')); } }));
  addFrames('bog_slime', slime('#4aa088', { angry: true, decor: (pm, w, h, cy, rx, ry) => { pm.set(4, Math.round(cy - ry) + 1, hex('#8fd45a')); pm.set(5, Math.round(cy - ry), hex('#8fd45a')); pm.set(11, Math.round(cy - ry) + 1, hex('#8fd45a')); } }));
  addFrames('magma_slime', slime('#e8603a', { w: 18, h: 16, rx: 7.4, ry: 6, angry: true, decor: (pm, w, h, cy) => { for (const [x, y] of [[5, 0], [9, 2], [12, -1]]) { pm.set(x, Math.round(cy) + y, hex('#ffd27a')); pm.set(x + 1, Math.round(cy) + y, hex('#ffb347')); } } }));
  addFrames('star_slime', slime('#5a4ab8', { w: 18, h: 16, rx: 7.4, ry: 6, angry: true, decor: (pm, w, h, cy) => { for (const [x, y] of [[4, -2], [11, 1], [9, -3], [13, -1]]) pm.set(x, Math.round(cy) + y, hex('#fffbd0')); } }));
  addFrames('golden_slime', slime('#ffd84a', { decor: (pm, w, h, cy, rx, ry) => { const sx = [[4, -1], [10, -2], [8, 1]]; for (const [x, y] of sx) { const px = x, py = Math.round(cy) + y; pm.set(px, py, WHITE); pm.set(px - 1, py, hex('#fff2a0')); pm.set(px + 1, py, hex('#fff2a0')); pm.set(px, py - 1, hex('#fff2a0')); pm.set(px, py + 1, hex('#fff2a0')); } } }));
  addFrames('bat', bat('#7a5aa8')); addFrames('ice_bat', bat('#8ad0f0', '#2a4a8a'));
  addFrames('ghost', ghost());
  addFrames('prism_wisp', wisp('#ff9fd0', '#ffffff')); addFrames('void_wisp', wisp('#7a5cff', '#fffbd0'));
  addFrames('scarab', beetle('#c0883a', { gem: '#5cc7ff' })); addFrames('scorpion', scorpion());
  addFrames('skeleton', skeleton()); addFrames('frog', frog());
  addFrames('mushroom_walker', mushroomWalker()); addFrames('fire_imp', fireImp());
  addFrames('crystal_golem', crystalGolem()); addFrames('shadow_knight', shadowKnight());
  addFrames('bunny', bunny('#f4eee8', '#ffb3c8')); addFrames('snow_bunny', bunny('#ffffff', '#c8e0ff'));
  addFrames('chick', chick()); addFrames('duck', duck()); addFrames('penguin', penguin()); addFrames('lizard', lizard()); addFrames('unicorn', unicorn());
  addFrames('mushroom_mother', bossMushroom()); addFrames('sand_pharaoh', bossPharaoh()); addFrames('frost_yeti', bossYeti()); addFrames('crystal_colossus', bossColossus());
  addFrames('slime_king', bossSlime()); addFrames('bone_lord', bossBone()); addFrames('magma_titan', bossMagma()); addFrames('void_eye', bossEye());
}
