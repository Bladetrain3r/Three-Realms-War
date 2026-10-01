import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { scenarioFor } from '../helpers/scenario.mjs';
import { createReplay, serializeReplay } from '../../sim/replay.js';

const N = 1000;
const bytes = (seed) => serializeReplay(createReplay(scenarioFor(seed), content));

test('determinism: 1,000 seeds give byte-identical replays on a second run, and in reverse order', () => {
  const first = new Array(N), outcomes = [0, 0];
  for (let s = 1; s <= N; s++) {
    first[s - 1] = bytes(s);
    outcomes[JSON.parse(first[s - 1]).result.outcome]++;
  }
  for (let s = N; s >= 1; s--) assert.equal(bytes(s), first[s - 1], `seed ${s} changed when run again in reverse order`);
  // The sample is not trivial: wins and losses both occur, and no two replays are the same.
  assert.ok(outcomes[0] > 100 && outcomes[1] > 100, `outcomes ${outcomes}`);
  assert.equal(new Set(first).size, N);
});

test('determinism: unrelated work between runs does not change the result (no hidden global state)', () => {
  const a = bytes(31337);
  for (let s = 1; s <= 25; s++) bytes(s);
  assert.equal(bytes(31337), a);
});

test('determinism: replay bytes do not depend on the key order of the inputs', () => {
  const inp = scenarioFor(77);
  const shuffled = { setAllowed: inp.setAllowed, party: inp.party.map((u) => Object.fromEntries(Object.entries(u).reverse())), seed: inp.seed, level: inp.level, realm: inp.realm };
  assert.equal(serializeReplay(createReplay(shuffled, content)), serializeReplay(createReplay(inp, content)));
});
