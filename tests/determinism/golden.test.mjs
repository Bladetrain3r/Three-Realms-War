import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { content } from '../helpers/content.mjs';
import { standardInput } from '../helpers/scenario.mjs';
import { createReplay, contentHashOf } from '../../sim/replay.js';

const golden = JSON.parse(readFileSync(repoPath('tests', 'golden', 'replay-hashes.json'), 'utf8'));
const HOW = 'If this change is intended, regenerate with `node tests/golden/make-golden.mjs > tests/golden/replay-hashes.json` and log why in LOG.md.';

test('golden: the content bundle hash is the committed one', () => {
  assert.equal(contentHashOf(content), golden.contentHash, HOW);
});

test('golden: 30 fixed inputs reproduce the committed replay hashes (the cross-machine promise)', () => {
  assert.equal(golden.replays.length, 30);
  for (const g of golden.replays) {
    const r = createReplay(standardInput(g.seed), content);
    assert.equal(r.hash, g.hash, `seed ${g.seed}. ${HOW}`);
    assert.equal(r.events.length, g.events);
    assert.equal(r.result.outcome, g.outcome);
  }
  assert.ok(golden.replays.some((g) => g.outcome === 1) && golden.replays.some((g) => g.outcome === 0));
});
