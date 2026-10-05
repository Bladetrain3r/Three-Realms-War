import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAll } from '../../checks/balance-lib.mjs';
import { runLegends, checkLegends, withSets } from '../../checks/balance-legends.mjs';

const ctx = loadAll();
const small = runLegends(ctx, 12);

test('legends runner: two runs are byte-identical, and every legend and party in the threshold file has its checks', () => {
  assert.equal(JSON.stringify(runLegends(ctx, 12)), JSON.stringify(small));
  const ids = new Set(checkLegends(small, ctx).map((c) => c.id));
  for (const l of ['fenris', 'jormungandr', 'ymir', 'beowulf', 'odin']) for (const p of ['ready', 'weak', 'strong']) assert.ok(ids.has(`lg.${l}.${p}.win_rate`), `${l} ${p}`);
  for (const l of ['fenris', 'jormungandr', 'ymir', 'beowulf', 'odin']) for (const k of ['median_rounds', 'last_phase_share', 'hero_death_per_won_fight']) assert.ok(ids.has(`lg.${l}.ready.${k}`), `${l} ${k}`);
  for (const p of ['solid', 'under', 'full']) assert.ok(ids.has(`final.${p}.win_rate`), p);
  assert.equal(ids.size, 5 * 6 + 3 + 1);
});

test('legends runner: the evaluation can fail (a boss made soft is out of bounds on the ready party; made brutal it is out on the strong one)', () => {
  const soft = withSets(ctx, [], ['fenris.vigBp=20000', 'fenris.otherBp=10000']), hard = withSets(ctx, [], ['fenris.vigBp=900000', 'fenris.otherBp=90000']);
  const bad = (c) => checkLegends(runLegends(c, 12, ['fenris']), c).filter((x) => !x.ok).map((x) => x.id);
  assert.ok(bad(soft).includes('lg.fenris.ready.win_rate')); assert.ok(bad(hard).includes('lg.fenris.strong.win_rate'));
});

test('legends runner: the real content is inside every bound (150 fights per cell; see evidence/legends-balance.json)', () => {
  const full = runLegends(ctx, ctx.B.legends.fights), bad = checkLegends(full, ctx).filter((c) => !c.ok);
  assert.deepEqual(bad.map((c) => `${c.id}=${c.value}`), []);
});
