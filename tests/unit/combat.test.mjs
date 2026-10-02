import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, scripted, mkDef, heroDef, ctxWith, ctxSeed, always, eventsOf } from '../helpers/units.mjs';
import { damageSteps } from '../../sim/damage.js';
import { resolveEncounter, turnOrder } from '../../sim/combat.js';
import { makeUnit } from '../../sim/unit.js';
import { tickStatuses, tryRider } from '../../sim/status.js';

const C = content.tables.combat;
const huscarl = (rules = [always('hearth_strike')]) => {
  const d = heroDef('huscarl', 26, rules);
  return { ...d, stats: { ...d.stats, MIT: { base: 300, pct: 0 }, SPD: { base: 50, pct: 0 } } };
};
const target = (over = {}) => mkDef({ stats: { VIG: 1000, GRD: 250, SPD: 1 }, res: { fire: 2000, frost: 0, lightning: 0 }, sres: 0, ...over });

test('combat: the damage pipeline reproduces the documented hit and crit (DESIGN.md WE-10, WE-11)', () => {
  const p = { atk: 300, power: 16000, def: 250, attackerLevel: 26, affinity: true, elemRes: 2000, takenBp: 0, variance: 10500, critRoll: 9000, critChance: 500, critDmg: 15000 };
  assert.deepEqual(damageSteps(p, C).steps, [480, 4152, 280, 308, 246, 246, 258, 258]);
  assert.deepEqual(damageSteps({ ...p, critRoll: 100 }, C).steps, [480, 4152, 280, 308, 246, 246, 258, 387, 387]);
});

test('combat: mitigation (DESIGN.md WE-09), its 80% cap, the 1-damage floor, mark and resist clamps', () => {
  const base = { atk: 100, power: 10000, def: 150, attackerLevel: 26, affinity: false, elemRes: 0, takenBp: 0, variance: 10000, critRoll: 9999, critChance: 0, critDmg: 15000 };
  assert.equal(damageSteps(base, C).steps[1], 2988);
  assert.equal(damageSteps({ ...base, def: 10 ** 9 }, C).steps[1], 8000);
  assert.equal(damageSteps({ ...base, atk: 1, def: 10 ** 9 }, C).damage, 1);
  assert.equal(damageSteps({ ...base, takenBp: 2500 }, C).damage, Math.floor(damageSteps(base, C).damage * 1.25));
  assert.equal(damageSteps({ ...base, elemRes: 99999 }, C).damage, damageSteps({ ...base, elemRes: 7500 }, C).damage);
  assert.equal(damageSteps({ ...base, elemRes: -99999 }, C).damage, damageSteps({ ...base, elemRes: -5000 }, C).damage);
});

test('combat: a roll equal to the crit chance is not a crit; one below it is', () => {
  const p = { atk: 100, power: 10000, def: 0, attackerLevel: 1, affinity: false, elemRes: 0, takenBp: 0, variance: 10000, critChance: 500, critDmg: 15000 };
  assert.equal(damageSteps({ ...p, critRoll: 500 }, C).crit, false);
  assert.equal(damageSteps({ ...p, critRoll: 499 }, C).crit, true);
  assert.equal(damageSteps({ ...p, critRoll: 0, critChance: 0 }, C).crit, false);
});

test('combat: a damaging hit draws variance (2001 values), then crit (10000), then each uncertain rider (10000), in that order', () => {
  const dice = scripted([1500, 9000, 0]), ev = [];
  resolveEncounter(ctxWith(dice, ev), { index: 0, heroes: [huscarl()], heroHp: null, enemies: [target()] });
  assert.deepEqual(dice.asked.slice(0, 3), [2001, 10000, 10000]);
});

function firstHit(critRoll) {
  const ev = [], ctx = ctxWith(scripted([1500, critRoll, 0]), ev);
  resolveEncounter(ctx, { index: 0, heroes: [huscarl()], heroHp: null, enemies: [target()] });
  return eventsOf(ev, 4)[0];
}
test('combat: an end-to-end Hearth Strike lands for 258, and 387 on a crit (DESIGN.md WE-10, WE-11)', () => {
  assert.deepEqual(firstHit(9000).slice(0, 5), [4, 0, 4, 258, 0]);
  assert.deepEqual(firstHit(100).slice(0, 5), [4, 0, 4, 387, 1]);
});

