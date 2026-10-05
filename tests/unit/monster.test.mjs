import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { buildMonster } from '../../sim/monster.js';
import { makeUnit } from '../../sim/unit.js';
import { enemyBase, finalStat } from '../../sim/stats.js';

const e = content.tables.enemy, t = content.tables.stats;
const row = (id) => content.roster.find((m) => m.id === id);
const affix = (id) => content.affixes.find((a) => a.id === id);

test('monster: an Ember Raider at level 26 has the documented VIG and 620 HP (DESIGN.md WE-17)', () => {
  const m = buildMonster(row('midgard_ember_raider'), 26, content);
  assert.equal(m.stats.VIG.base, 124);
  assert.equal(m.maxHp, 620);
});

test('monster: Hardy raises VIG by 40% and max HP with it (DESIGN.md WE-17)', () => {
  const m = buildMonster(row('midgard_ember_raider'), 26, content, { affixes: [affix('hardy')] });
  assert.equal(m.maxHp, 865);
  assert.deepEqual(m.affixes, ['hardy']);
});

test('monster: tilt applies to the realm\'s two stats only', () => {
  const m = buildMonster(row('asgard_storm_thane'), 20, content); // Asgard: ARC and SPD
  const brute = content.archetypeById.brute.stats;
  assert.equal(m.stats.ARC.base, enemyBase(brute.ARC, 20, e, { tilt: true }));
  assert.equal(m.stats.SPD.base, enemyBase(brute.SPD, 20, e, { tilt: true }));
  assert.equal(m.stats.MIT.base, enemyBase(brute.MIT, 20, e, { tilt: false }));
});

test('monster: a signature monster is 15% stronger before the tilt, and carries its special first', () => {
  const chief = buildMonster(row('midgard_warband_chief'), 26, content);
  assert.equal(chief.stats.VIG.base, enemyBase(content.archetypeById.brute.stats.VIG, 26, e, { multiplierBp: e.signatureBp, tilt: true }));
  assert.deepEqual(chief.skills, ['war_cry', 'smash']);
  assert.deepEqual(buildMonster(row('midgard_ember_raider'), 26, content).skills, ['smash']);
});

test('monster: a boss has triple VIG, 1.5x elsewhere, is level+2 by the caller, immune to shock, never affixed', () => {
  const b = buildMonster(content.bossById.surtr, 14, content, { boss: true });
  assert.equal(b.stats.VIG.base, enemyBase(content.archetypeById.brute.stats.VIG, 14, e, { multiplierBp: e.bossVigBp, tilt: true }));
  assert.equal(b.stats.GRD.base, enemyBase(content.archetypeById.brute.stats.GRD, 14, e, { multiplierBp: e.bossOtherBp, tilt: false }));
  assert.equal(b.boss, true);
  assert.deepEqual(b.skills, ['sword_of_flame', 'ragnarok_blaze']);
  assert.ok(b.maxHp > 2.5 * buildMonster(row('midgard_ember_raider'), 14, content).maxHp);
});

test('monster: each dungeon resists its element, is weak to the next, and the third is neutral (DESIGN.md 6)', () => {
  const r = (id) => buildMonster(row(id), 10, content).res;
  assert.deepEqual(r('midgard_ember_raider'), { fire: 5000, frost: -2500, lightning: 0 });
  assert.deepEqual(r('asgard_storm_thane'), { fire: -2500, frost: 0, lightning: 5000 });
  assert.deepEqual(r('helheim_draugr_brute'), { fire: 0, frost: 5000, lightning: -2500 });
});

test('monster: status resist grows with level, and Resolute adds 5000', () => {
  assert.equal(buildMonster(row('midgard_ember_raider'), 10, content).sres, 500 + 800);
  assert.equal(buildMonster(row('midgard_ember_raider'), 10, content, { affixes: [affix('resolute')] }).sres, 500 + 800 + 5000);
});

test('monster: affix effects reach the definition (lifesteal, regeneration, extra rider, stat mods)', () => {
  const m = buildMonster(row('midgard_ember_raider'), 30, content, { affixes: [affix('vampiric'), affix('regenerating'), affix('marking'), affix('brutal')] });
  assert.equal(m.lifestealBp, 2000);
  assert.equal(m.regenBp, 500);
  assert.deepEqual(m.extraRiders, [{ status: 'mark', chance: 2500, duration: 2, on: 'target' }]);
  assert.equal(m.stats.MIT.pct, 3000);
  assert.equal(m.stats.ARC.pct, 3000);
});

test('monster: all 36 monsters and 3 bosses build at levels 1, 25 and 50 and become fight units', () => {
  for (const L of [1, 25, 50]) {
    for (const r of content.roster) {
      const m = buildMonster(r, L, content);
      assert.ok(m.maxHp >= 5, `${r.id} L${L}`);
      assert.doesNotThrow(() => makeUnit(m, 4, 1, 0, null, content), r.id);
      assert.ok(m.skills.every((s) => content.skillById[s]), r.id);
    }
    for (const b of content.bosses) {
      const m = buildMonster(b, L + 2, content, { boss: true });
      assert.doesNotThrow(() => makeUnit(m, 4, 1, 0, null, content), b.id);
      assert.equal(finalStat(m.stats.VIG.base, 0, false, t) * 5, m.maxHp);
    }
  }
});
