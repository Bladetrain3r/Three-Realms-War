// Boss phases (DESIGN.md 10.7): a legendary boss is one monster whose skills and stats change as its HP falls through thresholds.
import { STATS } from './content.js';
import { effectiveSkill } from './unit.js';

export const PHASE = 15; // event opcode: [15, unit id, phase index]

// Called at the start of a unit's turn. Enters every phase whose threshold the unit's HP has reached (hp <= atBp/10000 of max HP),
// in order; entering a phase swaps the skill list, clears the cooldowns and adds the phase's percentage modifiers for good.
export function enterPhases(ctx, u) {
  const ph = u.def.phases;
  if (!ph) return;
  while (u.phase + 1 < ph.length && u.hp * 10000 <= ph[u.phase + 1].atBp * u.maxHp) {
    u.phase++;
    const p = ph[u.phase];
    u.skillIds = p.skills.slice();
    u.skills = p.skills.map((id) => effectiveSkill(ctx.content.skillById[id], u.def, ctx.content));
    u.cd = u.skills.map(() => 0);
    for (const s of STATS) if (p.mods[s]) u.bonus[s] = (u.bonus[s] || 0) + p.mods[s];
    ctx.emit([PHASE, u.id, u.phase]);
  }
}
