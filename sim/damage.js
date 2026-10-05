// The damage pipeline of DESIGN.md 5.5. The order of the steps is the rule; every step floors.
import { idiv, mulbp } from './arith.js';

const BP = 10000;

// p: { atk, power, def, attackerLevel, affinity, elemRes, takenBp, variance, critRoll, critChance, critDmg }
// c: tables.combat. Returns { steps, damage, crit } where steps lists each intermediate value.
export function damageSteps(p, c) {
  const steps = [];
  const raw = mulbp(p.atk, p.power);
  steps.push(raw);
  const mit = Math.min(c.mitCapBp, idiv(p.def * BP, p.def + c.mitBase + c.mitPerLevel * p.attackerLevel));
  steps.push(mit);
  let d = mulbp(raw, BP - mit);
  steps.push(d);
  if (p.affinity) { d = mulbp(d, c.realmDamageBp); steps.push(d); }
  const res = p.elemRes < c.resMin ? c.resMin : p.elemRes > c.resMax ? c.resMax : p.elemRes;
  d = mulbp(d, BP - res);
  steps.push(d);
  d = mulbp(d, BP + p.takenBp);
  steps.push(d);
  d = mulbp(d, p.variance);
  steps.push(d);
  const crit = p.critRoll < p.critChance;
  if (crit) { d = mulbp(d, p.critDmg); steps.push(d); }
  const damage = d < 1 ? 1 : d;
  steps.push(damage);
  return { steps, damage, crit };
}
