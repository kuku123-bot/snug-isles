// Every world rule (difficulty option) must visibly change the game, in the direction its label promises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../js/sim/sim.js';
import { makeSim, step, give, freeSpot, findThing, standNear } from './helpers.js';
import { TILE, RNG } from '../js/util.js';
import { MOBS } from '../js/data/mobs.js';
import { NODES } from '../js/data/nodes.js';
import { BUILD } from '../js/data/build.js';
import { OPTIONS, presetSettings } from '../js/data/difficulty.js';
import { invCount } from '../js/sim/inventory.js';
import { hurtPlayer, killPlayer, spawnMob, spawnBoss } from '../js/sim/combat.js';
import { rollNodeDrops, breakNode } from '../js/sim/gather.js';
import { addXp } from '../js/sim/player.js';
import { xpForLevel } from '../js/data/skills.js';

const sim = (o = {}, seed = 4242) => { const s = makeSim('classic', { enemyDensity: 1, ...o }, seed); const p = s.addPlayer('a', 'Alice'); return { sim: s, w: s.world, p }; };
const hostile = (w) => [...w.mobs.values()].filter((m) => MOBS[m.type].hostile && !m.boss);
const night = (s) => { s.world.time = s.world.settings.dayLength * 0.85; };
const avg = (f, n = 200) => { let a = 0; for (let i = 0; i < n; i++) a += f(i); return a / n; };

test('every option has a rule test below (adding an option without a test fails here)', () => {
  const covered = new Set(['worldSize', 'dayLength', 'weather', 'startKit', 'enemyDensity', 'enemyDamage', 'enemyHealth', 'aggro', 'nightDanger', 'bossPower', 'resourceYield', 'resourceRespawn', 'xpRate', 'landPrice', 'buildCost', 'techCost', 'hunger', 'regen', 'death', 'sleep']);
  assert.deepEqual(OPTIONS.map((o) => o.id).filter((id) => !covered.has(id)), []);
});

test('worldSize / startKit shape the new world', () => {
  for (const n of [7, 9, 11]) assert.equal(Sim.create({ seed: 1, settings: { ...presetSettings('classic'), worldSize: n } }).world.gw, n);
  const bare = sim({ startKit: 'bare' }), gen = sim({ startKit: 'generous' });
  assert.equal(bare.p.inv.filter(Boolean).length, 1, 'bare: just the pickaxe');
  assert.equal(bare.w.coins, 0);
  assert.ok(invCount(gen.p.inv, 'pickaxe_stone') === 1 && invCount(gen.p.inv, 'plank') >= 20, 'generous: stone tools and materials');
  assert.equal(gen.w.coins, 120);
});

test('enemyDensity: none means peaceful, swarms means more than normal', () => {
  const count = (d) => { const { sim: s, w } = sim({ enemyDensity: d }); night(s); let sum = 0, n = 0; for (let t = 0; t < 120; t += 1) { night(s); step(s, 1); sum += hostile(w).length; n++; } return sum / n; }; // average crowd over two minutes of night
  assert.equal(count(0), 0, 'peaceful');
  const few = count(0.5), norm = count(1), many = count(2.4);
  assert.ok(few < norm && norm < many, `few ${few.toFixed(1)} < normal ${norm.toFixed(1)} < swarms ${many.toFixed(1)}`);
});

test('nightDanger: calm nights are quieter than fierce ones', () => {
  const count = (d) => { const { sim: s, w } = sim({ nightDanger: d, enemyDensity: 1.6 }); let sum = 0, n = 0; for (let t = 0; t < 120; t += 1) { night(s); step(s, 1); sum += hostile(w).length; n++; } return sum / n; };
  assert.ok(count(0) < count(2), 'fierce nights bring more monsters');
});

test('enemyDamage scales the hits you take, enemyHealth the monsters you fight, bossPower the bosses', () => {
  const hit = (mult) => { const { sim: s, p } = sim({ enemyDamage: mult }); p.hp = 1000; p.shield = 0; hurtPlayer(s, p, 10, p.x + 4, p.y, 'mob'); return 1000 - p.hp; };
  assert.equal(hit(0.5), 5); assert.equal(hit(1), 10); assert.equal(hit(2.5), 25);
  const hp = (type, o) => { const { sim: s } = sim(o); return spawnMob(s, type, 100, 100).hp; };
  assert.equal(hp('slime_green', { enemyHealth: 1 }), MOBS.slime_green.hp);
  assert.equal(hp('slime_green', { enemyHealth: 2.5 }), Math.round(MOBS.slime_green.hp * 2.5));
  assert.equal(hp('slime_king', { bossPower: 1.6 }), Math.round(MOBS.slime_king.hp * 1.6));
  assert.equal(hp('slime_king', { enemyHealth: 2.5, bossPower: 1 }), MOBS.slime_king.hp, 'bosses ignore the monster toughness rule');
});

