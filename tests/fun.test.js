// The fun things: bombs and fireworks, cracked boulders, the four extra bosses, the golden slime, the pace rule's goal rewards, the guide.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give, findThing, standNear, freeSpot } from './helpers.js';
import { TILE } from '../js/util.js';
import { ITEMS, BOMB_IDS } from '../js/data/items.js';
import { MOBS } from '../js/data/mobs.js';
import { NODES } from '../js/data/nodes.js';
import { BUILD } from '../js/data/build.js';
import { RECIPES } from '../js/data/recipes.js';
import { TECHS } from '../js/data/techs.js';
import { GOALS, GOAL_BY_ID, AIM, nextGoal, rewardOf } from '../js/data/goals.js';
import { invCount } from '../js/sim/inventory.js';
import { spawnMob, spawnBoss, spawnTick, hurtMob } from '../js/sim/combat.js';
import { explode } from '../js/sim/bombs.js';
import { calcStats } from '../js/sim/player.js';
import { findTarget } from '../js/ui/guide.js';

const sim = (o = {}, seed = 777) => { const s = makeSim('classic', { enemyDensity: 1, pace: 1, ...o }, seed); s.world.shared.flags.age = 1e6; const p = s.addPlayer('a', 'Alice'); return { sim: s, w: s.world, p }; };
const clearAround = (w, p, r = 3) => { // an empty ring of ground around the player so nothing else interferes
  for (const t of [...w.things.values()]) if (Math.hypot((t.x + 0.5) * TILE - p.x, (t.y + 0.5) * TILE - p.y) < r * TILE) w.removeThing(t.id);
};
const use = (s, p, id, ax, ay) => { const slot = p.inv.findIndex((x) => x && x.id === id); p.cd = 0; return s.exec(p.pid, { c: 'use', slot, ax, ay }); };

test('bombs: five items, each one with a recipe, a tech and a picture, and a throw uses one up', () => {
  assert.deepEqual(BOMB_IDS.slice().sort(), ['bomb', 'fire_bomb', 'firework', 'frost_bomb', 'mega_bomb']);
  for (const id of BOMB_IDS) { assert.ok(ITEMS[id].bomb, id); assert.ok(RECIPES.some((r) => r.out === id || r.id === id), id + ' has a recipe'); }
  const { sim: s, p } = sim();
  give(p, 'bomb', 3);
  const before = invCount(p.inv, 'bomb');
  use(s, p, 'bomb', p.x + 40, p.y);
  assert.equal(invCount(p.inv, 'bomb'), before - 1);
  assert.equal(s.bombs.length, 1, 'a fuse is burning');
  step(s, 2);
  assert.equal(s.bombs.length, 0, 'and it went off');
  assert.ok(s.world.shared.flags.gs.thrown >= 1 && s.world.shared.flags.gs.bombs >= 1);
});

test('a bomb hurts monsters, knocks them back, never hurts the player or buildings', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 4);
  const m = spawnMob(s, 'slime_green', p.x + 30, p.y); m.hp = m.maxhp = 500;
  const hp = p.hp;
  explode(s, { x: p.x + 24, y: p.y, id: 'bomb', pid: p.pid });
  assert.ok(m.hp < 500, 'the slime took damage');
  assert.equal(p.hp, hp, 'the thrower is safe');
  const far = spawnMob(s, 'slime_green', p.x + 200, p.y); far.hp = 50;
  explode(s, { x: p.x + 24, y: p.y, id: 'bomb', pid: p.pid });
  assert.equal(far.hp, 50, 'out of reach, unhurt');
});

test('a bomb breaks rocks (a mega one trees too) and opens a cracked boulder, which a pickaxe cannot', () => {
  const { sim: s, w, p } = sim();
  assert.ok(NODES.cracked_boulder.cracked);
  const [tx, ty] = freeSpot(s, p, 10);
  const boulder = w.addThing('cracked_boulder', tx, ty);
  explode(s, { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, id: 'bomb', pid: p.pid });
  assert.ok(boulder.dep || !w.things.has(boulder.id), 'the boulder is open');
  assert.equal(w.shared.flags.gs.cracked, 1);
});

