// The research and skill trees: every box has a real picture, a place in its branch, and an effect; the new techs change the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TECHS, TECH_CATS, TECH_IDS, techUnlocks } from '../js/data/techs.js';
import { SKILLS, SKILL_BRANCHES } from '../js/data/skills.js';
import { buildBook } from '../js/gfx/art/index.js';
import { layoutTree, layoutLayers } from '../js/ui/treelayout.js';
import { techNodes, skillNodes, techDepth, TECH_BRANCH_ICON, SKILL_BRANCH_ICON } from '../js/ui/treedata.js';
import { calcStats } from '../js/sim/player.js';
import { makeSim } from './helpers.js';

const book = buildBook();

test('every technology and skill has a picture that exists, and so does every branch', () => {
  const bad = [];
  for (const id of TECH_IDS) if (!book.has(TECHS[id].icon)) bad.push(`tech ${id}: ${TECHS[id].icon}`);
  for (const id of Object.keys(SKILLS)) if (!book.has(SKILLS[id].icon)) bad.push(`skill ${id}: ${SKILLS[id].icon}`);
  for (const c of TECH_CATS) if (!book.has(TECH_BRANCH_ICON[c.id] || 'missing')) bad.push(`tech branch ${c.id}`);
  for (const b of SKILL_BRANCHES) if (!book.has(SKILL_BRANCH_ICON[b.id] || 'missing')) bad.push(`skill branch ${b.id}`);
  assert.deepEqual(bad, []);
  assert.deepEqual(book.missingArt, [], 'placeholder art somewhere');
});

