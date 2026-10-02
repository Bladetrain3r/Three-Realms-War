import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, scripted, mkDef, heroDef, ctxWith, always } from '../helpers/units.mjs';
import { makeUnit } from '../../sim/unit.js';
import { clauseHolds, pickBySelector, legalTargets } from '../../sim/targeting.js';
import { chooseHeroAction, chooseMonsterAction } from '../../sim/ai.js';

// Build a context with units on both sides. specs: { heroes: [def...], enemies: [def...] }
function arena(heroes, enemies, round = 1) {
  const ctx = ctxWith(scripted([]));
  ctx.round = round;
  ctx.sides = [heroes.map((d, i) => makeUnit(d, i, 0, i, null, content)), enemies.map((d, i) => makeUnit(d, 4 + i, 1, i, null, content))];
  return ctx;
}
const H = (cls = 'shieldwarden', rules = []) => heroDef(cls, 20, rules);
const E = (over = {}) => mkDef({ stats: { VIG: 100 }, ...over });
const hp = (u, num, den) => { u.hp = Math.floor(u.maxHp * num / den); };

test('conditions: hp thresholds are strict below, inclusive above, and use cross-multiplication', () => {
  const ctx = arena([H()], [E()]);
  const me = ctx.sides[0][0];
  me.hp = Math.floor(me.maxHp * 40 / 100); me.hp = me.maxHp * 40 / 100; // exactly 40%
  assert.equal(clauseHolds(ctx, me, { c: 'self_hp_below', pct: 40 }), false);
  assert.equal(clauseHolds(ctx, me, { c: 'self_hp_above', pct: 40 }), true);
  me.hp -= 1;
  assert.equal(clauseHolds(ctx, me, { c: 'self_hp_below', pct: 40 }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'self_hp_above', pct: 40 }), false);
});

test('conditions: ally_hp_below counts the hero too; enemy_hp_below counts living enemies only', () => {
  const ctx = arena([H(), H('huscarl')], [E(), E()]);
  const [a, b] = ctx.sides[0], [x, y] = ctx.sides[1];
  assert.equal(clauseHolds(ctx, a, { c: 'ally_hp_below', pct: 50 }), false);
  hp(a, 1, 4);
  assert.equal(clauseHolds(ctx, a, { c: 'ally_hp_below', pct: 50 }), true);  // the hero itself
  assert.equal(clauseHolds(ctx, b, { c: 'ally_hp_below', pct: 50 }), true);
  hp(x, 1, 10); x.alive = false;                                              // a dead enemy does not count
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_hp_below', pct: 20 }), false);
  hp(y, 1, 10);
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_hp_below', pct: 20 }), true);
});

test('conditions: counts of living units', () => {
  const ctx = arena([H(), H('huscarl'), H('hunter')], [E(), E(), E()]);
  const me = ctx.sides[0][0];
  assert.equal(clauseHolds(ctx, me, { c: 'enemies_at_least', n: 3 }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'enemies_at_least', n: 4 }), false);
  assert.equal(clauseHolds(ctx, me, { c: 'allies_alive_at_most', n: 2 }), false);
  ctx.sides[0][2].alive = false;
  assert.equal(clauseHolds(ctx, me, { c: 'allies_alive_at_most', n: 2 }), true);
  ctx.sides[1][0].alive = false;
  assert.equal(clauseHolds(ctx, me, { c: 'enemies_at_least', n: 3 }), false);
});

test('conditions: status checks look at the right side', () => {
  const ctx = arena([H(), H('huscarl')], [E(), E()]);
  const [a, b] = ctx.sides[0], [x, y] = ctx.sides[1];
  assert.equal(clauseHolds(ctx, a, { c: 'self_lacks', status: 'fury' }), true);
  b.statuses.push({ id: 'fury', dur: 2, at: 0 });
  assert.equal(clauseHolds(ctx, a, { c: 'self_has', status: 'fury' }), false);
  assert.equal(clauseHolds(ctx, a, { c: 'ally_lacks', status: 'fury' }), true);   // the hero lacks it
  a.statuses.push({ id: 'fury', dur: 2, at: 0 });
  assert.equal(clauseHolds(ctx, a, { c: 'ally_lacks', status: 'fury' }), false);
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_has', status: 'mark' }), false);
  x.statuses.push({ id: 'mark', dur: 2, at: 0 });
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_has', status: 'mark' }), true);
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_lacks', status: 'mark' }), true);  // y lacks it
  y.statuses.push({ id: 'mark', dur: 2, at: 0 });
  assert.equal(clauseHolds(ctx, a, { c: 'enemy_lacks', status: 'mark' }), false);
});

