import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml } from '../../checks/yaml.mjs';

test('yaml: nested maps, scalars, lists and comments', () => {
  const y = parseYaml(`# top comment
version: 1
name: three_realms   # trailing comment
ratio: 0.25
neg: -3
on: true
off: false
nothing: null
text: "hello # not a comment"
a:
  b:
    c: [1, 2.5, x]
  d: [0.1, 0.9]
  e: []
`);
  assert.deepEqual(y, { version: 1, name: 'three_realms', ratio: 0.25, neg: -3, on: true, off: false, nothing: null, text: 'hello # not a comment', a: { b: { c: [1, 2.5, 'x'] }, d: [0.1, 0.9], e: [] } });
});

test('yaml: siblings after a nested block return to the right level', () => {
  const y = parseYaml('a:\n  b: 1\n  c:\n    d: 2\n  e: 3\nf: 4\n');
  assert.deepEqual(y, { a: { b: 1, c: { d: 2 }, e: 3 }, f: 4 });
});

test('yaml: refuses what the subset does not cover, naming the line', () => {
  assert.throws(() => parseYaml('a: 1\n\tb: 2'), /line 2: tabs/);
  assert.throws(() => parseYaml('a:\n   b: 1'), /line 2: indentation/);
  assert.throws(() => parseYaml('a: 1\na: 2'), /line 2: duplicate key "a"/);
  assert.throws(() => parseYaml('- x'), /line 1: expected "key: value"/);
  assert.throws(() => parseYaml('a: [1, 2'), /line 1: unterminated list/);
  assert.throws(() => parseYaml('a: {b: 1}'), /line 1: cannot read value/);
  assert.throws(() => parseYaml('a:\n  b:\n      c: 1'), /line 3: indented too far/);
});

test('yaml: a key may repeat in different maps', () => {
  assert.deepEqual(parseYaml('a:\n  x: 1\nb:\n  x: 2\n'), { a: { x: 1 }, b: { x: 2 } });
});
