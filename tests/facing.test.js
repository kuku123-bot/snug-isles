// Turning furniture: which pieces turn, how the footprint follows, placement and removal of turned pieces, saves, networking and the pictures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { turnable, turnsOf, footprintFor, turnSprite, normRot, allTurnIds, DESIGN_TURNS } from '../js/data/facing.js';
import { placeCheck } from '../js/sim/commands.js';
import { serializeWorld, restoreWorld } from '../js/sim/serialize.js';
import { applyEvent } from '../js/net/protocol.js';
import { World } from '../js/sim/world.js';
import { SpriteBook } from '../js/gfx/atlas.js';
import { registerFurniture } from '../js/gfx/art/furniture.js';
import { registerStructures } from '../js/gfx/art/structures.js';
import { registerTurns } from '../js/gfx/art/turns.js';

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
const setup = () => { const sim = makeSim('dreamy', { enemyDensity: 0 }); const a = sim.addPlayer('a', 'Alice', {}); sim.world.settings.buildCost = 0; for (const t of ['carpentry', 'cottage_style']) sim.world.techs.add(t); return { sim, w: sim.world, a }; };

test('the turnable pieces are the furniture designs that look different from the side, plus benches and picnic tables', () => {
  const ids = allTurnIds();
  assert.ok(ids.length >= 70, 'a lot of pieces turn: ' + ids.length);
  for (const d of ['bed', 'chair', 'sofa', 'table', 'bookshelf', 'wardrobe', 'dresser', 'nightstand']) assert.ok(DESIGN_TURNS[d], d);
  assert.ok(turnable(BUILD.rustic_sofa) && turnable(BUILD.bench) && turnable(BUILD.picnic));
  assert.ok(!turnable(BUILD.rustic_lamp) && !turnable(BUILD.chest) && !turnable(BUILD.armchair) && !turnable(BUILD.wall_plank));
  assert.equal(normRot(-1), 3); assert.equal(normRot(5), 1); assert.equal(normRot(undefined), 0);
});

test('a turned piece swaps its footprint when seen from the side, and every turn of every piece has a footprint that fits its own picture', () => {
  assert.deepEqual(footprintFor(BUILD.rustic_sofa, 0), [2, 1]);
  assert.deepEqual(footprintFor(BUILD.rustic_sofa, 1), [1, 2]);
  assert.deepEqual(footprintFor(BUILD.rustic_sofa, 2), [2, 1]);
  assert.deepEqual(footprintFor(BUILD.rustic_sofa, 3), [1, 2]);
  assert.deepEqual(footprintFor(BUILD.rustic_bed, 1), [2, 1]);
  assert.deepEqual(footprintFor(BUILD.rustic_chair, 1), [1, 1]);
  assert.deepEqual(footprintFor(BUILD.rustic_table, 2), [2, 1], 'a long table seen from the other end is the same table');
  assert.deepEqual(footprintFor(BUILD.rustic_lamp, 1), [1, 1], 'a piece that cannot turn never changes');
  const book = new SpriteBook();
  registerFurniture(book); registerStructures(book); registerTurns(book);
  for (const id of allTurnIds()) {
    const d = BUILD[id];
    for (let r = 0; r < 4; r++) {
      const name = turnSprite(d, r);
      assert.ok(book.has(name), `${name} exists`);
      const [fw] = footprintFor(d, r), pm = book.get(name);
      assert.ok(pm.w >= fw * TILE - 2 && pm.w <= fw * TILE + 2, `${name}: picture ${pm.w}px wide for a ${fw}-tile footprint`);
    }
  }
});

