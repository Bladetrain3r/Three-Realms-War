// The rules layer, part 4: resting the roster (DESIGN.md 11.6). Idle time costs hacksilver and may leave the balance negative.
import { GameError } from './gameerror.js';
import { clone, assertFree } from './game.js';

// What a rest would cost now: every hero costs `restCost`, an injured one `restCostWounded` instead.
export function restCost(save, content) {
  const r = content.tables.injury;
  let healthy = 0, wounded = 0;
  for (const h of save.heroes) { if (h.injury > 0) wounded++; else healthy++; }
  return { healthy, wounded, cost: healthy * r.restCost + wounded * r.restCostWounded };
}

// One rest = one delve's worth of idle time for everybody: every injury counter drops by 1. You may spend more than you have
// (the balance goes negative), but you cannot rest unless the balance is positive when you start.
export function rest(save, content) {
  assertFree(save, 'resting');
  if (save.currency.hacksilver <= 0) throw new GameError('in_debt', save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve before resting` : 'you have no hacksilver; earn some in a delve before resting');
  if (!save.heroes.some((h) => h.injury > 0)) throw new GameError('nobody_injured', 'nobody is injured, so there is nothing to rest');
  const next = clone(save), c = restCost(save, content), healed = [];
  next.currency.hacksilver -= c.cost;
  for (const h of next.heroes) if (h.injury > 0) { h.injury--; if (h.injury === 0) healed.push(h.id); }
  return { save: next, summary: { ...c, healed } };
}