test('the research tree has six branches (one of them Seaside & Fishing) with plenty of boxes each', () => {
  assert.equal(TECH_CATS.length, 6);
  assert.ok(TECH_CATS.some((c) => c.id === 'sea' && /Seaside/.test(c.name)));
  assert.ok(TECH_IDS.length >= 90, `only ${TECH_IDS.length} technologies`);
  const ids = new Set();
  for (const c of TECH_CATS) {
    assert.ok(c.name && c.short && /^#[0-9a-f]{6}$/i.test(c.color) && !ids.has(c.id), 'branch ' + c.id); ids.add(c.id);
    const n = TECH_IDS.filter((id) => TECHS[id].cat === c.id).length;
    assert.ok(n >= 8 && n <= 26, `${c.id} has ${n} technologies`);
  }
  for (const id of TECH_IDS) assert.ok(ids.has(TECHS[id].cat), `${id} is in an unknown branch`);
  for (const id of ['fishing', 'angling', 'crystal_angling']) assert.equal(TECHS[id].cat, 'sea', id + ' lives by the sea');
});

test('every technology either unlocks something or gives a permanent bonus', () => {
  const un = techUnlocks(), dull = TECH_IDS.filter((id) => !TECHS[id].fx && un[id].build.length + un[id].recipes.length + un[id].process.length === 0);
  assert.deepEqual(dull, []);
});

test('every research branch is laid out without overlaps, and every line runs left to right', () => {
  for (const cat of TECH_CATS) {
    const nodes = techNodes(cat, new Set(), null), L = layoutLayers(nodes), seen = new Set();
    assert.equal(nodes.length, TECH_IDS.filter((id) => TECHS[id].cat === cat.id).length);
    for (const n of nodes) {
      const p = L.pos.get(n.id), key = `${p.col},${p.row}`;
      assert.ok(Number.isInteger(p.col) && Number.isInteger(p.row) && p.col >= 0 && p.row >= 0, `${n.id} has no place`);
      assert.ok(!seen.has(key), `${cat.id}: ${n.id} overlaps another box at ${key}`); seen.add(key);
      for (const par of n.parents) assert.ok(L.pos.get(par).col < p.col, `${n.id} is not to the right of ${par}`);
    }
    assert.ok(L.cols <= 12 && L.rows <= 10, `${cat.id} is ${L.cols} columns x ${L.rows} rows`);
  }
  // depth really is "how far along the chain": a tech is deeper than everything it needs, in any branch
  for (const id of TECH_IDS) for (const r of TECHS[id].req) assert.ok(techDepth(r) < techDepth(id), `${id} vs ${r}`);
});

test('research boxes show the right state: done, ready (can pay or not), locked, with prerequisites from other branches as little pictures', () => {
  const sea = TECH_CATS.find((c) => c.id === 'sea');
  let nodes = techNodes(sea, new Set(), (t) => t.id === 'driftwood');
  const by = (id) => nodes.find((n) => n.id === id);
  assert.equal(by('driftwood').state, 'ready can');
  assert.equal(by('fishing').state, 'ready');
  assert.equal(by('beachcombing').state, 'locked');
  assert.deepEqual(by('beachcombing').parents, ['driftwood']);
  assert.ok(by('beach_style').extras.some((e) => /Cottage/.test(e.title)), 'beach style needs a Home technology');
  nodes = techNodes(sea, new Set(['driftwood', 'fishing']), null);
  assert.equal(nodes.find((n) => n.id === 'driftwood').state, 'done');
  assert.equal(nodes.find((n) => n.id === 'beachcombing').state, 'ready');
  assert.deepEqual(nodes.find((n) => n.id === 'driftwood').badge, { kind: 'check' });
  assert.deepEqual(nodes.find((n) => n.id === 'shell_craft').badge, { kind: 'lock' });
});

test('skill trees: five branches of real trees (each requirement is in its own branch), no overlaps', () => {
  assert.equal(SKILL_BRANCHES.length, 5);
  assert.ok(Object.keys(SKILLS).length >= 50);
  for (const id of Object.keys(SKILLS)) { const s = SKILLS[id]; if (s.req) { assert.ok(SKILLS[s.req], `${id} needs unknown ${s.req}`); assert.equal(SKILLS[s.req].branch, s.branch, `${id} needs ${s.req} from another branch`); } }
  const p = { skills: {}, sp: 0 };
  for (const b of SKILL_BRANCHES) {
    const nodes = skillNodes(b, p), L = layoutTree(nodes), seen = new Set();
    assert.ok(nodes.length >= 9, `${b.id} has ${nodes.length} skills`);
    for (const n of nodes) {
      const pos = L.pos.get(n.id), key = `${pos.col},${pos.row}`;
      assert.ok(!seen.has(key), `${b.id}: ${n.id} overlaps at ${key}`); seen.add(key);
      for (const par of n.parents) assert.ok(L.pos.get(par).col < pos.col, `${n.id} is not right of ${par}`);
    }
  }
});

test('skill boxes show learnable / learned / locked / maxed correctly', () => {
  const forage = SKILL_BRANCHES.find((b) => b.id === 'forage');
  const find = (p, id) => skillNodes(forage, p).find((n) => n.id === id);
  assert.equal(find({ skills: {}, sp: 0 }, 'strong_arms').state, 'wait');
  assert.equal(find({ skills: {}, sp: 1 }, 'strong_arms').state, 'ready can');
  assert.equal(find({ skills: {}, sp: 5 }, 'swift_hands').state, 'locked');
  assert.deepEqual(find({ skills: {}, sp: 5 }, 'swift_hands').badge, { kind: 'lock' });
  assert.equal(find({ skills: { strong_arms: 2 }, sp: 0 }, 'strong_arms').state, 'done own');
  assert.deepEqual(find({ skills: { strong_arms: 2 }, sp: 0 }, 'strong_arms').badge, { text: '2/5' });
  assert.equal(find({ skills: { strong_arms: 5 }, sp: 9 }, 'strong_arms').state, 'done max');
  assert.equal(find({ skills: { strong_arms: 1 }, sp: 1 }, 'swift_hands').state, 'ready can');
});

test('layout code copes with odd data: cycles, unknown parents, empty lists, one node', () => {
  assert.equal(layoutTree([]).rows, 0);
  assert.equal(layoutLayers([]).cols, 0);
  const one = layoutTree([{ id: 'a', parents: ['nope'] }]);
  assert.deepEqual(one.pos.get('a'), { col: 0, row: 0 });
  const cyc = layoutTree([{ id: 'a', parents: ['b'] }, { id: 'b', parents: ['a'] }]);
  assert.ok(cyc.pos.get('a') && cyc.pos.get('b'), 'a cycle still lays out');
  const lay = layoutLayers([{ id: 'a', parents: [], col: 3 }, { id: 'b', parents: ['a'], col: 7 }, { id: 'c', parents: [], col: 7 }]);
  assert.equal(lay.cols, 2); assert.deepEqual(lay.colValues, [3, 7]);
  assert.notDeepEqual(lay.pos.get('b'), lay.pos.get('c'));
});

// every effect key a technology or skill can have is wired into the stats (so a bonus is never a lie)
const STAT = { toolDmg: 'toolDmg', toolSpeed: 'toolSpeed', speed: 'speed', slots: 'slots', buildDiscount: 'buildDiscount', xp: 'xpMul', drop: 'dropMul', machine: 'machineMul', cropGrowth: 'cropGrowth', cropYield: 'cropYield', animal: 'animal', food: 'foodMul', potion: 'potionMul', luck: 'luck', lightR: 'lightBonus', regen: 'regenMul', sell: 'sellMul', landDiscount: 'landDiscount', coins: 'coinMul', rare: 'rare', rareFish: 'rareFish', energy: 'maxEnergy', cozy: 'cozyMul', chestSlots: 'chestSlots' };
test('every technology bonus changes the stat it promises', () => {
  const sim = makeSim('classic'), p = sim.addPlayer('a', 'Alice', {});
  const base = { ...calcStats(sim.world, p) };
  for (const id of TECH_IDS) {
    const t = TECHS[id]; if (!t.fx) continue;
    for (const k of Object.keys(t.fx)) {
      assert.ok(STAT[k], `${id}: effect "${k}" is not wired to any stat`);
      const w = makeSim('classic'); const q = w.addPlayer('a', 'Alice', {}); w.world.techs.add(id);
      const now = calcStats(w.world, q);
      assert.notEqual(now[STAT[k]], base[STAT[k]], `${id}: ${k} did not change ${STAT[k]}`);
    }
  }
});
test('every skill bonus changes the stat it promises', () => {
  const sim = makeSim('classic'), p = sim.addPlayer('a', 'Alice', {});
  const base = { ...calcStats(sim.world, p) };
  const stat2 = { ...STAT, maxHp: 'maxHp', dmgTaken: 'defense', gatherXp: 'gatherXp', magnet: 'magnet', reach: 'reachBonus', crit: 'crit', dashCd: 'dashCd', meleeDmg: 'meleeDmg', bowDmg: 'bowDmg', staffDmg: 'staffDmg', doubleDrop: 'doubleDrop', oreBonus: 'oreBonus', plantBonus: 'plantBonus', regrow: 'regrow', bite: 'bite', lifesteal: 'lifesteal', comfort: 'comfortMul', wallDiscount: 'wallDiscount', buildReach: 'buildReach', treasureSense: 'treasureSense', secondWind: 'secondWind', rested: 'rested' };
  for (const id of Object.keys(SKILLS)) {
    const s = SKILLS[id];
    for (const k of Object.keys(s.fx)) {
      assert.ok(stat2[k], `${id}: effect "${k}" is not wired to any stat`);
      const w = makeSim('classic'); const q = w.addPlayer('a', 'Alice', {}); q.skills[id] = 1; q.rev++;
      const now = calcStats(w.world, q);
      assert.notEqual(now[stat2[k]], base[stat2[k]], `${id}: ${k} did not change ${stat2[k]}`);
    }
  }
});

test('skills and technologies add up (the same key from both counts twice)', () => {
  const sim = makeSim('classic'), p = sim.addPlayer('a', 'Alice', {});
  const base = calcStats(sim.world, p).toolDmg;
  sim.world.techs.add('sharper_tools'); p.rev++;
  const withTech = calcStats(sim.world, p).toolDmg;
  p.skills.strong_arms = 2; p.rev++;
  const both = calcStats(sim.world, p).toolDmg;
  assert.ok(Math.abs(withTech - base - 0.08) < 1e-9, 'tech adds 8%');
  assert.ok(Math.abs(both - withTech - 0.2) < 1e-9, 'two ranks of Strong Arms add 20% on top');
});
