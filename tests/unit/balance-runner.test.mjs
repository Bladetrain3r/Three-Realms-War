import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBalance } from '../../checks/balance.mjs';
import { loadAll } from '../../checks/balance-lib.mjs';
import { checkDelves } from '../../checks/balance-delves.mjs';
import { checkMirror } from '../../checks/balance-mirror.mjs';
import { econ, checkEcon } from '../../checks/balance-econ.mjs';

const SMALL = { delves_per_cell: 24, mirror_compositions: 6, mirror_fights_per_ordered_pair: 2, upgrade_attempts_per_star: 3000, line_rolls: 9000 };
const report = runBalance(SMALL);

test('balance runner: two runs give byte-identical reports (no times, dates or iteration-order leaks)', () => {
  assert.equal(JSON.stringify(runBalance(SMALL)), JSON.stringify(report));
});

test('balance runner: every delve cell and every economy bound in the threshold file has a check', () => {
  const { B } = loadAll();
  const ids = new Set(report.checks.map((c) => c.id));
  for (const L of B.delve_winrate.levels) for (const t of ['starter', 'fine', 'runed', 'heirloom']) assert.ok(ids.has(`delve_winrate.L${L}.${t}`), `L${L} ${t}`);
  for (const k of Object.keys(B.rewards.delves_per_item_to_3_stars)) assert.ok(ids.has(`rewards.delves_per_item_to_3_stars.${k}`), k);
  for (const k of Object.keys(B.rewards.delves_per_level)) assert.ok(ids.has(`rewards.delves_per_level.${k}`), k);
  for (const id of ['gear_gap.growth', 'encounter.median_rounds', 'encounter.timeout_rate', 'injury.per_hero_per_won_delve', 'injury.expedition_death_per_hero_per_won_encounter',
    'mirror.side_bias', 'mirror.timeout_rate', 'rewards.first_upgrade_max_delves', 'rewards.delves_for_16_items_to_3_stars_at_L30', 'rewards.hearts_vs_materials_min_ratio',
    'rewards.materials_per_delve_growth', 'rewards.delves_to_level_50', 'upgrade_odds.line_values_out_of_range']) assert.ok(ids.has(id), id);
  assert.equal(report.checks.filter((c) => c.id.startsWith('upgrade_odds.success')).length, 5);
  assert.equal(report.checks.filter((c) => c.id.startsWith('upgrade_odds.line_kind')).length, 10);
  assert.equal(report.checks.filter((c) => c.id.startsWith('gear_order')).length, 28);
});

test('balance runner: an out-of-bounds value is reported as out (the evaluation can fail)', () => {
  const { B } = loadAll();
  const fake = { winRate: Object.fromEntries(B.delve_winrate.levels.map((L) => [L, { none: 0, starter: 0, fine: 0, runed: 0, heirloom: 0 }])),
    runedPooled: { medianRounds: 99, timeoutRate: 0.5, injuryPerHeroPerWonDelve: 0.9, deathProxyPerHeroPerWonEncounter: 0.9 } };
  const checks = checkDelves(fake, B), bad = checks.filter((c) => !c.ok).map((c) => c.id);
  assert.ok(bad.includes('delve_winrate.L1.starter'));
  assert.ok(bad.includes('encounter.median_rounds') && bad.includes('encounter.timeout_rate') && bad.includes('injury.per_hero_per_won_delve'));
  assert.ok(bad.includes('gear_gap.growth'));
  assert.ok(!bad.includes('naked_party.L20'), 'a naked party that wins nothing satisfies its own bound');
  const m = checkMirror({ compositions: [{ classes: ['a'], winRate: 0.95 }], classWinRate: { x: 0.2 }, realmWinRate: { y: 0.7 }, sideBias: 0.9, timeoutRate: 0.5 }, B);
  assert.equal(m.filter((c) => !c.ok).length, 5);
});

test('balance runner: the economy figures reproduce hand calculations from the design formulas', () => {
  const ctx = loadAll(SMALL), e = econ(ctx);
  assert.equal(e.firstUpgradeDelves, 1);                         // 3 materials, a first delve pays at least 8
  assert.equal(e.materialsGrowth, 6.333333);                     // 5*(3+16) / 5*(3+0)
  assert.equal(e.delvesPerLevel.L10, 1.6);                       // xp_to_next(10) = 400 over 5 * (10 + 40)
  const expected3 = (3 + 5 / 1) / 0.9 + (3 + 10) / 0.75 + (3 + 15) / 0.6; // item level 10: costs 8, 13, 18
  assert.ok(Math.abs(e.delvesPerItemTo3.L10 - expected3 / (5 * 6)) < 1e-5, `${e.delvesPerItemTo3.L10} vs ${expected3 / 30}`); // 5 * (3 + floor(10/3)) materials a delve
  const checks = checkEcon(e, ctx.B);
  assert.ok(checks.find((c) => c.id === 'rewards.materials_per_delve_growth' && c.ok), 'growth 6.33 is inside [3, 8]');
});

test('balance runner: sampled compositions are four distinct commons, and the report carries no timing', () => {
  for (const c of report.mirror.compositions) { assert.equal(new Set(c.classes).size, 4); assert.deepEqual([...c.classes].sort(), c.classes); }
  assert.ok(!/ms|time|date/i.test(Object.keys(report).join(' ')));
});
