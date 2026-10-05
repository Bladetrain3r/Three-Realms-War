import { content, hero, item } from './content.mjs';
import { buildHeroUnit } from '../../sim/hero.js';
import { makeContext } from '../../sim/combat.js';
import { createRng } from '../../sim/prng.js';

export const STATS = ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD'];

// Dice that return scripted values (ignoring the requested range), then a fallback.
export function scripted(values, fallback = 0) {
  let i = 0;
  const asked = [];
  return { range: (n) => { asked.push(n); return i < values.length ? values[i++] : fallback; }, get used() { return i; }, asked };
}

// A hand-made unit definition (the resolved form). stats: plain numbers, becoming { base, pct: 0 }.
export function mkDef(over = {}) {
  const stats = {};
  for (const s of STATS) stats[s] = { base: (over.stats && over.stats[s]) ?? 20, pct: 0 };
  const vig = stats.VIG.base;
  return {
    kind: 'enemy', name: 'Dummy', realm: 'midgard', level: 10, attack: 'melee', boss: false, injured: false,
    maxHp: vig * 5, crit: 500, critDmg: 15000, sres: 500, res: { fire: 0, frost: 0, lightning: 0 },
    skills: [], runbook: { v: 1, rules: [] },
    ...over, stats,
  };
}

export function heroDef(classId, level, rules = [], patch = {}) {
  const u = buildHeroUnit(hero({ class: classId, level, runbook: { v: 1, rules } }), {}, content);
  return { ...u, ...patch };
}

export const ctxWith = (rng, events = []) => makeContext(content, rng, events);
export const ctxSeed = (seed, events = []) => makeContext(content, createRng(seed), events);

export const always = (skill, target = 'lowest_hp_pct') => ({ when: [{ c: 'always' }], do: { a: 'skill', skill }, target });
export const eventsOf = (events, op) => events.filter((e) => e[0] === op);
export { content, hero, item };

// ---- scenarios shared by the unit tests and the DESIGN.md example registry ----
import { resolveEncounter, turnOrder } from '../../sim/combat.js';
import { makeUnit } from '../../sim/unit.js';
import { tickStatuses, tryRider } from '../../sim/status.js';

export function healEvent(missing) {
  const healer = heroDef('hearthkeeper', 10, [always('hearth_light')]);
  healer.stats.ARC = { base: 220, pct: 0 };
  const ally = heroDef('shieldwarden', 50, [{ when: [{ c: 'always' }], do: { a: 'brace' }, target: null }]);
  const ev = [];
  resolveEncounter(ctxWith(scripted([0, 0, 0]), ev), { index: 0, heroes: [healer, ally], heroHp: [healer.maxHp, ally.maxHp - missing], enemies: [mkDef({ stats: { SPD: 1, MIT: 1, VIG: 100000 } })] });
  return eventsOf(ev, 5)[0];
}

export function tickAmounts() { // max HP 1455: a burn tick, then a mend tick
  const ev = [], ctx = ctxWith(scripted([]), ev);
  const u = makeUnit(mkDef({ stats: { VIG: 291 } }), 0, 0, 0, 1000, content);
  u.statuses.push({ id: 'burn', dur: 3, at: 0 }); tickStatuses(ctx, u);
  u.statuses = [{ id: 'mend', dur: 3, at: 0 }]; tickStatuses(ctx, u);
  return eventsOf(ev, 7).map((e) => e[3]);
}

export function orderIds() {
  const spd = [14, 9, 14, 12, 9, 12];
  const units = spd.map((s, i) => makeUnit(mkDef({ stats: { SPD: s } }), i, i < 3 ? 0 : 1, i % 3, null, content));
  units[3].statuses.push({ id: 'chill', dur: 2, at: 0 });
  return turnOrder(ctxWith(scripted([])), units).map((u) => u.id);
}

export function chillApplies(draw) { // chill 4000 bp against SRES 2500
  const src = makeUnit(mkDef(), 0, 0, 0, null, content), tgt = makeUnit(mkDef({ sres: 2500 }), 4, 1, 0, null, content);
  return tryRider(ctxWith(scripted([draw])), src, tgt, { status: 'chill', chance: 4000, duration: 2, on: 'target' }) ? 1 : 0;
}
