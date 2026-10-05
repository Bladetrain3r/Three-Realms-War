import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { scenarioFor } from '../helpers/scenario.mjs';
import { createReplay, serializeReplay } from '../../sim/replay.js';

// Replace every source of nondeterminism with something that throws, run fn, then restore. Synchronous on purpose.
function withTraps(fn) {
  const saved = { random: Math.random, DateRef: globalThis.Date, perfNow: globalThis.performance.now };
  const boom = (what) => () => { throw new Error(`sim touched ${what}`); };
  Math.random = boom('Math.random');
  globalThis.Date = new Proxy(saved.DateRef, { construct: boom('new Date'), apply: boom('Date()'), get: (t, k) => (k === 'now' ? boom('Date.now') : Reflect.get(t, k)) });
  globalThis.performance.now = boom('performance.now');
  try { return fn(); } finally {
    Math.random = saved.random; globalThis.Date = saved.DateRef; globalThis.performance.now = saved.perfNow;
  }
}

test('traps: the traps themselves fire (otherwise the next test proves nothing)', () => {
  withTraps(() => {
    assert.throws(() => Math.random(), /Math\.random/);
    assert.throws(() => Date.now(), /Date\.now/);
    assert.throws(() => new Date(), /new Date/);
    assert.throws(() => performance.now(), /performance\.now/);
  });
  assert.equal(typeof Math.random(), 'number'); // restored
  assert.equal(typeof Date.now(), 'number');
});

test('traps: 120 full delves run unchanged with Math.random, Date and performance.now trapped', () => {
  const inputs = Array.from({ length: 120 }, (_, i) => scenarioFor(500 + i));
  const plain = inputs.map((inp) => serializeReplay(createReplay(inp, content)));
  const trapped = withTraps(() => inputs.map((inp) => serializeReplay(createReplay(inp, content))));
  assert.deepEqual(trapped, plain);
});

test('traps: a sim that did read Math.random would fail loudly (the trap throws through createReplay)', () => {
  const inp = scenarioFor(9);
  assert.throws(() => withTraps(() => { Math.random(); return createReplay(inp, content); }), /Math\.random/);
});