test('combat: turn order is SPD descending with ties to the lower id, chill applying (DESIGN.md WE-16)', () => {
  const spd = [14, 9, 14, 12, 9, 12];
  const units = spd.map((s, i) => makeUnit(mkDef({ stats: { SPD: s } }), i, i < 3 ? 0 : 1, i % 3, null, content));
  units[3].statuses.push({ id: 'chill', dur: 2, at: 0 });
  assert.deepEqual(turnOrder(ctxWith(scripted([])), units).map((u) => u.id), [0, 2, 5, 1, 4, 3]);
});

test('combat: burn and mend ticks use max HP (DESIGN.md WE-14, WE-32)', () => {
  const ev = [], ctx = ctxWith(scripted([]), ev);
  const u = makeUnit(mkDef({ stats: { VIG: 291 } }), 0, 0, 0, 1000, content); // max HP 1455
  assert.equal(u.maxHp, 1455);
  u.statuses.push({ id: 'burn', dur: 3, at: 0 });
  tickStatuses(ctx, u);
  assert.deepEqual(eventsOf(ev, 7), [[7, 0, 0, 87]]);
  assert.equal(u.hp, 913);
  u.statuses = [{ id: 'mend', dur: 3, at: 0 }];
  tickStatuses(ctx, u);
  assert.deepEqual(eventsOf(ev, 7)[1], [7, 0, 6, 72]);
  assert.equal(u.hp, 985);
});

test('combat: burn can down its bearer and the unit then takes no action', () => {
  const ev = [], ctx = ctxWith(scripted([]), ev);
  const u = makeUnit(mkDef({ stats: { VIG: 291 } }), 0, 0, 0, 5, content);
  u.statuses.push({ id: 'burn', dur: 3, at: 0 });
  tickStatuses(ctx, u);
  assert.equal(u.hp, 0);
  assert.equal(u.alive, false);
  assert.deepEqual(ev.at(-1), [9, 0]);
});

test('combat: a heal is ARC x power, capped at missing HP, and never overheals (DESIGN.md WE-13)', () => {
  const run = (missing) => {
    const healer = heroDef('hearthkeeper', 10, [always('hearth_light')]);
    healer.stats.ARC = { base: 220, pct: 0 };
    const ally = heroDef('shieldwarden', 50, [{ when: [{ c: 'always' }], do: { a: 'brace' }, target: null }]);
    const hp = [healer.maxHp, ally.maxHp - missing];
    const ev = [];
    resolveEncounter(ctxWith(scripted([0, 0, 0]), ev), { index: 0, heroes: [healer, ally], heroHp: hp, enemies: [mkDef({ stats: { SPD: 1, MIT: 1, VIG: 100000 } })] });
    return eventsOf(ev, 5)[0];
  };
  assert.deepEqual(run(100).slice(0, 4), [5, 0, 1, 100]);
  assert.deepEqual(run(400).slice(0, 4), [5, 0, 1, 264]);
});

test('combat: lifesteal heals a share of the damage actually dealt', () => {
  const ev = [], d = heroDef('ghoul_reaver', 20, [always('carrion_feast')]);
  d.stats.SPD = { base: 80, pct: 0 };
  const hp = [Math.floor(d.maxHp / 2)];
  resolveEncounter(ctxWith(scripted([1000, 9999, 0]), ev), { index: 0, heroes: [d], heroHp: hp, enemies: [mkDef({ stats: { VIG: 500, SPD: 1 } })] });
  const h = eventsOf(ev, 4)[0], heal = eventsOf(ev, 5)[0];
  assert.equal(heal[3], Math.floor(h[3] * 5000 / 10000));
  assert.equal(heal[4], hp[0] + heal[3]);
});

