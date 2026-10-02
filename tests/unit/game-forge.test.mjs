import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { newGame, upgradeAttempt, acceptAttempt, undoAttempt, salvage, equip, validateSave, itemsById, GameError, upgradeCost, salvageValue, deriveSeed, createRng, attemptUpgrade } from '../../sim/index.js';

const fresh = () => newGame(content, 99, { savedAt: '', build: 't' });
const valid = (s) => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors, []); return s; };
const refuses = (f, code, re) => assert.throws(f, (e) => e instanceof GameError && e.code === code && (!re || re.test(e.message)), `expected ${code}`);
const stocked = () => { const s = fresh(); for (const k of Object.keys(s.materials)) s.materials[k] = 1000; return s; };
const spare = (s, over = {}) => { const it = { id: s.nextId++, slot: 'armour', kind: null, tier: 'runed', ilvl: 20, realm: 'midgard', set: null, star: 0, lines: [[0, 500], [1, 500]], held: null, heldStar: null, mulligan: 1, ...over }; s.items.push(it); return it; };

test('forge: an attempt pays its cost, uses one seed step and the same stream as the sim, and holds the previous lines', () => {
  const s0 = stocked(), it0 = spare(s0), cost = upgradeCost(it0, content);
  const s = valid(upgradeAttempt(s0, content, it0.id)), it = itemsById(s)[it0.id];
  assert.equal(s.materials.forge_iron, 1000 - cost.common);
  assert.equal(s.materials.ember_heart, 1000);
  assert.equal(s.rng.counter, s0.rng.counter + 1);
  const expected = attemptUpgrade(it0, createRng(deriveSeed(s0.rng.masterSeed, s0.rng.counter)), content);
  assert.deepEqual(it, expected);
  assert.deepEqual(it.held, it0.lines);
  assert.equal(it.heldStar, 0);
});

test('forge: from star 3 an attempt also costs hearts of the item\'s realm', () => {
  const s0 = stocked(), it0 = spare(s0, { star: 3, realm: 'asgard' }), cost = upgradeCost(it0, content);
  assert.equal(cost.rare, 1);
  const s = upgradeAttempt(s0, content, it0.id);
  assert.deepEqual([s.materials.sky_silver, s.materials.storm_heart], [1000 - cost.common, 999]);
});

test('forge: refusals: cannot afford (with the cost), a pending attempt, the tier\'s last star, unknown item', () => {
  const s = fresh(), it = spare(s);
  refuses(() => upgradeAttempt(s, content, it.id), 'cannot_afford', /costs \d+ forge_iron/);
  const rich = stocked(), it2 = spare(rich, { star: 5, tier: 'heirloom', lines: [[0, 500], [1, 500], [2, 500]] });
  refuses(() => upgradeAttempt(rich, content, it2.id), 'upgrade_max', /stops at 5 stars/);
  const rich2 = stocked(), it3 = spare(rich2), pending = upgradeAttempt(rich2, content, it3.id);
  refuses(() => upgradeAttempt(pending, content, it3.id), 'upgrade_pending');
  refuses(() => upgradeAttempt(rich2, content, 9999), 'no_such_item');
  const hearts = stocked(); const it4 = spare(hearts, { star: 3 }); hearts.materials.ember_heart = 0;
  refuses(() => upgradeAttempt(hearts, content, it4.id), 'cannot_afford', /ember_heart/);
});

test('forge: accept clears the held attempt; undo restores the old lines once, keeps the star, and does not refund', () => {
  const s0 = stocked(), it0 = spare(s0);
  const tried = upgradeAttempt(s0, content, it0.id), after = itemsById(tried)[it0.id];
  const accepted = valid(acceptAttempt(tried, content, it0.id)), a = itemsById(accepted)[it0.id];
  assert.deepEqual([a.held, a.heldStar, a.star, a.lines], [null, null, after.star, after.lines]);
  const undone = valid(undoAttempt(tried, content, it0.id)), u = itemsById(undone)[it0.id];
  assert.deepEqual([u.lines, u.star, u.held, u.heldStar, u.mulligan], [it0.lines, after.star, null, null, 0]);
  assert.equal(undone.materials.forge_iron, tried.materials.forge_iron, 'no refund');
  refuses(() => acceptAttempt(accepted, content, it0.id), 'no_pending');
  refuses(() => undoAttempt(accepted, content, it0.id), 'no_pending');
});

test('forge: the mulligan is spent until a star is gained; it refills on success', () => {
  const s0 = stocked(); const it0 = spare(s0);
  let s = s0, spentSeen = false, refilled = false;
  for (let i = 0; i < 60; i++) {
    const id = it0.id;
    let before = itemsById(s)[id];
    if (before.star >= 5) break;
    s = upgradeAttempt(s, content, id);
    const after = itemsById(s)[id];
    if (after.star > before.star) { assert.equal(after.mulligan, 1); refilled = true; s = acceptAttempt(s, content, id); }
    else if (after.mulligan === 0) { refuses(() => undoAttempt(s, content, id), 'mulligan_spent'); spentSeen = true; s = acceptAttempt(s, content, id); }
    else { s = undoAttempt(s, content, id); }
    valid(s);
  }
  assert.ok(refilled && spentSeen, `refilled ${refilled}, spent ${spentSeen}`);
});

test('forge: salvage pays the table value in the item\'s realm and refuses a worn item', () => {
  const s0 = fresh(), it = spare(s0, { realm: 'helheim', tier: 'fine', lines: [[0, 500]], ilvl: 12 });
  const s = valid(salvage(s0, content, it.id));
  assert.equal(s.materials.grave_rime, salvageValue(it));
  assert.equal(salvageValue(it), 12);
  assert.ok(!s.items.some((x) => x.id === it.id));
  const wornId = s0.heroes[0].slots.weapon;
  refuses(() => salvage(s0, content, wornId), 'item_worn');
  const off = valid(equip(s0, content, s0.heroes[0].id, 'weapon', null));
  assert.ok(valid(salvage(off, content, wornId)).items.length === s0.items.length - 1);
});
