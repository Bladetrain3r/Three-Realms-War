import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, item } from '../helpers/content.mjs';
import { createRng } from '../../sim/prng.js';
import { itemMain, lineValue, rollLines, upgradeCost, attemptUpgrade, acceptUpgrade, useMulligan, salvageValue, generateItem } from '../../sim/items.js';

const I = content.items;

test('items: armour main stats at item level 26, Runed, star 2 (DESIGN.md WE-07)', () => {
  const m = itemMain(item({ tier: 'runed', ilvl: 26, star: 2 }), content);
  assert.deepEqual(m.flat, [['GRD', 148], ['VIG', 111]]);
});

test('items: weapon kind selects MIT or ARC; charm gives SPD and a realm-element resist', () => {
  assert.deepEqual(itemMain(item({ slot: 'weapon', kind: 'ARC', ilvl: 10 }), content).flat, [['ARC', 60]]);
  const c = itemMain(item({ slot: 'charm', ilvl: 10 }), content);
  assert.deepEqual(c.flat, [['SPD', 10]]);
  assert.equal(c.resist, 200);
});

test('items: line value scales with the star (DESIGN.md WE-19)', () => {
  assert.equal(lineValue(300, 3, I), 345);
  assert.equal(lineValue(300, 5, I), 375);
});

test('items: a rolled line is a kind then a value (DESIGN.md WE-20)', () => {
  const script = [6, 150], seen = [];
  const stub = { range(n) { seen.push(n); return script.shift(); } };
  assert.deepEqual(rollLines(stub, 1, content), [[6, 250]]);
  assert.deepEqual(seen, [10, 301]);
});

test('items: lines are distinct kinds with raw values inside their ranges', () => {
  const rng = createRng(11);
  for (let i = 0; i < 2000; i++) {
    const lines = rollLines(rng, 3, content);
    assert.equal(new Set(lines.map((l) => l[0])).size, 3);
    for (const [k, raw] of lines) assert.ok(raw >= I.lines[k].lo && raw <= I.lines[k].hi);
  }
});

test('items: upgrade cost (DESIGN.md WE-18) and the rare material from star 3', () => {
  assert.deepEqual(upgradeCost(item({ ilvl: 26, star: 0 }), content), { common: 16, rare: 0 });
  assert.deepEqual(upgradeCost(item({ ilvl: 26, star: 3 }), content), { common: 55, rare: 1 });
  assert.deepEqual(upgradeCost(item({ ilvl: 26, star: 4 }), content), { common: 3 + 65, rare: 2 });
});

test('items: salvage returns ilvl/2 x (tier index + 1) (DESIGN.md WE-33)', () => {
  assert.equal(salvageValue(item({ tier: 'runed', ilvl: 26 })), 39);
  assert.equal(salvageValue(item({ tier: 'plain', ilvl: 1 })), 0);
});

test('items: 5,000 attempts never destroy or lower anything and keep the old lines held', () => {
  const rng = createRng(2024);
  let it = item({ tier: 'heirloom', ilvl: 30, slot: 'weapon', kind: 'MIT', lines: rollLines(rng, 3, content) });
  let successes = 0, rolls = 0;
  for (let i = 0; i < 5000; i++) {
    if (it.star >= content.tierById[it.tier].maxStar) it = item({ tier: 'heirloom', ilvl: 30, slot: 'weapon', kind: 'MIT', lines: rollLines(rng, 3, content) });
    const before = it, after = attemptUpgrade(it, rng, content);
    assert.ok(after.star === before.star || after.star === before.star + 1);
    assert.equal(after.tier, before.tier); assert.equal(after.ilvl, before.ilvl); assert.equal(after.slot, before.slot);
    assert.equal(after.lines.length, 3);
    assert.deepEqual(after.held, before.lines);
    if (after.star > before.star) { successes++; assert.equal(after.mulligan, 1); }
    rolls++;
    it = acceptUpgrade(after);
  }
  assert.ok(successes > 500 && successes < rolls, `successes ${successes}`);
});

test('items: one mulligan per star; it restores the old lines, keeps the star, and refills on a star gain', () => {
  const rng = createRng(5);
  let it = item({ tier: 'runed', ilvl: 20, slot: 'helm', lines: rollLines(rng, 2, content) });
  const original = it.lines;
  let after = attemptUpgrade(it, rng, content);
  const star1 = after.star;
  const undone = useMulligan(after);
  assert.deepEqual(undone.lines, original);
  assert.equal(undone.star, star1);
  assert.equal(undone.mulligan, 0);
  assert.equal(undone.held, null);
  // Keep attempting until one fails (no star gain): the mulligan must still be spent.
  let cur = undone, guard = 0;
  for (;;) {
    const next = attemptUpgrade(cur, rng, content);
    if (next.star === cur.star) { assert.throws(() => useMulligan(next), /spent/); break; }
    cur = acceptUpgrade(next);
    if (++guard > 50) break;
  }
});

test('items: refuses to attempt with an unresolved attempt, past max star, or to undo nothing', () => {
  const rng = createRng(1);
  const it = item({ tier: 'plain', ilvl: 5 });
  const a = attemptUpgrade(it, rng, content);
  assert.throws(() => attemptUpgrade(a, rng, content), /resolve/);
  assert.throws(() => attemptUpgrade(item({ tier: 'plain', star: 3 }), rng, content), RangeError);
  assert.throws(() => useMulligan(it), /no attempt/);
  assert.throws(() => acceptUpgrade(it), /no attempt/);
});

test('items: dropped items respect tier weights, set rules and the requested level', () => {
  const rng = createRng(77), tiers = { plain: 0, fine: 0, runed: 0, heirloom: 0 };
  let sets = 0;
  for (let i = 0; i < 20000; i++) {
    const it = generateItem(rng, { ilvl: 12, realm: 'asgard', boss: false, setAllowed: true }, content);
    tiers[it.tier]++; assert.equal(it.ilvl, 12); assert.equal(it.realm, 'asgard');
    if (it.set) { sets++; assert.equal(it.set, 'stormbound'); assert.ok(content.tierById[it.tier].setAllowed); }
    assert.equal(it.lines.length, content.tierById[it.tier].lines);
    assert.equal(it.slot === 'weapon', it.kind !== null);
  }
  assert.equal(tiers.heirloom, 0);
  assert.ok(Math.abs(tiers.plain / 20000 - 0.7) < 0.02);
  assert.ok(sets > 0);
  const noSet = generateItem(createRng(1), { ilvl: 5, realm: 'midgard', boss: true, setAllowed: false }, content);
  assert.equal(noSet.set, null);
});

test('items: boss drops never roll Plain', () => {
  const rng = createRng(3);
  for (let i = 0; i < 2000; i++) assert.notEqual(generateItem(rng, { ilvl: 9, realm: 'helheim', boss: true, setAllowed: true }, content).tier, 'plain');
});