test('building a turned piece uses its turned footprint, remembers the turn, and refuses what does not fit', () => {
  const { sim, w, a } = setup();
  const [x, y] = clearPatch(sim, a, 6, 5);
  a.x = (x + 2) * TILE; a.y = (y + 4) * TILE;
  // a sofa turned sideways is one tile wide and two tall
  sim.exec('a', { c: 'build', bid: 'rustic_sofa', tx: x + 1, ty: y + 1, rot: 1 });
  const sofa = w.thingAt(x + 1, y + 1);
  assert.ok(sofa, 'built');
  assert.equal(sofa.rot, 1);
  assert.deepEqual([sofa.w, sofa.h], [1, 2]);
  assert.equal(w.thingAt(x + 1, y + 2), sofa, 'it takes the tile below as well');
  assert.equal(w.thingAt(x + 2, y + 1), null, 'and not the one beside');
  assert.equal(placeCheck(sim, a, BUILD.rustic_chair, x + 1, y + 2), 'Occupied', 'the second tile counts');
  assert.ok(placeCheck(sim, a, BUILD.rustic_sofa, x + 1, y + 2, 1), 'a second sideways sofa overlapping its far tile is refused');
  assert.equal(placeCheck(sim, a, BUILD.rustic_sofa, x, y + 1, 1), null, 'one beside it is fine');
  assert.equal(placeCheck(sim, a, BUILD.rustic_sofa, x + 3, y + 1, 1), null, 'but next to it is fine');
  // the turn only means something to pieces that can turn
  sim.exec('a', { c: 'build', bid: 'rustic_lamp', tx: x + 4, ty: y + 1, rot: 3 });
  assert.equal(w.thingAt(x + 4, y + 1).rot || 0, 0);
  // every turn of the same sofa can be placed in free ground
  for (let rot = 0; rot < 4; rot++) {
    sim.exec('a', { c: 'build', bid: 'rustic_sofa', tx: x, ty: y + 3, rot });
    const t = w.thingAt(x, y + 3);
    assert.ok(t && t.rot === rot, 'turn ' + rot);
    assert.deepEqual([t.w, t.h], footprintFor(BUILD.rustic_sofa, rot));
    w.removeThing(t.id);
  }
  // a turned piece does not also get mirrored
  sim.exec('a', { c: 'build', bid: 'rustic_chair', tx: x + 4, ty: y + 3, rot: 1, flip: true });
  const chair = w.thingAt(x + 4, y + 3);
  assert.equal(chair.rot, 1); assert.ok(!chair.flip);
});

test('removing a turned piece takes the whole turned footprint and refunds it', () => {
  const { sim, w, a } = setup();
  w.settings.buildCost = 1;
  const [x, y] = clearPatch(sim, a, 5, 5);
  a.x = (x + 2) * TILE; a.y = (y + 4) * TILE;
  a.inv[0] = { id: 'plank', n: 60 }; a.inv[1] = { id: 'cloth', n: 40 }; a.inv[2] = { id: 'petal_pink', n: 9 }; a.rev++;
  const count = (id) => a.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0), before = { plank: count('plank'), cloth: count('cloth') };
  sim.exec('a', { c: 'build', bid: 'rustic_bed', tx: x + 1, ty: y + 1, rot: 1 });
  assert.ok(count('plank') < before.plank, 'it cost planks');
  const bed = w.thingAt(x + 1, y + 1);
  assert.ok(bed && bed.w === 2 && bed.h === 1);
  sim.exec('a', { c: 'unbuild', tx: x + 2, ty: y + 1 }); // the far end of it
  assert.ok(!w.things.has(bed.id), 'gone');
  assert.equal(w.thingAt(x + 1, y + 1), null); assert.equal(w.thingAt(x + 2, y + 1), null);
  assert.equal(count('plank'), before.plank, 'planks came back');
  assert.equal(count('cloth'), before.cloth, 'and cloth');
});

test('turns survive saving and loading, and reach the other player', () => {
  const { sim, w, a } = setup();
  const [x, y] = clearPatch(sim, a, 6, 4);
  w.record = true;
  const t = w.addThing('rustic_sofa', x + 1, y + 1, { rot: 3 });
  const t2 = w.addThing('rustic_bed', x + 3, y + 1, { rot: 2 });
  // a save keeps the turn and the footprint it makes
  const data = JSON.parse(JSON.stringify(serializeWorld(sim)));
  const { world: w2 } = restoreWorld(data);
  const s2 = w2.things.get(t.id), b2 = w2.things.get(t2.id);
  assert.equal(s2.rot, 3); assert.deepEqual([s2.w, s2.h], [1, 2]);
  assert.equal(b2.rot, 2); assert.deepEqual([b2.w, b2.h], [1, 2]);
  assert.equal(w2.thingAt(x + 1, y + 2), s2, 'both tiles are occupied again');
  // old saves (no turn recorded) load unturned
  const old = JSON.parse(JSON.stringify(serializeWorld(sim)));
  old.things = old.things.map((r) => (Array.isArray(r) ? r.slice(0, 9) : r));
  const { world: w3 } = restoreWorld(old);
  assert.equal(w3.things.get(t.id).rot || 0, 0);
  // the other player's world learns the turn from the event
  const ev = w.events.filter((e) => e[0] === 'ta' && e[1] === t.id);
  assert.ok(ev.length, 'the event was recorded');
  const client = restoreWorld(JSON.parse(JSON.stringify(serializeWorld(sim)))).world;
  client.removeThing(t.id);
  applyEvent(client, ev[0], {});
  const seen = client.things.get(t.id);
  assert.ok(seen && seen.rot === 3 && seen.w === 1 && seen.h === 2, 'the partner sees it turned');
  assert.equal(client.thingAt(x + 1, y + 2), seen);
});
