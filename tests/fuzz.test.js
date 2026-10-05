// A partner's device is trusted to play, not to be well-behaved: malformed commands must never throw or corrupt the host's world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, step, give } from './helpers.js';
import { TILE, RNG } from '../js/util.js';
import { BUILD } from '../js/data/build.js';
import { ITEMS } from '../js/data/items.js';
import { TECHS } from '../js/data/techs.js';
import { RECIPES } from '../js/data/recipes.js';

const CMDS = ['use', 'sel', 'craft', 'build', 'buildMany', 'unbuild', 'unbuildMany', 'buyLand', 'research', 'skill', 'interact', 'inv', 'drop', 'sell', 'door', 'warp', 'wake', 'emote', 'dash', 'pet', 'sort', 'equip', 'unequip', 'ping', 'closeui', 'feed', 'nonsense', ''];
const FIELDS = ['slot', 'ax', 'ay', 'i', 'rid', 'n', 'bid', 'tx', 'ty', 'tiles', 'layer', 'flip', 'gx', 'gy', 'tid', 'sid', 'id', 'op', 'from', 'to', 'k', 'f', 'e', 'x', 'y', 'c'];

function junk(rng, depth = 0) {
  switch (rng.int(depth > 1 ? 9 : 12)) {
    case 0: return rng.irange(-5, 40);
    case 1: return rng.range(-1e6, 1e6);
    case 2: return NaN;
    case 3: return Infinity;
    case 4: return null;
    case 5: return undefined;
    case 6: return String.fromCharCode(...Array.from({ length: rng.int(8) }, () => 33 + rng.int(90)));
    case 7: return rng.pick(Object.keys(BUILD));
    case 8: return rng.pick([...Object.keys(ITEMS), ...Object.keys(TECHS), ...RECIPES.map((r) => r.id)]);
    case 9: return Array.from({ length: rng.int(6) }, () => junk(rng, depth + 1));
    case 10: return Object.fromEntries(Array.from({ length: rng.int(4) }, () => [rng.pick(FIELDS), junk(rng, depth + 1)]));
    default: return rng.chance(0.5);
  }
}
function randomCmd(rng) {
  const cmd = { c: rng.pick(CMDS) };
  for (let i = rng.int(7); i > 0; i--) cmd[rng.pick(FIELDS)] = junk(rng);
  return cmd;
}

function invariants(sim) {
  const w = sim.world, bad = [];
  for (const p of w.players.values()) {
    for (const k of ['x', 'y', 'hp', 'energy', 'hunger', 'xp', 'level', 'sel']) if (typeof p[k] !== 'number' || Number.isNaN(p[k]) || !Number.isFinite(p[k])) bad.push(`player ${k}=${p[k]}`);
    for (const s of p.inv) if (s && (!ITEMS[s.id] || !(s.n >= 1) || !Number.isInteger(s.n) || s.n > 9999)) bad.push('bad stack ' + JSON.stringify(s));
  }
  if (!Number.isFinite(w.coins) || w.coins < 0 || !Number.isInteger(w.coins)) bad.push('coins ' + w.coins);
  for (const t of w.things.values()) if (!Number.isInteger(t.x) || !Number.isInteger(t.y)) bad.push('thing at ' + t.x + ',' + t.y);
  return bad;
}

test('malformed commands from a partner never throw and never corrupt the world', () => {
  const sim = makeSim('cozy', { enemyDensity: 0 }, 31337);
  const w = sim.world, host = sim.addPlayer('host', 'Host'), p = sim.addPlayer('evil', 'Evil');
  for (const t of Object.keys(TECHS)) w.techs.add(t);
  w.coins = 5000;
  const rng = new RNG(2024), thrown = {};
  for (let round = 0; round < 40; round++) {
    // keep resources flowing so the commands have something to chew on
    for (const id of ['wood', 'stone', 'plank', 'fiber', 'iron_ingot', 'gold_ingot', 'seed_wheat']) give(p, id, 20);
    p.x = sim.spawn.x + rng.range(-60, 60); p.y = sim.spawn.y + rng.range(-40, 60);
    for (let i = 0; i < 700; i++) {
      const cmd = randomCmd(rng);
      try { sim.exec('evil', cmd); } catch (e) { const k = String(cmd.c) + ': ' + e.message.split('\n')[0]; thrown[k] = (thrown[k] || 0) + 1; }
    }
    step(sim, 0.5);
    const bad = invariants(sim);
    assert.deepEqual(bad.slice(0, 5), [], `world corrupted in round ${round}`);
  }
  assert.deepEqual(thrown, {}, 'commands that threw');
});

test('commands from an unknown or offline player, or with no command at all, are ignored', () => {
  const sim = makeSim('classic');
  sim.addPlayer('a', 'A');
  for (const [pid, cmd] of [['nobody', { c: 'sort' }], ['a', null], ['a', undefined], ['a', 5], ['a', 'build'], ['a', []], ['a', {}], [undefined, { c: 'sort' }]]) assert.doesNotThrow(() => sim.exec(pid, cmd));
  sim.removePlayer('a');
  assert.doesNotThrow(() => sim.exec('a', { c: 'sort' }));
});