test('conditions: skill_ready, round_at_least, enemy_row_alive, enemy_weak_to, always', () => {
  const ctx = arena([H()], [E(), E(), E({ res: { fire: 0, frost: -2500, lightning: 0 } })], 3);
  const me = ctx.sides[0][0];
  assert.equal(clauseHolds(ctx, me, { c: 'always' }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'skill_ready', skill: 'shield_bash' }), true);
  me.cd[me.skillIds.indexOf('shield_bash')] = 2;
  assert.equal(clauseHolds(ctx, me, { c: 'skill_ready', skill: 'shield_bash' }), false);
  assert.equal(clauseHolds(ctx, me, { c: 'skill_ready', skill: 'hex' }), false);          // not in the kit
  assert.equal(clauseHolds(ctx, me, { c: 'round_at_least', n: 3 }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'round_at_least', n: 4 }), false);
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_row_alive', row: 'front' }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_row_alive', row: 'back' }), true);       // slot 2
  ctx.sides[1][2].alive = false;
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_row_alive', row: 'back' }), false);
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_weak_to', element: 'frost' }), false);    // the weak one is dead
  ctx.sides[1][2].alive = true;
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_weak_to', element: 'frost' }), true);
  assert.equal(clauseHolds(ctx, me, { c: 'enemy_weak_to', element: 'fire' }), false);
});

test('selectors: each picks as documented, and every tie goes to the lower id', () => {
  const ctx = arena([H()], [E({ stats: { VIG: 100, SPD: 10, MIT: 5 } }), E({ stats: { VIG: 100, SPD: 30, MIT: 5 } }), E({ stats: { VIG: 100, SPD: 20, MIT: 50 } }), E({ stats: { VIG: 100, SPD: 20, MIT: 5 } })]);
  const me = ctx.sides[0][0], es = ctx.sides[1];
  const pick = (sel, c = es) => pickBySelector(ctx, me, sel, c).id;
  assert.equal(pick('lowest_hp_pct'), 4);   // all equal: lowest id
  assert.equal(pick('lowest_hp'), 4);
  assert.equal(pick('highest_hp'), 4);
  es[2].hp = 100; es[1].hp = 100;
  assert.equal(pick('lowest_hp'), 5);       // 100 vs 100: lower id of the two
  es[1].hp = es[1].maxHp; es[2].hp = es[2].maxHp;
  es[3].hp = es[3].maxHp / 2;
  assert.equal(pick('lowest_hp_pct'), 7);
  assert.equal(pick('highest_hp'), 4);
  assert.equal(pick('fastest'), 5);
  assert.equal(pick('strongest'), 6);
  assert.equal(pick('back_first'), 6);      // first of slots 2 and 3
  assert.equal(pick('back_first', es.slice(0, 2)), 4); // no back row among the candidates: the first candidate
  assert.equal(pick('self', [me]), 0);
});

test('selectors: lowest_hp_pct compares shares, not absolute HP', () => {
  const ctx = arena([H()], [E({ stats: { VIG: 1000 } }), E({ stats: { VIG: 10 } })]);
  const me = ctx.sides[0][0], [big, small] = ctx.sides[1];
  big.hp = 400; small.hp = 20;               // 8% of 5000 vs 40% of 50
  assert.equal(pickBySelector(ctx, me, 'lowest_hp_pct', [big, small]).id, big.id);
  assert.equal(pickBySelector(ctx, me, 'lowest_hp', [big, small]).id, small.id);
});

test('legal targets: melee is limited to the front row; ranged and all_allies are not', () => {
  const ctx = arena([H(), H('huscarl')], [E(), E(), E(), E()]);
  const me = ctx.sides[0][0], sk = (id) => me.basic.id === id ? me.basic : null;
  assert.deepEqual(legalTargets(ctx, me, { target: 'enemy', range: 'melee' }).map((u) => u.id), [4, 5]);
  assert.deepEqual(legalTargets(ctx, me, { target: 'enemy', range: 'ranged' }).map((u) => u.id), [4, 5, 6, 7]);
  ctx.sides[1][0].alive = false; ctx.sides[1][1].alive = false;
  assert.deepEqual(legalTargets(ctx, me, { target: 'all_enemies', range: 'melee' }).map((u) => u.id), [6, 7]);
  assert.deepEqual(legalTargets(ctx, me, { target: 'all_allies', range: 'ranged' }).map((u) => u.id), [0, 1]);
  assert.deepEqual(legalTargets(ctx, me, { target: 'self', range: 'self' }).map((u) => u.id), [0]);
  assert.equal(sk('strike') !== null, true);
});