test('combat: melee skills reach only the front row while it stands, then the back row', () => {
  const ev = [];
  const enemies = [mkDef({ stats: { VIG: 3, SPD: 1 } }), mkDef({ stats: { VIG: 3, SPD: 1 } }), mkDef({ stats: { VIG: 500, SPD: 1 } }), mkDef({ stats: { VIG: 500, SPD: 1 } })];
  const d = heroDef('huscarl', 20, [{ when: [{ c: 'always' }], do: { a: 'basic' }, target: 'highest_hp' }]);
  d.stats.SPD = { base: 90, pct: 0 };
  resolveEncounter(ctxSeed(5, ev), { index: 0, heroes: [d], heroHp: null, enemies });
  const hits = eventsOf(ev, 4).filter((e) => e[1] === 0).map((e) => e[2]);
  assert.deepEqual(hits.slice(0, 2).sort(), [4, 5]);        // front row first, despite back-row units having more HP
  assert.ok(hits.slice(2).every((t) => t === 6 || t === 7)); // then the back row
});

test('combat: ranged skills reach the back row at once', () => {
  const ev = [];
  const enemies = [mkDef({ stats: { VIG: 50, SPD: 1 } }), mkDef({ stats: { VIG: 50, SPD: 1 } }), mkDef({ stats: { VIG: 50, SPD: 1 } })];
  const d = heroDef('hunter', 20, [{ when: [{ c: 'always' }], do: { a: 'basic' }, target: 'back_first' }]);
  d.stats.SPD = { base: 90, pct: 0 };
  resolveEncounter(ctxSeed(6, ev), { index: 0, heroes: [d], heroHp: null, enemies });
  assert.equal(eventsOf(ev, 4)[0][2], 6);
});

test('combat: a cooldown of 4 means use, then three other actions, then use again', () => {
  const ev = [];
  const d = heroDef('shieldwarden', 10, [always('hold_the_line', null)]);
  resolveEncounter(ctxSeed(7, ev), { index: 0, heroes: [d], heroHp: null, enemies: [mkDef({ stats: { VIG: 100000, MIT: 1, SPD: 1 } })] });
  let turn = 0; const usedOn = [];
  for (const e of ev) {
    if (e[0] === 2 && e[1] === 0) turn++;
    if (e[0] === 3 && e[1] === 0 && e[3] === -1) usedOn.push(turn);
  }
  assert.deepEqual(usedOn.slice(0, 4), [1, 5, 9, 13]);
});

test('combat: a self-applied buff counts its stated number of FOLLOWING turns, not the turn it was cast', () => {
  const ev = [];
  const d = heroDef('shieldwarden', 10, [always('hold_the_line', null)]);
  resolveEncounter(ctxSeed(8, ev), { index: 0, heroes: [d], heroHp: null, enemies: [mkDef({ stats: { VIG: 100000, MIT: 1, SPD: 1 } })] });
  let turn = 0, expiredOn = null;
  for (const e of ev) {
    if (e[0] === 2 && e[1] === 0) turn++;
    if (e[0] === 8 && e[1] === 0 && expiredOn === null) expiredOn = turn;
  }
  assert.equal(expiredOn, 4); // cast on turn 1, active on turns 2, 3 and 4
});

test('combat: shock skips an action, then the bearer is immune for two turns; bosses are always immune', () => {
  const ev = [], ctx = ctxWith(scripted([0]), ev);
  const src = makeUnit(mkDef(), 0, 0, 0, null, content), tgt = makeUnit(mkDef({ sres: 0 }), 4, 1, 0, null, content);
  assert.equal(tryRider(ctx, src, tgt, { status: 'shock', chance: 2500, duration: 1, on: 'target' }), true);
  assert.equal(tgt.statuses[0].id, 'shock');
  tgt.statuses = []; tgt.shockImmune = 2;
  assert.equal(tryRider(ctxWith(scripted([0])), src, tgt, { status: 'shock', chance: 2500, duration: 1, on: 'target' }), false);
  const boss = makeUnit(mkDef({ boss: true, sres: 0 }), 5, 1, 1, null, content);
  assert.equal(tryRider(ctxWith(scripted([0])), src, boss, { status: 'shock', chance: 10000, duration: 1, on: 'target' }), false);
});

