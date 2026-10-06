// Paint colors: the color format, the recolor of a sprite, building in a color, the brush, saves and the other player's screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { PAINT_FLAG, normColor, packColor, colorRGB, colorHex, hexToColor, rgbToHsl, hslToRgb, hslToColor, colorToHsl, PALETTE } from '../js/data/paint.js';
import { tintPixmap } from '../js/gfx/tint.js';
import { Pixmap, A, R, G, B, rgba, hex } from '../js/gfx/pixmap.js';
import { buildBook } from '../js/gfx/art/index.js';
import { wallSprite } from '../js/gfx/art/walls.js';
import { paintTarget, colorAt } from '../js/sim/commands.js';
import { serializeWorld, restoreWorld } from '../js/sim/serialize.js';
import { applyEvent } from '../js/net/protocol.js';
import { wallCodeOf, floorCodeOf, decoCodeOf } from '../js/sim/world.js';
import { needsUpdateCopy, updateCopyMeta, updateCopyId } from '../js/engine/backup.js';
import { SAVE_EPOCH, saveMeta } from '../js/sim/serialize.js';
import { lineTiles } from '../js/game/builder.js';

const RED = hexToColor('#e0525c'), BLUE = hexToColor('#4a8be0'), PINK = hexToColor('#f6b8c8');

function clearPatch(sim, p, w, h) {
  const W = sim.world;
  for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = Math.floor(p.x / TILE) + dx, y0 = Math.floor(p.y / TILE) + dy;
    let ok = true;
    for (let y = y0; y < y0 + h && ok; y++) for (let x = x0; x < x0 + w && ok; x++) if (!W.inb(x, y) || !W.isTileOwned(x, y) || (W.solid[W.idx(x, y)] & 1) || W.wall[W.idx(x, y)] || W.floor[W.idx(x, y)]) ok = false;
    if (!ok) continue;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const t = W.thingAt(x, y); if (t) W.removeThing(t.id); const f = W.flatAt(x, y); if (f) W.removeThing(f.id); }
    return [x0, y0];
  }
  throw new Error('no clear ground');
}
function setup() {
  const sim = makeSim('dreamy', { enemyDensity: 0 }), w = sim.world, a = sim.addPlayer('a', 'Alice', {});
  w.settings.buildCost = 0;
  for (const t of ['carpentry', 'cottage_style', 'stonecraft']) w.techs.add(t);
  const [x, y] = clearPatch(sim, a, 8, 6);
  a.x = (x + 4) * TILE; a.y = (y + 5) * TILE;
  return { sim, w, a, x, y };
}
const build = (sim, bid, tx, ty, extra = {}) => sim.exec('a', { c: 'build', bid, tx, ty, ...extra });
const paint = (sim, tx, ty, col, extra = {}) => sim.exec('a', { c: 'paint', tx, ty, col, ...extra });

test('colors: any color packs into one small number and comes back (nearly) the same; nonsense is "not painted"', () => {
  for (const hx of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#e0525c', '#7f7f7f', '#123456']) {
    const c = hexToColor(hx), back = colorRGB(c), want = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
    assert.ok(c & PAINT_FLAG, hx + ' is flagged as painted (so pure black is not "none")');
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k] - want[k]) <= 8, `${hx}: channel ${k} ${back[k]} vs ${want[k]}`);
    assert.equal(hexToColor(colorHex(c)), c, 'hex text round trips');
  }
  assert.equal(colorHex(hexToColor('#ffffff')), '#ffffff'); assert.equal(colorHex(hexToColor('#000000')), '#000000');
  assert.equal(hexToColor('abc'), hexToColor('#aabbcc'), 'short form, no #');
  assert.equal(hexToColor('nope'), 0); assert.equal(hexToColor('#12345'), 0); assert.equal(hexToColor(''), 0);
  for (const bad of [undefined, null, NaN, 'x', {}, [], 0, 5, 0x7fff, -1, Infinity]) assert.equal(normColor(bad), 0, String(bad));
  assert.equal(normColor(RED), RED); assert.equal(normColor(String(RED)), RED, 'a number sent as text');
  assert.equal(normColor(RED + 0x10000), 0, 'out of range'); assert.equal(normColor(RED + 0.5), 0, 'not a whole number');
  assert.equal(PALETTE.length, 24);
  assert.ok(PALETTE.every((p) => p.color & PAINT_FLAG && p.name), 'every swatch is a real color with a name');
  assert.equal(new Set(PALETTE.map((p) => p.color)).size, PALETTE.length, 'no duplicate swatches');
});