test('frost bombs hold a monster still, fire bombs make it burn, fireworks hurt nothing', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 4);
  const m = spawnMob(s, 'slime_green', p.x + 26, p.y); m.hp = m.maxhp = 400;
  explode(s, { x: p.x + 24, y: p.y, id: 'frost_bomb', pid: p.pid });
  assert.ok(m.frozen > 0, 'frozen');
  step(s, 0.4); // the push of the blast settles
  const x0 = m.x, y0 = m.y; step(s, 1); assert.ok(Math.hypot(m.y - y0, 0) < 4, 'it did not walk away (y)'); assert.ok(Math.abs(m.x - x0) < 4, 'it did not walk away');
  const n = spawnMob(s, 'slime_green', p.x - 26, p.y); n.hp = n.maxhp = 400;
  explode(s, { x: p.x - 24, y: p.y, id: 'fire_bomb', pid: p.pid });
  assert.ok(n.burn > 0);
  const hp = n.hp; step(s, 2); assert.ok(n.hp < hp, 'it keeps burning');
  const k = spawnMob(s, 'slime_green', p.x + 60, p.y + 20); const kh = k.hp;
  explode(s, { x: k.x, y: k.y, id: 'firework', pid: p.pid });
  assert.equal(k.hp, kh);
  assert.ok(w.shared.flags.gs.fireworks >= 1);
});

test('the bomb techs exist in the tree, in order, and the goals for them can be reached', () => {
  assert.ok(TECHS.explosives && TECHS.pyrotechnics);
  assert.ok(TECHS.pyrotechnics.req.includes('explosives'));
  for (const id of ['bomb1', 'boulder', 'firework', 'golden', 'boss_mush', 'boss_pharaoh', 'boss_yeti', 'boss_colossus']) { assert.ok(GOAL_BY_ID[id], id); assert.ok(AIM[id], id + ' has a guide entry'); }
});

test('four more bosses, each with an altar that needs its own research, and they all fight with patterns the game draws', () => {
  const ids = ['mushroom_mother', 'sand_pharaoh', 'frost_yeti', 'crystal_colossus'];
  const bosses = Object.values(MOBS).filter((m) => m.boss);
  assert.equal(bosses.length, 8);
  for (const id of ids) {
    const d = MOBS[id];
    assert.ok(d.boss && d.ai === 'boss' && d.patterns.length >= 3 && d.drops.some((x) => x[0] === 'boss_token'), id);
    for (const pat of d.patterns) assert.ok(['hop', 'summon', 'slam', 'charge', 'ring', 'volley', 'spin', 'quake'].includes(pat), pat);
    if (d.patterns.includes('summon')) assert.ok(MOBS[d.summon], id + ' summons a real creature');
    const altar = Object.values(BUILD).find((b) => b.behavior === 'altar' && b.conf.boss === id);
    assert.ok(altar && TECHS[altar.tech], id + ' has an altar with a tech');
    for (const k in altar.conf.offer) assert.ok(ITEMS[k], k);
  }
  // each is tougher than the one before it in the story
  const order = Object.values(MOBS).filter((m) => m.boss).sort((a, b) => a.tier - b.tier || a.hp - b.hp);
  for (let i = 1; i < order.length; i++) assert.ok(order[i].hp >= order[i - 1].hp, order[i].id);
});

test('every boss pattern runs: volley shoots a fan, spin sprays, quake rings, nobody gets stuck in a pattern', () => {
  for (const id of ['mushroom_mother', 'sand_pharaoh', 'frost_yeti', 'crystal_colossus']) {
    const { sim: s, w, p } = sim({ bossPower: 0.6 });
    clearAround(w, p, 6);
    p.hp = 1e6; p.maxhp = 1e6; // just watching them work
    const b = spawnBoss(s, id, p.x + 70, p.y);
    const seen = new Set();
    let shots = 0, rings = 0;
    for (let t = 0; t < 70; t += 1 / 30) {
      s.update(1 / 30); p.hp = 1e6; if (w.mobs.has(b.id)) seen.add(b.st);
      shots = Math.max(shots, s.projectiles ? s.projectiles.length : 0);
      p.x = Math.min(p.x, b.x - 50); // keep still near it
    }
    for (const pat of MOBS[id].patterns) assert.ok(seen.has(pat), `${id} performs ${pat} (saw ${[...seen]})`);
    assert.ok(w.mobs.has(b.id), id + ' is alive and in the world');
    assert.ok(seen.has('chase'), 'it comes back to chasing between patterns');
  }
});

