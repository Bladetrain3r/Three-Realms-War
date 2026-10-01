import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { scanSource, stripCode } from '../helpers/scan.mjs';

const files = readdirSync(repoPath('sim')).filter((f) => f.endsWith('.js')).sort();

test('banned: sim/ has files to scan', () => assert.ok(files.length >= 15, String(files.length)));

for (const f of files) {
  test(`banned: sim/${f} contains no determinism-breaking construct`, () => {
    assert.deepEqual(scanSource(f, readFileSync(repoPath('sim', f), 'utf8')), []);
  });
}

test('banned: the scan flags every planted violation (self-test, so a silent scanner cannot pass)', () => {
  const bad = {
    'Math.random': 'const x = Math.random();',
    'Date.now': 'const t = Date.now();',
    'new Date': 'const d = new Date();',
    'performance': 'const t = performance.now();',
    'timer': 'setTimeout(f, 1);',
    'for-in': 'for (const k in obj) {}',
    'Object.keys': 'const k = Object.keys(o);',
    'Object.values': 'const k = Object.values(o);',
    'sort()': 'a.sort();',
    'sort(cmp) unreviewed': 'a.sort((x, y) => x - y);',
    'Map': 'const m = new Map();',
    'Set': 'const s = new Set([1]);',
    'division': 'const q = a / b;',
    'Math.floor': 'const q = Math.floor(a);',
    'Math.round': 'const q = Math.round(a);',
    'decimal literal': 'const x = 1.5;',
    'node import': "import fs from 'node:fs';",
    'bare import': "import x from 'lodash';",
    'dynamic import': 'const m = import("./x.js");',
    'localStorage': 'localStorage.setItem("a", "b");',
    'document': 'document.title = "x";',
    'process': 'process.exit(1);',
    'globalThis': 'globalThis.x = 1;',
    'toFixed': 'x.toFixed(2);',
  };
  for (const [name, src] of Object.entries(bad)) assert.ok(scanSource('x.js', src).length > 0, `not flagged: ${name}`);
});

test('banned: the scan does not flag comments, strings, templates, or integer-safe code', () => {
  const ok = [
    '// Math.random and Date are banned',
    '/* never use Date.now() or a / b */',
    'const s = "Date.now() / 2";',
    "const t = 'Math.random';",
    'const u = `${a} / ${b} Date`;',
    'const v = `outer ${`inner ${x}`} Date.now()`;',
    'const m = Math.min(a, b) + Math.max(c, d) + Math.abs(e) + Math.imul(f, g);',
    'for (const x of list) {}',
    'for (let i = 0; i < n; i++) {}',
    'const r = a % b;',
    'const memo = new WeakMap();',
    'const h = 0x9e3779b9 | 0;',
    "import { idiv } from './arith.js';",
    'rows.sort((a, b) => b.spd - a.spd || a.u.id - b.u.id);'.replace('rows.sort', 'rows.nosort'),
  ];
  for (const src of ok) assert.deepEqual(scanSource('x.js', src), [], src);
});

test('banned: allowlists are per file (canon.js may sort and iterate keys, arith.js may divide)', () => {
  assert.deepEqual(scanSource('canon.js', 'Object.keys(v).sort((a, b) => (a < b ? -1 : 1));'), []);
  assert.deepEqual(scanSource('arith.js', 'return (a - (a % b)) / b;'), []);
  assert.ok(scanSource('stats.js', 'return (a - (a % b)) / b;').length > 0);
  assert.ok(scanSource('stats.js', 'Object.keys(v).sort((a, b) => 1);').length > 0);
});

test('banned: stripCode keeps line numbers', () => {
  const src = 'a\n// c\n"x\\"y"\n`t\n${1}`\nb';
  assert.equal(stripCode(src).split('\n').length, src.split('\n').length);
});
