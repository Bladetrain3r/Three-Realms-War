// The rules layer, part 7: paragon stars (DESIGN.md 4.6). A Paragon Point (a rare expedition drop) plus hearts of the hero's realm buy one
// star on one stat; a star raises the growth of every level gained after it, never retroactively.
import { GameError } from './gameerror.js';
import { STATS } from './content.js';
import { clone, findHero, assertFree } from './game.js';
import { paragonStars } from './hero.js';

// Hearts for the hero's next star: heartBase x (stars the hero already has + 1), of the hero's realm.
export function paragonCost(hero, content) {
  return content.tables.paragon.heartBase * (paragonStars(hero) + 1);
}

export function addParagonStar(save, content, heroId, stat) {
  assertFree(save, 'spending a Paragon Point');
  const hero = findHero(save, heroId), t = content.tables.paragon, cls = content.heroById[hero.class], realm = content.realmById[cls.realm];
  if (!STATS.includes(stat)) throw new GameError('bad_stat', `there is no stat "${stat}"`);
  const have = (hero.paragon && hero.paragon[stat]) || [];
  if (have.length >= t.maxPerStat) throw new GameError('paragon_max', `${hero.name} already has ${t.maxPerStat} stars on ${stat}`);
  if (save.paragonPoints < 1) throw new GameError('no_point', 'you have no Paragon Point (they drop, rarely, from expedition site bosses)');
  const cost = paragonCost(hero, content);
  if (save.materials[realm.rareMaterial] < cost) throw new GameError('cannot_afford', `the next star costs ${cost} ${realm.rareMaterial.split('_').join(' ')} (you have ${save.materials[realm.rareMaterial]})`, { cost });
  const next = clone(save), h = findHero(next, heroId);
  next.paragonPoints -= 1; next.materials[realm.rareMaterial] -= cost;
  h.paragon = { ...(h.paragon || {}), [stat]: [...have, h.level] };
  return next;
}