test('combat: debuff chance is cut by status resist; buffs ignore it; a certain effective chance draws nothing (DESIGN.md WE-12)', () => {
  const src = makeUnit(mkDef(), 0, 0, 0, null, content), tgt = makeUnit(mkDef({ sres: 2500 }), 4, 1, 0, null, content);
  const rider = { status: 'chill', chance: 4000, duration: 2, on: 'target' };
  assert.equal(tryRider(ctxWith(scripted([2999])), src, tgt, rider), true);
  tgt.statuses = [];
  assert.equal(tryRider(ctxWith(scripted([3000])), src, tgt, rider), false);
  const dice = scripted([]);
  assert.equal(tryRider(ctxWith(dice), src, tgt, { status: 'fury', chance: 10000, duration: 2, on: 'target' }), true);
  assert.equal(dice.used, 0);
});

test('combat: reapplying a status refreshes its duration and never stacks', () => {
  const ctx = ctxWith(scripted([]));
  const src = makeUnit(mkDef(), 0, 0, 0, null, content), tgt = makeUnit(mkDef(), 4, 1, 0, null, content);
  const r = (d) => ({ status: 'fury', chance: 10000, duration: d, on: 'target' });
  tryRider(ctx, src, tgt, r(2)); tgt.statuses[0].dur = 1; tryRider(ctx, src, tgt, r(3));
  assert.equal(tgt.statuses.length, 1);
  assert.equal(tgt.statuses[0].dur, 3);
});

test('combat: brace skips the attack and gives bulwark', () => {
  const ev = [], d = heroDef('shieldwarden', 10, [{ when: [{ c: 'always' }], do: { a: 'brace' }, target: null }]);
  resolveEncounter(ctxSeed(9, ev), { index: 0, heroes: [d], heroHp: null, enemies: [mkDef({ stats: { MIT: 1, SPD: 1, VIG: 100000 } })] });
  assert.ok(eventsOf(ev, 4).every((h) => h[1] !== 0), 'a bracing hero never attacks');
  assert.ok(eventsOf(ev, 6).some((s) => s[1] === 0 && s[2] === 0 && s[3] === 4));
});

test('combat: an impossible starting HP is refused, not silently clamped', () => {
  const d = heroDef('huscarl', 10);
  assert.throws(() => makeUnit(d, 0, 0, 0, -5, content), /outside/);
  assert.throws(() => makeUnit(d, 0, 0, 0, d.maxHp + 1, content), /outside/);
  assert.doesNotThrow(() => makeUnit(d, 0, 0, 0, 0, content));
});

test('combat: a hero who starts at 0 HP stays down and never acts', () => {
  const ev = [];
  const a = heroDef('huscarl', 10), b = heroDef('stormcaller', 10);
  resolveEncounter(ctxSeed(10, ev), { index: 0, heroes: [a, b], heroHp: [a.maxHp, 0], enemies: [mkDef({ stats: { VIG: 5, SPD: 1 } })] });
  assert.ok(!ev.some((e) => e[0] === 2 && e[1] === 1));
});

test('combat: after 30 rounds with both sides standing the player loses', () => {
  const ev = [];
  const r = resolveEncounter(ctxSeed(11, ev), { index: 0, heroes: [heroDef('shieldwarden', 50)], heroHp: null, enemies: [mkDef({ stats: { VIG: 10 ** 6, MIT: 1, SPD: 1 } })] });
  assert.deepEqual([r.outcome, r.rounds], [0, 30]);
  assert.deepEqual(ev.at(-1), [11, 0, 30]);
});

test('combat: the same seed gives byte-identical events', () => {
  const run = () => { const ev = []; resolveEncounter(ctxSeed(321, ev), { index: 0, heroes: [heroDef('huscarl', 12), heroDef('hearthkeeper', 12)], heroHp: null, enemies: [mkDef(), mkDef({ stats: { ARC: 30 }, attack: 'magic' })] }); return JSON.stringify(ev); };
  assert.equal(run(), run());
});
