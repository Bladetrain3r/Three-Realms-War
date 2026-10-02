// Stat curves and the final-stat rule (DESIGN.md section 4).
import { idiv, mulbp } from './arith.js';

const BP = 10000;

// 4.2: level-1 value s1 -> value at `level`; level 50 is exactly 10x level 1.
export function heroBase(s1, level, t) {
  return s1 + idiv(s1 * t.growthMul * (level - 1), t.growthDiv);
}

// 4.3: realm affinity on one stat.
export function withAffinity(value, t) {
  return mulbp(value, BP + t.affinityBp);
}

// 4.5: the enemy curve, then (optionally) the signature or boss multiplier, then the realm tilt.
export function enemyScaled(p, level, e) {
  const x = level - 1;
  return p + idiv(p * (e.curveK * x * e.curveDiv + e.curveQ * x * x), e.curveDiv * e.curveDiv);
}

export function enemyBase(p, level, e, { multiplierBp = 0, tilt = false } = {}) {
  let v = enemyScaled(p, level, e);
  if (multiplierBp) v = mulbp(v, multiplierBp);
  if (tilt) v = mulbp(v, BP + e.tiltBp);
  return v;
}

// 4.4 steps 4 to 6: percentage modifiers, then the injured halving, then a floor of 1.
export function finalStat(base, pctBp, injured, t) {
  let v = mulbp(base, Math.max(0, BP + pctBp));
  if (injured) v = mulbp(v, t.injuredBp);
  return v < 1 ? 1 : v;
}

export function maxHp(finalVig, t) {
  return t.hpPerVig * finalVig;
}
