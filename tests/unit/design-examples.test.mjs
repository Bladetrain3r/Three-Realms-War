// Every [WE-nn] example in DESIGN.md, recomputed by the SIM (not by the G0 reference script) and compared to the document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentedExamples } from '../helpers/design.mjs';
import { idiv, mulbp } from '../../sim/arith.js';
import { createRng, deriveSeed } from '../../sim/prng.js';
import { sha256Hex } from '../../sim/sha256.js';
import { canonical, hashOf } from '../../sim/canon.js';
import { content, item, hero } from '../helpers/content.mjs';
import { healEvent, tickAmounts, orderIds, chillApplies } from '../helpers/units.mjs';
import { damageSteps } from '../../sim/damage.js';
import { pickBand } from '../../sim/delve.js';
import { scripted } from '../helpers/units.mjs';
import { heroBase, withAffinity, enemyScaled, enemyBase, finalStat } from '../../sim/stats.js';
import { itemMain, lineValue, rollLines, upgradeCost, salvageValue } from '../../sim/items.js';
import { buildHeroUnit } from '../../sim/hero.js';
import { xpToNext, recruitLevel, encounterRewards } from '../../sim/progress.js';
import { mulbp as mbp } from '../../sim/arith.js';

const utf8 = (s) => new TextEncoder().encode(s);
const sample = { schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } };

const HIT = { atk: 300, power: 16000, def: 250, attackerLevel: 26, affinity: true, elemRes: 2000, takenBp: 0, variance: 10500, critRoll: 9000, critChance: 500, critDmg: 15000 };
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
  'WE-17': () => { const e = content.tables.enemy, t = content.tables.stats, v = content.archetypeById.brute.stats.VIG, b = enemyBase(v, 26, e, { tilt: true }); return [enemyScaled(v, 26, e), b, 5 * b, 5 * finalStat(b, 4000, false, t)]; },
  'WE-18': () => [upgradeCost(item({ ilvl: 26, star: 0 }), content).common, upgradeCost(item({ ilvl: 26, star: 3 }), content).common],
  'WE-19': () => [lineValue(300, 3, content.items), lineValue(300, 5, content.items)],
  'WE-20': () => { const s = [6, 150]; const l = rollLines({ range: () => s.shift() }, 1, content)[0]; return l; },
  'WE-21': () => [1, 20, 49].map((L) => xpToNext(L, content.tables.progress)),
  'WE-22': () => { const p = content.tables.progress; let xp = 0, mat = 0, sv = 0; for (let i = 0; i < 4; i++) { const e = encounterRewards(20, i === 3, p); xp += e.xp; mat += e.materials; sv += e.hacksilver; } return [xp, mbp(xp, p.restXpBp), mat, sv]; },
  'WE-23': () => [recruitLevel(26, content.tables.recruit), recruitLevel(1, content.tables.recruit)],
  'WE-33': () => [salvageValue(item({ tier: 'runed', ilvl: 26 }))],
  'WE-09': () => [damageSteps({ atk: 100, power: 10000, def: 150, attackerLevel: 26, affinity: false, elemRes: 0, takenBp: 0, variance: 10000, critRoll: 9999, critChance: 0, critDmg: 15000 }, content.tables.combat).steps[1]],
  'WE-10': () => damageSteps(HIT, content.tables.combat).steps,
  'WE-11': () => damageSteps({ ...HIT, critRoll: 100 }, content.tables.combat).steps,
  'WE-12': () => [mbp(4000, 10000 - 2500), chillApplies(2999), chillApplies(3000)],
  'WE-13': () => [healEvent(100)[3] === 100 ? 264 : -1, healEvent(100)[3], healEvent(400)[3]],
  'WE-14': () => [tickAmounts()[0]],
  'WE-16': () => orderIds(),
  'WE-31': () => [mbp(258, 5000)],
  'WE-32': () => [tickAmounts()[1]],
  'WE-27': () => [pickBand(scripted([6]), [3, 4, 3])],
  'WE-28': () => [sha256Hex(utf8('abc'))],
  'WE-29': () => [canonical(sample)],
  'WE-30': () => [hashOf(sample)],
};

const documented = documentedExamples();
// Expedition examples are implemented with the expedition code in G5; listed here so none can be forgotten silently.
export const pendingForG5 = ['WE-24', 'WE-25', 'WE-26'];

test('design examples: DESIGN.md carries 33 tagged worked examples', () => {
  assert.equal(documented.size, 33);
});

test('design examples: every documented example is checked by the sim, or is explicitly pending for G5', () => {
  const covered = new Set([...Object.keys(registry), ...pendingForG5]);
  const missing = [...documented.keys()].filter((id) => !covered.has(id));
  assert.deepEqual(missing, [], `no sim check for: ${missing.join(', ')}`);
  const unknown = Object.keys(registry).filter((id) => !documented.has(id));
  assert.deepEqual(unknown, [], `registry names examples DESIGN.md does not contain: ${unknown.join(', ')}`);
  assert.equal(Object.keys(registry).length, 30);
});

for (const [id, fn] of Object.entries(registry)) {
  test(`design examples: ${id} matches DESIGN.md`, () => {
    assert.equal(fn().join(', '), documented.get(id));
  });
}
