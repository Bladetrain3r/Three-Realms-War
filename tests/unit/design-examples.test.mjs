// Every [WE-nn] example in DESIGN.md, recomputed by the SIM (not by the G0 reference script) and compared to the document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentedExamples } from '../helpers/design.mjs';
import { idiv, mulbp } from '../../sim/arith.js';
import { createRng, deriveSeed } from '../../sim/prng.js';
import { sha256Hex } from '../../sim/sha256.js';
import { canonical, hashOf } from '../../sim/canon.js';

const utf8 = (s) => new TextEncoder().encode(s);
const sample = { schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } };

// id -> function returning the values the document prints after "=>"
export const registry = {
  'WE-01': () => [mulbp(37, 11500), idiv(1000000007, 6)],
  'WE-02': () => { const n = 6, limit = 4294967296 - (4294967296 % n); return [limit, 4294967293, 1000000007 % n]; },
  'WE-03': () => { const r = createRng(1); return [r.next(), r.next(), r.next()]; },
  'WE-04': () => [deriveSeed(1, 0), deriveSeed(1, 1)],
  'WE-28': () => [sha256Hex(utf8('abc'))],
  'WE-29': () => [canonical(sample)],
  'WE-30': () => [hashOf(sample)],
};

const documented = documentedExamples();

test('design examples: DESIGN.md carries 33 tagged worked examples', () => {
  assert.equal(documented.size, 33);
});

for (const [id, fn] of Object.entries(registry)) {
  test(`design examples: ${id} matches DESIGN.md`, () => {
    assert.equal(fn().join(', '), documented.get(id));
  });
}
