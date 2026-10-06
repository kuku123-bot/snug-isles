// Sitting and sleeping: seats per piece, lying down any time, never ending up stuck in a bed, and the cozy bonus for sleeping in a cozy room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step } from './helpers.js';
import { TILE } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { wallCodeOf, floorCodeOf } from '../js/sim/world.js';
import { seatSlots, bedSpot, pillowAt, exitSpot, standUp, furnitureUnder, restingThing, unstickSpot, standsFree } from '../js/sim/furniture.js';
import { seatFacing, headEnd, turnable, footprintFor } from '../js/data/facing.js';

/** a clear w x h block of owned ground (plus a margin of 2) near the player; anything standing on it is cleared. Returns its top-left tile. */
function patch(sim, p, w, h, margin = 2) {
  const W = sim.world;
  for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = Math.floor(p.x / TILE) + dx, y0 = Math.floor(p.y / TILE) + dy;
    let ok = true;
    for (let y = y0 - margin; y < y0 + h + margin && ok; y++) for (let x = x0 - margin; x < x0 + w + margin && ok; x++) {
      if (!W.inb(x, y) || !W.isTileOwned(x, y)) { ok = false; break; }
      const i = W.idx(x, y);
      if ((W.solid[i] & 1) && !(W.occ[i] && W.things.get(W.occ[i]) && !W.thingSolid(W.things.get(W.occ[i])))) { if (W.occ[i] && W.things.get(W.occ[i])) continue; ok = false; }
      if (W.wall[i] || W.floor[i]) ok = false;
    }
    if (!ok) continue;
    for (let y = y0 - margin; y < y0 + h + margin; y++) for (let x = x0 - margin; x < x0 + w + margin; x++) { const t = W.thingAt(x, y); if (t) W.removeThing(t.id); }
    let free = true;
    for (let y = y0 - margin; y < y0 + h + margin; y++) for (let x = x0 - margin; x < x0 + w + margin; x++) if (W.solid[W.idx(x, y)] & 1) free = false;
    if (free) return [x0, y0];
  }
  throw new Error('no clear ground near the player');
}
const fresh = (preset = 'dreamy') => { const sim = makeSim(preset, { enemyDensity: 0 }); const a = sim.addPlayer('a', 'Alice', {}); return { sim, w: sim.world, a }; };
const day = (sim) => { sim.world.time = sim.world.settings.dayLength * 0.35; };
const night = (sim) => { sim.world.time = sim.world.settings.dayLength * 0.8; };
/** put a piece down (as the world would after a build) and stand the player in front of it */
function put(sim, p, id, rot = 0, at) {
  const [x, y] = at || patch(sim, p, 4, 4), t = sim.world.addThing(id, x + 1, y + 1, { rot });
  stand(p, t);
  return t;
}
function stand(p, t) { p.x = (t.x + t.w / 2) * TILE; p.y = (t.y + t.h + 1) * TILE; p.vx = p.vy = 0; }
const inside = (t, x, y) => x >= t.x * TILE && x < (t.x + t.w) * TILE && y - 3 >= t.y * TILE && y - 3 < (t.y + t.h) * TILE;
const teleports = (sim, pid) => (sim.tells || []).filter(([id, ev]) => id === pid && ev.t === 'teleport').map(([, ev]) => ev);

test('a chair seats one, a sofa or bench one per cushion, a swing two; they face the way the piece faces', () => {
  const { sim, w, a } = fresh();
  const [x, y] = patch(sim, a, 6, 6);
  for (let rot = 0; rot < 4; rot++) {
    const chair = w.addThing('rustic_chair', x + 1, y + 1, { rot });
    const s = seatSlots(chair);
    assert.equal(s.length, 1);
    assert.equal(s[0].dir, rot, 'a chair turned to rot faces rot');
    w.removeThing(chair.id);
    const sofa = w.addThing('rustic_sofa', x + 1, y + 1, { rot });
    const ss = seatSlots(sofa);
    assert.equal(ss.length, 2);
    assert.ok(ss.every((q) => q.dir === rot));
    if (rot % 2 === 0) assert.ok(ss[0].x !== ss[1].x && ss[0].y === ss[1].y, 'side by side when facing front or back');
    else assert.ok(ss[0].y !== ss[1].y && ss[0].x === ss[1].x, 'one behind the other when facing sideways');
    for (const q of ss) assert.ok(q.tx >= sofa.x && q.tx < sofa.x + sofa.w && q.ty >= sofa.y && q.ty < sofa.y + sofa.h, 'every seat is on the piece');
    w.removeThing(sofa.id);
  }
  const swing = w.addThing('swing', x + 1, y + 1, {});
  assert.equal(seatSlots(swing).length, 2);
  assert.ok(seatSlots(swing).every((q) => q.ty === swing.y + 1), 'a swing seats people on its front row');
  const arm = w.addThing('armchair', x + 4, y + 4, {});
  assert.equal(seatSlots(arm).length, 1);
  assert.equal(seatSlots(arm)[0].dir, 0);
});

