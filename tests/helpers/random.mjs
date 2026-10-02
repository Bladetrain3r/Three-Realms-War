import assert from 'node:assert/strict';
import { content, heroDef } from './units.mjs';
import { validateRunbook } from '../../sim/runbook.js';

const CLASSES = content.heroes.map((h) => h.id);
const STATUS_IDS = content.statuses.map((s) => s.id);

export function randomRunbook(rng, kit) {
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

export function randomSide(rng, size) {
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

