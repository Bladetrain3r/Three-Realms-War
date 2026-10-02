import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { engineCheck, ENGINE_CHECK } from '../../client/engine-check.js';

test('engine check: the fixed delve still produces the hash recorded in client/engine-check.js', () => {
  const r = engineCheck(content);
  assert.equal(r.actual, ENGINE_CHECK.expectedHash, `If the content or the sim changed on purpose, set expectedHash in client/engine-check.js to ${r.actual} and log why in LOG.md.`);
  assert.equal(r.ok, true);
  assert.equal(r.outcome, 1);
});

test('engine check: a wrong expected value is reported as a failure, not hidden', () => {
  assert.equal(engineCheck(content, 'deadbeef').ok, false);
});
