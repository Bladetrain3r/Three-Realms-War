import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { xpToNext, recruitLevel, recruitCost, encounterRewards } from '../../sim/progress.js';
import { mulbp } from '../../sim/arith.js';

const p = content.tables.progress, r = content.tables.recruit;

test('progress: experience to the next level (DESIGN.md WE-21)', () => {
  assert.deepEqual([xpToNext(1, p), xpToNext(20, p), xpToNext(49, p)], [80, 1050, 7402]);
});

test('progress: xp to next strictly increases with level', () => {
  for (let L = 1; L < 49; L++) assert.ok(xpToNext(L + 1, p) > xpToNext(L, p));
});

test('progress: recruit level and cost (DESIGN.md WE-23)', () => {
  assert.equal(recruitLevel(26, r), 1);
  assert.equal(recruitLevel(1, r), 1);
  assert.equal(recruitCost(1, false, r), 120);
  assert.equal(recruitCost(1, true, r), 360);
  assert.equal(recruitCost(19, false, r), 480, 'the cost formula still prices a higher level');
});

test('progress: a level-20 delve of three encounters and a boss (DESIGN.md WE-22)', () => {
  let xp = 0, mat = 0, silver = 0;
  for (let i = 0; i < 3; i++) { const e = encounterRewards(20, false, p); xp += e.xp; mat += e.materials; silver += e.hacksilver; }
  const b = encounterRewards(20, true, p);
  xp += b.xp; mat += b.materials; silver += b.hacksilver;
  assert.deepEqual([xp, mulbp(xp, p.restXpBp), mat, silver], [450, 225, 45, 150]);
});
