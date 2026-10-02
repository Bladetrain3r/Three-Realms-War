import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { scenarioFor, standardInput } from '../helpers/scenario.mjs';
import { createReplay, serializeReplay, readReplay, verifyReplay, ReplayFormatError } from '../../sim/replay.js';
import { resolveDelve } from '../../sim/delve.js';
import { hashOf } from '../../sim/canon.js';

const doc = () => createReplay(standardInput(2), content);

test('replay: carries its format, inputs, tables, plan, events, result and a hash', () => {
  const r = doc();
  assert.equal(r.format, 'three-realms-replay');
  assert.equal(r.v, 1);
  assert.equal(r.kind, 'delve');
  assert.equal(r.seed, 2);
  assert.deepEqual(r.tables.statuses, ['burn', 'chill', 'shock', 'mark', 'bulwark', 'fury', 'mend']);
  assert.ok(r.tables.skills.length > 0 && r.events.length > 50 && r.plan.length === r.result.encounters);
  assert.match(r.hash, /^[0-9a-f]{64}$/);
  const { hash, ...rest } = r;
  assert.equal(hash, hashOf(rest));
});

test('replay: round trip: serialize, read back, verify, and the re-simulated final state is the same', () => {
  for (const seed of [1, 2, 3, 12, 25]) {
    const original = createReplay(standardInput(seed), content);
    const text = serializeReplay(original);
    const back = readReplay(text);
    assert.deepEqual(back, original);
    assert.equal(serializeReplay(back), text);
    assert.deepEqual(verifyReplay(back, content), { ok: true, resimulated: true, reasons: [] });
    const again = resolveDelve({ ...back.inputs, seed: back.seed }, content);
    assert.deepEqual(again.result, back.result);
    assert.deepEqual(again.events, back.events);
  }
});

test('replay: round trips for 100 random scenarios', () => {
  for (let s = 1; s <= 100; s++) {
    const text = serializeReplay(createReplay(scenarioFor(s), content));
    assert.equal(verifyReplay(readReplay(text), content).ok, true, `scenario ${s}`);
  }
});

test('replay: a change made after writing is detected by the hash', () => {
  const r = doc(); r.events[10] = [...r.events[10]]; r.events[10][1] += 1;
  const v = verifyReplay(readReplay(JSON.stringify(r)), content);
  assert.equal(v.ok, false);
  assert.match(v.reasons[0], /hash mismatch/);
});

test('replay: a change that also fixes up the hash is caught by re-simulation, and the reason says where', () => {
  const r = doc(); r.events[20] = [...r.events[20]]; r.events[20][1] += 1;
  const { hash, ...rest } = r; r.hash = hashOf(rest);
  const v = verifyReplay(r, content);
  assert.equal(v.ok, false);
  assert.ok(v.reasons.some((x) => /events differ from a fresh simulation at index 20/.test(x)), v.reasons.join('; '));
});

test('replay: a forged result or seed or input is caught the same way', () => {
  const forge = (mut) => { const r = doc(); mut(r); const { hash, ...rest } = r; r.hash = hashOf(rest); return verifyReplay(r, content); };
  assert.equal(forge((r) => { r.result.outcome = 1 - r.result.outcome; }).ok, false);
  assert.equal(forge((r) => { r.seed += 1; }).ok, false);
  assert.equal(forge((r) => { r.inputs.level += 1; }).ok, false);
  assert.equal(forge((r) => { r.inputs.party[0].stats.MIT.base += 1; }).ok, false);
});

test('replay: content from a different build is reported, not silently re-simulated', () => {
  const r = doc(), other = JSON.parse(JSON.stringify(content.raw));
  other.tables.enemy.curveK = 23;
  const v = verifyReplay(r, { ...content, raw: other });
  assert.equal(v.ok, false);
  assert.equal(v.resimulated, false);
  assert.ok(v.reasons.some((x) => /content mismatch/.test(x)));
});

test('replay: readReplay refuses the wrong format, version, shape and missing keys, naming why', () => {
  const r = doc();
  assert.throws(() => readReplay('{nope'), ReplayFormatError);
  assert.throws(() => readReplay('[]'), /JSON object/);
  assert.throws(() => readReplay(JSON.stringify({ ...r, format: 'something-else' })), /format is "something-else"/);
  assert.throws(() => readReplay(JSON.stringify({ ...r, v: 2 })), /version 2/);
  const { events, ...noEvents } = r;
  assert.throws(() => readReplay(JSON.stringify(noEvents)), /missing key "events"/);
});

test('replay: canonical serialization refuses a non-integer instead of writing a lossy replay', () => {
  const r = doc(); r.events[0] = [0, 0.5, 3];
  assert.throws(() => serializeReplay(r), TypeError);
});

test('replay: a rewards item is inside the hash (changing a drop changes the replay hash)', () => {
  const a = createReplay(standardInput(1), content), b = createReplay({ ...standardInput(1), setAllowed: !standardInput(1).setAllowed }, content);
  assert.notEqual(a.hash, b.hash);
});
