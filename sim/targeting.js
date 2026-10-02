// Legal targets, selectors and runbook conditions (DESIGN.md 5.4 and 9).
import { statOf, hasStatus } from './unit.js';

export const isFront = (u) => u.slot < 2;
const living = (list) => list.filter((u) => u.alive);

export function alliesOf(ctx, u) { return living(ctx.sides[u.side]); }
export function enemiesOf(ctx, u) { return living(ctx.sides[1 - u.side]); }

export function legalTargets(ctx, u, skill) {
  switch (skill.target) {
    case 'self': return [u];
    case 'ally': case 'all_allies': return alliesOf(ctx, u);
    default: {
      const foes = enemiesOf(ctx, u);
      if (skill.range === 'melee') {
        const front = foes.filter(isFront);
        if (front.length) return front;
      }
      return foes;
    }
  }
}

// Lower id wins every tie; candidates arrive in ascending id order.
function best(list, better) {
  let b = list[0];
  for (let i = 1; i < list.length; i++) if (better(list[i], b)) b = list[i];
  return b;
}

export function pickBySelector(ctx, u, selector, cands) {
  switch (selector) {
    case 'lowest_hp': return best(cands, (a, b) => a.hp < b.hp);
    case 'highest_hp': return best(cands, (a, b) => a.hp > b.hp);
    case 'fastest': return best(cands, (a, b) => statOf(a, 'SPD', ctx.content) > statOf(b, 'SPD', ctx.content));
    case 'strongest': {
      const pow = (x) => Math.max(statOf(x, 'MIT', ctx.content), statOf(x, 'ARC', ctx.content));
      return best(cands, (a, b) => pow(a) > pow(b));
    }
    case 'back_first': {
      const back = cands.filter((x) => !isFront(x));
      return back.length ? back[0] : cands[0];
    }
    case 'self': return cands.includes(u) ? u : cands[0];
    default: return best(cands, (a, b) => a.hp * b.maxHp < b.hp * a.maxHp); // lowest_hp_pct
  }
}

const hpBelow = (x, pct) => x.hp * 100 < pct * x.maxHp;

export function clauseHolds(ctx, u, cl) {
  const allies = alliesOf(ctx, u), foes = enemiesOf(ctx, u);
  switch (cl.c) {
    case 'always': return true;
    case 'self_hp_below': return hpBelow(u, cl.pct);
    case 'self_hp_above': return !hpBelow(u, cl.pct);
    case 'ally_hp_below': return allies.some((x) => hpBelow(x, cl.pct));
    case 'enemy_hp_below': return foes.some((x) => hpBelow(x, cl.pct));
    case 'enemies_at_least': return foes.length >= cl.n;
    case 'allies_alive_at_most': return allies.length <= cl.n;
    case 'self_has': return hasStatus(u, cl.status);
    case 'self_lacks': return !hasStatus(u, cl.status);
    case 'ally_lacks': return allies.some((x) => !hasStatus(x, cl.status));
    case 'enemy_has': return foes.some((x) => hasStatus(x, cl.status));
    case 'enemy_lacks': return foes.some((x) => !hasStatus(x, cl.status));
    case 'skill_ready': { const i = u.skillIds.indexOf(cl.skill); return i >= 0 && u.cd[i] === 0; }
    case 'round_at_least': return ctx.round >= cl.n;
    case 'enemy_row_alive': return foes.some((x) => (cl.row === 'front') === isFront(x));
    case 'enemy_weak_to': return foes.some((x) => x.def.res[cl.element] < 0);
    default: throw new Error(`unknown condition ${cl.c}`);
  }
}
