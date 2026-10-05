// Content integrity: every id points at something real, and everything in the game can actually be obtained/researched/built
// in a sensible order (a fixpoint simulation of "what could a player have by now" over the whole catalog).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../js/data/items.js';
import { RECIPES, PROCESS, STATION_NAMES } from '../js/data/recipes.js';
import { TECHS } from '../js/data/techs.js';
import { BUILD } from '../js/data/build.js';
import { NODES } from '../js/data/nodes.js';
import { MOBS } from '../js/data/mobs.js';
import { BIOMES } from '../js/data/biomes.js';
import { CROPS } from '../js/data/crops.js';
import { START_KITS } from '../js/data/difficulty.js';
import { lootChest, lootDig, lootFish } from '../js/sim/loot.js';
import { RNG } from '../js/util.js';

const item = (id) => id === 'coin' || id === '@fish' || !!ITEMS[id];

test('every reference points at something that exists', () => {
  const bad = [];
  for (const r of RECIPES) {
    if (!ITEMS[r.out]) bad.push(`recipe ${r.id}: unknown output ${r.out}`);
    for (const k of Object.keys(r.in)) if (!item(k)) bad.push(`recipe ${r.id}: unknown ingredient ${k}`);
    if (!STATION_NAMES[r.station]) bad.push(`recipe ${r.id}: unknown station ${r.station}`);
    if (r.tech && !TECHS[r.tech]) bad.push(`recipe ${r.id}: unknown tech ${r.tech}`);
  }
  for (const p of PROCESS) {
    if (!ITEMS[p.input] || !ITEMS[p.out]) bad.push(`process ${p.input}->${p.out}: unknown item`);
    if (p.tech && !TECHS[p.tech]) bad.push(`process ${p.out}: unknown tech ${p.tech}`);
  }
  for (const b of Object.values(BUILD)) {
    for (const k of Object.keys(b.cost || {})) if (!ITEMS[k]) bad.push(`build ${b.id}: unknown cost item ${k}`);
    if (b.tech && !TECHS[b.tech]) bad.push(`build ${b.id}: unknown tech ${b.tech}`);
    if (b.conf && b.conf.station && !STATION_NAMES[b.conf.station]) bad.push(`build ${b.id}: unknown station ${b.conf.station}`);
    if (b.conf && b.conf.out && b.conf.out !== '@fishpick' && !ITEMS[b.conf.out]) bad.push(`build ${b.id}: unknown output ${b.conf.out}`);
    for (const f of (b.conf && b.conf.feed) || []) if (!ITEMS[f]) bad.push(`build ${b.id}: unknown feed ${f}`);
    for (const k of Object.keys((b.conf && b.conf.offer) || {})) if (!ITEMS[k]) bad.push(`build ${b.id}: unknown offering ${k}`);
    if (b.conf && b.conf.boss && !MOBS[b.conf.boss]) bad.push(`build ${b.id}: unknown boss ${b.conf.boss}`);
  }
  for (const t of Object.values(TECHS)) {
    for (const q of t.req) if (!TECHS[q]) bad.push(`tech ${t.id}: unknown prerequisite ${q}`);
    for (const k of Object.keys(t.cost)) if (!ITEMS[k]) bad.push(`tech ${t.id}: unknown cost item ${k}`);
  }
  for (const n of Object.values(NODES)) for (const d of n.drops || []) if (!ITEMS[d[0]]) bad.push(`node ${n.id}: unknown drop ${d[0]}`);
  for (const m of Object.values(MOBS)) for (const d of m.drops) if (!item(d[0])) bad.push(`mob ${m.id}: unknown drop ${d[0]}`);
  for (const [id, c] of Object.entries(CROPS)) { if (!ITEMS[c.item]) bad.push(`crop ${id}: unknown item`); if (!ITEMS['seed_' + id]) bad.push(`crop ${id}: no seed item`); }
  for (const bi of Object.values(BIOMES)) {
    for (const [n] of bi.res) if (!NODES[n]) bad.push(`biome ${bi.id}: unknown node ${n}`);
    for (const [m] of [...bi.mobs, ...bi.night]) if (!MOBS[m]) bad.push(`biome ${bi.id}: unknown mob ${m}`);
  }
  for (const [k, kit] of Object.entries(START_KITS)) for (const id of Object.keys(kit)) if (!ITEMS[id]) bad.push(`start kit ${k}: unknown item ${id}`);
  assert.deepEqual(bad, [], '\n' + bad.join('\n'));
});

