import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { buildHeroUnit, newGame, playDelve, applyDelveResult, validateSave, verifyReplay, canonical, deriveSeed, GameError, itemsById, stashCount, mulbp, xpToNext } from '../../sim/index.js';

const fresh = () => newGame(content, 424242, { savedAt: '', build: 't' });
const valid = (s) => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors, []); return s; };
const refuses = (f, code, re) => assert.throws(f, (e) => e instanceof GameError && e.code === code && (!re || re.test(e.message)), `expected ${code}`);
const strong = () => { const s = fresh(); for (const h of s.heroes) h.level = 50; return s; };   // wins level-1 delves
const weak = () => fresh();                                                                     // loses a high-level delve
const withLevels = (s, realm, level) => { s.unlocked[realm] = level; return s; };

test('delve: a win pays xp, hacksilver, materials, reputation, items, and uses exactly one seed step', () => {
  const s0 = strong(), r = playDelve(s0, content, { realm: 'midgard', level: 1 }), s = valid(r.save);
  assert.equal(r.summary.outcome, 1);
  assert.equal(r.replay.seed, deriveSeed(s0.rng.masterSeed, s0.rng.counter));
  assert.equal(s.rng.counter, s0.rng.counter + 1);
  assert.equal(s.currency.hacksilver, r.summary.hacksilver);
  assert.ok(r.summary.hacksilver > 0 && r.summary.xp > 0);
  assert.equal(s.materials.forge_iron, r.replay.result.rewards.materials.forge_iron);
  assert.equal(s.materials.ember_heart, 1);
  assert.equal(s.reputation.midgard, 10);
  assert.equal(s.items.length, s0.items.length + r.summary.items.length);
  assert.ok(r.summary.items.every((id) => itemsById(s)[id].ilvl === 1 && itemsById(s)[id].id >= s0.nextId));
  assert.equal(s.unlocked.midgard, 2);
  assert.deepEqual(r.summary.unlocked, { realm: 'midgard', level: 2 });
  assert.equal(verifyReplay(r.replay, content).ok, true);
});

test('delve: the same save and request give the identical replay and save', () => {
  const a = playDelve(strong(), content, { realm: 'asgard', level: 1 }), b = playDelve(strong(), content, { realm: 'asgard', level: 1 });
  assert.equal(a.replay.hash, b.replay.hash);
  assert.equal(canonical(a.save), canonical(b.save));
});

test('delve: a loss pays nothing, injures the heroes who went down, and does not unlock', () => {
  const s0 = withLevels(weak(), 'helheim', 30), r = playDelve(s0, content, { realm: 'helheim', level: 30 }), s = valid(r.save);
  assert.equal(r.summary.outcome, 0);
  assert.deepEqual([s.currency.hacksilver, s.reputation.helheim, s.unlocked.helheim, s.items.length, s.threads], [0, 0, 30, s0.items.length, 0]);
  assert.deepEqual(s.heroes.map((h) => h.xp), s0.heroes.map((h) => h.xp));
  assert.equal(s.heroes.filter((h) => h.injury === 2).length, r.replay.result.injured.length);
  assert.ok(r.replay.result.injured.length > 0);
  assert.equal(r.summary.injured.length, r.replay.result.injured.length);
});

test('delve: refusals: locked level, unknown realm, injured hero not forced, forcing someone outside the party', () => {
  const s = strong();
  refuses(() => playDelve(s, content, { realm: 'midgard', level: 2 }), 'level_locked', /open up to level 1/);
  refuses(() => playDelve(s, content, { realm: 'midgard', level: 0 }), 'level_locked');
  refuses(() => playDelve(s, content, { realm: 'vanaheim', level: 1 }), 'unknown_realm');
  const hurt = structuredClone(s); hurt.heroes[0].injury = 2;
  refuses(() => playDelve(hurt, content, { realm: 'midgard', level: 1 }), 'injured_not_forced', /injured for 2 more delves/);
  refuses(() => playDelve(hurt, content, { realm: 'midgard', level: 1, force: [999] }), 'force_not_in_party');
  const out = structuredClone(hurt); out.party = out.party.slice(1);
  refuses(() => playDelve(out, content, { realm: 'midgard', level: 1, force: [out.heroes[0].id] }), 'force_not_in_party');
});

