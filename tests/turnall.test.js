// Everything turns: stations, storage, machines, lamps, rugs, windows, doors, fences, floors, wall decorations. Footprints, pictures, placing, saves, the other player.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { turnable, turnsOf, footprintFor, turnSprite, allTurnIds, hasViews, autoKind } from '../js/data/facing.js';
import { buildBook } from '../js/gfx/art/index.js';
import { wallSprite, fenceSprite } from '../js/gfx/art/walls.js';
import { plainFace, resizeX, extendTop, boxSide, boxBack, turnOpening } from '../js/gfx/art/autoturn.js';
import { Pixmap, A, rgba } from '../js/gfx/pixmap.js';
import { serializeWorld, restoreWorld } from '../js/sim/serialize.js';
import { applyEvent } from '../js/net/protocol.js';
import { stationNear } from '../js/sim/commands.js';
import { hexToColor } from '../js/data/paint.js';

const RED = hexToColor('#e0525c');
function clearPatch(sim, p, w, h) {
  const W = sim.world;
  for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = Math.floor(p.x / TILE) + dx, y0 = Math.floor(p.y / TILE) + dy;
    let ok = true;
    for (let y = y0; y < y0 + h && ok; y++) for (let x = x0; x < x0 + w && ok; x++) if (!W.inb(x, y) || !W.isTileOwned(x, y) || W.ground[W.idx(x, y)] === 0 || W.wall[W.idx(x, y)] || W.floor[W.idx(x, y)]) ok = false;
    if (!ok) continue;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const t = W.thingAt(x, y); if (t) W.removeThing(t.id); const f = W.flatAt(x, y); if (f) W.removeThing(f.id); }
    return [x0, y0];
  }
  throw new Error('no clear ground');
}
function setup() {
  const sim = makeSim('dreamy', { enemyDensity: 0 }), w = sim.world, a = sim.addPlayer('a', 'Alice', {});
  w.settings.buildCost = 0;
  for (const t of ['carpentry', 'cottage_style', 'stonecraft', 'smelting', 'kitchen']) w.techs.add(t);
  const [x, y] = clearPatch(sim, a, 12, 8);
  a.x = (x + 6) * TILE; a.y = (y + 5) * TILE;
  return { sim, w, a, x, y };
}
const build = (sim, bid, tx, ty, extra = {}) => sim.exec('a', { c: 'build', bid, tx, ty, ...extra });

test('every one of the pieces you can build has four views, and each view fits the footprint it turns to', () => {
  const book = buildBook();
  assert.deepEqual(book.missingArt, [], 'no picture is missing');
  const ids = allTurnIds();
  assert.ok(ids.length >= 200);
  for (const id of ids) {
    const d = BUILD[id];
    for (let r = 0; r < 4; r++) {
      const [fw] = footprintFor(d, r), pm = book.get(turnSprite(d, r));
      assert.ok(pm.w >= fw * TILE - 2 && pm.w <= fw * TILE + 2, `${id}/${r}: ${pm.w}px wide for ${fw} tile(s)`);
      assert.ok(pm.bounds(), `${id}/${r}: something is drawn`);
    }
  }
});

test('long pieces turn their footprint (the kitchen along a wall), square and tall round ones do not', () => {
  for (const id of ['kitchen', 'workbench', 'research_table', 'large_chest', 'vault', 'forge', 'piano', 'fireplace', 'aquarium', 'bathtub', 'chicken_coop', 'slime_altar']) {
    const d = BUILD[id], [w, h] = [d.w, d.h];
    assert.ok(w !== h, id + ' is long');
    assert.deepEqual([0, 1, 2, 3].map((r) => footprintFor(d, r)), [[w, h], [h, w], [w, h], [h, w]], id);
  }
  for (const id of ['cow_shed', 'magma_furnace', 'drill_iron', 'star_forge', 'furnace', 'chest', 'lighthouse', 'world_heart', 'statue_angel', 'well', 'windmill']) {
    const d = BUILD[id];
    assert.deepEqual([1, 2, 3].map((r) => footprintFor(d, r)), [[d.w, d.h], [d.w, d.h], [d.w, d.h]], id);
  }
});