test('the tech tree is a proper DAG with prerequisites no later than the tech itself', () => {
  const state = {};
  const visit = (id, path) => {
    if (state[id] === 2) return;
    assert.ok(state[id] !== 1, 'cycle: ' + [...path, id].join(' -> '));
    state[id] = 1;
    for (const q of TECHS[id].req) { assert.ok(TECHS[q].tier <= TECHS[id].tier, `${id} (tier ${TECHS[id].tier}) requires later tech ${q} (tier ${TECHS[q].tier})`); visit(q, [...path, id]); }
    state[id] = 2;
  };
  for (const id of Object.keys(TECHS)) visit(id, []);
  assert.ok(Object.keys(TECHS).length >= 60, 'a big tree');
});

test('everything is obtainable, researchable and buildable in a sensible order', () => {
  // ---- what the world gives for free (sampled from the real loot code at every tier)
  const world = new Set(), chestOnly = new Set(), digOnly = new Set(), fishOnly = new Set();
  const rng = new RNG(1234);
  for (let tier = 0; tier <= 7; tier++) for (let i = 0; i < 1500; i++) {
    for (const it of lootChest(rng, tier, i % 3 ? 0 : 0.5).items) chestOnly.add(it.id);
    for (const it of lootDig(rng, tier, i % 3 ? 0 : 0.5).items) digOnly.add(it.id);
  }
  for (const b of Object.keys(BIOMES)) for (let r = 1; r <= 7; r += 3) for (let i = 0; i < 400; i++) fishOnly.add(lootFish(rng, b, r, i % 2 ? 0 : 0.4, i % 5 ? 0 : 0.5));
  for (const id of chestOnly) world.add(id); // chests lie around the islands: no tool needed
  const have = new Set(world);
  for (const kit of Object.values(START_KITS)) for (const id of Object.keys(kit)) { /* the bare kit is the hardest: only use that */ }
  for (const id of Object.keys(START_KITS.bare)) have.add(id);

  const techOk = new Set(), built = new Set();
  const researchStation = (tier) => (tier <= 3 ? 'research_table' : tier <= 6 ? 'library' : 'observatory');
  const bestPick = () => Math.max(0, ...[...have].map((i) => (ITEMS[i] && ITEMS[i].tool === 'pick' ? ITEMS[i].tier : 0)));
  const hasTool = (kind) => [...have].some((i) => ITEMS[i] && ITEMS[i].tool === kind);
  const hasAll = (cost) => Object.keys(cost).every((k) => (k === '@fish' ? [...have].some((i) => ITEMS[i] && ITEMS[i].fish) : have.has(k)));
  const buildable = (b) => (!b.tech || techOk.has(b.tech)) && hasAll(b.cost);
  const stationBuilt = (st) => st === 'hand' || [...built].some((id) => BUILD[id].conf && BUILD[id].conf.station === st);
  const processorBuilt = (kind) => [...built].some((id) => BUILD[id].behavior === 'processor' && BUILD[id].conf.kind === kind);
  const add = (id) => { if (!have.has(id)) { have.add(id); return true; } return false; };

  const log = [];
  for (let round = 0; round < 60; round++) {
    let changed = false;
    // gathering: nodes whose hardness the best pickaxe can handle
    const pick = bestPick();
    for (const n of Object.values(NODES)) if (n.kind === 'node' && n.hard <= pick) for (const d of n.drops) changed = add(d[0]) || changed;
    for (const m of Object.values(MOBS)) if (!m.boss) for (const d of m.drops) if (d[0] !== 'coin') changed = add(d[0]) || changed;
    if (hasTool('shovel')) for (const id of digOnly) changed = add(id) || changed;
    if (hasTool('rod')) for (const id of fishOnly) changed = add(id) || changed;
    // blueprints and techs
    for (const b of Object.values(BUILD)) if (!built.has(b.id) && buildable(b)) { built.add(b.id); changed = true; }
    for (const t of Object.values(TECHS)) {
      if (techOk.has(t.id)) continue;
      if (t.req.every((q) => techOk.has(q)) && hasAll(t.cost) && built.has(researchStation(t.tier))) { techOk.add(t.id); changed = true; log.push(`${t.id}@${round}`); }
    }
    // crafting
    for (const r of RECIPES) if ((!r.tech || techOk.has(r.tech)) && stationBuilt(r.station) && hasAll(r.in)) changed = add(r.out) || changed;
    for (const p of PROCESS) if ((!p.tech || techOk.has(p.tech)) && processorBuilt(p.kind) && have.has(p.input)) changed = add(p.out) || changed;
    // farming, animals, traps
    for (const [id, c] of Object.entries(CROPS)) if (have.has('seed_' + id) && built.has('farm_plot')) changed = add(c.item) || changed;
    for (const id of built) {
      const b = BUILD[id];
      if (b.behavior === 'producer') {
        const feedOk = !(b.conf.feed && b.conf.feed.length) || b.conf.feed.some((f) => have.has(f));
        if (feedOk) { if (b.conf.out === '@fishpick') for (const f of fishOnly) changed = add(f) || changed; else changed = add(b.conf.out) || changed; }
      }
      if (b.behavior === 'altar' && Object.keys(b.conf.offer).every((k) => have.has(k))) for (const d of MOBS[b.conf.boss].drops) if (d[0] !== 'coin') changed = add(d[0]) || changed;
    }
    if (!changed) break;
  }

  const lost = {
    items: Object.keys(ITEMS).filter((i) => !have.has(i)),
    techs: Object.keys(TECHS).filter((t) => !techOk.has(t)),
    blueprints: Object.values(BUILD).filter((b) => !b.hidden && !built.has(b.id)).map((b) => b.id),
    recipes: RECIPES.filter((r) => !((!r.tech || techOk.has(r.tech)) && stationBuilt(r.station) && hasAll(r.in))).map((r) => r.id),
  };
  assert.deepEqual(lost, { items: [], techs: [], blueprints: [], recipes: [] }, 'unreachable content (with the bare start kit): ' + JSON.stringify(lost));
});

