// Enforces the simulation ceilings of DESIGN.md section 15. The ceilings are read from the document so they cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { measureEncounter, measureDelves } from '../../checks/measure-sim.mjs';

const doc = readFileSync(repoPath('DESIGN.md'), 'utf8');
const encounterCeilingMs = Number(/One encounter[^|]*\|\s*median <= (\d+) ms/.exec(doc)[1]);
const delvesCeilingS = Number(/Ten thousand delves[^|]*\|\s*<= (\d+) s/.exec(doc)[1]);

test('budget: the ceilings were read from DESIGN.md section 15', () => {
  assert.equal(encounterCeilingMs, 5);
  assert.equal(delvesCeilingS, 60);
});

test('budget: one level-50 4v4 encounter resolves in a median under the ceiling', () => {
  const m = measureEncounter(300);
  t_diag(`median ${m.medianMs.toFixed(3)} ms, p95 ${m.p95Ms.toFixed(3)} ms, max ${m.maxMs.toFixed(3)} ms (ceiling ${encounterCeilingMs} ms)`);
  assert.ok(m.medianMs <= encounterCeilingMs, `median ${m.medianMs} ms`);
});

test('budget: ten thousand delves run under the ceiling', () => {
  const m = measureDelves(10000);
  t_diag(`10,000 delves in ${(m.totalMs / 1000).toFixed(2)} s (ceiling ${delvesCeilingS} s), ${m.events} events`);
  assert.equal(m.count, 10000);
  assert.ok(m.totalMs / 1000 <= delvesCeilingS, `${m.totalMs / 1000} s`);
});

function t_diag(msg) { console.log(`# ${msg}`); }
