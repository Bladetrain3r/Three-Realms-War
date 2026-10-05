// The rules layer, part 6: paid training (DESIGN.md 11.8). A hero can be bought up to training.maxLevel; xp earned by diving does the rest.
import { GameError } from './gameerror.js';
import { trainingCost } from './progress.js';
import { clone, findHero, assertFree } from './game.js';

export function train(save, content, heroId, levels = 1) {
  assertFree(save, 'training');
  const t = content.tables.training, h = findHero(save, heroId);
  if (!Number.isInteger(levels) || levels < 1) throw new GameError('bad_levels', 'train one or more whole levels');
  if (h.level >= t.maxLevel) throw new GameError('train_cap', `${h.name} is already level ${h.level}; training stops at level ${t.maxLevel} (earn the rest in the dungeons)`);
  if (h.level + levels > t.maxLevel) throw new GameError('train_cap', `training stops at level ${t.maxLevel}: at most ${t.maxLevel - h.level} more level${t.maxLevel - h.level === 1 ? '' : 's'} for ${h.name}`);
  const cost = trainingCost(h.level, levels, t);
  if (save.currency.hacksilver <= 0) throw new GameError('in_debt', save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve first` : 'you have no hacksilver');
  if (save.currency.hacksilver < cost) throw new GameError('cannot_afford', `training ${h.name} up ${levels} level${levels === 1 ? '' : 's'} costs ${cost} hacksilver (you have ${save.currency.hacksilver})`);
  const next = clone(save), hero = findHero(next, heroId);
  next.currency.hacksilver -= cost; hero.level += levels;
  return next;
}