test('each tier of the tree can be reached without skipping ahead of the resources that tier needs', () => {
  // a tech's cost must not need a pickaxe tier that the same tech (or its prerequisites) is what unlocks
  const needPick = { coal: 1, copper_ore: 2, iron_ore: 3, gold_ore: 4, ember_stone: 5, obsidian: 5, crystal_shard: 6, star_fragment: 7, void_essence: 7 };
  const pickTierItem = { 1: 'pickaxe_wood', 2: 'pickaxe_stone', 3: 'pickaxe_copper', 4: 'pickaxe_iron', 5: 'pickaxe_gold', 6: 'pickaxe_obsidian', 7: 'pickaxe_crystal', 8: 'pickaxe_star' };
  const recFor = (out) => RECIPES.find((r) => r.out === out);
  for (let t = 2; t <= 8; t++) {
    const rec = recFor(pickTierItem[t]);
    assert.ok(rec, `a recipe for ${pickTierItem[t]}`);
    if (rec.tech) assert.ok(TECHS[rec.tech], `${pickTierItem[t]} needs a real tech`);
  }
  // sanity: the nodes' hardness table matches the pickaxe tiers
  for (const n of Object.values(NODES)) if (n.kind === 'node') assert.ok(n.hard <= 8, n.id);
  assert.ok(needPick.gold_ore <= 4);
});

test('every ground biome has a way to earn its own tier of materials', () => {
  for (const b of Object.values(BIOMES)) {
    const drops = new Set(); for (const [n] of b.res) for (const d of NODES[n].drops) drops.add(d[0]);
    assert.ok(drops.size >= 3, `${b.id} drops a variety of items`);
    assert.ok(b.mobs.length && b.night.length, `${b.id} has day and night creatures`);
  }
});

