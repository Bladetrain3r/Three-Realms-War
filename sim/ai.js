// Choosing an action: a hero's runbook (DESIGN.md 9) and a monster's fixed priority (10.4).
import { legalTargets, pickBySelector, clauseHolds } from './targeting.js';

// Returns { skill, cdIndex, targets, main } or null when the skill has no legal target.
function plan(ctx, u, skill, cdIndex, selector) {
  const legal = legalTargets(ctx, u, skill);
  if (legal.length === 0) return null;
  if (skill.target === 'enemy' || skill.target === 'ally') {
    const t = pickBySelector(ctx, u, selector, legal);
    return { skill, cdIndex, targets: [t], main: t.id };
  }
  return { skill, cdIndex, targets: legal, main: -1 };
}

export function chooseHeroAction(ctx, u) {
  for (const rule of u.def.runbook.rules) {
    if (!rule.when.every((cl) => clauseHolds(ctx, u, cl))) continue;
    const a = rule.do;
    if (a.a === 'brace') return { brace: true };
    if (a.a === 'basic') {
      const p = plan(ctx, u, u.basic, -1, rule.target);
      if (p) return p;
      continue;
    }
    const i = u.skillIds.indexOf(a.skill);
    if (i < 0 || u.cd[i] > 0) continue;
    const p = plan(ctx, u, u.skills[i], i, rule.target);
    if (p) return p;
  }
  return plan(ctx, u, u.basic, -1, 'lowest_hp_pct');
}

export function chooseMonsterAction(ctx, u) {
  for (let i = 0; i < u.skills.length; i++) {
    const sk = u.skills[i];
    if (u.cd[i] > 0) continue;
    if (sk.type === 'heal') {
      const hurt = legalTargets(ctx, u, sk).filter((x) => x.hp * 10000 < sk.healBelowBp * x.maxHp);
      if (hurt.length === 0) continue;
      const t = pickBySelector(ctx, u, 'lowest_hp_pct', hurt);
      return { skill: sk, cdIndex: i, targets: [t], main: t.id };
    }
    const p = plan(ctx, u, sk, i, 'lowest_hp_pct');
    if (p) return p;
  }
  return plan(ctx, u, u.basic, -1, 'lowest_hp_pct');
}
