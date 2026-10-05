// One floor of an expedition site (DESIGN.md 12.3, 12.4): its encounters, fought back to back, with a death save after every won
// encounter. Pure and deterministic from { realm, level, seed, party, heroHp, boss }.
import { mulbp } from './arith.js';
import { createRng } from './prng.js';
import { makeContext, resolveEncounter } from './combat.js';
import { generateEncounter, planOf } from './delve.js';
import { buildLegend } from './monster.js';

// Event opcode 14, DEATH_SAVE: [14, hero slot, 0 revived at 1 HP | 1 died for good | 2 saved by a Thread of the Norns].
export const DEATH_SAVE = 14;

// 12.4: a death save at `deathSaveBp` kills when the draw is below it.
export const deathSaveKills = (draw, x) => draw < x.deathSaveBp;

// input: { realm, level, seed, boss (the floor's last encounter is the site boss), party: [hero unit defs, each maybe with thread: true],
//          heroHp: [hp per party entry, or null for full] }. Party entries are slots 0.. in order.
export function resolveFloor(input, content) {
  if (input.party.length < 1 || input.party.length > 4) throw new RangeError('a party has 1 to 4 heroes');
  const x = content.tables.expedition, c = content.tables.combat, rng = createRng(input.seed), events = [], ctx = makeContext(content, rng, events);
  const encounters = [];
  if (input.legend) { // 10.7: a legendary boss fights alone, in the front row, over a longer round cap
    encounters.push([{ ...buildLegend(content.legendById[input.legend], input.level, input.realm, content), slot: 0 }]);
  } else for (let k = 0; k < x.encountersPerFloor; k++) encounters.push(generateEncounter(rng, { realm: input.realm, level: input.level, kind: input.boss && k === x.encountersPerFloor - 1 ? 'boss' : 'middle' }, content));
  const defs = input.party.map((d, i) => ({ ...d, slot: i }));
  const hp = defs.map((d, i) => (input.heroHp && input.heroHp[i] !== null && input.heroHp[i] !== undefined ? Math.min(d.maxHp, input.heroHp[i]) : d.maxHp));
  const gone = defs.map(() => false), died = [], injured = [], threaded = [];
  let cleared = 0, outcome = 1;
  const fall = (i) => { // one death save for the fallen hero i: a Thread holds them, otherwise the draw decides (12.4)
    const draw = rng.range(10000);
    if (defs[i].thread === true) { hp[i] = 1; threaded.push(i); events.push([DEATH_SAVE, i, 2]); }
    else if (deathSaveKills(draw, x)) { gone[i] = true; died.push(i); events.push([DEATH_SAVE, i, 1]); }
    else { hp[i] = 1; injured.push(i); events.push([DEATH_SAVE, i, 0]); }
  };
  for (let k = 0; k < encounters.length; k++) {
    const live = defs.filter((_, i) => !gone[i]), liveHp = live.map((d) => hp[d.slot]);
    const r = resolveEncounter(ctx, { index: k, heroes: live, heroHp: liveHp, enemies: encounters[k], roundCap: input.legend ? content.tables.legend.roundCap : 0 });
    live.forEach((d, j) => { hp[d.slot] = r.heroHp[j]; });
    if (r.outcome === 0) { // a lost encounter: every hero falls for good, unless a Thread holds them
      outcome = 0;
      for (let i = 0; i < defs.length; i++) {
        if (gone[i]) continue;
        if (defs[i].thread === true) { hp[i] = 1; threaded.push(i); events.push([DEATH_SAVE, i, 2]); } else { gone[i] = true; died.push(i); events.push([DEATH_SAVE, i, 1]); }
      }
      break;
    }
    cleared++;
    for (let i = 0; i < defs.length; i++) if (!gone[i] && hp[i] === 0) fall(i);
    // healed after every won encounter, the last of the floor included: the next floor's first fight is also "between encounters" (12.4)
    for (let i = 0; i < defs.length; i++) if (!gone[i]) { hp[i] = Math.min(defs[i].maxHp, hp[i] + mulbp(defs[i].maxHp, c.restHealBp)); events.push([12, i, hp[i]]); }
  }
  events.push([13, outcome, cleared]);
  return { events, skills: ctx.skillTable, plan: planOf(encounters), result: { outcome, encounters: encounters.length, cleared, hpAfter: hp, died, injured, threaded } };
}
