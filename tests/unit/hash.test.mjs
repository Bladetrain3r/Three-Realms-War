import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../../sim/sha256.js';
import { canonical, hashOf } from '../../sim/canon.js';

const utf8 = (s) => new TextEncoder().encode(s);

test('sha256: published test vectors', () => {
  assert.equal(sha256Hex(utf8('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex(utf8('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('sha256: a million "a" characters (published vector, exercises many blocks)', () => {
  assert.equal(sha256Hex(new Uint8Array(1000000).fill(97)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

test('sha256: lengths around the padding boundaries agree with Node crypto', async () => {
  const { createHash } = await import('node:crypto');
  for (let n = 0; n <= 130; n++) {
    const bytes = new Uint8Array(n).map((_, i) => (i * 31 + n) & 255);
    assert.equal(sha256Hex(bytes), createHash('sha256').update(bytes).digest('hex'), `length ${n}`);
  }
});

test('canon: sorted keys, no whitespace, arrays keep order (DESIGN.md WE-29)', () => {
  assert.equal(canonical({ schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } }),
    '{"a":{"b":1,"y":2},"kind":"x","schema":1,"z":[3,1,2]}');
});

test('canon: key insertion order does not change the bytes or the hash', () => {
  assert.equal(canonical({ a: 1, b: 2 }), canonical({ b: 2, a: 1 }));
  assert.equal(hashOf({ a: 1, b: 2 }), hashOf({ b: 2, a: 1 }));
});

test('canon: refuses non-integers, NaN, undefined, functions', () => {
  for (const bad of [1.5, NaN, Infinity, undefined, () => 1, 2 ** 60]) {
    assert.throws(() => canonical({ x: bad }), TypeError, String(bad));
  }
});

test('canon: hash of the documented sample (DESIGN.md WE-30)', () => {
  assert.equal(hashOf({ schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } }),
    'fa551ade1828c1a98375f021087c1c581d2459e69107783d9464fa3145f86cd6');
});
