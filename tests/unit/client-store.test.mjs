import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { createStore, SAVE_KEY } from '../../client/store.js';
import { setParty, recruit, canonical, newGame, validateSave } from '../../sim/index.js';

const fakeStorage = (init = {}) => { const m = { ...init }; return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const make = (storage = fakeStorage(), seed = 99) => createStore({ content, saveSchema, build: 't', storage, now: () => '2026-10-02T00:00:00Z', seed: () => seed });

test('store: a new game is saved to storage and a second store over the same storage resumes it', () => {
  const st = fakeStorage(), a = make(st);
  assert.ok(st.m[SAVE_KEY], 'nothing was stored');
  assert.equal(validateSave(JSON.parse(st.m[SAVE_KEY]), content, saveSchema).ok, true);
  a.act(setParty, [a.save.party[1], a.save.party[0]]);
  const b = make(st, 12345);
  assert.deepEqual(b.save.party, a.save.party, 'the resumed game must be the saved one, not a new one');
});

test('store: a refused action returns the rule\'s code and message, leaves the save alone and does not notify', () => {
  const a = make(); let n = 0; a.subscribe(() => n++);
  const before = a.exportText(), r = a.act(recruit, 'hunter');
  assert.equal(r.ok, false); assert.equal(r.code, 'cannot_afford'); assert.match(r.message, /costs 120 hacksilver/);
  assert.equal(a.exportText(), before); assert.equal(n, 0);
  assert.equal(a.act(setParty, [a.save.party[0]]).ok, true); assert.equal(n, 1);
});

test('store: a bug (not a GameError) is not swallowed', () => {
  assert.throws(() => make().act(() => { throw new TypeError('boom'); }), /boom/);
});

test('store: export then import is the identity; a damaged save, bad JSON and a wrong format are refused with the key and reason', () => {
  const a = make(), text = a.exportText(), b = make(fakeStorage(), 7);
  assert.notEqual(b.exportText(), text);
  assert.deepEqual(b.importText(text), { ok: true });
  assert.equal(b.exportText(), text);
  const bad = JSON.parse(text); bad.items[0].star = 99;
  const r = b.importText(JSON.stringify(bad));
  assert.equal(r.ok, false); assert.match(r.errors[0].key, /items/); assert.match(r.errors[0].message, /at most/);
  assert.match(b.importText('{{').errors[0].message, /not valid JSON/);
  assert.equal(b.importText(JSON.stringify({ format: 'other' })).ok, false);
  assert.equal(b.exportText(), text, 'refused imports must not change the save');
});

test('store: a stored save that fails validation is kept aside, a new game starts and the problem is reported', () => {
  const good = newGame(content, 5); good.heroes[0].level = 9999;
  const st = fakeStorage({ [SAVE_KEY]: canonical(good) }), a = make(st);
  assert.match(a.problem, /was refused/); assert.equal(st.m[`${SAVE_KEY}.bad`], canonical(good));
  assert.equal(validateSave(a.save, content, saveSchema).ok, true);
  const junk = make(fakeStorage({ [SAVE_KEY]: 'not json' }));
  assert.match(junk.problem, /not valid JSON/);
});

test('store: with no storage the game still works (private windows) and a full storage is reported, not fatal', () => {
  const a = make(null); assert.equal(a.act(setParty, [a.save.party[0]]).ok, true);
  const full = fakeStorage(); const b = make(full); full.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.equal(b.act(setParty, [b.save.party[0]]).ok, true); assert.match(b.problem, /could not write the save/);
});

test('store: a delve keeps its replay and the pre-delve save for the battle screen, and reset replaces the game', () => {
  const a = make(), r = a.delve({ realm: 'midgard', level: 1 });
  assert.equal(r.ok, true); assert.equal(a.lastBattle.replay.hash, r.value.replay.hash); assert.ok(a.lastBattle.before.rng.counter < a.save.rng.counter);
  assert.equal(a.delve({ realm: 'midgard', level: 5 }).code, 'level_locked');
  a.reset(); assert.equal(a.lastBattle, null); assert.ok(a.save.heroes.length === 4);
});

