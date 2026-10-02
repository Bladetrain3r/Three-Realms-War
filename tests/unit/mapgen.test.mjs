import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { mapFromSeed, PLAIN, FOREST, HILLS, WATER, PEAK, moveCost, cellsWithin } from '../../sim/mapgen.js';
import { hashOf } from '../../sim/index.js';
import { idiv } from '../../sim/arith.js';

const X = content.tables.expedition;
const passable = (m, x, y) => ![WATER, PEAK].includes(m.terrain[y * m.width + x]);

test('mapgen: the same seed and level give the same map, other seeds give other maps', () => {
  const a = hashOf(mapFromSeed(12345, 20, X)), b = hashOf(mapFromSeed(12345, 20, X));
  assert.equal(a, b);
  const seen = new Set(); for (let s = 1; s <= 60; s++) seen.add(hashOf(mapFromSeed(s, 20, X)));
  assert.equal(seen.size, 60);
});

test('mapgen: over 1,000 seeds every map has the right shape, a start in column 0, 5 to 8 spaced sites, and every site reachable', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const m = mapFromSeed(seed * 7919, 1 + (seed % 50), X);
    assert.equal(m.width, 20); assert.equal(m.height, 14); assert.equal(m.terrain.length, 280);
    assert.ok(m.terrain.every((t) => t >= 0 && t <= 4));
    assert.equal(m.start.x, 0); assert.ok(m.start.y >= 0 && m.start.y < 14); assert.equal(m.terrain[m.start.y * 20], PLAIN);
    assert.ok(m.sites.length >= 5 && m.sites.length <= 8, `seed ${seed}: ${m.sites.length} sites`);
    for (const [i, s] of m.sites.entries()) {
      assert.ok(passable(m, s.x, s.y), `seed ${seed}: site on water or peak`);
      assert.ok(Math.abs(s.x) + Math.abs(s.y - m.start.y) >= 4);
      for (const t of m.sites.slice(i + 1)) assert.ok(Math.abs(s.x - t.x) + Math.abs(s.y - t.y) >= 4, `seed ${seed}: sites too close`);
    }
    // flood fill: every site is reachable over passable cells
    const seen = new Set([m.start.y * 20]), q = [[0, m.start.y]];
    for (let i = 0; i < q.length; i++) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = q[i][0] + ox, ny = q[i][1] + oy;
      if (nx < 0 || ny < 0 || nx >= 20 || ny >= 14 || seen.has(ny * 20 + nx) || !passable(m, nx, ny)) continue;
      seen.add(ny * 20 + nx); q.push([nx, ny]);
    }
    for (const s of m.sites) assert.ok(seen.has(s.y * 20 + s.x), `seed ${seed}: site ${s.id} unreachable`);
  }
});

test('mapgen: site level, floors and distance follow DESIGN 12.3 (level E + idiv(dist, 3), floors 2 + idiv(dist, 4) capped at 6)', () => {
  for (let seed = 1; seed <= 200; seed++) for (const s of mapFromSeed(seed, 20, X).sites) {
    assert.equal(s.level, 20 + idiv(s.dist, 3)); assert.equal(s.floors, Math.min(6, 2 + idiv(s.dist, 4))); assert.ok(s.floors >= 2 && s.floors <= 6);
  }
});

test('mapgen: the terrain mix is sane (mostly walkable, some of every kind over many maps)', () => {
  const count = [0, 0, 0, 0, 0];
  for (let seed = 1; seed <= 300; seed++) { const m = mapFromSeed(seed, 10, X); for (const t of m.terrain) count[t]++; }
  const total = count.reduce((a, b) => a + b, 0);
  assert.ok(count.every((n) => n > 0), JSON.stringify(count));
  assert.ok((count[PLAIN] + count[FOREST] + count[HILLS]) / total > 0.7, JSON.stringify(count));
  assert.ok(count[PLAIN] / total > 0.3);
  assert.deepEqual([moveCost(PLAIN, X), moveCost(FOREST, X), moveCost(HILLS, X), moveCost(WATER, X), moveCost(PEAK, X)], [1, 2, 2, 0, 0]);
  assert.deepEqual(cellsWithin(0, 0, 2, 20, 14).sort((a, b) => a - b), [0, 1, 2, 20, 21, 40]);
});