test('a turned station is still a working station: the kitchen crafts, the furnace smelts, the chest keeps things', () => {
  const { sim, w, a, x, y } = setup();
  a.x = (x + 3) * TILE; a.y = (y + 6) * TILE;
  build(sim, 'kitchen', x + 2, y + 1, { rot: 1 });
  const k = w.thingAt(x + 2, y + 1);
  assert.ok(k && k.rot === 1 && k.w === 1 && k.h === 2, 'the kitchen stands sideways: 1 wide, 2 deep');
  assert.equal(w.thingAt(x + 2, y + 2), k, 'it takes the tile below');
  assert.equal(w.thingAt(x + 3, y + 1), null, 'and not the one beside');
  assert.ok(stationNear(sim, a, 'kitchen'), 'cooking works beside a kitchen turned on its side');
  for (const rot of [0, 2, 3]) { w.removeThing(k.id); build(sim, 'kitchen', x + 2, y + 1, { rot }); assert.ok(stationNear(sim, a, 'kitchen'), 'turn ' + rot); }
  // storage and machines in every turn
  for (const id of ['chest', 'large_chest', 'furnace', 'workbench', 'drill_iron', 'chicken_coop']) {
    for (let rot = 0; rot < 4; rot++) {
      const t = sim.world.addThing(id, x + 7, y + 1, { rot });
      assert.equal(t.rot, rot, `${id}/${rot}`);
      const [fw, fh] = footprintFor(BUILD[id], rot);
      assert.deepEqual([t.w, t.h], [fw, fh]);
      w.removeThing(t.id);
    }
  }
});

test('a lamp, a plant or a statue turns too: it mirrors and keeps its animation', () => {
  const book = buildBook();
  for (const id of ['torch', 'campfire', 'brazier', 'lava_lamp', 'windmill', 'fountain']) {
    assert.equal(autoKind(BUILD[id]), 'sym', id);
    assert.ok(book.has(`t_${id}_a0`), id + ' is animated');
    for (let r = 1; r <= 3; r++) assert.ok(book.has(`t_${id}_r${r}_a0`) && book.has(`t_${id}_r${r}_a1`), `${id}/${r} keeps its animation frames`);
  }
  const front = book.get('t_statue_cat'), r1 = book.get('t_statue_cat_r1'), r2 = book.get('t_statue_cat_r2');
  assert.deepEqual([...r1.d], [...front.flipX().d], 'a quarter turn mirrors');
  assert.deepEqual([...r2.d], [...front.d], 'turned right round it looks as it did');
  assert.ok(!hasViews(BUILD.statue_cat) && hasViews(BUILD.rustic_sofa));
});

test('the pictures made for turned stations keep the shape and lose what is drawn on the front', () => {
  const book = buildBook();
  const kitchen = book.get('t_kitchen'), plain = plainFace(kitchen);
  assert.equal(plain.w, kitchen.w); assert.equal(plain.h, kitchen.h);
  for (let i = 0; i < kitchen.d.length; i++) assert.equal(A(plain.d[i]), A(kitchen.d[i]), 'the outline is the same');
  assert.notDeepEqual([...plain.d], [...kitchen.d], 'but the oven door and the drawers are smoothed away');
  const back = boxBack(kitchen);
  assert.deepEqual([back.w, back.h], [kitchen.w, kitchen.h]);
  const side = boxSide(kitchen, 2, 1, true);
  assert.equal(side.w, 16, 'the long kitchen turned sideways is one tile wide');
  assert.ok(side.h > kitchen.h, 'and deeper, so it looks longer front to back');
  assert.equal(boxSide(kitchen, 2, 1, false).w, 32, 'without a swap the picture keeps its width');
  // helpers
  const strip = new Pixmap(8, 2); for (let x = 0; x < 8; x++) { strip.d[x] = rgba(10 * x, 0, 0); strip.d[8 + x] = rgba(10 * x, 20, 0); }
  const sq = resizeX(strip, 4);
  assert.equal(sq.w, 4); assert.equal(sq.d[0], strip.d[0], 'the first column stays first'); assert.equal(sq.d[3], strip.d[7], 'and the last stays last');
  assert.equal(extendTop(strip, 3).h, 5);
  assert.equal(extendTop(strip, 0).h, 2);
});

