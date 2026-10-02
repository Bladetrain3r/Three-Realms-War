import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema, item } from '../helpers/content.mjs';
import { newGame, recruit, dismiss, equip, setParty, setRunbook, assignThread, unassignThread, buyThread, itemsById, stashCount, topLevel, GameError, validateSave, canonical, hashOf, deriveSeed } from '../../sim/index.js';

const meta = { savedAt: '2026-10-02T09:00:00Z', build: 'test' };
const fresh = (seed = 12345) => newGame(content, seed, meta);
const valid = (s) => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors, []); return s; };
const refuses = (f, code, re) => assert.throws(f, (e) => e instanceof GameError && e.code === code && (!re || re.test(e.message)), `expected GameError ${code}`);
const rich = (s) => { const n = structuredClone(s); n.currency.hacksilver = 100000; return n; };

test('game: a new game has the four starting heroes, a full Plain kit each, and is a valid save', () => {
  const s = valid(fresh());
  assert.deepEqual(s.heroes.map((h) => h.class), content.tables.recruit.startingRoster);
  assert.deepEqual(s.party, s.heroes.map((h) => h.id));
  assert.equal(s.items.length, 16);
  const by = itemsById(s);
  for (const h of s.heroes) for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
    const it = by[h.slots[slot]];
    assert.deepEqual([it.slot, it.tier, it.ilvl, it.star, it.realm], [slot, 'plain', 1, 0, content.heroById[h.class].realm]);
    assert.equal(slot === 'weapon' ? it.kind : null, content.heroById[h.class].attack === 'magic' && slot === 'weapon' ? 'ARC' : slot === 'weapon' ? 'MIT' : null);
  }
  assert.deepEqual([s.currency.hacksilver, s.threads, s.rng.counter, s.expedition], [0, 0, 4, null]);
  assert.deepEqual(s.unlocked, { midgard: 1, asgard: 1, helheim: 1 });
  assert.equal(stashCount(s), 0);
});

test('game: new heroes take names from their realm\'s list without repeats, and the starter runbook (a copy, not a shared object)', () => {
  const s = fresh();
  assert.equal(new Set(s.heroes.map((h) => h.name)).size, 4);
  for (const h of s.heroes) { assert.ok(content.names[content.heroById[h.class].realm].includes(h.name)); assert.deepEqual(h.runbook, content.starterRunbooks[h.class]); assert.notEqual(h.runbook, content.starterRunbooks[h.class]); }
});

test('game: a new game is a pure function of its seed', () => {
  assert.equal(canonical(fresh(7)), canonical(fresh(7)));
  assert.notEqual(canonical(fresh(7)), canonical(fresh(8)));
  refuses(() => newGame(content, -1), 'bad_seed');
  refuses(() => newGame(content, 1.5), 'bad_seed');
  refuses(() => newGame(content, 2 ** 32), 'bad_seed');
});

test('game: recruit costs hacksilver, arrives at 3/4 of the top level with a free Plain kit, and uses a seed step', () => {
  const s0 = rich(fresh());
  s0.heroes[0].level = 20;
  const s = valid(recruit(s0, content, 'hunter'));
  const h = s.heroes.at(-1);
  assert.deepEqual([h.class, h.level, h.xp, h.injury], ['hunter', 15, 0, 0]);
  assert.equal(s.currency.hacksilver, 100000 - (100 + 20 * 15));
  assert.equal(s.rng.counter, s0.rng.counter + 1);
  assert.equal(s.items.length, s0.items.length + 4);
  assert.ok(Object.values(h.slots).every((id) => itemsById(s)[id].ilvl === 15));
  assert.equal(topLevel(s), 20);
});

test('game: recruit refusals: cost, rare reputation, roster size, unknown class; and the rare price is triple', () => {
  const s = fresh();
  refuses(() => recruit(s, content, 'hunter'), 'cannot_afford', /costs 120 hacksilver/);
  refuses(() => recruit(rich(s), content, 'berserker'), 'rare_locked', /50 reputation in Midgard/);
  refuses(() => recruit(rich(s), content, 'dragon'), 'unknown_class');
  const known = rich(s); known.reputation.midgard = 50;
  assert.equal(known.currency.hacksilver - recruit(known, content, 'berserker').currency.hacksilver, 360);
  let full = rich(s);
  for (let i = 0; i < 20; i++) full = recruit(full, content, 'huscarl');
  assert.equal(full.heroes.length, 24);
  refuses(() => recruit(full, content, 'huscarl'), 'roster_full');
  valid(full);
});

test('game: dismiss returns gear to the stash, closes the party, returns a Thread, and never the last hero', () => {
  const s0 = fresh(); s0.heroes[1].thread = true;
  const s = valid(dismiss(s0, content, s0.heroes[1].id));
  assert.equal(s.heroes.length, 3);
  assert.deepEqual(s.party, [s0.party[0], s0.party[2], s0.party[3]]);
  assert.equal(s.threads, 1);
  assert.equal(stashCount(s), 4);
  let one = s;
  while (one.heroes.length > 1) one = dismiss(one, content, one.heroes[0].id);
  valid(one);
  refuses(() => dismiss(one, content, one.heroes[0].id), 'last_hero');
  refuses(() => dismiss(s, content, 9999), 'no_such_hero');
});