test('hue / softness / lightness: the sliders and the colors agree', () => {
  for (const [r, g, b] of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0], [128, 128, 128], [224, 82, 92], [18, 52, 86]]) {
    const [h, s, l] = rgbToHsl(r, g, b), [r2, g2, b2] = hslToRgb(h, s, l);
    assert.ok(Math.abs(r - r2) < 1.01 && Math.abs(g - g2) < 1.01 && Math.abs(b - b2) < 1.01, `${[r, g, b]} -> ${[r2, g2, b2].map(Math.round)}`);
  }
  assert.deepEqual(rgbToHsl(0, 0, 0), [0, 0, 0]); assert.equal(rgbToHsl(255, 255, 255)[2], 1);
  const c = hslToColor(210, 0.7, 0.5), [h, s, l] = colorToHsl(c);
  assert.ok(Math.abs(h - 210) < 6 && Math.abs(s - 0.7) < 0.08 && Math.abs(l - 0.5) < 0.04, `${h} ${s} ${l}`);
});

test('recoloring a sprite keeps its shape and shading and makes the piece the chosen color', () => {
  const book = buildBook();
  for (const base of [book.get('t_rustic_sofa'), book.get('t_rustic_bed'), book.get('f_plank'), wallSprite('plank', 'window', 6, 0), book.get('d_painting_cat')]) {
    const out = tintPixmap(base, RED);
    assert.equal(out.w, base.w); assert.equal(out.h, base.h);
    let n = 0, sr = 0, sg = 0, sb = 0, changed = 0;
    for (let i = 0; i < base.d.length; i++) {
      assert.equal(A(out.d[i]), A(base.d[i]), 'transparency and soft edges are untouched');
      if (A(base.d[i])) { n++; sr += R(out.d[i]); sg += G(out.d[i]); sb += B(out.d[i]); if (out.d[i] !== base.d[i]) changed++; }
    }
    const [er, eg, eb] = colorRGB(RED);
    assert.ok(Math.abs(sr / n - er) < 38 && Math.abs(sg / n - eg) < 38 && Math.abs(sb / n - eb) < 38, `the average pixel is about the chosen color: ${[sr, sg, sb].map((v) => Math.round(v / n))} vs ${[er, eg, eb]}`);
    assert.ok(changed > n * 0.9, 'nearly every pixel took the color');
  }
  // shading survives: whatever was lighter than something else in the picture still is
  const base = new Pixmap(4, 1); base.d[0] = rgba(40, 30, 20); base.d[1] = rgba(120, 90, 60); base.d[2] = rgba(180, 140, 100); base.d[3] = rgba(230, 200, 160);
  for (const col of [RED, BLUE, PINK, hexToColor('#3d3a47'), hexToColor('#f6f2ea')]) {
    const out = tintPixmap(base, col), lum = (c) => R(c) * 0.3 + G(c) * 0.59 + B(c) * 0.11;
    for (let i = 1; i < 4; i++) assert.ok(lum(out.d[i]) >= lum(out.d[i - 1]), `${colorHex(col)}: pixel ${i} is not darker than pixel ${i - 1}`);
  }
  // deterministic, and it never touches the original
  const a = tintPixmap(base, RED), b = tintPixmap(base, RED);
  assert.deepEqual([...a.d], [...b.d]);
  assert.equal(base.d[1], rgba(120, 90, 60));
  // an empty picture is fine
  assert.doesNotThrow(() => tintPixmap(new Pixmap(3, 3), RED));
});

