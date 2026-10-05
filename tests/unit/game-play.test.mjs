import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { content, saveSchema } from '../helpers/content.mjs';
import { play } from '../helpers/bot.mjs';
import { newGame, validateSave, canonical, hashOf, itemsById } from '../../sim/index.js';

const golden = JSON.parse(readFileSync(repoPath('tests', 'golden', 'playthrough.json'), 'utf8'));
const start = (seed) => newGame(content, seed, { savedAt: '', build: 'test' });

test('play: three seeded random players, 400 actions each, keep every save invariant after every action', () => {
  const kinds = {};
  for (const seed of [11, 22, 33]) {
    const { save, log } = play(start(seed * 1000), 400, seed);   // play() throws on the first invalid save
    for (const k of Object.keys(log.ok)) kinds[k] = (kinds[k] || 0) + log.ok[k];
    assert.ok(log.wins + log.losses > 40, `seed ${seed}: only ${log.wins + log.losses} delves`);
    assert.deepEqual(validateSave(save, content, saveSchema).errors, []);
  }
  for (const k of ['delve', 'recruit', 'equip', 'upgrade', 'salvage', 'party', 'runbook']) assert.ok(kinds[k] > 0, `no successful ${k} in 1,200 actions`);
});

test('play: random play both wins and loses delves, injures and heals, levels up and unlocks', () => {
  const { save, log } = play(start(777), 500, 9);
  assert.ok(log.wins > 5 && log.losses > 5, `${log.wins} wins, ${log.losses} losses`);
  assert.ok(Math.max(...save.heroes.map((h) => h.level)) > 1);
  assert.ok(save.unlocked.midgard + save.unlocked.asgard + save.unlocked.helheim > 3);
});

test('play: the same seeds give the same final save (a whole game is a pure function of its seeds)', () => {
  assert.equal(canonical(play(start(5), 150, 6).save), canonical(play(start(5), 150, 6).save));
  assert.notEqual(canonical(play(start(5), 150, 6).save), canonical(play(start(5), 150, 7).save));
});

test('play: golden: the 300-action playthrough ends in the committed save (cross-machine promise for whole games)', () => {
  const { save, log } = play(newGame(content, golden.masterSeed, { savedAt: '', build: 'golden' }), golden.steps, golden.botSeed, { check: false });
  const HOW = 'If intended, regenerate with `node tests/golden/make-playthrough.mjs > tests/golden/playthrough.json` and log why in LOG.md.';
  assert.equal(hashOf(save), golden.finalSaveHash, HOW);
  assert.deepEqual([save.rng.counter, save.heroes.length, save.items.length, log.wins, log.losses], [golden.counter, golden.heroes, golden.items, golden.wins, golden.losses], HOW);
});

test('play: item ids stay unique and below nextId through long play; no item is ever worn twice', () => {
  const { save } = play(start(31337), 400, 4);
  const ids = save.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id < save.nextId));
  const worn = save.heroes.flatMap((h) => Object.values(h.slots)).filter((x) => x !== null);
  assert.equal(new Set(worn).size, worn.length);
  assert.ok(worn.every((id) => itemsById(save)[id]));
});
