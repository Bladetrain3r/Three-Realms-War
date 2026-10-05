import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgainst, pathKey } from '../../sim/schema.js';

const errs = (value, schema) => validateAgainst(value, schema);
const keys = (value, schema) => errs(value, schema).map((e) => e.key);

test('schema: type, with integer a subset of number, and arrays of types', () => {
  assert.deepEqual(errs(3, { type: 'integer' }), []);
  assert.equal(errs(3.5, { type: 'integer' }).length, 1);
  assert.deepEqual(errs(3.5, { type: 'number' }), []);
  assert.deepEqual(errs(null, { type: ['string', 'null'] }), []);
  assert.match(errs(7, { type: ['string', 'null'] })[0].message, /expected string or null, got integer/);
  assert.match(errs([], { type: 'object' })[0].message, /got array/);
  assert.match(errs(null, { type: 'object' })[0].message, /got null/);
});

test('schema: enum, const, minimum, maximum, pattern, minLength', () => {
  assert.match(errs('epic', { enum: ['plain', 'fine'] })[0].message, /must be one of plain, fine \(got "epic"\)/);
  assert.match(errs(2, { const: 1 })[0].message, /must be 1/);
  assert.match(errs(0, { type: 'integer', minimum: 1 })[0].message, /at least 1 \(got 0\)/);
  assert.match(errs(9, { type: 'integer', maximum: 5 })[0].message, /at most 5 \(got 9\)/);
  assert.equal(errs('Bad Id', { type: 'string', pattern: '^[a-z_]+$' }).length, 1);
  assert.equal(errs('', { type: 'string', minLength: 1 }).length, 1);
  assert.deepEqual(errs('ok_id', { type: 'string', pattern: '^[a-z_]+$' }), []);
});

test('schema: arrays: items, minItems, maxItems, uniqueItems with the clashing index', () => {
  const s = { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 3, uniqueItems: true };
  assert.deepEqual(errs([1, 2], s), []);
  assert.match(errs([1], s)[0].message, /at least 2 items/);
  assert.match(errs([1, 2, 3, 4], s)[0].message, /at most 3 items/);
  assert.deepEqual(errs([1, 2, 1], s).map((e) => [e.key, e.message]), [['[2]', 'duplicates item [0]']]);
  assert.deepEqual(keys([1, 'x'], s), ['[1]']);
});

test('schema: objects: required, unknown keys (with a did-you-mean), nested paths', () => {
  const s = { type: 'object', additionalProperties: false, required: ['stats', 'id'], properties: { id: { type: 'string' }, stats: { type: 'object', additionalProperties: false, required: ['VIG'], properties: { VIG: { type: 'integer' } } } } };
  assert.deepEqual(errs({ id: 'a', stats: { VIG: 3 } }, s), []);
  assert.deepEqual(errs({ id: 'a', stat: { VIG: 3 } }, s).map((e) => [e.key, e.message]), [
    ['stats', 'missing required key "stats"'],
    ['stat', 'unknown key "stat" (did you mean "stats"?)'],
  ]);
  assert.deepEqual(keys({ id: 'a', stats: { VIG: 'x' } }, s), ['stats.VIG']);
  assert.deepEqual(keys([{ id: 'a', stats: {} }], { type: 'array', items: s }), ['[0].stats.VIG']);
});

test('schema: additionalProperties as a schema validates the free-keyed values', () => {
  const s = { type: 'object', additionalProperties: { type: 'integer' } };
  assert.deepEqual(errs({ a: 1, b: 2 }, s), []);
  assert.deepEqual(keys({ a: 1, b: 'x' }, s), ['b']);
});

test('schema: $ref to a local definition; a dangling $ref is a schema bug and throws', () => {
  const s = { $defs: { id: { type: 'string', pattern: '^[a-z]+$' } }, type: 'array', items: { $ref: '#/$defs/id' } };
  assert.deepEqual(errs(['a', 'b'], s), []);
  assert.deepEqual(keys(['a', 'B'], s), ['[1]']);
  assert.throws(() => errs([1], { type: 'array', items: { $ref: '#/$defs/nope' } }), /missing definition/);
});

test('schema: path keys read naturally', () => {
  assert.equal(pathKey([]), '(root)');
  assert.equal(pathKey([2, 'stats', 'VIG']), '[2].stats.VIG');
  assert.equal(pathKey(['drops', 'tierWeights', 'epic']), 'drops.tierWeights.epic');
  assert.equal(pathKey(['roster', 7, 'band']), 'roster[7].band');
});
