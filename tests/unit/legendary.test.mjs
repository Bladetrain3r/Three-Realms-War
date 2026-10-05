import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema, item } from '../helpers/content.mjs';
import { createRng } from '../../sim/prng.js';
import { attemptUpgrade, upgradeCost, generateItem, itemMain, salvageValue } from '../../sim/items.js';
import { newGame, upgradeAttempt, salvage, salvageMany, validateSave, GameError } from '../../sim/index.js';

const legendary = (over = {}) => item({ tier: 'legendary', slot: 'weapon', kind: 'MIT', ilvl: 40, lines: [[0, 900], [5, 600], [6, 300]], set: null, ...over });
const scripted = (draws) => ({ range: (n) => { const d = draws.shift(); assert.ok(d < n, `draw ${d} for range ${n}`); return d; } });

test('legendary: a tier of its own, 1.5 x Heirloom, seven stars, three fixed lines, no set, never in a random drop', () => {
  const t = content.tierById.legendary, h = content.tierById.heirloom;
  assert.deepEqual([t.multiplierBp, t.lines, t.maxStar, t.setAllowed, t.fixedLines], [h.multiplierBp * 3 / 2, 3, 7, false, true]);
  assert.equal(content.items.starSuccessBp.length, 7);
  const rng = createRng(11);
  for (const source of ['delve', 'expedition']) for (const boss of [false, true]) for (let i = 0; i < 4000; i++) assert.notEqual(generateItem(rng, { ilvl: 30, realm: 'midgard', boss, setAllowed: true, source }, content).tier, 'legendary');
});

test('legendary: the main stat is 1.5 x the Heirloom one at the same level and star, and a 7th star adds 35%', () => {
  const a = itemMain(item({ tier: 'heirloom', slot: 'armour', ilvl: 40, star: 5 }), content), b = itemMain(legendary({ slot: 'armour', kind: null, star: 5 }), content);
  for (let i = 0; i < a.flat.length; i++) assert.ok(Math.abs(b.flat[i][1] / a.flat[i][1] - 1.5) < 0.02, `${a.flat[i]} vs ${b.flat[i]}`);
  const s0 = itemMain(legendary({ star: 0 }), content).flat[0][1], s7 = itemMain(legendary({ star: 7 }), content).flat[0][1];
  assert.ok(Math.abs(s7 / s0 - 1.35) < 0.01);
});

test('legendary: attempts roll only the star, keep the lines, hold nothing and leave no mulligan to spend; odds are 20% then 5% at stars 5 and 6', () => {
  const it = legendary({ star: 5 });
  const win = attemptUpgrade(it, scripted([1999]), content), lose = attemptUpgrade(it, scripted([2000]), content);
  assert.deepEqual([win.star, lose.star], [6, 5]); assert.deepEqual([win.held, win.heldStar, lose.held], [null, null, null]); assert.deepEqual(win.lines, it.lines); assert.equal(win.mulligan, it.mulligan);
  const w7 = attemptUpgrade(legendary({ star: 6 }), scripted([499]), content), l7 = attemptUpgrade(legendary({ star: 6 }), scripted([500]), content);
  assert.deepEqual([w7.star, l7.star], [7, 6]);
  assert.throws(() => attemptUpgrade(legendary({ star: 7 }), scripted([0]), content), /maximum star/);
  const rng = createRng(5); let wins = 0; for (let i = 0; i < 20000; i++) wins += attemptUpgrade(legendary({ star: 6 }), rng, content).star === 7 ? 1 : 0;
  assert.ok(Math.abs(wins / 20000 - 0.05) < 0.01, `${wins / 20000}`);
});

test('legendary: stars 6 and 7 cost three times the usual (common and hearts); lower stars are priced as before', () => {
  const c = (star, tier = 'legendary') => upgradeCost(legendary({ star, tier, ilvl: 40 }), content);
  assert.deepEqual(c(4), { common: 3 + Math.trunc(40 * 5 / 2), rare: 2 });
  assert.deepEqual(c(5), { common: 3 * (3 + Math.trunc(40 * 6 / 2)), rare: 3 * 3 });
  assert.deepEqual(c(6), { common: 3 * (3 + Math.trunc(40 * 7 / 2)), rare: 3 * 4 });
});

test('legendary: cannot be salvaged, singly or in bulk; a save with a 7-star Legendary item is valid and a 8-star one is not', () => {
  const s = newGame(content, 3, { savedAt: '', build: 't' });
  s.items.push({ ...legendary({ id: s.nextId, star: 7 }) }); const id = s.nextId++;
  assert.equal(validateSave(s, content, saveSchema).ok, true);
  const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError); return e.code; } };
  assert.equal(code(() => salvage(s, content, id)), 'legendary_kept'); assert.equal(code(() => salvageMany(s, content, [id])), 'legendary_kept');
  s.items.at(-1).star = 8; assert.equal(validateSave(s, content, saveSchema).ok, false);
  assert.equal(code(() => upgradeAttempt({ ...s, items: s.items.map((x) => (x.id === id ? { ...x, star: 7 } : x)), materials: Object.fromEntries(Object.keys(s.materials).map((k) => [k, 9999])) }, content, id)), 'upgrade_max');
  assert.ok(salvageValue(legendary(), content) >= 0);
});

test('drops: delves never drop Heirloom (40,000 draws); expeditions do, more at the site boss', () => {
  const rng = createRng(9), tiers = (source, boss) => { const c = { plain: 0, fine: 0, runed: 0, heirloom: 0 }; for (let i = 0; i < 20000; i++) c[generateItem(rng, { ilvl: 20, realm: 'asgard', boss, setAllowed: true, source }, content).tier]++; return c; };
  assert.equal(tiers('delve', false).heirloom, 0); assert.equal(tiers('delve', true).heirloom, 0);
  const e = tiers('expedition', false), eb = tiers('expedition', true);
  assert.ok(Math.abs(e.heirloom / 20000 - 0.03) < 0.01, JSON.stringify(e)); assert.ok(Math.abs(eb.heirloom / 20000 - 0.6) < 0.02, JSON.stringify(eb)); assert.equal(eb.plain + eb.fine, 0);
});