test('delve: injury bookkeeping: benched hurt heroes heal by one per delve; a forced hero fights at half stats and keeps their counter', () => {
  const s0 = strong(); s0.heroes[1].level = 3; s0.heroes[0].injury = 2; s0.heroes[1].injury = 1; s0.party = [s0.heroes[0].id, s0.heroes[2].id, s0.heroes[3].id];
  const r = playDelve(s0, content, { realm: 'midgard', level: 1, force: [s0.heroes[0].id] }), s = valid(r.save);
  assert.equal(r.replay.inputs.party[0].injured, true);
  assert.equal(r.replay.inputs.party[1].injured, false);
  const unforced = buildHeroUnit(s0.heroes[0], itemsById(s0), content);
  assert.ok(Math.abs(r.replay.inputs.party[0].maxHp - 5 * mulbp(unforced.maxHp / 5, 5000)) <= 5 && r.replay.inputs.party[0].maxHp < unforced.maxHp, `forced ${r.replay.inputs.party[0].maxHp} vs unforced ${unforced.maxHp}`);
  assert.equal(s.heroes[0].injury, 2, 'the forced hero\'s counter does not drop');
  assert.equal(s.heroes[1].injury, 0, 'the benched hero\'s counter dropped from 1 to 0');
  assert.deepEqual(r.summary.healed, [s0.heroes[1].id]);
  assert.equal(s.heroes[1].xp, s0.heroes[1].xp, 'a hurt benched hero earns no rest xp, even on the delve that cures them');
});

test('delve: rest xp: healthy benched heroes get half of the delve xp; participants get all of it; levels rise and carry xp over', () => {
  const s0 = fresh(); for (const h of s0.heroes) h.level = 50;
  s0.heroes.push({ ...structuredClone(s0.heroes[0]), id: s0.nextId++, name: 'Bench', level: 3, xp: 10, slots: { weapon: null, armour: null, helm: null, charm: null } });
  valid(s0);
  const r = playDelve(s0, content, { realm: 'midgard', level: 1 }), s = valid(r.save), bench = s.heroes.at(-1), xp = r.summary.xp;
  const half = mulbp(xp, 5000);
  let level = 3, left = 10 + half;
  while (left >= xpToNext(level, content.tables.progress)) { left -= xpToNext(level, content.tables.progress); level++; }
  assert.deepEqual([bench.level, bench.xp], [level, left]);
  assert.equal(r.summary.levelUps.some((u) => u.heroId === bench.id), level > 3);
  assert.ok(s.heroes.slice(0, 4).every((h) => h.level === 50 && h.xp === 0), 'at the level cap, xp stays 0');
});

test('delve: unlocking: only a win at the highest unlocked level opens the next, and never beyond 50', () => {
  let s = strong(); s.unlocked.midgard = 3;
  assert.equal(playDelve(s, content, { realm: 'midgard', level: 1 }).save.unlocked.midgard, 3);
  s.unlocked.asgard = 50;
  assert.equal(playDelve(withLevels(strong(), 'asgard', 1), content, { realm: 'asgard', level: 1 }).save.unlocked.asgard, 2);
});

test('delve: a full stash loses extra drops and says how many', () => {
  const s0 = strong();
  while (stashCount(s0) < 100) s0.items.push({ ...structuredClone(s0.items[0]), id: s0.nextId++ , slot: 'charm', kind: null });
  valid(s0);
  const r = playDelve(s0, content, { realm: 'midgard', level: 1 }), s = valid(r.save);
  assert.equal(stashCount(s), 100);
  assert.equal(r.summary.items.length, 0);
  assert.equal(r.summary.droppedItems, r.replay.result.rewards.items.length);
  assert.ok(r.summary.droppedItems >= 1);
});

test('delve: Thread drops go to the count; reputation at Trusted turns on set tags in the drops', () => {
  let threads = 0, tagged = 0, taggedWhenLocked = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const a = strong(); a.rng.masterSeed = seed; const r = playDelve(a, content, { realm: 'asgard', level: 1 });
    threads += r.summary.threads; assert.equal(r.save.threads, r.summary.threads);
    taggedWhenLocked += r.replay.result.rewards.items.filter((i) => i.set).length;
    const b = strong(); b.rng.masterSeed = seed; b.reputation.asgard = 150; const q = playDelve(b, content, { realm: 'asgard', level: 1 });
    tagged += q.replay.result.rewards.items.filter((i) => i.set).length;
  }
  assert.equal(taggedWhenLocked, 0);
  assert.ok(tagged > 0, 'set-tagged drops appear once the realm trusts you');
  assert.ok(threads > 0 && threads < 20, `threads ${threads} of 150 delves (3% expected)`);
});

test('delve: applyDelveResult is the only place a replay changes a save, and it needs the party ids', () => {
  const s0 = strong(), r = playDelve(s0, content, { realm: 'midgard', level: 1 });
  const again = structuredClone(s0); again.rng.counter++;
  const sum = applyDelveResult(again, content, r.replay, s0.party);
  assert.equal(canonical(again), canonical(r.save));
  assert.equal(canonical(sum), canonical(r.summary));
});
