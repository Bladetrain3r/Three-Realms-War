// Randomized 4v4 fights with random valid runbooks. The invariants must hold for every fight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, mkDef, heroDef, ctxSeed } from '../helpers/units.mjs';
import { createRng } from '../../sim/prng.js';
import { resolveEncounter } from '../../sim/combat.js';
import { validateRunbook } from '../../sim/runbook.js';

const CLASSES = content.heroes.map((h) => h.id);
const STATUS_IDS = content.statuses.map((s) => s.id);

function randomRunbook(rng, kit) {
  const pick = (a) => a[rng.range(a.length)];
  const rules = [];
  const n = rng.range(content.runbook.maxRules + 1);
  for (let i = 0; i < n; i++) {
    const when = [];
    for (let k = 0, m = 1 + rng.range(2); k < m; k++) {
      const def = pick(content.runbook.conditions), cl = { c: def.id };
      for (const [a, type] of Object.entries(def.args)) {
        const T = content.runbook.argTypes[type];
        cl[a] = T.values ? pick(T.values) : T.of === 'statuses' ? pick(STATUS_IDS) : T.of === 'skills' ? pick(kit) : T.step ? T.min + T.step * rng.range((T.max - T.min) / T.step + 1) : T.min + rng.range(T.max - T.min + 1);
      }
      when.push(cl);
    }
    const r = rng.range(3);
    let doIt, target;
    if (r === 0) { doIt = { a: 'brace' }; target = null; }
    else if (r === 1) { doIt = { a: 'basic' }; target = pick(content.runbook.selectors.filter((s) => s.for.includes('enemy'))).id; }
    else {
      const sk = pick(kit), def = content.skillById[sk];
      doIt = { a: 'skill', skill: sk };
      target = def.target === 'enemy' || def.target === 'ally' ? pick(content.runbook.selectors.filter((s) => s.for.includes(def.target))).id : null;
    }
    rules.push({ when, do: doIt, target });
  }
  return { v: 1, rules };
}

function randomSide(rng, size) {
  const out = [];
  for (let i = 0; i < size; i++) {
    const cls = CLASSES[rng.range(CLASSES.length)], level = 1 + rng.range(50);
    const base = heroDef(cls, level);
    const rb = randomRunbook(rng, content.heroById[cls].skills);
    const v = validateRunbook(rb, content.heroById[cls].skills, content);
    assert.ok(v.ok, JSON.stringify(v.errors) + JSON.stringify(rb));
    out.push({ ...base, runbook: rb });
  }
  return out;
}

test('fuzz: 2,000 random fights keep every invariant', () => {
  const dice = createRng(20261001);
  for (let f = 0; f < 2000; f++) {
    const heroes = randomSide(dice, 1 + dice.range(4));
    const enemies = randomSide(dice, 1 + dice.range(4)).map((d, i) => ({ ...d, kind: 'enemy', runbook: undefined, skills: content.heroById[d.class].skills.slice(0, 1), name: 'E' + i }));
    const maxHp = [...heroes, ...enemies].map((d) => d.maxHp);
    const ev = [];
    const res = resolveEncounter(ctxSeed(1000 + f, ev), { index: 0, heroes, heroHp: null, enemies });
    assert.ok(res.rounds >= 1 && res.rounds <= content.tables.combat.roundCap, `fight ${f} rounds ${res.rounds}`);
    assert.ok([0, 1].includes(res.outcome));
    res.heroHp.forEach((h, i) => assert.ok(h >= 0 && h <= heroes[i].maxHp, `fight ${f} hero ${i} hp ${h}`));
    // event stream well-formedness
    const hpNow = [...heroes.map((d) => d.maxHp), ...new Array(4 - heroes.length).fill(0), ...enemies.map((d) => d.maxHp)];
    const slotOf = (id) => (id < 4 ? id : id - 4 + 4);
    const dead = new Set();
    let actor = null, shocked = new Set();
    for (const e of ev) {
      if (e[0] === 2) { actor = e[1]; assert.ok(!dead.has(actor), `fight ${f}: dead unit ${actor} took a turn`); }
      if (e[0] === 3) assert.equal(e[1], actor, `fight ${f}: skill by a unit not on turn`);
      if (e[0] === 3) assert.ok(!shocked.has(e[1]), `fight ${f}: shocked unit ${e[1]} acted`);
      if (e[0] === 4) { assert.ok(e[3] >= 1, 'a hit deals at least 1'); assert.ok(e[5] >= 0); assert.ok(!dead.has(e[2]), `fight ${f}: hit on the dead`); }
      if (e[0] === 6 && e[3] === 2) shocked.add(e[2]);
      if (e[0] === 10) shocked.delete(e[1]);
      if (e[0] === 8 && e[2] === 2) shocked.delete(e[1]);
      if (e[0] === 9) { assert.ok(!dead.has(e[1])); dead.add(e[1]); }
    }
    assert.equal(ev.filter((e) => e[0] === 0).length, 1);
    assert.equal(ev.filter((e) => e[0] === 11).length, 1);
    assert.deepEqual(ev.at(-1).slice(0, 2), [11, res.outcome]);
    void maxHp; void hpNow; void slotOf;
  }
});

test('fuzz: the same 200 fights replay to identical bytes', () => {
  for (let f = 0; f < 200; f++) {
    const run = () => {
      const dice = createRng(777 + f), heroes = randomSide(dice, 4), enemies = randomSide(dice, 4).map((d) => ({ ...d, kind: 'enemy', skills: [content.heroById[d.class].skills[0]] }));
      const ev = [];
      resolveEncounter(ctxSeed(5000 + f, ev), { index: 0, heroes, heroHp: null, enemies });
      return JSON.stringify(ev);
    };
    assert.equal(run(), run());
  }
});