test('a very pale or very dark paint still gives a readable picture (outline darker than the body)', () => {
  const book = buildBook(), base = book.get('t_rustic_chair');
  for (const hx of ['#ffffff', '#f6f2ea', '#000000', '#3d3a47']) {
    const out = tintPixmap(base, hexToColor(hx));
    const lums = []; for (let i = 0; i < out.d.length; i++) if (A(out.d[i])) lums.push(R(out.d[i]) * 0.3 + G(out.d[i]) * 0.59 + B(out.d[i]) * 0.11);
    assert.ok(Math.max(...lums) - Math.min(...lums) > 12, `${hx}: some shading is left (${Math.round(Math.max(...lums) - Math.min(...lums))})`);
  }
});

test('building in a color: floors, walls, wall decorations and furniture remember it', () => {
  const { sim, w, a, x, y } = setup();
  build(sim, 'floor_plank', x, y, { col: RED });
  build(sim, 'wall_plank', x + 1, y, { col: BLUE });
  build(sim, 'wall_plank', x + 2, y);
  build(sim, 'rustic_sofa', x, y + 2, { col: PINK });
  build(sim, 'rustic_lamp', x + 3, y + 2);
  assert.equal(w.floorCol[w.idx(x, y)], RED, 'floor');
  assert.equal(w.wallCol[w.idx(x + 1, y)], BLUE, 'wall');
  assert.equal(w.wallCol[w.idx(x + 2, y)], 0, 'a wall built without a color is not painted');
  assert.equal(w.thingAt(x, y + 2).col, PINK, 'sofa');
  assert.equal(w.thingAt(x + 3, y + 2).col, 0, 'lamp');
  const deco = Object.values(BUILD).find((d) => d.kind === 'walldeco' && !d.tech) || Object.values(BUILD).find((d) => d.kind === 'walldeco');
  w.techs.add(deco.tech || 'carpentry');
  build(sim, deco.id, x + 1, y, { col: RED });
  assert.equal(w.decoCol[w.idx(x + 1, y)], RED, 'wall decoration');
  // nonsense colors from the network never get in
  build(sim, 'floor_plank', x, y + 4, { col: 'banana' }); build(sim, 'floor_plank', x + 1, y + 4, { col: 12345 });
  assert.equal(w.floorCol[w.idx(x, y + 4)], 0); assert.equal(w.floorCol[w.idx(x + 1, y + 4)], 0, 'a number without the paint flag is not a color');
  // a whole row at once
  sim.exec('a', { c: 'buildMany', bid: 'floor_plank', tiles: [[x + 2, y + 4], [x + 3, y + 4], [x + 4, y + 4]], col: BLUE });
  for (const k of [2, 3, 4]) assert.equal(w.floorCol[w.idx(x + k, y + 4)], BLUE);
});

test('building the same floor in another color repaints it for free; the same color changes nothing', () => {
  const { sim, w, a, x, y } = setup();
  w.settings.buildCost = 1;
  a.inv.fill(null); a.inv[0] = { id: 'plank', n: 30 }; a.rev++;
  const count = () => a.inv.reduce((n, s) => n + (s && s.id === 'plank' ? s.n : 0), 0);
  build(sim, 'floor_plank', x, y, { col: RED });
  const after = count();
  assert.ok(after < 30, 'the floor cost planks');
  w.record = true; w.events.length = 0;
  build(sim, 'floor_plank', x, y, { col: RED });
  assert.equal(count(), after, 'same piece, same color: nothing');
  assert.equal(w.events.length, 0, 'and nothing to tell anyone');
  build(sim, 'floor_plank', x, y, { col: BLUE });
  assert.equal(w.floorCol[w.idx(x, y)], BLUE, 'repainted');
  assert.equal(count(), after, 'repainting is free');
  a.inv.fill(null); a.rev++; // no planks at all: repainting still works
  build(sim, 'floor_plank', x, y, { col: PINK });
  assert.equal(w.floorCol[w.idx(x, y)], PINK, 'repainting needs no materials');
});