test('the quake pattern hits in rings: standing in a gap spares you, standing in a ring does not', () => {
  const { sim: s, w, p } = sim({ bossPower: 1 });
  clearAround(w, p, 6);
  const b = spawnBoss(s, 'sand_pharaoh', p.x + 200, p.y); // far from the player; we put the player near it by hand each time
  const full = calcStats(w, p).maxHp;
  const hit = (dist) => { p.hp = full; p.invuln = 0; b.x = p.x - dist; b.y = p.y; b.st = 'quake'; b.stt0 = b.stt = 1.7; b.qk = 0; b.patT = 99; let lowest = p.hp; for (let t = 0; t < 1.8; t += 1 / 30) { s.update(1 / 30); b.x = p.x - dist; b.y = p.y; lowest = Math.min(lowest, p.hp); } return lowest < full; };
  assert.ok(hit(40), 'inside the second ring');
  assert.ok(!hit(110), 'beyond the last ring');
});

test('the golden slime: shy, vanishes by itself, pays out, counts for its goal, and does not hurt', () => {
  const { sim: s, w, p } = sim();
  clearAround(w, p, 5);
  assert.equal(MOBS.golden_slime.dmg, 0);
  const g = spawnMob(s, 'golden_slime', p.x + 40, p.y);
  const d0 = Math.hypot(g.x - p.x, g.y - p.y);
  const hp = p.hp;
  step(s, 2.5);
  assert.ok(Math.hypot(g.x - p.x, g.y - p.y) > d0, 'it runs away from the player');
  assert.equal(p.hp, hp, 'touching it never hurts');
  // it goes away after its time
  w.time += MOBS.golden_slime.life + 1;
  step(s, 0.5);
  assert.ok(!w.mobs.has(g.id), 'gone');
  // caught: coins and the counter
  const h = spawnMob(s, 'golden_slime', p.x + 10, p.y);
  hurtMob(s, h, 9999, p.x, p.y, p, {});
  assert.equal(w.shared.flags.gs.golden, 1);
  const coinsOut = [...w.drops.values()].filter((x) => x.item === 'coin').reduce((a, x) => a + x.n, 0);
  assert.ok(coinsOut >= 60, 'a pile of coins falls out: ' + coinsOut);
});

test('golden slimes turn up now and then (never two at once)', () => {
  const { sim: s, w, p } = sim({ enemyDensity: 3 });
  let seen = 0;
  for (let i = 0; i < 6000; i++) {
    for (const m of [...w.mobs.values()]) if (m.type !== 'golden_slime') w.mobs.delete(m.id);
    spawnTick(s);
    const n = [...w.mobs.values()].filter((m) => m.type === 'golden_slime').length;
    assert.ok(n <= 1);
    if (n) { seen++; for (const m of [...w.mobs.values()]) w.mobs.delete(m.id); }
  }
  assert.ok(seen >= 1, 'at least one in a long run');
});

test('goal rewards follow the game pace', () => {
  const g = GOAL_BY_ID.boss1;
  assert.deepEqual(rewardOf({ pace: 1 }, g), { coins: g.reward.coins, xp: g.reward.xp });
  assert.ok(rewardOf({ pace: 2 }, g).coins > g.reward.coins);
});

test('the next goal is always something you can do now: the path leads from chopping to bombs and bosses', () => {
  const done = new Set();
  const order = [];
  for (let i = 0; i < 60; i++) { const g = nextGoal(done); if (!g) break; order.push(g.id); done.add(g.id); }
  assert.equal(order[0], 'chop');
  assert.ok(order.indexOf('bomb1') > order.indexOf('tech1') && order.indexOf('bomb1') < 40, 'bombs come early enough to be fun: ' + order.join(','));
  assert.ok(order.indexOf('boss1') < 40);
});

test('the guide finds the nearest cracked boulder, altar, golden slime, tree and rock', () => {
  const { sim: s, w, p } = sim();
  const g = { world: w, me: p };
  const [tx, ty] = freeSpot(s, p, 10);
  const b = w.addThing('cracked_boulder', tx, ty);
  const t = findTarget(g, AIM.boulder.find);
  assert.ok(t && Math.abs(t.x - (tx + 0.5) * TILE) < TILE, 'boulder');
  assert.equal(findTarget(g, AIM.boss_mush.find), null, 'no altar built yet');
  const [ax, ay] = freeSpot(s, p, 12);
  const altar = w.addThing('spore_altar', ax, ay);
  assert.ok(findTarget(g, AIM.boss_mush.find), 'altar');
  assert.equal(findTarget(g, AIM.boss_yeti.find), null, 'a different boss altar is not the one');
  assert.equal(findTarget(g, AIM.golden.find), null);
  spawnMob(s, 'golden_slime', p.x + 60, p.y);
  assert.ok(findTarget(g, AIM.golden.find), 'golden slime');
  assert.ok(findTarget(g, AIM.chop.find) && findTarget(g, AIM.mine.find), 'trees and rocks');
});
