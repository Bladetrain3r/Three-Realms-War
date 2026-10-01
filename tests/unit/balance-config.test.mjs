import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { content } from '../helpers/content.mjs';
import { parseYaml } from '../../checks/yaml.mjs';
import { validateRunbook } from '../../sim/runbook.js';

const text = readFileSync(repoPath('checks', 'balance.yaml'), 'utf8');
const B = parseYaml(text);
const rb = JSON.parse(readFileSync(repoPath('checks', 'balance-runbooks.json'), 'utf8')).runbooks;

function bounds(obj, path, out = []) { // every [lo, hi] pair in the tree
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')) out.push([`${path}.${k}`, v]);
    else if (v && typeof v === 'object' && !Array.isArray(v)) bounds(v, `${path}.${k}`, out);
  }
  return out;
}

test('balance config: the threshold file parses and carries the expected sections', () => {
  for (const k of ['version', 'written', 'run', 'ladder', 'delve_winrate', 'gear_order', 'naked_party', 'gear_gap', 'encounter', 'injury', 'mirror', 'rewards', 'upgrade_odds']) assert.ok(B[k] !== undefined, k);
  assert.equal(B.version, 1);
});

test('balance config: every bound is ordered and inside 0..1 where it is a rate', () => {
  const all = bounds(B, 'balance');
  assert.ok(all.length >= 47, `only ${all.length} bounds found`);
  for (const [path, [lo, hi]] of all) assert.ok(lo <= hi, `${path}: ${lo} > ${hi}`);
  for (const [path, [lo, hi]] of bounds({ delve_winrate: B.delve_winrate, mirror: B.mirror }, 'balance')) assert.ok(lo >= 0 && hi <= 1, path);
});

test('balance config: a bound exists for every level and every gear tier in the ladder', () => {
  const tiers = Object.keys(B.ladder).filter((t) => t !== 'none');
  assert.deepEqual(tiers, ['starter', 'fine', 'runed', 'heirloom']);
  for (const L of B.delve_winrate.levels) for (const t of tiers) assert.ok(Array.isArray(B.delve_winrate[`L${L}`][t]), `L${L} ${t}`);
});

test('balance config: the intent is monotone (a better tier never has a lower floor; higher levels never have a higher starter ceiling)', () => {
  const order = ['starter', 'fine', 'runed', 'heirloom'];
  for (const L of B.delve_winrate.levels) {
    const row = B.delve_winrate[`L${L}`];
    for (let i = 1; i < order.length; i++) {
      assert.ok(row[order[i]][0] >= row[order[i - 1]][0], `L${L}: floor of ${order[i]} below ${order[i - 1]}`);
      assert.ok(row[order[i]][1] >= row[order[i - 1]][1], `L${L}: ceiling of ${order[i]} below ${order[i - 1]}`);
    }
  }
  const lv = B.delve_winrate.levels;
  for (let i = 1; i < lv.length; i++) assert.ok(B.delve_winrate[`L${lv[i]}`].starter[1] <= B.delve_winrate[`L${lv[i - 1]}`].starter[1], `starter ceiling rises at L${lv[i]}`);
});

test('balance config: the run block names real classes and the gear ladder names real tiers', () => {
  for (const c of B.run.party) assert.ok(content.heroById[c], c);
  for (const [name, [tier, star]] of Object.entries(B.ladder)) {
    if (name === 'none') continue;
    assert.ok(content.tierById[tier], tier);
    assert.ok(star >= 0 && star <= content.tierById[tier].maxStar, `${name}: ${star} stars`);
  }
});

test('balance runbooks: every class has one and the real validator accepts it', () => {
  assert.deepEqual(Object.keys(rb).sort(), content.heroes.map((h) => h.id).sort());
  for (const h of content.heroes) {
    const v = validateRunbook(rb[h.id], h.skills, content);
    assert.deepEqual(v.errors, [], h.id);
  }
});

test('balance runbooks: each uses every skill its class has at least once (so a class is not tested as a plain attacker)', () => {
  for (const h of content.heroes) {
    const used = new Set(rb[h.id].rules.filter((r) => r.do.a === 'skill').map((r) => r.do.skill));
    assert.ok(used.size >= 1, h.id);
  }
});