test('sitting: the nearest free cushion, two people on a sofa, nobody else on a taken seat, and the hand button gets you up', () => {
  const { sim, w, a } = fresh();
  const b = sim.addPlayer('b', 'Bea', {});
  const sofa = put(sim, a, 'rustic_sofa', 0);
  const c = sim.addPlayer('c', 'Cy', {});
  stand(b, sofa); stand(c, sofa);
  a.x = (sofa.x + 0.5) * TILE; // Alice is nearest the left cushion
  sim.exec('a', { c: 'interact', id: sofa.id });
  assert.deepEqual(a.sit, { id: sofa.id, i: 0 }, 'the nearest cushion');
  const slot = seatSlots(sofa)[0];
  assert.equal(a.x, slot.x); assert.equal(a.y, slot.y);
  assert.ok(teleports(sim, 'a').some((e) => e.x === slot.x && e.y === slot.y), 'she is moved onto it');
  b.x = (sofa.x + 0.5) * TILE; // Bea is also nearest the left one, which is taken
  sim.exec('b', { c: 'interact', id: sofa.id });
  assert.deepEqual(b.sit, { id: sofa.id, i: 1 }, 'the other cushion');
  sim.exec('c', { c: 'interact', id: sofa.id });
  assert.equal(c.sit, null, 'a full sofa takes nobody else');
  assert.ok((sim.tells || []).some(([id, ev]) => id === 'c' && ev.t === 'toast' && /sitting/i.test(ev.text || '')), 'and says why');
  sim.exec('a', { c: 'interact', id: sofa.id });
  assert.equal(a.sit, null, 'the hand button on your own seat stands you up');
  sim.exec('c', { c: 'interact', id: sofa.id });
  assert.deepEqual(c.sit, { id: sofa.id, i: 0 }, 'and the cushion is free again');
});

test('interacting with something else while sitting stands you up first', () => {
  const { sim, w, a } = fresh();
  const [x, y] = patch(sim, a, 7, 4);
  const chair = w.addThing('rustic_chair', x + 1, y + 1, {});
  const chest = w.addThing('chest', x + 3, y + 1, {});
  stand(a, chair);
  sim.exec('a', { c: 'interact', id: chair.id });
  assert.ok(a.sit);
  sim.exec('a', { c: 'interact', id: chest.id });
  assert.equal(a.sit, null);
});

test('lying down works any time of day; only a night skips', () => {
  const { sim, w, a } = fresh();
  day(sim);
  const bed = put(sim, a, 'rustic_bed', 0);
  sim.exec('a', { c: 'interact', id: bed.id });
  assert.ok(a.sleeping, 'lying down at noon');
  assert.equal(a.bed, bed.id);
  assert.equal(a.spawn.id, bed.id, 'and the bed is where you wake after fainting');
  const spot = bedSpot(bed);
  assert.equal(a.x, spot.x); assert.equal(a.y, spot.y);
  assert.ok(inside(bed, a.x, a.y), 'lying on the bed, on the pillow end');
  const t0 = w.time;
  step(sim, 5);
  assert.ok(!sim.skipping, 'a daytime rest skips nothing');
  assert.ok(w.time - t0 < 10, 'time moved at the normal pace');
  assert.ok(a.sleeping);
  night(sim);
  step(sim, 1);
  assert.ok(sim.skipping, 'the night skips once it is dark and you are in bed');
});

test('getting up from any bed, turned any way, leaves you standing free beside it', () => {
  const { sim, w, a } = fresh();
  const beds = Object.values(BUILD).filter((d) => d.behavior === 'bed');
  assert.ok(beds.length >= 12, 'every bed is covered: ' + beds.length);
  for (const d of beds) {
    for (let rot = 0; rot < (turnable(d) ? 4 : 1); rot++) {
      const bed = put(sim, a, d.id, rot);
      sim.exec('a', { c: 'interact', id: bed.id });
      assert.ok(a.sleeping, `${d.id}/${rot}: lying down`);
      assert.ok(inside(bed, a.x, a.y), `${d.id}/${rot}: on the bed`);
      sim.tells = [];
      sim.exec('a', { c: 'interact', id: bed.id }); // the hand button again
      assert.ok(!a.sleeping, `${d.id}/${rot}: up`);
      assert.ok(standsFree(w, a.x, a.y), `${d.id}/${rot}: not stuck (${a.x},${a.y})`);
      assert.ok(!inside(bed, a.x, a.y), `${d.id}/${rot}: beside the bed, not in it`);
      assert.ok(teleports(sim, 'a').some((e) => e.x === a.x && e.y === a.y), `${d.id}/${rot}: told where they are`);
      w.removeThing(bed.id);
    }
  }
});

