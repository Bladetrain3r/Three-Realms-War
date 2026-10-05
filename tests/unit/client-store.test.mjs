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


test('store: a timed batch lands the same save and runs as playDelves, applies each run as it lands, locks everything meanwhile, and can be stopped', async () => {
  const { playDelves } = await import('../../sim/index.js');
  const mk = () => { const a = make(); for (const h of a.save.heroes) h.level = 40; return a; };
  const a = mk(); a.importText(a.exportText());
  const strongSave = JSON.parse(a.exportText()); for (const h of strongSave.heroes) h.level = 40; a.importText(JSON.stringify(strongSave));
  const want = playDelves(strongSave, content, { realm: 'midgard', level: 1 }, 4);
  const seen = []; a.subscribe(() => seen.push(a.busy ? a.busy.i : 'idle'));
  const p = a.delvesTimed({ realm: 'midgard', level: 1 }, 4, 5);
  assert.equal(a.busy.n, 4);
  assert.equal(a.act(setParty, [a.save.party[0]]).code, 'busy'); assert.equal(a.delve({ realm: 'midgard', level: 1 }).code, 'busy'); assert.equal(a.importText('{}').ok, false);
  const r = await p;
  assert.equal(r.ok, true); assert.equal(a.busy, null);
  assert.equal(canonical(a.save).replace(/"meta":\{[^}]*\},/, ''), canonical(want.save).replace(/"meta":\{[^}]*\},/, ''));
  assert.deepEqual(r.value.runs.map((x) => x.replay.hash), want.runs.map((x) => x.replay.hash)); assert.equal(r.value.stopped, want.stopped);
  assert.ok(seen.includes(0) && seen.includes('idle'));
  // stop after the current run
  const b = mk(); b.importText(JSON.stringify(strongSave));
  const q = b.delvesTimed({ realm: 'midgard', level: 1 }, 10, 5); b.stopBatch();
  const rb = await q; assert.equal(rb.value.stopped, 'stopped'); assert.equal(rb.value.runs.length, 1);
  assert.equal((await b.delvesTimed({ realm: 'midgard', level: 99 }, 3, 0)).code, 'level_locked', 'refusals arrive at once, before any waiting');
  assert.equal((await b.delvesTimed({ realm: 'midgard', level: 1 }, 99, 0)).code, 'bad_count');
});

// ---- G6: watching a replay file ----
import { createReplay, createFloorReplay, serializeReplay, indexContent } from '../../sim/index.js';
import { builtSave } from '../../checks/expedition-bot.mjs';
import { buildHeroUnit, itemsById } from '../../sim/index.js';
const partyOf = (s) => { const by = itemsById(s); return s.party.map((id) => buildHeroUnit(s.heroes.find((h) => h.id === id), by, content)); };
const delveReplay = (c = content, seed = 7) => createReplay({ realm: 'midgard', level: 5, seed, party: partyOf(builtSave(c, { heroLevel: 8, tier: 'runed', star: 3, ilvl: 8, withLines: true }, 3)), setAllowed: false }, c);

test('replay viewer: a good file is verified and becomes the battle shown; the save is untouched and nothing is notified', () => {
  const a = make(); let n = 0; a.subscribe(() => n++);
  const before = a.exportText(), doc = delveReplay(), r = a.viewReplay(serializeReplay(doc));
  assert.equal(r.ok, true); assert.deepEqual(r.verdict, { ok: true, resimulated: true, reasons: [] });
  assert.equal(a.lastBattle.kind, 'viewed'); assert.equal(a.lastBattle.replay.hash, doc.hash); assert.equal(a.exportText(), before); assert.equal(n, 0);
  const f = createFloorReplay({ realm: 'asgard', level: 12, seed: 4, boss: true, legend: 'fenris', party: partyOf(builtSave(content, { heroLevel: 50, tier: 'heirloom', star: 5, ilvl: 50, withLines: true }, 5)), heroHp: null }, content);
  assert.equal(a.viewReplay(serializeReplay(f)).ok, true); assert.equal(a.lastBattle.replay.kind, 'floor');
});

test('replay viewer: a changed file is not verified but still plays; a file from other content says so', () => {
  const a = make(), doc = JSON.parse(serializeReplay(delveReplay()));
  const hit = doc.events.find((e) => e[0] === 4); hit[3] += 1; // one damage number changed after the hash was made
  const r = a.viewReplay(JSON.stringify(doc)); assert.equal(r.ok, true); assert.equal(r.verdict.ok, false); assert.match(r.verdict.reasons.join(' | '), /hash mismatch/);
  const raw = structuredClone(content.raw); raw.tables.legend.rewardMul = 7; const other = indexContent(raw);
  const r2 = a.viewReplay(serializeReplay(delveReplay(other))); assert.equal(r2.ok, true); assert.equal(r2.verdict.resimulated, false); assert.match(r2.verdict.reasons.join(' | '), /content mismatch/);
});

test('replay viewer: damaged or foreign files are refused with the reason and leave the previous battle alone', () => {
  const a = make(), good = JSON.parse(serializeReplay(delveReplay())); a.viewReplay(JSON.stringify(good)); const shown = a.lastBattle.replay.hash;
  const refused = (mut, re) => { const d = structuredClone(good); mut(d); const r = a.viewReplay(typeof d === 'string' ? d : JSON.stringify(d)); assert.equal(r.ok, false, re.source); assert.match(r.errors[0].message, re); assert.equal(a.lastBattle.replay.hash, shown); };
  assert.equal(a.viewReplay('not json').ok, false); assert.match(a.viewReplay('not json').errors[0].message, /not valid JSON/);
  refused((d) => { d.format = 'other'; }, /format is "other"/); refused((d) => { d.v = 2; }, /version 2 is not supported/); refused((d) => { delete d.events; }, /missing key "events"/);
  refused((d) => { d.kind = 'duel'; }, /a delve or a floor/); refused((d) => { d.inputs.realm = 'vanaheim'; }, /realm this build does not have/);
  refused((d) => { d.inputs.party[0].class = 'jester'; }, /hero class "jester"/); refused((d) => { d.inputs.party = []; }, /1 to 4 heroes/);
  refused((d) => { d.plan[0][0].id = 'dragon'; }, /monster "dragon"/); refused((d) => { d.events.push([99]); }, /cannot be played: unknown event opcode 99/);
  refused((d) => { d.events[3] = 'x'; }, /not lists of events/); refused((d) => { d.plan = 'x'; }, /not lists of events/); refused((d) => { d.plan[0] = 7; }, /not lists of events/); refused((d) => { d.events = d.events.slice(0, 5).concat([[4, 1, 99, 5, 0, 0]]); }, /cannot be played/);
});
