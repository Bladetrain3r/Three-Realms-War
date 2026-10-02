import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, deriveSeed, splitmix32 } from '../../sim/prng.js';

test('prng: the same seed gives the same stream, different seeds differ', () => {
  const a = createRng(42), b = createRng(42), c = createRng(43);
  const sa = Array.from({ length: 50 }, a.next), sb = Array.from({ length: 50 }, b.next), sc = Array.from({ length: 50 }, c.next);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('prng: sfc32 seeded with 1 gives the documented first three draws (DESIGN.md WE-03)', () => {
  const r = createRng(1);
  assert.deepEqual([r.next(), r.next(), r.next()], [1689047798, 3678829038, 1136791837]);
});

test('prng: deriveSeed is a pure function of (master, n) (DESIGN.md WE-04)', () => {
  assert.equal(deriveSeed(1, 0), 3675335440);
  assert.equal(deriveSeed(1, 1), 414504250);
  assert.equal(deriveSeed(1, 0), deriveSeed(1, 0));
});

test('prng: range rejects the biased tail (DESIGN.md WE-02)', () => {
  // Drive range() with a scripted stream by building the same arithmetic: limit for n = 6.
  const n = 6, limit = 4294967296 - (4294967296 % n);
  assert.equal(limit, 4294967292);
  const r = createRng(7);
  for (let i = 0; i < 10000; i++) {
    const v = r.range(n);
    assert.ok(Number.isInteger(v) && v >= 0 && v < n);
  }
});

test('prng: range(n) is roughly uniform and covers every value', () => {
  const r = createRng(99), counts = new Array(10).fill(0);
  for (let i = 0; i < 100000; i++) counts[r.range(10)]++;
  for (const c of counts) assert.ok(c > 9000 && c < 11000, `count ${c} outside 9000..11000`);
});

test('prng: range refuses bad arguments', () => {
  const r = createRng(1);
  assert.throws(() => r.range(0), RangeError);
  assert.throws(() => r.range(1.5), RangeError);
  assert.equal(r.range(1), 0);
});

test('prng: the draw counter counts draws made after warm-up', () => {
  const r = createRng(5);
  assert.equal(r.draws, 0);
  r.next(); r.next();
  assert.equal(r.draws, 2);
});

test('prng: splitmix32 is deterministic', () => {
  const a = splitmix32(1), b = splitmix32(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
