import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { validateRunbook } from '../../sim/runbook.js';

const kit = ['hold_the_line', 'shield_bash'];
const codes = (rb, k = kit) => validateRunbook(rb, k, content).errors.map((e) => e.code);
const rule = (when, doIt, target = null) => ({ when, do: doIt, target });
const ok = { c: 'always' };

test('runbook: the documented example validates (DESIGN.md 9.5)', () => {
  const rb = { v: 1, rules: [
    rule([{ c: 'self_hp_below', pct: 40 }], { a: 'skill', skill: 'hold_the_line' }, null),
    rule([{ c: 'enemy_lacks', status: 'mark' }, { c: 'enemies_at_least', n: 2 }], { a: 'skill', skill: 'shield_bash' }, 'highest_hp'),
  ] };
  assert.deepEqual(validateRunbook(rb, kit, content), { ok: true, errors: [] });
  assert.deepEqual(validateRunbook(JSON.stringify(rb), kit, content), { ok: true, errors: [] });
});

test('runbook: an empty runbook is valid (the fixed fallback applies)', () => assert.equal(validateRunbook({ v: 1, rules: [] }, kit, content).ok, true));

test('runbook: E01 not JSON, wrong shape or wrong version', () => {
  assert.deepEqual(codes('{nope'), ['E01']);
  assert.deepEqual(codes({ v: 2, rules: [] }), ['E01']);
  assert.deepEqual(codes({ v: 1 }), ['E01']);
  assert.deepEqual(codes([]), ['E01']);
  assert.deepEqual(codes(null), ['E01']);
});

test('runbook: E02 more than 8 rules', () => {
  const r = rule([ok], { a: 'basic' }, 'lowest_hp');
  assert.equal(validateRunbook({ v: 1, rules: new Array(8).fill(r) }, kit, content).ok, true);
  assert.deepEqual(codes({ v: 1, rules: new Array(9).fill(r) }), ['E02']);
});

test('runbook: E03 no clause, more than two, or "when" missing', () => {
  assert.deepEqual(codes({ v: 1, rules: [rule([], { a: 'basic' }, 'lowest_hp')] }), ['E03']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok, ok, ok], { a: 'basic' }, 'lowest_hp')] }), ['E03']);
  assert.deepEqual(codes({ v: 1, rules: [{ do: { a: 'basic' }, target: 'lowest_hp' }] }), ['E03']);
});

test('runbook: E04 unknown condition or action', () => {
  assert.deepEqual(codes({ v: 1, rules: [rule([{ c: 'moon_is_full' }], { a: 'basic' }, 'lowest_hp')] }), ['E04']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'dance' }, null)] }), ['E04']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], null, null)] }), ['E04']);
});

test('runbook: E05 missing or out-of-range arguments', () => {
  const r = (cl) => ({ v: 1, rules: [rule([cl], { a: 'basic' }, 'lowest_hp')] });
  assert.deepEqual(codes(r({ c: 'self_hp_below' })), ['E05']);
  assert.deepEqual(codes(r({ c: 'self_hp_below', pct: 5 })), ['E05']);
  assert.deepEqual(codes(r({ c: 'self_hp_below', pct: 95 })), ['E05']);
  assert.deepEqual(codes(r({ c: 'self_hp_below', pct: 45 })), ['E05']);
  assert.deepEqual(codes(r({ c: 'enemies_at_least', n: 5 })), ['E05']);
  assert.deepEqual(codes(r({ c: 'round_at_least', n: 1.5 })), ['E05']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill' }, null)] }), ['E05']);
  assert.equal(validateRunbook(r({ c: 'self_hp_below', pct: 90 }), kit, content).ok, true);
  assert.equal(validateRunbook(r({ c: 'enemies_at_least', n: 4 }), kit, content).ok, true);
});

test('runbook: E06 unknown status, element, row or skill id', () => {
  const r = (cl) => ({ v: 1, rules: [rule([cl], { a: 'basic' }, 'lowest_hp')] });
  assert.deepEqual(codes(r({ c: 'self_has', status: 'sleepy' })), ['E06']);
  assert.deepEqual(codes(r({ c: 'enemy_weak_to', element: 'acid' })), ['E06']);
  assert.deepEqual(codes(r({ c: 'enemy_row_alive', row: 'middle' })), ['E06']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'no_such_skill' }, null)] }), ['E06']);
});

test('runbook: E07 a real skill that is not in this hero\'s kit', () => {
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'hex' }, 'lowest_hp')] }), ['E07']);
  assert.deepEqual(codes({ v: 1, rules: [rule([{ c: 'skill_ready', skill: 'hex' }], { a: 'basic' }, 'lowest_hp')] }), ['E07']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'hex' }, 'lowest_hp')] }, [...kit, 'hex']), []);
});

test('runbook: E08 selector wrong for the target type, missing, or unknown', () => {
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'shield_bash' }, 'self')] }), ['E08']);     // enemy target, ally-only selector
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'basic' }, 'self')] }), ['E08']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'shield_bash' }, null)] }), ['E08']);      // needs a selector
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'hold_the_line' }, 'lowest_hp')] }), ['E08']); // self skill takes null
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'skill', skill: 'shield_bash' }, 'closest')] }), ['E08']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'brace' }, 'lowest_hp')] }), ['E08']);
});

test('runbook: E09 an unknown field anywhere is refused, not ignored', () => {
  assert.deepEqual(codes({ v: 1, rules: [], note: 'x' }), ['E09']);
  assert.deepEqual(codes({ v: 1, rules: [{ ...rule([ok], { a: 'basic' }, 'lowest_hp'), why: 1 }] }), ['E09']);
  assert.deepEqual(codes({ v: 1, rules: [rule([{ c: 'always', pct: 3 }], { a: 'basic' }, 'lowest_hp')] }), ['E09']);
  assert.deepEqual(codes({ v: 1, rules: [rule([ok], { a: 'basic', skill: 'x' }, 'lowest_hp')] }), ['E09']);
});

test('runbook: every error names its rule number from 1 and says why', () => {
  const r = validateRunbook({ v: 1, rules: [rule([ok], { a: 'basic' }, 'lowest_hp'), rule([{ c: 'self_hp_below', pct: 55 }], { a: 'basic' }, 'lowest_hp')] }, kit, content);
  assert.equal(r.errors[0].rule, 2);
  assert.match(r.errors[0].message, /rule 2/);
  assert.match(r.errors[0].message, /pct/);
});