test('a window, door or gate turned: only the opening turns, the wall around it stays', () => {
  for (const [mat, piece] of [['plank', 'window'], ['plank', 'door'], ['stone', 'window'], ['thatch', 'door']]) {
    for (const mask of [0, 2, 4, 6, 7]) {
      const plain = wallSprite(mat, 'wall', mask, 0), piece0 = wallSprite(mat, piece, mask, 0);
      assert.deepEqual([...turnOpening(plain, piece0, 0).d], [...piece0.d], 'rot 0 is the piece itself');
      const views = [1, 2, 3].map((r) => turnOpening(plain, piece0, r));
      for (const [k, v] of views.entries()) {
        assert.deepEqual([v.w, v.h], [16, 20]);
        let sameAsWall = 0, total = 0;
        for (let i = 0; i < v.d.length; i++) { total++; if (v.d[i] === plain.d[i]) sameAsWall++; }
        if (k !== 1) assert.ok(sameAsWall > total * 0.55, `${mat} ${piece} turn ${k + 1}: seen from the side the opening is narrower, so most of it is the plain wall (${sameAsWall} of ${total})`);
        else { let was = 0; for (let i = 0; i < v.d.length; i++) if (piece0.d[i] !== plain.d[i]) was++; assert.ok(Math.abs((total - sameAsWall) - was) <= was * 0.25, `${mat} ${piece}: from behind the opening is the same size (${total - sameAsWall} vs ${was})`); }
      }
      assert.notDeepEqual([...views[0].d], [...piece0.d], `${mat} ${piece}: turned right it looks different`);
      assert.notDeepEqual([...views[0].d], [...views[2].d], 'right and left differ');
      for (const v of views) for (let x = 0; x < 16; x++) assert.equal(A(v.d[x]), A(plain.d[x]), 'the wall outline (cap, rounded ends) is untouched');
    }
  }
  const fence = fenceSprite('wood', false, 6, 0), gate = fenceSprite('wood', true, 6, 0);
  assert.notDeepEqual([...turnOpening(fence, gate, 1).d], [...gate.d]);
  assert.deepEqual([...turnOpening(fence, fence, 1).d], [...fence.d], 'a plain fence has no opening to turn');
});

test('building a window, door, floor or decoration turned remembers the turn, and nothing else changes', () => {
  const { sim, w, x, y } = setup();
  build(sim, 'wall_plank', x, y); build(sim, 'window_plank', x + 1, y, { rot: 1 }); build(sim, 'door_plank', x + 2, y, { rot: 3 }); build(sim, 'wall_plank', x + 3, y, { rot: 2 });
  assert.equal(w.wallRot[w.idx(x + 1, y)], 1); assert.equal(w.wallRot[w.idx(x + 2, y)], 3); assert.equal(w.wallRot[w.idx(x, y)], 0); assert.equal(w.wallRot[w.idx(x + 3, y)], 2);
  build(sim, 'floor_plank', x, y + 2, { rot: 1 }); build(sim, 'floor_plank', x + 1, y + 2);
  assert.equal(w.floorRot[w.idx(x, y + 2)], 1); assert.equal(w.floorRot[w.idx(x + 1, y + 2)], 0);
  build(sim, 'painting_meadow', x + 1, y, { rot: 1 });
  assert.equal(w.decoRot[w.idx(x + 1, y)], 1);
  // a turn that is not 0..3 is made one; junk is no turn
  build(sim, 'floor_plank', x + 2, y + 2, { rot: 5 }); build(sim, 'floor_plank', x + 3, y + 2, { rot: 'x' }); build(sim, 'floor_plank', x + 4, y + 2, { rot: -1 });
  assert.deepEqual([x + 2, x + 3, x + 4].map((tx) => w.floorRot[w.idx(tx, y + 2)]), [1, 0, 3]);
  // a whole row at once
  sim.exec('a', { c: 'buildMany', bid: 'floor_plank', tiles: [[x + 5, y + 2], [x + 6, y + 2]], rot: 2 });
  assert.deepEqual([x + 5, x + 6].map((tx) => w.floorRot[w.idx(tx, y + 2)]), [2, 2]);
  // the same floor built again with another turn is just turned, free
  w.settings.buildCost = 1; const before = JSON.stringify(sim.world.players.get('a').inv);
  build(sim, 'floor_plank', x, y + 2, { rot: 3 });
  assert.equal(w.floorRot[w.idx(x, y + 2)], 3); assert.equal(JSON.stringify(sim.world.players.get('a').inv), before, 'turning costs nothing');
  // paint keeps the turn, an open door keeps it, removing the piece takes it away
  sim.exec('a', { c: 'paint', tx: x + 1, ty: y, col: RED });
  assert.equal(w.wallRot[w.idx(x + 1, y)], 1, 'painting does not undo the turn');
  w.setWallState(x + 2, y, 1); assert.equal(w.wallRot[w.idx(x + 2, y)], 3); assert.equal(w.wallState[w.idx(x + 2, y)], 1);
  sim.exec('a', { c: 'unbuild', tx: x + 1, ty: y, layer: 'wall' });
  assert.deepEqual([w.wall[w.idx(x + 1, y)], w.wallRot[w.idx(x + 1, y)], w.decoRot[w.idx(x + 1, y)]], [0, 0, 0], 'the wall takes its decoration and both turns');
  sim.exec('a', { c: 'unbuild', tx: x, ty: y + 2, layer: 'floor' });
  assert.equal(w.floorRot[w.idx(x, y + 2)], 0);
  build(sim, 'floor_plank', x, y + 2);
  assert.equal(w.floorRot[w.idx(x, y + 2)], 0, 'the next floor there is not turned');
});

