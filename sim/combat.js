// One encounter, 4 v 4 (DESIGN.md section 5). Everything random comes from ctx.rng, drawn in the order the rules state.
import { mulbp } from './arith.js';
import { makeUnit, statOf, takenBp, hasStatus } from './unit.js';
import { damageSteps } from './damage.js';
import { addStatus, tryRider, tickStatuses, endTurn, down } from './status.js';
import { chooseHeroAction, chooseMonsterAction } from './ai.js';

export function makeContext(content, rng, events) {
  const statusIdx = Object.create(null);
  content.statuses.forEach((s, i) => { statusIdx[s.id] = i; });
  const skillTable = [], skillIdxById = Object.create(null);
  return {
    content, rng, events, statusIdx, skillTable, round: 0, sides: [[], []],
    emit(e) { events.push(e); },
    skillIndex(id) {
      let i = skillIdxById[id];
      if (i === undefined) { i = skillTable.length; skillTable.push(id); skillIdxById[id] = i; }
      return i;
    },
  };
}

// 5.2: living units by SPD descending, ties to the lower id.
export function turnOrder(ctx, units) {
  const rows = units.filter((u) => u.alive).map((u) => ({ u, spd: statOf(u, 'SPD', ctx.content) }));
  rows.sort((a, b) => b.spd - a.spd || a.u.id - b.u.id);
  return rows.map((r) => r.u);
}

function hit(ctx, u, t, skill) {
  const { content, rng } = ctx, c = content.tables.combat;
  let phys = skill.type === 'physical';
  if (skill.type === 'best') phys = statOf(u, 'MIT', content) >= statOf(u, 'ARC', content);
  const el = skill.element;
  const variance = c.varianceMin + rng.range(c.varianceSpan);
  const critRoll = rng.range(10000);
  const r = damageSteps({
    atk: statOf(u, phys ? 'MIT' : 'ARC', content), power: skill.power, def: statOf(t, phys ? 'GRD' : 'WRD', content),
    attackerLevel: u.def.level, affinity: el !== 'none' && el === content.realmById[u.def.realm].element,
    elemRes: el === 'none' ? 0 : t.def.res[el], takenBp: takenBp(t, content),
    variance, critRoll, critChance: u.def.crit, critDmg: u.def.critDmg,
  }, c);
  const dealt = Math.min(r.damage, t.hp);
  t.hp -= dealt;
  ctx.emit([4, u.id, t.id, r.damage, r.crit ? 1 : 0, t.hp]);
  if (t.hp === 0) down(ctx, t);
  const ls = (skill.lifestealBp || 0) + (u.def.lifestealBp || 0);
  if (ls > 0 && u.alive) {
    const healed = Math.min(mulbp(dealt, ls), u.maxHp - u.hp);
    u.hp += healed;
    ctx.emit([5, u.id, u.id, healed, u.hp]);
  }
  if (t.alive) for (const rd of skill.riders) if (rd.on === 'target') tryRider(ctx, u, t, rd);
}

function heal(ctx, u, t, skill) {
  const amount = mulbp(mulbp(statOf(u, 'ARC', ctx.content), skill.power), 10000 + (u.def.healBp || 0)); // healBp: a maxed paragon healer (4.6)
  const actual = Math.min(amount, t.maxHp - t.hp);
  t.hp += actual;
  ctx.emit([5, u.id, t.id, actual, t.hp]);
  for (const rd of skill.riders) if (rd.on === 'target') tryRider(ctx, u, t, rd);
}

function execute(ctx, u, choice) {
  const { skill, cdIndex, targets, main } = choice;
  ctx.emit([3, u.id, ctx.skillIndex(skill.id), main]);
  if (cdIndex >= 0) u.cd[cdIndex] = skill.cooldown;
  for (const t of targets) { // ascending id
    if (!t.alive) continue;
    if (skill.type === 'heal') heal(ctx, u, t, skill);
    else if (skill.type === 'utility') { for (const rd of skill.riders) if (rd.on === 'target') tryRider(ctx, u, t, rd); }
    else hit(ctx, u, t, skill);
  }
  if (u.alive) for (const rd of skill.riders) if (rd.on === 'self') addStatus(ctx, u, u, rd.status, rd.duration);
}

function takeTurn(ctx, u) {
  u.turn++;
  ctx.emit([2, u.id]);
  for (let i = 0; i < u.cd.length; i++) if (u.cd[i] > 0) u.cd[i]--;
  tickStatuses(ctx, u);
  if (!u.alive) return;
  if (hasStatus(u, 'shock')) { ctx.emit([10, u.id, 0]); endTurn(ctx, u); return; }
  const choice = u.def.kind === 'hero' ? chooseHeroAction(ctx, u) : chooseMonsterAction(ctx, u);
  if (choice.brace) {
    ctx.emit([3, u.id, ctx.skillIndex('brace'), -1]);
    addStatus(ctx, u, u, 'bulwark', ctx.content.tables.combat.braceTurns);
  } else execute(ctx, u, choice);
  endTurn(ctx, u);
}

const anyAlive = (list) => list.some((u) => u.alive);

// heroes, enemies: resolved unit definitions. heroHp: current HP per hero (null for full). Returns the outcome and HP.
export function resolveEncounter(ctx, { index, heroes, heroHp, enemies }) {
  const slotOf = (d, i) => (d.slot === undefined ? i : d.slot);
  const hs = heroes.map((d, i) => makeUnit(d, slotOf(d, i), 0, slotOf(d, i), heroHp ? heroHp[i] : null, ctx.content));
  const es = enemies.map((d, i) => makeUnit(d, 4 + slotOf(d, i), 1, slotOf(d, i), null, ctx.content));
  for (const side of [hs, es]) {
    side.forEach((u, i) => { if (u.slot < 0 || u.slot > 3 || (i > 0 && u.slot <= side[i - 1].slot)) throw new RangeError('units must have distinct slots 0..3 in ascending order'); });
  }
  ctx.sides = [hs, es];
  ctx.emit([0, index, es.length]);
  const cap = ctx.content.tables.combat.roundCap, all = hs.concat(es);
  let outcome = null, rounds = 0;
  for (let r = 1; r <= cap && outcome === null; r++) {
    rounds = r; ctx.round = r;
    ctx.emit([1, r]);
    for (const u of turnOrder(ctx, all)) {
      if (!u.alive) continue;
      takeTurn(ctx, u);
      if (!anyAlive(es)) { outcome = 1; break; }
      if (!anyAlive(hs)) { outcome = 0; break; }
    }
  }
  if (outcome === null) outcome = 0;
  ctx.emit([11, outcome, rounds]);
  return { outcome, rounds, heroHp: hs.map((u) => u.hp), enemyHp: es.map((u) => u.hp) };
}
