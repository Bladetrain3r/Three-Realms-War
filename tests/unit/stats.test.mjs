import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { heroBase, withAffinity, enemyScaled, enemyBase, finalStat } from '../../sim/stats.js';

const t = content.tables.stats, e = content.tables.enemy;

test('stats: level 1 is the profile value and level 50 is exactly 10x for every class and stat', () => {
  for (const h of content.heroes) {
    for (const s of ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD']) {
      assert.equal(heroBase(h.stats[s], 1, t), h.stats[s]);
      assert.equal(heroBase(h.stats[s], 50, t), 10 * h.stats[s], `${h.id} ${s}`);
    }
  }
});

test('stats: the hero curve never decreases with level', () => {
  for (const s1 of [3, 12, 22, 26]) {
    let prev = 0;
    for (let L = 1; L <= 50; L++) { const v = heroBase(s1, L, t); assert.ok(v >= prev); prev = v; }
  }
});

test('stats: affinity is +10% floored', () => assert.equal(withAffinity(123, t), 135));

test('stats: enemy curve and tilt, with the Hardy affix as a percentage (DESIGN.md WE-17)', () => {
  assert.equal(enemyScaled(14, 26, e), 171);
  const base = enemyBase(14, 26, e, { tilt: true });
  assert.equal(base, 188);
  assert.equal(finalStat(base, 4000, false, t), 263);
});

test('stats: boss multiplier applies before the tilt', () => {
  const plain = enemyBase(14, 10, e, { tilt: true });
  const boss = enemyBase(14, 10, e, { multiplierBp: e.bossVigBp, tilt: true });
  assert.ok(boss > 2 * plain);
});

test('stats: finalStat floors at 1 and halves when injured', () => {
  assert.equal(finalStat(1, 0, true, t), 1);
  assert.equal(finalStat(300, 0, true, t), 150);
  assert.equal(finalStat(300, 2500, false, t), 375);
});