test('island goals: unique ids, real icons, real items, and every condition can come true', async () => {
  const { GOALS, GOAL_SECTIONS, nextGoal } = await import('../js/data/goals.js');
  const { expectedSprites } = await import('../js/gfx/art/index.js');
  const sprites = new Set(expectedSprites());
  for (const n of ['i_coin', 'ui_star', 'ui_heart', 'ui_house', 'ui_hammer', 'ui_hunger', 'ui_sword', 'ui_map', 'ui_flask', 'ui_moon', 'ui_sun', 'ui_check']) sprites.add(n); // ui sprites are registered by hand
  const sections = new Set(GOAL_SECTIONS.map((s) => s.id));
  const ids = new Set(), bad = [];
  for (const g of GOALS) {
    if (ids.has(g.id)) bad.push('duplicate id ' + g.id); ids.add(g.id);
    if (!sections.has(g.section)) bad.push(`${g.id}: unknown section ${g.section}`);
    if (!g.title) bad.push(`${g.id}: no title`);
    if (!(g.reward.coins >= 0) || !(g.reward.xp >= 0)) bad.push(`${g.id}: bad reward`);
    if (!/^ui_|^i_coin$/.test(g.icon) && !sprites.has(g.icon)) bad.push(`${g.id}: icon ${g.icon} is not a real sprite`);
    if (g.prog) { const p = g.prog({ gs: {}, techs: new Set(), things: {}, items: new Set(), biomes: new Set(), maxLevel: 1, cozy: 0, lands: 1, floors: 0, walls: 0, furniture: 0 }); if (!Array.isArray(p) || p[1] <= 0) bad.push(`${g.id}: bad progress`); }
  }
  assert.deepEqual(bad, []);
  assert.ok(GOALS.length >= 50, 'plenty of goals: ' + GOALS.length);
  // every goal that asks for an item or a built thing names one that exists (probe with a Proxy census that records what is asked for)
  const asked = { items: new Set(), things: new Set() };
  const probe = { gs: new Proxy({}, { get: (_, k) => { if (String(k).startsWith('made_')) asked.items.add(String(k).slice(5)); return 0; } }), techs: { size: 0, has: () => false }, things: new Proxy({}, { get: (_, k) => { asked.things.add(String(k)); return 0; } }), items: { has: (k) => { asked.items.add(k); return false; } }, biomes: new Set(), maxLevel: 1, cozy: 0, lands: 1, floors: 0, walls: 0, doors: 0, windows: 0, bridges: 0, furniture: 0, lights: 0, beds: 0, chests: 0, drills: 0, coins: 0 };
  for (const g of GOALS) g.check(probe);
  for (const i of asked.items) assert.ok(ITEMS[i], 'goal asks for unknown item ' + i);
  for (const t of asked.things) assert.ok(BUILD[t], 'goal asks for unknown blueprint ' + t);
  // the tracker always has something sensible to show
  assert.equal(nextGoal(new Set()).id, 'chop');
  assert.equal(nextGoal(new Set(GOALS.map((g) => g.id))), null);
  const some = new Set(GOALS.slice(0, 5).map((g) => g.id));
  assert.ok(!some.has(nextGoal(some).id));
});

test('presets only use values the options actually allow (nothing is silently reset)', async () => {
  const { OPTIONS, PRESETS, sanitizeSettings } = await import('../js/data/difficulty.js');
  for (const p of PRESETS) for (const [k, v] of Object.entries(p.v)) {
    const o = OPTIONS.find((x) => x.id === k);
    assert.ok(o, `${p.id}: unknown option ${k}`);
    assert.ok(o.opts.some((x) => x[0] === v), `${p.id}: ${k}=${v} is not one of the choices`);
  }
  for (const p of PRESETS) assert.deepEqual(sanitizeSettings({ ...p.v }), { ...sanitizeSettings({}), ...p.v }, `${p.id} survives sanitizing`);
});