test('the brush: furniture first, then the wall and what hangs on it, then the floor; free; Original takes paint off', () => {
  const { sim, w, a, x, y } = setup();
  build(sim, 'floor_plank', x, y); build(sim, 'floor_plank', x + 1, y);
  build(sim, 'wall_plank', x + 1, y);
  const deco = Object.values(BUILD).find((d) => d.kind === 'walldeco' && !d.tech);
  assert.ok(deco, 'a wall decoration anyone can build');
  build(sim, deco.id, x + 1, y);
  build(sim, 'rustic_sofa', x + 3, y + 2);
  assert.ok(w.thingAt(x + 3, y + 2) && w.wall[w.idx(x + 1, y)] && w.deco[w.idx(x + 1, y)], 'the scene is built');
  paint(sim, x, y, RED); assert.equal(w.floorCol[w.idx(x, y)], RED, 'the floor');
  paint(sim, x + 3, y + 2, BLUE); assert.equal(w.thingAt(x + 3, y + 2).col, BLUE, 'the sofa');
  paint(sim, x + 4, y + 2, PINK); assert.equal(w.thingAt(x + 3, y + 2).col, PINK, 'the other end of the sofa is the sofa too');
  // a wall with a decoration: the wall first, and only once the wall has the color the decoration gets it
  const i = w.idx(x + 1, y);
  paint(sim, x + 1, y, RED); assert.deepEqual([w.wallCol[i], w.decoCol[i]], [RED, 0], 'wall first');
  paint(sim, x + 1, y, RED); assert.deepEqual([w.wallCol[i], w.decoCol[i]], [RED, RED], 'then the decoration');
  assert.equal(w.floorCol[i], 0, 'the floor under the wall is not touched');
  // many tiles at once
  sim.exec('a', { c: 'paint', tiles: [[x, y], [x + 1, y]], col: BLUE });
  assert.equal(w.floorCol[w.idx(x, y)], BLUE); assert.equal(w.floorCol[w.idx(x + 1, y)], 0, 'under the wall: not painted');
  assert.equal(w.wallCol[i], BLUE);
  // back to how it was drawn
  paint(sim, x, y, 0); assert.equal(w.floorCol[w.idx(x, y)], 0);
  paint(sim, x + 3, y + 2, 0); assert.equal(w.thingAt(x + 3, y + 2).col, 0);
  // costs nothing, even with an empty bag
  w.settings.buildCost = 1; a.inv.fill(null); a.rev++;
  paint(sim, x, y, RED); assert.equal(w.floorCol[w.idx(x, y)], RED, 'no materials needed');
  // nothing there / nonsense
  assert.doesNotThrow(() => { paint(sim, x + 6, y + 4, RED); paint(sim, -5, 3, RED); paint(sim, 1e9, 1e9, RED); sim.exec('a', { c: 'paint', tiles: 'no', col: RED }); sim.exec('a', { c: 'paint', tiles: [[1], 'x', null], col: RED }); });
  paint(sim, x, y, 'banana'); assert.equal(w.floorCol[w.idx(x, y)], 0, 'a color that is not one means "as drawn"');
});

test('the brush respects reach and land: far away or someone else\'s land is left alone', () => {
  const { sim, w, a, x, y } = setup();
  build(sim, 'floor_plank', x, y);
  a.x = (x + 40) * TILE; a.y = (y + 40) * TILE; sim.tells = [];
  paint(sim, x, y, RED);
  assert.equal(w.floorCol[w.idx(x, y)], 0, 'too far away');
  assert.ok(sim.tells.some(([, ev]) => ev.t === 'toast' && /far/i.test(ev.text)), 'and it says so');
  a.x = (x + 0.5) * TILE; a.y = (y + 1) * TILE;
  // a tile on land nobody owns
  let un = null; for (let ty = 0; ty < w.H && !un; ty++) for (let tx = 0; tx < w.W && !un; tx++) if (w.isLand(tx, ty) && !w.isTileOwned(tx, ty)) un = [tx, ty];
  if (un) { w.floor[w.idx(un[0], un[1])] = floorCodeOf('floor_plank'); a.x = (un[0] + 0.5) * TILE; a.y = (un[1] + 1) * TILE; paint(sim, un[0], un[1], RED); assert.equal(w.floorCol[w.idx(un[0], un[1])], 0, 'not your land yet'); }
});