test('you step out on the side the bed faces, and sideways when that is blocked', () => {
  const { sim, w, a } = fresh();
  const [x, y] = patch(sim, a, 3, 4);
  const bed = w.addThing('rustic_bed', x + 1, y + 1, { rot: 0 }); // foot points down
  stand(a, bed);
  sim.exec('a', { c: 'interact', id: bed.id });
  sim.exec('a', { c: 'wake' }); // (the player's own screen moves them; here the simulation only clears the flag)
  a.x = bedSpot(bed).x; a.y = bedSpot(bed).y; a.sleeping = true; a.bed = bed.id;
  const front = exitSpot(w, a);
  assert.equal(Math.floor(front.x / TILE), bed.x, 'in line with the bed');
  assert.equal(Math.floor((front.y - 3) / TILE), bed.y + bed.h, 'at the foot end, the side it faces');
  // wall off the foot end
  const wall = wallCodeOf('wall_plank');
  w.setWall(bed.x, bed.y + bed.h, wall, 0);
  const side = exitSpot(w, a);
  assert.ok(standsFree(w, side.x, side.y));
  assert.ok(Math.abs(Math.floor(side.x / TILE) - bed.x) === 1, 'beside the bed, on a side');
  // wall off the whole first ring: it still finds somewhere to stand
  for (let yy = bed.y - 1; yy <= bed.y + bed.h; yy++) for (let xx = bed.x - 1; xx <= bed.x + 1; xx++) if (!inside(bed, (xx + 0.5) * TILE, (yy + 0.5) * TILE + 4)) w.setWall(xx, yy, wall, 0);
  const out = exitSpot(w, a);
  assert.ok(out && standsFree(w, out.x, out.y), 'never left inside the bed');
  assert.ok(!inside(bed, out.x, out.y));
});

test('taking the bed apart under a sleeper (or with the remove tool) stands them up beside it', () => {
  const { sim, w, a } = fresh();
  const b = sim.addPlayer('b', 'Bea', {});
  const bed = put(sim, a, 'rustic_bed', 1);
  sim.exec('a', { c: 'interact', id: bed.id });
  assert.ok(a.sleeping);
  stand(b, bed); b.x += 4;
  w.techs.add('cottage_style');
  sim.exec('b', { c: 'unbuild', tx: bed.x, ty: bed.y });
  assert.ok(!w.things.has(bed.id), 'the bed is gone');
  assert.ok(!a.sleeping, 'she is up');
  assert.ok(standsFree(w, a.x, a.y), 'and stands on free ground');
  // any other way a bed disappears is caught on the next tick
  const bed2 = put(sim, a, 'rustic_bed', 0);
  sim.exec('a', { c: 'interact', id: bed2.id });
  assert.ok(a.sleeping);
  w.removeThing(bed2.id);
  step(sim, 0.2);
  assert.ok(!a.sleeping, 'woken');
  assert.ok(standsFree(w, a.x, a.y));
  // a seat taken away from under a sitter
  const chair = put(sim, a, 'rustic_chair', 0);
  sim.exec('a', { c: 'interact', id: chair.id });
  assert.ok(a.sit);
  w.removeThing(chair.id);
  step(sim, 0.2);
  assert.equal(a.sit, null);
});

test('leaving the game while lying in a bed leaves your character standing beside it', () => {
  const { sim, w, a } = fresh();
  const bed = put(sim, a, 'rustic_bed', 2);
  sim.exec('a', { c: 'interact', id: bed.id });
  assert.ok(a.sleeping);
  sim.removePlayer('a');
  assert.ok(!a.online && !a.sleeping);
  assert.ok(standsFree(w, a.x, a.y), 'saved in a free spot, not inside the bed');
});

test('a player stuck inside something solid is moved to the nearest free ground', () => {
  const { sim, w, a } = fresh();
  const bed = put(sim, a, 'rustic_bed', 0);
  const inBed = { x: (bed.x + 0.5) * TILE, y: (bed.y + 1) * TILE };
  assert.ok(!standsFree(w, inBed.x, inBed.y), 'a bed is solid');
  const free = unstickSpot(w, inBed.x, inBed.y);
  assert.ok(free && standsFree(w, free.x, free.y));
  assert.ok(Math.hypot(free.x - inBed.x, free.y - inBed.y) < 3 * TILE, 'close by');
  assert.equal(unstickSpot(w, free.x, free.y), null, 'a free spot stays where it is');
});

