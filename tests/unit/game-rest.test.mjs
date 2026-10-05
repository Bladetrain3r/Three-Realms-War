import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { newGame, rest, restCost, recruit, validateSave, GameError } from '../../sim/index.js';

const fresh = () => newGame(content, 77, { savedAt: '', build: 't' });
const valid = (s) => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors || [], []); return s; };
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError, String(e)); return e.code; } return null; };

test('rest: costs 10 per hero and 30 per injured hero (the injured replace the 10), and takes one off every injury counter', () => {
  const s = fresh(); s.currency.hacksilver = 1000; s.heroes[0].injury = 2; s.heroes[1].injury = 1;
  assert.deepEqual(restCost(s, content), { healthy: 2, wounded: 2, cost: 2 * 10 + 2 * 30 });
  const r = rest(s, content);
  assert.equal(r.save.currency.hacksilver, 1000 - 80);
  assert.deepEqual(r.save.heroes.map((h) => h.injury), [1, 0, 0, 0]);
  assert.deepEqual(r.summary.healed, [s.heroes[1].id]);
  assert.equal(s.heroes[0].injury, 2, 'the input save is not changed');
  valid(r.save);
});

test('rest: you may spend more than you have and go into debt, which the save format allows', () => {
  const s = fresh(); s.currency.hacksilver = 5; s.heroes[0].injury = 1;
  const r = rest(s, content);
  assert.equal(r.save.currency.hacksilver, 5 - (30 + 3 * 10));
  assert.equal(valid(r.save).currency.hacksilver, -55);
});

test('rest: in debt (or at zero) you cannot rest or recruit, and the refusals say how much you owe; a delve is how you earn out', () => {
  const s = fresh(); s.heroes[0].injury = 1;
  for (const gold of [0, -55]) {
    s.currency.hacksilver = gold;
    assert.equal(code(() => rest(s, content)), 'in_debt');
    assert.equal(code(() => recruit(s, content, 'hunter')), gold < 0 ? 'in_debt' : 'cannot_afford');
  }
  s.currency.hacksilver = -55; assert.throws(() => rest(s, content), /you owe 55 hacksilver/);
});

test('rest: refuses when nobody is injured (no free idle time to buy)', () => {
  const s = fresh(); s.currency.hacksilver = 1000;
  assert.equal(code(() => rest(s, content)), 'nobody_injured'); assert.equal(s.currency.hacksilver, 1000);
});

test('rest: a debt beyond the format\'s floor is refused on import, and a rest from a rich save lands exactly on the arithmetic', () => {
  const s = fresh(); s.currency.hacksilver = -1000000001;
  assert.equal(validateSave(s, content, saveSchema).ok, false);
  const t = fresh(); t.currency.hacksilver = 7931; for (const h of t.heroes) h.injury = 2;
  let cur = t; let gold = 7931;
  for (let i = 0; i < 2; i++) { const r = rest(cur, content); gold -= 4 * 30; cur = r.save; assert.equal(cur.currency.hacksilver, gold); }
  assert.deepEqual(cur.heroes.map((h) => h.injury), [0, 0, 0, 0]);
});
