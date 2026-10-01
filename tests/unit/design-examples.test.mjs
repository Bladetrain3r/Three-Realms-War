// Every [WE-nn] example in DESIGN.md, recomputed by the SIM (not by the G0 reference script) and compared to the document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentedExamples } from '../helpers/design.mjs';
import { idiv, mulbp } from '../../sim/arith.js';
import { createRng, deriveSeed } from '../../sim/prng.js';
import { sha256Hex } from '../../sim/sha256.js';
import { canonical, hashOf } from '../../sim/canon.js';
import { content, item, hero } from '../helpers/content.mjs';
import { heroBase, withAffinity, enemyScaled, enemyBase, finalStat } from '../../sim/stats.js';
import { itemMain, lineValue, rollLines, upgradeCost, salvageValue } from '../../sim/items.js';
import { buildHeroUnit } from '../../sim/hero.js';
import { xpToNext, recruitLevel, encounterRewards } from '../../sim/progress.js';
import { mulbp as mbp } from '../../sim/arith.js';

const utf8 = (s) => new TextEncoder().encode(s);
const sample = { schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } };

const wsItems = {
  10: item({ id: 10, slot: 'armour', ilvl: 26 }),
  11: item({ id: 11, slot: 'helm', ilvl: 26 }),
  12: item({ id: 12, slot: 'charm', tier: 'fine', ilvl: 26, lines: [[0, 1000]] }),
};
const fin = (u, s, inj) => finalStat(u.stats[s].base, u.stats[s].pct, inj, content.tables.stats);

// id -> function returning the values the document prints after "=>"
export const registry = {
  'WE-01': () => [mulbp(37, 11500), idiv(1000000007, 6)],
  'WE-02': () => { const n = 6, limit = 4294967296 - (4294967296 % n); return [limit, 4294967293, 1000000007 % n]; },
  'WE-03': () => { const r = createRng(1); return [r.next(), r.next(), r.next()]; },
  'WE-04': () => [deriveSeed(1, 0), deriveSeed(1, 1)],
  'WE-05': () => [1, 26, 50].map((L) => heroBase(22, L, content.tables.stats)),
  'WE-06': () => [withAffinity(123, content.tables.stats)],
  'WE-07': () => [itemMain(item({ tier: 'runed', ilvl: 26, star: 2 }), content).flat[0][1]],
  'WE-08': () => { const u = buildHeroUnit(hero({ level: 26, slots: { weapon: null, armour: 10, helm: 11, charm: 12 } }), wsItems, content); return [fin(u, 'VIG', false), u.maxHp]; },
  'WE-15': () => { const u = buildHeroUnit(hero({ level: 26, slots: { weapon: null, armour: 10, helm: 11, charm: 12 } }), wsItems, content, { forced: true }); const t = content.tables.stats; return [finalStat(300, 0, true, t), fin(u, 'VIG', true), u.maxHp]; },
  'WE-17': () => { const e = content.tables.enemy, t = content.tables.stats, b = enemyBase(14, 26, e, { tilt: true }); return [enemyScaled(14, 26, e), b, 5 * b, 5 * finalStat(b, 4000, false, t)]; },
  'WE-18': () => [upgradeCost(item({ ilvl: 26, star: 0 }), content).common, upgradeCost(item({ ilvl: 26, star: 3 }), content).common],
  'WE-19': () => [lineValue(300, 3, content.items), lineValue(300, 5, content.items)],
  'WE-20': () => { const s = [6, 150]; const l = rollLines({ range: () => s.shift() }, 1, content)[0]; return l; },
  'WE-21': () => [1, 20, 49].map((L) => xpToNext(L, content.tables.progress)),
  'WE-22': () => { const p = content.tables.progress; let xp = 0, mat = 0, sv = 0; for (let i = 0; i < 4; i++) { const e = encounterRewards(20, i === 3, p); xp += e.xp; mat += e.materials; sv += e.hacksilver; } return [xp, mbp(xp, p.restXpBp), mat, sv]; },
  'WE-23': () => [recruitLevel(26, content.tables.recruit), recruitLevel(1, content.tables.recruit)],
  'WE-33': () => [salvageValue(item({ tier: 'runed', ilvl: 26 }))],
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