test('aggro: sleepy monsters ignore you from further away than alert ones', () => {
  const closing = (a) => {
    const { sim: s, w, p } = sim({ aggro: a });
    p.x = s.spawn.x; p.y = s.spawn.y; p.shield = 99;
    const ms = []; for (let i = 0; i < 16; i++) { const ang = (i / 16) * Math.PI * 2; const m = spawnMob(s, 'slime_green', p.x + Math.cos(ang) * 70, p.y + Math.sin(ang) * 70); ms.push(m); }
    w.time = w.settings.dayLength * 0.4; step(s, 3);
    return avg((i) => 70 - Math.hypot(ms[i].x - p.x, ms[i].y - p.y), ms.length);
  };
  assert.ok(closing(1.5) > closing(0.5) + 3, 'alert monsters come closer');
});

test('resourceYield scales gathering, resourceRespawn the regrowth', () => {
  const wood = (y) => { const { sim: s, p } = sim({ resourceYield: y }); return avg(() => rollNodeDrops(s, NODES.oak, p).filter((d) => d.id === 'wood').reduce((a, d) => a + d.n, 0), 600); };
  const lo = wood(0.5), mid = wood(1), hi = wood(3);
  assert.ok(lo < mid && mid < hi, `yield ${lo.toFixed(2)} < ${mid.toFixed(2)} < ${hi.toFixed(2)}`);
  assert.ok(hi > mid * 2.4 && lo < mid * 0.7, 'roughly proportional');
  const regrow = (r) => { const { sim: s, w, p } = sim({ resourceRespawn: r }); const tree = findThing(s, 'oak', p); breakNode(s, tree, p); return tree.t; };
  assert.ok(regrow(4) * 3 < regrow(0.5), 'very fast regrowth is much quicker than slow');
});

test('xpRate, landPrice', () => {
  const total = (p) => { let t = p.xp; for (let l = 1; l < p.level; l++) t += xpForLevel(l); return t; };
  const xp = (r) => { const { w, p } = sim({ xpRate: r }); p.xp = 0; p.level = 1; addXp(w, p, 10, false); return total(p); };
  assert.ok(xp(0.5) < xp(1) && xp(1) < xp(3), 'xp scales');
  assert.ok(Math.abs(xp(3) / xp(1) - 3) < 0.05);
  const price = (m) => { const { sim: s, w, p } = sim({ landPrice: m }); let best = null; for (let gx = 0; gx < w.gw; gx++) for (let gy = 0; gy < w.gh; gy++) if (!w.isLandOwned(gx, gy) && (w.isLandOwned(gx + 1, gy) || w.isLandOwned(gx - 1, gy) || w.isLandOwned(gx, gy + 1) || w.isLandOwned(gx, gy - 1))) best = [gx, gy]; return { v: s.priceOf(best[0], best[1], p), best, s, w, p }; };
  assert.equal(price(0).v, 0, 'free land');
  assert.ok(price(0.5).v < price(1).v && price(1).v < price(2.5).v, 'cheap < normal < steep');
  const f = price(0); f.s.exec('a', { c: 'buyLand', gx: f.best[0], gy: f.best[1] });
  assert.ok(f.w.isLandOwned(f.best[0], f.best[1]), 'a free land can be bought with no coins');
});

test('buildCost and techCost: free, half, double', () => {
  const cost = (m) => { const { sim: s, w, p } = sim({ buildCost: m }); w.techs.add('carpentry'); give(p, 'wood', 50); const spot = freeSpot(s, p, 8); p.x = (spot[0] + .5) * TILE; p.y = (spot[1] + 3) * TILE; const before = invCount(p.inv, 'wood'); s.exec('a', { c: 'build', bid: 'workbench', tx: spot[0], ty: spot[1] }); return { built: !!w.thingAt(spot[0], spot[1]), spent: before - invCount(p.inv, 'wood') }; };
  const base = BUILD.workbench.cost.wood;
  assert.deepEqual(cost(0), { built: true, spent: 0 }, 'creative mode is free');
  assert.equal(cost(0.5).spent, Math.ceil(base * 0.5));
  assert.equal(cost(1).spent, base);
  assert.equal(cost(1.5).spent, Math.ceil(base * 1.5));
  const research = (m, stand) => { const { sim: s, w, p } = sim({ techCost: m }); give(p, 'wood', 200); give(p, 'fiber', 100); const t = w.addThing('research_table', Math.floor(p.x / TILE) + 2, Math.floor(p.y / TILE)); if (!stand) { p.x = 3 * TILE; p.y = 3 * TILE; } const b = invCount(p.inv, 'wood'); s.exec('a', { c: 'research', tid: 'carpentry' }); return { done: w.techs.has('carpentry'), spent: b - invCount(p.inv, 'wood') }; };
  assert.deepEqual(research(0, false), { done: true, spent: 0 }, 'free research works anywhere');
  assert.equal(research(1, true).spent, 15);
  assert.equal(research(2, true).spent, 30);
  assert.equal(research(1, false).done, false, 'normal research needs the table nearby');
});

