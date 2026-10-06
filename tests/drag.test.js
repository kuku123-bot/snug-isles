// Drag and drop of items between slots: the hint the screen gives (canDrop) must agree with what the simulation really does with a move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, give } from './helpers.js';
import { TILE } from '../js/util.js';
import { stackAt, canDrop, refKey } from '../js/ui/drag.js';
import { HOTBAR } from '../js/sim/player.js';

function setup() {
  const sim = makeSim('dreamy', { enemyDensity: 0 }), w = sim.world, p = sim.addPlayer('a', 'Alice', {});
  for (let i = 0; i < p.inv.length; i++) p.inv[i] = null;
  for (const t of ['carpentry', 'stonecraft', 'smelting', 'frostcraft']) w.techs.add(t);
  w.settings.buildCost = 0;
  const g = { me: p, world: w };
  const near = (id) => {
    for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = Math.floor(p.x / TILE) + dx, ty = Math.floor(p.y / TILE) + dy;
      if (!w.inb(tx, ty) || !w.isTileOwned(tx, ty) || (w.solid[w.idx(tx, ty)] & 1) || w.occ[w.idx(tx, ty)]) continue;
      const t = w.addThing(id, tx, ty, {});
      p.x = (t.x + t.w / 2) * TILE; p.y = (t.y + t.h + 1) * TILE;
      return t;
    }
    throw new Error('no room');
  };
  return { sim, w, p, g, near };
}
const move = (sim, from, to) => sim.exec('a', { c: 'inv', op: 'move', from, to, n: 0 });

test('slot references find the right stack in the bag, on the body, in a chest and in a machine', () => {
  const { sim, w, p, g, near } = setup();
  p.inv[3] = { id: 'plank', n: 12 }; p.equip.body = { id: 'tunic_cloth', n: 1 };
  assert.equal(stackAt(g, { k: 'p', i: 3 }).n, 12);
  assert.equal(stackAt(g, { k: 'p', i: 4 }), null);
  assert.equal(stackAt(g, { k: 'e', slot: 'body' }).id, 'tunic_cloth');
  assert.equal(stackAt(g, { k: 'e', slot: 'head' }), null);
  const chest = near('chest'); chest.s = { inv: Array(8).fill(null) }; chest.s.inv[2] = { id: 'wood', n: 5 };
  assert.equal(stackAt(g, { k: 't', id: chest.id, i: 2 }).id, 'wood');
  const furn = near('furnace'); furn.s = { inp: { id: 'copper_ore', n: 3 }, fuel: null, out: null };
  assert.equal(stackAt(g, { k: 'm', id: furn.id, f: 'inp' }).n, 3);
  assert.equal(stackAt(g, { k: 'm', id: furn.id, f: 'fuel' }), null);
  assert.equal(stackAt(g, { k: 't', id: 99999, i: 0 }), null, 'a chest that is gone');
  assert.equal(refKey({ k: 'p', i: 3 }), '{"k":"p","i":3}', 'the same key the slot elements carry');
});

test('what the screen hints is what the simulation does: wearing, charms, food-only chests, machines', () => {
  const { sim, w, p, g, near } = setup();
  const chest = near('chest'), icebox = near('fridge'), furn = near('furnace');
  for (const t of [chest, icebox]) { t.s = { inv: Array(8).fill(null) }; }
  furn.s = { inp: null, fuel: null, out: null };
  p.x = (furn.x + 1) * TILE; // close enough to all three (they were placed next to each other)
  const cases = [
    ['tunic_cloth', { k: 'e', slot: 'body' }, true], ['tunic_cloth', { k: 'e', slot: 'head' }, false], ['hat_cloth', { k: 'e', slot: 'head' }, true], ['boots_cloth', { k: 'e', slot: 'feet' }, true],
    ['charm_speed', { k: 'e', slot: 'charm' }, true], ['charm_speed', { k: 'e', slot: 'body' }, false], ['pickaxe_wood', { k: 'e', slot: 'charm' }, false],
    ['wood', { k: 't', id: chest.id, i: 0 }, true], ['wood', { k: 't', id: icebox.id, i: 0 }, false], ['berries', { k: 't', id: icebox.id, i: 0 }, true],
    ['copper_ore', { k: 'm', id: furn.id, f: 'inp' }, true], ['wood', { k: 'm', id: furn.id, f: 'inp' }, true], ['feather', { k: 'm', id: furn.id, f: 'inp' }, false],
    ['wood', { k: 'm', id: furn.id, f: 'fuel' }, true], ['copper_ore', { k: 'm', id: furn.id, f: 'fuel' }, false], ['copper_ore', { k: 'm', id: furn.id, f: 'out' }, false],
    ['plank', { k: 'p', i: 20 }, true],
  ];
  for (const [item, to, want] of cases) {
    for (let i = 0; i < p.inv.length; i++) p.inv[i] = null;
    p.equip = { head: null, body: null, feet: null, charm: null };
    chest.s.inv.fill(null); icebox.s.inv.fill(null); furn.s.inp = furn.s.fuel = furn.s.out = null;
    p.inv[10] = { id: item, n: 1 };
    const hint = canDrop(g, to, p.inv[10]);
    move(sim, { k: 'p', i: 10 }, to);
    const moved = p.inv[10] === null;
    assert.equal(hint, want, `${item} -> ${refKey(to)}: the hint`);
    assert.equal(moved, want, `${item} -> ${refKey(to)}: what actually happened`);
  }
});

test('moving within the bag and onto the hotbar: empty slot moves, same item merges, different item swaps, big stacks survive', () => {
  const { sim, p } = setup();
  p.inv[12] = { id: 'plank', n: 50 }; p.inv[2] = { id: 'stone', n: 7 }; p.inv[3] = { id: 'plank', n: 20 }; p.inv[13] = { id: 'wood', n: 9999 };
  move(sim, { k: 'p', i: 12 }, { k: 'p', i: 2 });
  assert.deepEqual([p.inv[2], p.inv[12]], [{ id: 'plank', n: 50 }, { id: 'stone', n: 7 }], 'a different item swaps');
  move(sim, { k: 'p', i: 2 }, { k: 'p', i: 3 });
  assert.deepEqual([p.inv[2], p.inv[3]], [null, { id: 'plank', n: 70 }], 'the same item merges');
  move(sim, { k: 'p', i: 13 }, { k: 'p', i: 5 });
  assert.deepEqual([p.inv[13], p.inv[5]], [null, { id: 'wood', n: 9999 }], 'a 9999 stack moves whole');
  assert.ok(5 < HOTBAR, 'slot 5 is on the hotbar');
  p.inv[6] = { id: 'wood', n: 9990 };
  move(sim, { k: 'p', i: 5 }, { k: 'p', i: 6 });
  assert.deepEqual([p.inv[5], p.inv[6]], [{ id: 'wood', n: 9990 }, { id: 'wood', n: 9999 }], 'two nearly full stacks swap instead of merging into a hole');
  const total = p.inv.reduce((n, s) => n + (s && s.id === 'wood' ? s.n : 0), 0);
  assert.equal(total, 9990 + 9999, 'nothing lost, nothing made');
  move(sim, { k: 'p', i: 5 }, { k: 'p', i: 999 });
  assert.equal(p.inv[5].n, 9990, 'a slot that does not exist changes nothing');
});
