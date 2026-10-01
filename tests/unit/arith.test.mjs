import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idiv, mulbp, clamp } from '../../sim/arith.js';

test('arith: idiv is floor division on non-negative integers', () => {
  assert.equal(idiv(7, 2), 3);
  assert.equal(idiv(0, 5), 0);
  assert.equal(idiv(1000000007, 6), 166666667);
  assert.equal(idiv(2 ** 52, 3), Math.floor(2 ** 52 / 3));
});

test('arith: idiv refuses negative or zero operands instead of truncating silently', () => {
  assert.throws(() => idiv(-1, 2), RangeError);
  assert.throws(() => idiv(1, 0), RangeError);
});

test('arith: mulbp floors after the multiplication', () => {
  assert.equal(mulbp(37, 11500), 42);
  assert.equal(mulbp(1, 9999), 0);
  assert.equal(mulbp(10000, 10000), 10000);
});

test('arith: mulbp refuses a product that is not exactly representable', () => {
  assert.throws(() => mulbp(2 ** 50, 10000), RangeError);
  assert.throws(() => mulbp(-5, 100), RangeError);
});

test('arith: clamp', () => {
  assert.equal(clamp(-9000, -5000, 7500), -5000);
  assert.equal(clamp(9000, -5000, 7500), 7500);
  assert.equal(clamp(3, -5000, 7500), 3);
});