test('hunger: off keeps you fed, on makes you hungry and then hurts', () => {
  const run = (h, secs) => { const { sim: s, w, p } = sim({ hunger: h, enemyDensity: 0 }); p.hunger = 100; p.hp = 20; step(s, secs); return p; };
  assert.equal(run(0, 120).hunger, 100);
  assert.ok(run(1, 120).hunger < 90);
  const starving = (() => { const { sim: s, p } = sim({ hunger: 1, enemyDensity: 0, dayLength: 240 }); p.hunger = 0; p.hp = 20; p.shield = 0; step(s, 30); return p.hp; })();
  assert.ok(starving < 20, 'starving hurts');
});

test('regen: fast beats normal beats none', () => {
  const hp = (r) => { const { sim: s, p } = sim({ regen: r, enemyDensity: 0 }); p.hp = 4; step(s, 60); return p.hp; };
  const none = hp('none'), normal = hp('normal'), fast = hp('fast');
  assert.equal(none, 4, 'no regeneration');
  assert.ok(normal > none && fast > normal, `${none} < ${normal} < ${fast}`);
});

test('death rules: nothing lost / 10% coins / pack in a gravestone / pack gone', () => {
  const die = (rule) => { const { sim: s, w, p } = sim({ death: rule, enemyDensity: 0 }); w.coins = 1000; give(p, 'stone', 30); const bag0 = p.inv.filter(Boolean).length; killPlayer(s, p); return { coins: w.coins, bag: p.inv.filter(Boolean).length, bag0, grave: [...w.things.values()].some((t) => t.type === 'gravestone'), s, w, p }; };
  const none = die('none'); assert.equal(none.coins, 1000); assert.equal(none.bag, none.bag0); assert.ok(!none.grave);
  const coins = die('coins'); assert.equal(coins.coins, 900); assert.equal(coins.bag, coins.bag0);
  const drop = die('drop'); assert.equal(drop.bag, 0); assert.ok(drop.grave, 'a gravestone holds the pack');
  const stone = [...drop.w.things.values()].find((t) => t.type === 'gravestone');
  assert.equal(stone.s.inv.filter(Boolean).reduce((a, s) => a + (s.id === 'stone' ? s.n : 0), 0), 30, 'and it has the stone');
  const hard = die('hardcore'); assert.equal(hard.bag, 0); assert.ok(!hard.grave, 'hardcore: gone for good');
});

test('sleep: "either" skips the night with one sleeper, "both" needs everyone', () => {
  const skip = (rule) => { const { sim: s, w, p } = sim({ sleep: rule, enemyDensity: 0 }); const q = s.addPlayer('b', 'Bea'); night(s); p.sleeping = true; step(s, 2); return s.skipping; };
  assert.equal(skip('any'), true);
  assert.equal(skip('all'), false);
  const both = (() => { const { sim: s, w, p } = sim({ sleep: 'all', enemyDensity: 0 }); const q = s.addPlayer('b', 'Bea'); night(s); p.sleeping = true; q.sleeping = true; step(s, 2); return s.skipping; })();
  assert.equal(both, true, 'both asleep: skip');
});

test('dayLength and weather', () => {
  const phase = (len) => { const { sim: s } = sim({ dayLength: len, enemyDensity: 0 }); const p0 = s.world.time; step(s, 60); return (s.world.time - p0) / len; };
  assert.ok(Math.abs(phase(240) / phase(1200) - 5) < 0.2, 'a 4-minute day moves five times faster than a 20-minute one');
  const rains = (wx) => { const { sim: s, w } = sim({ weather: wx, enemyDensity: 0 }); let any = false; for (let i = 0; i < 400; i++) { s._weatherTick(); if (w.shared.weather) any = true; } return any; };
  assert.equal(rains(0), false, 'always sunny');
  assert.equal(rains(1), true); assert.equal(rains(2), true);
  const stormy = (wx) => { const { sim: s, w } = sim({ weather: wx, enemyDensity: 0 }); let n = 0; for (let i = 0; i < 2000; i++) { s._weatherTick(); if (w.shared.weather) n++; } return n; };
  assert.ok(stormy(2) > stormy(1), 'stormy weather rains more often than gentle');
});
