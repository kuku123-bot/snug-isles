// The Remove tool clears plants (berry bushes...), opened treasure chests and the leftovers of gathering, and nothing else natural.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, freeSpot } from './helpers.js';
import { TILE } from '../js/util.js';
import { clearableNode } from '../js/sim/commands.js';
import { invCount } from '../js/sim/inventory.js';

function setup() {
  const sim = makeSim('dreamy'), p = sim.addPlayer('a', 'Alice', {}), w = sim.world;
  const [fx, fy] = freeSpot(sim, p, 8);
  p.x = (fx + 0.5) * TILE; p.y = (fy + 3) * TILE;
  const spot = (dx) => { const x = fx + dx, y = fy; return [x, y]; };
  return { sim, p, w, fx, fy, spot };
}
const remove = (sim, p, x, y) => sim.exec(p.pid, { c: 'unbuild', tx: x, ty: y });

test('a berry bush can be removed, and a ripe one gives its berries', () => {
  const { sim, p, w, spot } = setup();
  const [x, y] = spot(0);
  const bush = w.addThing('berry_bush', x, y, {});
  assert.ok(clearableNode(bush));
  const before = invCount(p.inv, 'berries');
  remove(sim, p, x, y);
  assert.equal(w.thingAt(x, y), null, 'the bush is gone');
  assert.ok(invCount(p.inv, 'berries') >= before + 2, 'ripe berries came with it');
  // one that was already picked clears without a harvest
  const [x2, y2] = spot(1);
  w.addThing('berry_bush', x2, y2, { dep: 1 });
  const n = invCount(p.inv, 'berries');
  remove(sim, p, x2, y2);
  assert.equal(w.thingAt(x2, y2), null);
  assert.equal(invCount(p.inv, 'berries'), n);
});

test('flowers, tall grass, stumps and spent rocks clear too; trees and rocks that are still full do not', () => {
  const { sim, p, w, spot } = setup();
  for (const [i, type, dep, should] of [[0, 'flower_pink', 0, true], [1, 'tall_grass', 0, true], [2, 'oak', 1, true], [3, 'rock', 1, true], [4, 'oak', 0, false], [5, 'rock', 0, false]]) {
    const [x, y] = spot(i);
    w.addThing(type, x, y, { dep });
    remove(sim, p, x, y);
    assert.equal(!w.thingAt(x, y), should, `${type}${dep ? ' (spent)' : ''}`);
  }
});

test('an opened treasure chest can be removed (a little wood), an unopened one cannot, and dig spots stay', () => {
  const { sim, p, w, spot } = setup();
  const [x, y] = spot(0), [x2, y2] = spot(1), [x3, y3] = spot(2);
  w.addThing('chest_wild', x, y, { dep: 1 });
  const wood = invCount(p.inv, 'wood');
  remove(sim, p, x, y);
  assert.equal(w.thingAt(x, y), null);
  assert.ok(invCount(p.inv, 'wood') >= wood + 1);
  w.addThing('chest_wild', x2, y2, {});
  remove(sim, p, x2, y2);
  assert.ok(w.thingAt(x2, y2), 'the closed chest still holds its loot');
  w.addThing('dig_spot', x3, y3, {});
  remove(sim, p, x3, y3);
  assert.ok(w.thingAt(x3, y3), 'buried treasure is not cleared away');
});

test('clearing is limited to your own land and to what you can reach', () => {
  const { sim, p, w, spot } = setup();
  const [x, y] = spot(0);
  w.addThing('berry_bush', x, y, {});
  p.x = (x + 30) * TILE; // far away
  remove(sim, p, x, y);
  assert.ok(w.thingAt(x, y), 'too far to reach');
});