test('what the brush would color and what the dropper would copy', () => {
  const { sim, w, x, y } = setup();
  build(sim, 'floor_plank', x, y, { col: RED }); build(sim, 'wall_plank', x + 1, y, { col: BLUE }); build(sim, 'rustic_chair', x + 3, y + 2, { col: PINK });
  assert.equal(paintTarget(w, x, y, BLUE).layer, 'floor'); assert.equal(paintTarget(w, x, y, BLUE).has, RED);
  assert.equal(paintTarget(w, x + 1, y, RED).layer, 'wall');
  assert.equal(paintTarget(w, x + 3, y + 2, RED).layer, 'thing');
  assert.equal(paintTarget(w, x + 5, y + 5, RED), null, 'bare ground: nothing to paint');
  assert.equal(paintTarget(w, -1, -1, RED), null);
  assert.deepEqual(colorAt(w, x, y), { col: RED, name: BUILD.floor_plank.name });
  assert.equal(colorAt(w, x + 1, y).col, BLUE); assert.equal(colorAt(w, x + 3, y + 2).col, PINK);
  assert.equal(colorAt(w, x + 5, y + 5), null);
});

test('paint goes away with the piece: removing or replacing a piece never leaves its color behind', () => {
  const { sim, w, x, y } = setup();
  const i = w.idx(x, y);
  build(sim, 'floor_plank', x, y, { col: RED });
  sim.exec('a', { c: 'unbuild', tx: x, ty: y });
  assert.equal(w.floor[i], 0); assert.equal(w.floorCol[i], 0, 'floor');
  build(sim, 'wall_plank', x, y, { col: RED }); const deco = Object.values(BUILD).find((d) => d.kind === 'walldeco' && !d.tech);
  build(sim, deco.id, x, y, { col: BLUE });
  sim.exec('a', { c: 'unbuild', tx: x, ty: y, layer: 'wall' });
  assert.deepEqual([w.wall[i], w.wallCol[i], w.deco[i], w.decoCol[i]], [0, 0, 0, 0], 'wall takes its decoration and both colors');
  build(sim, 'floor_plank', x, y, { col: RED }); build(sim, 'floor_dark', x, y, { col: 0 });
  assert.equal(w.floor[i], floorCodeOf('floor_dark')); assert.equal(w.floorCol[i], 0, 'a different floor built over it starts unpainted');
  build(sim, 'rustic_chair', x + 3, y + 3, { col: RED }); const t = w.thingAt(x + 3, y + 3);
  sim.exec('a', { c: 'unbuild', tx: x + 3, ty: y + 3 });
  assert.ok(!w.things.has(t.id));
  build(sim, 'rustic_chair', x + 3, y + 3);
  assert.equal(w.thingAt(x + 3, y + 3).col, 0, 'the next chair there is unpainted');
});

test('opening and closing a painted door keeps its color', () => {
  const { sim, w, x, y } = setup();
  const door = Object.values(BUILD).find((d) => d.kind === 'wall' && d.piece === 'door' && !d.tech);
  assert.ok(door);
  build(sim, door.id, x + 1, y + 1, { col: RED });
  const i = w.idx(x + 1, y + 1);
  w.setWallState(x + 1, y + 1, 1); assert.equal(w.wallCol[i], RED);
  w.setWallState(x + 1, y + 1, 0); assert.equal(w.wallCol[i], RED);
  // and the other screen, which learns it from events, keeps it too
  w.record = true; w.events.length = 0;
  w.setWallState(x + 1, y + 1, 1);
  const mirror = restoreWorld(JSON.parse(JSON.stringify(serializeWorld(sim)))).world;
  for (const ev of w.events) applyEvent(mirror, ev, {});
  assert.equal(mirror.wallCol[i], RED); assert.equal(mirror.wallState[i], 1);
});