test('game: equip checks the slot, the level slack (hero level + 5), moves an item between heroes, and null unequips', () => {
  const s0 = fresh();
  s0.items.push(item({ id: s0.nextId++, slot: 'armour', ilvl: 6, realm: 'midgard' }), item({ id: s0.nextId++, slot: 'armour', ilvl: 7, realm: 'midgard' }), item({ id: s0.nextId++, slot: 'helm', ilvl: 1 }));
  const [ok6, too7, helm] = s0.items.slice(-3).map((i) => i.id), a = s0.heroes[0].id, b = s0.heroes[1].id;
  const s1 = valid(equip(s0, content, a, 'armour', ok6));
  assert.equal(s1.heroes[0].slots.armour, ok6);
  refuses(() => equip(s0, content, a, 'armour', too7), 'level_slack', /up to level 6; this is level 7/);
  refuses(() => equip(s0, content, a, 'armour', helm), 'bad_slot');
  refuses(() => equip(s0, content, a, 'cloak', ok6), 'bad_slot');
  const s2 = valid(equip(s1, content, b, 'armour', ok6));
  assert.deepEqual([s2.heroes[0].slots.armour, s2.heroes[1].slots.armour], [null, ok6]);
  assert.equal(valid(equip(s2, content, b, 'armour', null)).heroes[1].slots.armour, null);
  refuses(() => equip(s0, content, a, 'armour', 9999), 'no_such_item');
});

test('game: setParty needs one to four distinct existing heroes, in order', () => {
  const s = fresh(), ids = s.heroes.map((h) => h.id);
  assert.deepEqual(valid(setParty(s, content, [ids[3], ids[0]])).party, [ids[3], ids[0]]);
  refuses(() => setParty(s, content, []), 'party_size');
  refuses(() => setParty(s, content, [1, 2, 3, 4, 5]), 'party_size');
  refuses(() => setParty(s, content, [ids[0], ids[0]]), 'party_dup');
  refuses(() => setParty(s, content, [ids[0], 9999]), 'no_such_hero');
});

test('game: setRunbook stores a valid runbook (object or text) and refuses an invalid one with the validator\'s code', () => {
  const s = fresh(), h = s.heroes[0], good = { v: 1, rules: [{ when: [{ c: 'always' }], do: { a: 'brace' }, target: null }] };
  assert.deepEqual(valid(setRunbook(s, content, h.id, good)).heroes[0].runbook, good);
  assert.deepEqual(valid(setRunbook(s, content, h.id, JSON.stringify(good))).heroes[0].runbook, good);
  const bad = { v: 1, rules: [{ when: [{ c: 'self_hp_below', pct: 55 }], do: { a: 'basic' }, target: 'lowest_hp' }] };
  assert.throws(() => setRunbook(s, content, h.id, bad), (e) => e.code === 'runbook_invalid' && /rule 1/.test(e.message) && e.details[0].code === 'E05');
  assert.throws(() => setRunbook(s, content, h.id, '{nope'), (e) => e.code === 'runbook_invalid' && e.details[0].code === 'E01');
  assert.deepEqual(s.heroes[0].runbook, content.starterRunbooks.shieldwarden, 'the original save is untouched');
});

test('game: a set skill is a legal runbook action only while four set pieces are worn', () => {
  const s0 = fresh(), h = s0.heroes[0], rb = { v: 1, rules: [{ when: [{ c: 'always' }], do: { a: 'skill', skill: 'hearthfire_surge' }, target: null }] };
  assert.throws(() => setRunbook(s0, content, h.id, rb), (e) => e.details[0].code === 'E07');
  for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
    const it = s0.items.find((i) => i.id === h.slots[slot]);
    Object.assign(it, { tier: 'runed', set: 'hearthforged', realm: 'midgard', lines: [[0, 500], [1, 500]] });
  }
  valid(s0);
  assert.deepEqual(valid(setRunbook(s0, content, h.id, rb)).heroes[0].runbook, rb);
});

test('game: Threads: assign, unassign, and buy at Honoured for 5 hearts', () => {
  const s = fresh(), h = s.heroes[0].id;
  refuses(() => assignThread(s, content, h), 'thread_none');
  refuses(() => buyThread(s, content, 'midgard'), 'rep_locked', /400 reputation/);
  const r = fresh(); r.reputation.midgard = 400;
  refuses(() => buyThread(r, content, 'midgard'), 'cannot_afford', /5 hearts/);
  r.materials.ember_heart = 7;
  const b = valid(buyThread(r, content, 'midgard'));
  assert.deepEqual([b.threads, b.materials.ember_heart], [1, 2]);
  const a = valid(assignThread(b, content, h));
  assert.deepEqual([a.threads, a.heroes[0].thread], [0, true]);
  refuses(() => assignThread(a, content, h), 'thread_has');
  assert.deepEqual([valid(unassignThread(a, content, h)).threads], [1]);
  refuses(() => unassignThread(b, content, h), 'thread_none');
  refuses(() => buyThread(r, content, 'vanaheim'), 'unknown_realm');
});

test('game: actions never change the save they are given', () => {
  const s = fresh(), before = canonical(s);
  recruit(rich(s), content, 'hunter'); equip(s, content, s.heroes[0].id, 'weapon', null); setParty(s, content, [s.heroes[0].id]); dismiss(s, content, s.heroes[0].id);
  assert.equal(canonical(s), before);
});

test('game: moving items into a full stash is refused (unequip, a swap that adds one, dismiss), but a swap that does not grow it is fine', () => {
  const s = fresh();
  while (stashCount(s) < 100) s.items.push(item({ id: s.nextId++, slot: 'charm', ilvl: 1 }));
  valid(s);
  refuses(() => equip(s, content, s.heroes[0].id, 'weapon', null), 'stash_full', /holds at most 100/);
  refuses(() => dismiss(s, content, s.heroes[0].id), 'stash_full');
  const spare = s.items.at(-1);                                                    // a charm nobody wears
  const swapped = valid(equip(s, content, s.heroes[0].id, 'charm', spare.id));   // one in, one out: the stash stays at 100
  assert.equal(stashCount(swapped), 100);
});