test('sleeping in a cozy room counts as being in it: you wake up cozy and rested', () => {
  const { sim, w, a } = fresh('dreamy');
  const [fx, fy] = patch(sim, a, 7, 7);
  const wall = wallCodeOf('wall_plank'), floor = floorCodeOf('floor_plank');
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { if (x === 0 || y === 0 || x === 6 || y === 6) w.setWall(fx + x, fy + y, wall, 0); else w.setFloor(fx + x, fy + y, floor); }
  const bed = w.addThing('rustic_bed', fx + 1, fy + 1, { rot: 0 });
  w.addThing('rustic_sofa', fx + 3, fy + 5, {});
  w.addThing('rustic_lamp', fx + 5, fy + 1, {});
  w.addThing('rustic_bookshelf', fx + 4, fy + 1, {});
  w.addThing('rustic_rug', fx + 3, fy + 3, {});
  w.addThing('rustic_chair', fx + 1, fy + 5, { rot: 1 });
  a.x = (fx + 3.5) * TILE; a.y = (fy + 4) * TILE;
  sim.computeCozy(a);
  assert.ok(a.cozy >= 10, 'a cozy room: ' + a.cozy);
  night(sim);
  stand(a, bed); a.x = (bed.x + 0.5) * TILE; a.y = (bed.y + 3) * TILE - 4; // beside the foot of the bed, inside the room
  sim.exec('a', { c: 'interact', id: bed.id });
  assert.ok(a.sleeping);
  assert.ok(a.cozy >= 10, 'still cozy while lying in the bed (it used to read 0 from inside the solid bed): ' + a.cozy);
  step(sim, 25);
  assert.ok(!a.sleeping, 'morning');
  assert.ok(standsFree(w, a.x, a.y), 'standing free');
  assert.ok(a.buffs.cozy, 'woke up cozy');
});

test('a screen that does not know the bed id finds it by position (as a partner or the player does)', () => {
  const { sim, w, a } = fresh();
  const bed = put(sim, a, 'rustic_bed', 3);
  const spot = bedSpot(bed);
  const lyer = { sleeping: true, sit: null, x: spot.x, y: spot.y };
  assert.equal(restingThing(w, lyer), bed);
  assert.equal(furnitureUnder(w, lyer, 'bed'), bed);
  assert.equal(furnitureUnder(w, lyer, 'seat'), null);
  const chair = put(sim, a, 'rustic_chair', 0);
  const sl = seatSlots(chair)[0];
  assert.equal(restingThing(w, { sleeping: false, sit: { id: 0 }, x: sl.x, y: sl.y }), chair);
  assert.equal(restingThing(w, { sleeping: false, sit: null, x: sl.x, y: sl.y }), null);
});

test('every bed turn lies the head on its pillow, and the head end follows the footprint', () => {
  const { sim, w, a } = fresh();
  for (const id of ['rustic_bed', 'gothic_bed', 'celestial_bed']) {
    for (let rot = 0; rot < 4; rot++) {
      const bed = put(sim, a, id, rot), pl = pillowAt(bed), def = BUILD[id];
      assert.equal(pl.head, headEnd(def, rot));
      assert.ok(pl.x >= bed.x * TILE && pl.x <= (bed.x + bed.w) * TILE && pl.y >= bed.y * TILE - 6 && pl.y <= (bed.y + bed.h) * TILE, `${id}/${rot}: the pillow is on the bed`);
      const [fw, fh] = footprintFor(def, rot);
      assert.deepEqual([bed.w, bed.h], [fw, fh]);
      w.removeThing(bed.id);
    }
  }
  // seat facing follows the turn
  assert.equal(seatFacing(BUILD.rustic_chair, 3), 3);
  assert.equal(seatFacing(BUILD.armchair, 3), 0, 'a piece that cannot turn always faces front');
});

test('waking at dawn and the wake command both leave the sleeper free; the wake command trusts the player\'s own screen', () => {
  const { sim, w, a } = fresh();
  const bed = put(sim, a, 'rustic_bed', 0);
  sim.exec('a', { c: 'interact', id: bed.id });
  // the player's screen steps out by itself, then tells the host
  const spot = exitSpot(w, a);
  a.x = spot.x; a.y = spot.y; // (what the client does locally, then sends in its position reports)
  sim.tells = [];
  sim.exec('a', { c: 'wake' });
  assert.ok(!a.sleeping);
  assert.equal(teleports(sim, 'a').length, 0, 'no second move');
  assert.equal(a.x, spot.x);
  // dawn: the host does the stepping out
  const bed2 = put(sim, a, 'rustic_bed', 2);
  night(sim);
  sim.exec('a', { c: 'interact', id: bed2.id });
  step(sim, 25);
  assert.ok(!a.sleeping, 'morning');
  assert.ok(standsFree(w, a.x, a.y));
  assert.ok(teleports(sim, 'a').length > 0, 'told where they were stepped out to');
  // standUp on someone doing nothing is harmless
  assert.equal(standUp(sim, a), null);
});