test('the other player sees every paint change through the events (and a new join sees them in the snapshot)', () => {
  const { sim, w, a, x, y } = setup();
  const snap = JSON.parse(JSON.stringify(serializeWorld(sim)));
  const mirror = restoreWorld(snap).world;
  w.record = true; w.events.length = 0;
  build(sim, 'floor_plank', x, y, { col: RED }); build(sim, 'wall_plank', x + 1, y, { col: BLUE }); build(sim, 'rustic_sofa', x + 3, y + 2, { col: PINK });
  paint(sim, x, y, BLUE); paint(sim, x + 3, y + 2, RED);
  const deco = Object.values(BUILD).find((d) => d.kind === 'walldeco' && !d.tech);
  build(sim, deco.id, x + 1, y, { col: PINK });
  for (const ev of JSON.parse(JSON.stringify(w.events))) applyEvent(mirror, ev, {});
  assert.deepEqual([...mirror.floorCol], [...w.floorCol], 'floors');
  assert.deepEqual([...mirror.wallCol], [...w.wallCol], 'walls');
  assert.deepEqual([...mirror.decoCol], [...w.decoCol], 'decorations');
  const sofa = w.thingAt(x + 3, y + 2), seen = mirror.things.get(sofa.id);
  assert.equal(seen.col, RED, 'furniture, including the repaint');
  // a player who joins later gets it all in the snapshot
  const joined = restoreWorld(JSON.parse(JSON.stringify(serializeWorld(sim)))).world;
  assert.equal(joined.floorCol[w.idx(x, y)], BLUE); assert.equal(joined.wallCol[w.idx(x + 1, y)], BLUE); assert.equal(joined.things.get(sofa.id).col, RED);
});

test('colors survive saving and loading; a world nobody painted saves exactly as before; an old save loads unpainted', () => {
  const { sim, w, x, y } = setup();
  const plain = JSON.parse(JSON.stringify(serializeWorld(sim)));
  for (const k of ['floorCol', 'wallCol', 'decoCol']) assert.ok(!(k in plain), 'no ' + k + ' key when nothing is painted');
  build(sim, 'floor_plank', x, y, { col: RED }); build(sim, 'wall_plank', x + 1, y, { col: BLUE }); build(sim, 'rustic_sofa', x + 3, y + 2, { col: PINK });
  const data = JSON.parse(JSON.stringify(serializeWorld(sim)));
  const w2 = restoreWorld(data).world, sofa = w.thingAt(x + 3, y + 2);
  assert.equal(w2.floorCol[w.idx(x, y)], RED); assert.equal(w2.wallCol[w.idx(x + 1, y)], BLUE); assert.equal(w2.things.get(sofa.id).col, PINK);
  assert.deepEqual(JSON.parse(JSON.stringify(serializeWorld(restoreWorld(data).sim))).things, data.things, 'saving again changes nothing');
  // an old save: no color keys, thing rows nine long
  const old = JSON.parse(JSON.stringify(plain)); old.things = old.things.map((r) => r.slice(0, 9));
  const w3 = restoreWorld(old).world;
  assert.ok(![...w3.floorCol, ...w3.wallCol, ...w3.decoCol].some(Boolean)); assert.ok([...w3.things.values()].every((t) => t.col === 0));
  // damaged colors: a color for a tile with nothing on it, junk values, out-of-range tiles
  const bad = JSON.parse(JSON.stringify(data));
  bad.floorCol.push([w.idx(x + 7, y + 5), RED], [-3, RED], [99999999, RED], [w.idx(x, y), 'junk'], [w.idx(x, y), 77]);
  assert.doesNotThrow(() => restoreWorld(bad));
  const w4 = restoreWorld(bad).world;
  assert.equal(w4.floorCol[w.idx(x + 7, y + 5)], 0, 'nothing is built there, so no color');
  assert.equal(w4.floorCol[w.idx(x, y)], 0, 'the last (invalid) entry for a tile wins and is not a color');
});