test('runbook: the first rule whose clauses hold, whose skill is ready and which has a target fires', () => {
  const rules = [
    { when: [{ c: 'self_hp_below', pct: 10 }], do: { a: 'skill', skill: 'hold_the_line' }, target: null },
    { when: [{ c: 'always' }], do: { a: 'skill', skill: 'shield_bash' }, target: 'highest_hp' },
    { when: [{ c: 'always' }], do: { a: 'basic' }, target: 'lowest_hp' },
  ];
  const ctx = arena([H('shieldwarden', rules)], [E(), E()]);
  const me = ctx.sides[0][0];
  assert.equal(chooseHeroAction(ctx, me).skill.id, 'shield_bash');          // rule 1 does not hold
  me.hp = 1;
  assert.equal(chooseHeroAction(ctx, me).skill.id, 'hold_the_line');        // rule 1 now holds
  me.cd[me.skillIds.indexOf('hold_the_line')] = 3;
  assert.equal(chooseHeroAction(ctx, me).skill.id, 'shield_bash');          // on cooldown: next rule
  me.cd[me.skillIds.indexOf('shield_bash')] = 3;
  assert.equal(chooseHeroAction(ctx, me).skill.id, 'strike');               // both on cooldown: basic rule
});

test('runbook: with no rules, or none firing, the fixed fallback is a basic attack on the lowest-share enemy', () => {
  const ctx = arena([H('hunter', [])], [E(), E(), E()]);
  ctx.sides[1][2].hp = 1;
  const c = chooseHeroAction(ctx, ctx.sides[0][0]);
  assert.equal(c.skill.id, 'shoot');
  assert.equal(c.targets[0].id, 6);
  assert.equal(c.cdIndex, -1);
});

test('runbook: a rule needing a target that does not exist is skipped', () => {
  const rules = [{ when: [{ c: 'always' }], do: { a: 'skill', skill: 'hearth_light' }, target: 'lowest_hp_pct' }];
  const ctx = arena([heroDef('hearthkeeper', 20, rules)], [E()]);
  const me = ctx.sides[0][0];
  assert.equal(chooseHeroAction(ctx, me).skill.id, 'hearth_light');          // an ally exists (itself)
  me.alive = false;
  assert.equal(legalTargets(ctx, me, me.skills[0]).length, 0);
});

test('monster: specials before the archetype skill, then the basic attack; heals only below 80%', () => {
  const mk = (skills, attack = 'melee') => mkDef({ skills, attack, realm: 'midgard' });
  const ctx = arena([H()], [mk(['war_cry', 'smash']), mk(['mend'], 'magic'), mk(['smash'])]);
  const [a, healer, plain] = ctx.sides[1];
  assert.equal(chooseMonsterAction(ctx, a).skill.id, 'war_cry');
  a.cd[0] = 2;
  assert.equal(chooseMonsterAction(ctx, a).skill.id, 'smash');
  a.cd[1] = 2;
  assert.equal(chooseMonsterAction(ctx, a).skill.id, 'strike');
  assert.equal(chooseMonsterAction(ctx, healer).skill.id, 'bolt');            // nobody hurt: basic attack
  plain.hp = Math.floor(plain.maxHp * 79 / 100);
  const heal = chooseMonsterAction(ctx, healer);
  assert.equal(heal.skill.id, 'mend');
  assert.equal(heal.targets[0].id, plain.id);
  plain.hp = Math.floor(plain.maxHp * 80 / 100);
  assert.equal(chooseMonsterAction(ctx, healer).skill.id, 'bolt');            // exactly 80%: not below
});

test('monster: effective skills take the dungeon element and realm rider', () => {
  const m = makeUnit(mkDef({ skills: ['smash', 'bolt_storm'], realm: 'helheim' }), 4, 1, 0, null, content);
  assert.equal(m.skills[0].element, 'frost');
  assert.deepEqual(m.skills[0].riders, [{ status: 'chill', chance: 4000, duration: 2, on: 'target' }]);
  const s = makeUnit(mkDef({ skills: ['shieldbash'], realm: 'midgard' }), 5, 1, 1, null, content);
  assert.deepEqual(s.skills[0].riders.map((r) => r.status), ['burn', 'bulwark']);
  const c = makeUnit(mkDef({ skills: ['curse'], realm: 'asgard' }), 6, 1, 2, null, content);
  assert.deepEqual(c.skills[0].riders.map((r) => r.status), ['mark']);        // no realm rider
  assert.equal(c.skills[0].element, 'lightning');
});

test('monster: an affix that marks adds a rider to damaging skills only', () => {
  const m = makeUnit(mkDef({ skills: ['smash', 'mend'], realm: 'midgard', extraRiders: [{ status: 'mark', chance: 2500, duration: 2, on: 'target' }] }), 4, 1, 0, null, content);
  assert.deepEqual(m.skills[0].riders.map((r) => r.status), ['burn', 'mark']);
  assert.deepEqual(m.skills[1].riders, []);
});
