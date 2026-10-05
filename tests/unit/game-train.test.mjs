import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { newGame, train, trainingCost, recruit, playDelve, startExpedition, validateSave, GameError } from '../../sim/index.js';

const fresh = () => newGame(content, 31, { savedAt: '', build: 't' });
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError, String(e)); return e.code; } return null; };

test('train: a level costs 100 x the level it leaves; several levels cost the sum; xp carries; the save stays valid', () => {
  const s = fresh(); s.currency.hacksilver = 5000; s.heroes[0].level = 10; s.heroes[0].xp = 123; const id = s.heroes[0].id;
  const t = train(s, content, id, 3);
  assert.equal(t.currency.hacksilver, 5000 - 3300); assert.equal(t.heroes[0].level, 13); assert.equal(t.heroes[0].xp, 123);
  assert.equal(s.heroes[0].level, 10, 'the input save is not changed');
  assert.equal(validateSave(t, content, saveSchema).ok, true);
  assert.equal(trainingCost(10, 3, content.tables.training), 3300); assert.equal(trainingCost(1, 39, content.tables.training), 78000);
});

test('train: refuses past level 40 (naming how far it can go), what you cannot afford, debt, and bad counts; never creates debt', () => {
  const s = fresh(); s.currency.hacksilver = 100000; const id = s.heroes[0].id; s.heroes[0].level = 38;
  assert.equal(code(() => train(s, content, id, 3)), 'train_cap'); assert.throws(() => train(s, content, id, 3), /at most 2 more levels/);
  assert.equal(train(s, content, id, 2).heroes[0].level, 40);
  s.heroes[0].level = 40; assert.throws(() => train(s, content, id, 1), /training stops at level 40/);
  s.heroes[0].level = 20; s.currency.hacksilver = 1999; assert.equal(code(() => train(s, content, id, 1)), 'cannot_afford');
  s.currency.hacksilver = 2000; assert.equal(train(s, content, id, 1).currency.hacksilver, 0);
  for (const bad of [0, -1, 1.5, '2']) assert.equal(code(() => train(s, content, id, bad)), 'bad_levels');
  s.currency.hacksilver = -5; assert.equal(code(() => train(s, content, id, 1)), 'in_debt');
  s.currency.hacksilver = 0; assert.equal(code(() => train(s, content, id, 1)), 'in_debt');
});

test('train: locked while an expedition is under way; a hero at 50 cannot be trained (the cap is the dungeons\')', () => {
  const s = fresh(); s.currency.hacksilver = 100000; const id = s.heroes[0].id;
  const away = startExpedition(s, content, { realm: 'midgard', level: 1, provisions: 5 }).save;
  assert.equal(code(() => train(away, content, id, 1)), 'on_expedition');
  s.heroes[0].level = 50; assert.equal(code(() => train(s, content, id, 1)), 'train_cap');
});

test('recruit: every recruit is level 1 whatever the roster, costs 120 (360 rare), and arrives with a level-1 kit', () => {
  const s = fresh(); s.currency.hacksilver = 100000; for (const h of s.heroes) h.level = 40; s.reputation.midgard = 100;
  const r = recruit(s, content, 'hunter'), h = r.heroes.at(-1);
  assert.deepEqual([h.level, h.xp], [1, 0]); assert.equal(s.currency.hacksilver - r.currency.hacksilver, 120);
  assert.ok(Object.values(h.slots).every((id) => r.items.find((i) => i.id === id).ilvl === 1));
  assert.equal(s.currency.hacksilver - recruit(s, content, 'berserker').currency.hacksilver, 360);
});

test('rest xp: a benched healthy hero within 10 levels of the party\'s best still gains it; a level-1 recruit benched behind a level-40 party gains nothing', () => {
  const s = fresh(); s.currency.hacksilver = 100000; for (const h of s.heroes) h.level = 40; s.unlocked.midgard = 40;
  const withBench = recruit(recruit(recruit(s, content, 'hunter'), content, 'hunter'), content, 'hunter');
  const [recruitA, recruitB, recruitC] = withBench.heroes.slice(-3);
  withBench.heroes.find((h) => h.id === recruitC.id).level = 30; // exactly 10 below: the gap is inclusive
  withBench.heroes.find((h) => h.id === recruitB.id).level = 31; // 9 below the party: inside the gap
  withBench.heroes.find((h) => h.id === recruitA.id).level = 29; // 11 below: outside it
  const out = playDelve(withBench, content, { realm: 'midgard', level: 5 });
  assert.equal(out.summary.outcome, 1);
  const get = (save, id) => save.heroes.find((h) => h.id === id);
  assert.equal(get(out.save, recruitA.id).xp, 0, 'outside the gap: nothing');
  assert.ok(get(out.save, recruitB.id).xp > 0 || get(out.save, recruitB.id).level > 31, 'inside the gap: rest xp');
  assert.ok(get(out.save, recruitC.id).xp > 0 || get(out.save, recruitC.id).level > 30, 'exactly at the gap: still rest xp');
});
