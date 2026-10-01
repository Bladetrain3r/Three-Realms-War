// Numbers that DESIGN.md states in sentences rather than tables. Each is located by its sentence, so if the design is
// reworded the test says which constant lost its source; and if the content drifts the test says which number differs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { prose, proseRaw, designText } from '../helpers/mdtables.mjs';

const T = content.tables, I = content.items;
const sum = (a) => a.reduce((x, y) => x + y, 0);

const CASES = [
  // [label, regex over DESIGN.md, expected numbers from the content, in capture order]
  ['4.1 base crit, crit damage, hero status resist', /`CRIT`\s+\(crit\s+chance,\s+bp,\s+base\s+(\d+)\),\s+`CRITDMG`\s+\(crit\s+multiplier,\s+bp,\s+base\s+(\d+)\),\s+`SRES`\s+\(status\s+resistance,\s+bp,\s+base\s+(\d+)\s+for\s+heroes\)/, () => [T.stats.baseCrit, T.stats.baseCritDmg, T.stats.heroSresBase]],
  ['4.1 HP per VIG', /maximum HP is `(\d+) x VIG`/, () => [T.stats.hpPerVig]],
  ['4.2 hero curve', /`base\(s1, L\) = s1 \+ idiv\(s1 \* (\d+) \* \(L - 1\), (\d+)\)`/, () => [T.stats.growthMul, T.stats.growthDiv]],
  ['4.2 level cap (level 50 is exactly 10x level 1)', /\(1 to (\d+)\):/, () => [T.stats.levelCap]],
  ['4.3 realm affinity bonus', /multiplied by `\+(\d+) bp`/, () => [T.stats.affinityBp]],
  ['4.3 realm element resist', /`RES` of the realm's element of `\+(\d+) bp`/, () => [T.stats.affinityResBp]],
  ['4.4 injured halving', /halve it \(`mulbp\(x, (\d+)\)`\)/, () => [T.stats.injuredBp]],
  ['4.5 enemy curve', /`enemy\(p, L\) = p \+ idiv\(p \* (\d+) \* \(L - 1\), (\d+)\)`/, () => [T.enemy.curveK, T.enemy.curveDiv]],
  ['4.5 signature multiplier', /signature \(`x(\d+)`\)/, () => [T.enemy.signatureBp]],
  ['4.5 realm tilt', /realm tilt\s+\(\+(\d+) bp on two stats/, () => [T.enemy.tiltBp]],
  ['4.5 enemy status resist', /`SRES = (\d+) \+ (\d+) x level`/, () => [T.enemy.sresBase, T.enemy.sresPerLevel]],
  ['5.2 round cap', /After\s+\*\*(\d+) rounds\*\*/, () => [T.combat.roundCap]],
  ['5.5 mitigation cap, base and per-level', /`mit = min\((\d+), idiv\(def \* 10000, def \+ (\d+) \+ (\d+) \* LA\)\)`/, () => [T.combat.mitCapBp, T.combat.mitBase, T.combat.mitPerLevel]],
  ['5.5 affinity damage bonus', /`d =\s+mulbp\(d, (\d+)\)` \(affinity\)/, () => [T.combat.realmDamageBp]],
  ['5.5 elemental resist clamp', /clamp\(RES_element, (-?\d+), (\d+)\)\)`/, () => [T.combat.resMin, T.combat.resMax]],
  ['5.5 variance', /`v = (\d+) \+ range\((\d+)\)`/, () => [T.combat.varianceMin, T.combat.varianceSpan]],
  ['5.8 rest between encounters', /recovers\s+`mulbp\(maxHP, (\d+)\)`/, () => [T.combat.restHealBp]],
  ['5.9 injury length', /`INJURY_DELVES = (\d+)`/, () => [T.injury.delves]],
  ['9.2 brace duration', /gains bulwark for (\d+) turn/, () => [T.combat.braceTurns]],
  ['7.5 recruit level', /`max\(1, idiv\(topLevel \* (\d+), (\d+)\)\)`/, () => [T.recruit.levelNum, T.recruit.levelDen]],
  ['7.5 recruit cost', /`(\d+) \+ (\d+) x recruit level`/, () => [T.recruit.costBase, T.recruit.costPerLevel]],
  ['7.5 roster size', /at most (\d+) heroes/, () => [T.recruit.rosterMax]],
  ['8.1 hero may wear items up to level + slack', /`hero level \+ (\d+)`/, () => [I.levelSlack]],
  ['8.4 star bonus', /`mulbp\(raw, 10000 \+ (\d+) x star\)`/, () => [I.starBonusBp]],
  ['8.4 star success odds', /`\[(\d+), (\d+), (\d+), (\d+), (\d+)\]\[s\]`/, () => I.starSuccessBp],
  ['8.4 common cost', /`(\d+) \+ idiv\(i x \(s \+ 1\), (\d+)\)`/, () => [I.upgradeCost.commonBase, I.upgradeCost.commonDivisor]],
  ['8.4 rare material from star', /from star (\d+) upward/, () => [I.upgradeCost.rareFromStar]],
  ['8.6 ordinary drop chance and tier weights', /probability (\d+) bp: tier by weights Plain (\d+), Fine (\d+), Runed\s+(\d+)/, () => [I.drops.encounterBp, I.drops.tierWeights.plain, I.drops.tierWeights.fine, I.drops.tierWeights.runed]],
  ['8.6 boss drop tier weights', /A boss drops one item: Fine (\d+), Runed (\d+), Heirloom (\d+)/, () => [I.drops.bossTierWeights.fine, I.drops.bossTierWeights.runed, I.drops.bossTierWeights.heirloom]],
  ['8.6 set tag chance', /with probability (\d+) bp, but\s+only once/, () => [I.drops.setTagBp]],
  ['8.6 stash size', /The stash holds (\d+) items/, () => [I.stashMax]],
  ['9 rules per runbook', /at most \*\*(\d+) rules\*\* per hero/, () => [content.runbook.maxRules]],
  ['9 clauses per rule', /with 1 or (\d+) clauses/, () => [content.runbook.maxClauses]],
  ['10.4 boss multipliers (VIG x3, others x1.5, as basis points)', /VIG `x(\d+)` and every other stat `x([\d.]+)`/, () => [T.enemy.bossVigBp / 10000, T.enemy.bossOtherBp / 10000]],
  ['10.4 boss level bonus', /is\s+level `delve level \+ (\d+)`/, () => [T.enemy.bossLevelBonus]],
  ['10.5 encounter count', /`n = (\d+) \+ range\((\d+)\)`/, () => [T.delve.minEncounters, T.delve.encounterSpan]],
  ['10.5 enemies per encounter', /the first encounter has (\d+) monsters; the rest have (\d+)/, () => [T.delve.firstEnemies, T.delve.otherEnemies]],
  ['10.5 boss encounter adds', /the boss plus (\d+) monsters/, () => [T.delve.bossAdds]],
  ['10.5 band weights', /first encounter weights \((\d+), (\d+), (\d+)\), middle encounters \((\d+), (\d+), (\d+)\), the monsters beside the boss \((\d+), (\d+), (\d+)\)/, () => [...T.delve.bandWeights.first, ...T.delve.bandWeights.middle, ...T.delve.bandWeights.boss]],
  ['10.5 affix chances and levels', /none below `D = (\d+)`\. At `D` from \d+, each enemy gets one affix with probability (\d+) bp\s+\((\d+) bp from `D = (\d+)`\), and from `D = (\d+)` a second, different one with probability (\d+) bp/, () => [T.delve.affix.minDelve, T.delve.affix.chanceBp, T.delve.affix.chanceHighBp, T.delve.affix.highFrom, T.delve.affix.secondFrom, T.delve.affix.secondBp]],
  ['10.5 affixes begin at the same level the chance rule does', /At `D` from (\d+), each enemy/, () => [T.delve.affix.minDelve]],
  ['10.6 unlock cap', /to a cap of (\d+)\./, () => [T.progress.unlockCap]],
  ['11.1 xp to next level', /`xp_to_next\(L\) = (\d+) \+ (\d+) L \+ idiv\(L\^3, (\d+)\)`/, () => [T.progress.xpBase, T.progress.xpPerLevel, T.progress.xpCubeDiv]],
  ['11.1 encounter xp and boss multiple', /gives every participating hero `(\d+) \+ (\d+) D` xp \(the boss encounter `(\d+)x`\)/, () => [T.progress.encXpBase, T.progress.encXpPerD, T.progress.bossMul]],
  ['11.1 rest xp share', /receive (\d+)% of the delve's xp/, () => [T.progress.restXpBp / 100]],
  ['11.2 materials, silver and boss multiples', /\*\*common materials\*\* `(\d+) \+ idiv\(D, (\d+)\)`, \*\*hacksilver\*\* `(\d+) \+ D`; a boss encounter pays (\d+)x\s+materials and (\d+)x hacksilver/, () => [T.progress.matBase, T.progress.matDiv, T.progress.silverBase, T.progress.bossMatMul, T.progress.bossSilverMul]],
  ['11.2 reputation per delve and boss', /`\+(\d+)` per won delve, `\+(\d+)` more for the boss/, () => [T.progress.repWin, T.progress.repBoss]],
  ['11.2 insurance drop chance', /has a (\d+) bp chance to drop/, () => [T.progress.threadBp]],
  ['11.3 hearts to buy the insurance item', /bought for (\d+) hearts/, () => [T.progress.threadHearts]],
];

for (const [label, re, expected] of CASES) {
  test(`design prose: ${label}`, () => assert.deepEqual(prose(re, label), expected()));
}

test('design prose: the rare-class price is three times the common price', () => {
  assert.equal(T.recruit.rareMul, 3);
  assert.match(designText, /three times that/);
});

test('design prose: the starting roster is the four classes the design names', () => {
  const [, line] = /The new game begins with four heroes at level 1: (.*?) each with Plain/s.exec(designText);
  const named = [...line.matchAll(/\*\*([^*]+)\*\*/g)].flatMap((m) => m[1].split(/,\s*/)).map((s) => s.toLowerCase());
  assert.deepEqual([...T.recruit.startingRoster].sort(), [...named].sort());
});

test('design prose: weights and chances are internally consistent', () => {
  assert.equal(sum(Object.values(I.drops.tierWeights)), 10000);
  assert.equal(sum(Object.values(I.drops.bossTierWeights)), 10000);
  assert.ok(T.delve.affix.chanceHighBp > T.delve.affix.chanceBp);
  assert.equal(T.stats.levelCap, 50);
  assert.equal(T.stats.growthMul + 1, 10, 'level 50 must be exactly 10x level 1');
  assert.equal(T.stats.growthDiv, T.stats.levelCap - 1);
});

test('design prose: counts the design announces (15 classes, 33 hero skills, 36 monsters, 3 bosses, 8 affixes, 3 sets)', () => {
  assert.deepEqual(
    [content.heroes.length, content.skills.filter((s) => content.heroById[s.owner]).length, content.roster.length, content.bosses.length, content.affixes.length, I.sets.length],
    [15, 33, 36, 3, 8, 3]);
  for (const r of ['midgard', 'asgard', 'helheim']) assert.equal(content.roster.filter((m) => m.realm === r).length, 12, r);
  assert.equal(content.heroes.filter((h) => h.rarity === 'common').length, 12);
  assert.equal(content.heroes.filter((h) => h.rarity === 'rare').length, 3);
  const header = /## 2\. Content scale[\s\S]*?\| Hero classes \| 15 \(12 common, 3 rare\)/.test(designText);
  assert.ok(header, 'DESIGN.md section 2 no longer states 15 classes (12 common, 3 rare)');
});

test('design prose: skills the design lists only by id (monster, special, basic) are named by title-casing the id', () => {
  const title = (id) => id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const unnamed = content.skills.filter((s) => ['archetype', 'special', 'basic'].includes(s.owner));
  assert.equal(unnamed.length, 8 + 12 + 3);
  for (const s of unnamed) assert.equal(s.name, title(s.id), s.id);
});

test('design prose: the runbook\'s element values are exactly the three realm elements (DESIGN.md 6)', () => {
  assert.deepEqual([...content.runbook.argTypes.element.values].sort(), content.realms.map((r) => r.element).sort());
});