test('turns reach the other player, and survive saving and loading', () => {
  const { sim, w, x, y } = setup();
  const mirror = restoreWorld(JSON.parse(JSON.stringify(serializeWorld(sim)))).world;
  w.record = true; w.events.length = 0;
  build(sim, 'wall_plank', x, y); build(sim, 'window_plank', x + 1, y, { rot: 1 }); build(sim, 'floor_plank', x, y + 2, { rot: 2 });
  build(sim, 'painting_meadow', x, y, { rot: 3 }); build(sim, 'kitchen', x + 4, y + 2, { rot: 1 }); build(sim, 'rustic_lamp', x + 8, y + 2, { rot: 2 });
  w.setWallState(x + 1, y, 1);
  for (const ev of JSON.parse(JSON.stringify(w.events))) applyEvent(mirror, ev, {});
  assert.deepEqual([...mirror.wallRot], [...w.wallRot]); assert.deepEqual([...mirror.floorRot], [...w.floorRot]); assert.deepEqual([...mirror.decoRot], [...w.decoRot]);
  const k = [...mirror.things.values()].find((t) => t.type === 'kitchen');
  assert.ok(k && k.rot === 1 && k.w === 1 && k.h === 2, 'the partner sees the kitchen turned, taking two tiles in a column');
  assert.equal(mirror.thingAt(x + 4, y + 3), k);
  // saving: a world with turns keeps them, a world without writes nothing new
  const plain = JSON.parse(JSON.stringify(serializeWorld(makeSim('dreamy', {}))));
  for (const key of ['floorRot', 'wallRot', 'decoRot']) assert.ok(!(key in plain), 'no ' + key + ' key when nothing is turned');
  const data = JSON.parse(JSON.stringify(serializeWorld(sim)));
  const w2 = restoreWorld(data).world;
  assert.deepEqual([...w2.wallRot], [...w.wallRot]); assert.deepEqual([...w2.floorRot], [...w.floorRot]); assert.deepEqual([...w2.decoRot], [...w.decoRot]);
  assert.equal([...w2.things.values()].find((t) => t.type === 'kitchen').rot, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(serializeWorld(restoreWorld(data).sim))).things, data.things, 'saving again changes nothing');
  // damaged entries are ignored
  const bad = JSON.parse(JSON.stringify(data));
  bad.floorRot.push([-4, 1], [99999999, 2], [w.idx(x + 11, y + 7), 3], [w.idx(x, y + 2), 'junk']);
  assert.doesNotThrow(() => restoreWorld(bad));
  assert.equal(restoreWorld(bad).world.floorRot[w.idx(x + 11, y + 7)], 0, 'nothing is built there, so no turn');
});

test('the build preview and the pieces agree: the Rotate key works for everything in the Build menu', async () => {
  const { Builder } = await import('../js/game/builder.js');
  const calls = [];
  const g = { audio: { play() {} }, hud: { setBuildBar() {}, setBuildSide() {}, layoutBuildSide() {} }, ui: { closeAll() {} }, world: makeSim('dreamy', {}).world, me: null, toast() {}, cmd: (c) => calls.push(c) };
  const b = new Builder(g);
  b.syncBar = () => {};
  const kinds = new Set();
  for (const d of Object.values(BUILD)) {
    if (d.hidden) continue;
    b.start(d.id);
    assert.equal(b.rot, 0, d.id + ' starts facing front');
    for (let k = 1; k <= 4; k++) { b.rotate(1); assert.equal(b.rot, k % 4, `${d.id}: turn ${k}`); }
    b.rotate(-1); assert.equal(b.rot, 3, d.id + ': back one');
    kinds.add(d.kind);
    b.rot = 0;
  }
  assert.deepEqual([...kinds].sort(), ['flat', 'floor', 'thing', 'wall', 'walldeco'], 'things, rugs, walls, floors and decorations all turn');
  b.remove = true; b.rot = 0; b.rotate(1); assert.equal(b.rot, 0, 'but the remove tool has nothing to turn');
});