test('a color set in a save the old way round (only flagged numbers) can never produce a bad sprite request', () => {
  const book = buildBook(), pm = book.get('f_plank');
  for (const c of [0x8000, 0xffff, 0x8001, PALETTE[0].color]) assert.doesNotThrow(() => tintPixmap(pm, c), String(c));
});

test('updating: a world last saved by an older generation gets a copy kept; copies and current worlds do not', () => {
  assert.ok(SAVE_EPOCH >= 2);
  assert.equal(needsUpdateCopy({ name: 'Our Isles' }), true, 'saved before epochs existed');
  assert.equal(needsUpdateCopy({ epoch: 1 }), true);
  assert.equal(needsUpdateCopy(undefined), true);
  assert.equal(needsUpdateCopy({ epoch: SAVE_EPOCH }), false, 'saved by this generation');
  assert.equal(needsUpdateCopy({ epoch: SAVE_EPOCH + 1 }), false);
  assert.equal(needsUpdateCopy({ copyOf: 'abc' }), false, 'the partner copy is itself a copy');
  assert.equal(needsUpdateCopy({ before: 'abc' }), false, 'a copy is never copied again');
  const meta = { id: 'w1', name: 'Our Isles', day: 12, lands: 3, players: [{ name: 'A' }], updated: 1234 };
  const copy = updateCopyMeta(meta, { name: 'Our Isles' }, 'w1');
  assert.equal(copy.name, 'Our Isles (before the update)'); assert.equal(copy.before, 'w1'); assert.equal(copy.epoch, SAVE_EPOCH);
  assert.equal(copy.updated, 1234, 'it keeps the time of the original save'); assert.equal(copy.day, 12);
  assert.ok(!('id' in copy), 'no id inside the meta (the list takes it from the key)');
  assert.equal(updateCopyId('w1'), 'before-w1');
  assert.equal(updateCopyMeta(undefined, { name: 'Isle' }, 'z').name, 'Isle (before the update)');
  const sim = makeSim('dreamy', {}); assert.equal(saveMeta(sim).epoch, SAVE_EPOCH, 'every save is stamped, so the copy is made once');
});

test('a player restored from a save is a complete player (nothing the new version reads is missing)', () => {
  const { sim, a } = setup();
  const data = JSON.parse(JSON.stringify(serializeWorld(sim)));
  const { world } = restoreWorld(data);
  const p = world.players.get('a');
  for (const k of ['bed', 'sit', 'sleeping', 'dead', 'cozy', 'equip', 'inv', 'skills', 'buffs']) assert.ok(k in p, k);
  assert.equal(p.bed, 0);
});

test('a drag stroke covers every tile between two frames, in every direction, without gaps', () => {
  assert.deepEqual(lineTiles([3, 3], [3, 3]), [[3, 3]], 'a single tile');
  assert.deepEqual(lineTiles([0, 0], [4, 0]), [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]);
  assert.deepEqual(lineTiles([4, 0], [0, 0]).length, 5, 'backwards too');
  for (const [a, b] of [[[0, 0], [7, 3]], [[7, 3], [0, 0]], [[2, 9], [9, 2]], [[5, 5], [5, -4]], [[-3, -3], [6, 8]], [[0, 0], [1, 1]]]) {
    const line = lineTiles(a, b);
    assert.deepEqual(line[0], a); assert.deepEqual(line[line.length - 1], b, 'ends where it should');
    for (let i = 1; i < line.length; i++) assert.ok(Math.abs(line[i][0] - line[i - 1][0]) <= 1 && Math.abs(line[i][1] - line[i - 1][1]) <= 1 && (line[i][0] !== line[i - 1][0] || line[i][1] !== line[i - 1][1]), 'no gaps, no repeats ' + JSON.stringify([a, b, i]));
  }
  assert.ok(lineTiles([0, 0], [100000, 100000]).length <= 400, 'a wild jump cannot flood the host with tiles');
});
