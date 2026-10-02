// The rules layer, part 2: running a delve and applying its result (DESIGN.md 5.9, 11 and 19).
import { mulbp } from './arith.js';
import { GameError } from './gameerror.js';
import { buildHeroUnit } from './hero.js';
import { createReplay } from './replay.js';
import { xpToNext } from './progress.js';
import { clone, findHero, itemsById, nextSeed, stashCount } from './game.js';

function gainXp(hero, xp, content) {
  const cap = content.tables.stats.levelCap, p = content.tables.progress, from = hero.level;
  hero.xp += xp;
  while (hero.level < cap && hero.xp >= xpToNext(hero.level, p)) { hero.xp -= xpToNext(hero.level, p); hero.level++; }
  if (hero.level >= cap) hero.xp = 0;
  return hero.level - from;
}

// Mutates the (cloned) save with the result recorded in the replay. Returns a summary for the UI.
export function applyDelveResult(save, content, replay, partyIds) {
  const res = replay.result, p = content.tables.progress, realm = replay.inputs.realm, level = replay.inputs.level;
  const summary = { outcome: res.outcome, encounters: res.encounters, cleared: res.cleared, xp: 0, levelUps: [], injured: [], healed: [], hacksilver: 0, materials: [],
    reputation: 0, items: [], droppedItems: 0, threads: 0, unlocked: null };
  const benchedHealthy = save.heroes.filter((h) => !partyIds.includes(h.id) && h.injury === 0).map((h) => h.id);

  for (const h of save.heroes) {
    if (!partyIds.includes(h.id) && h.injury > 0) { h.injury--; if (h.injury === 0) summary.healed.push(h.id); }
  }
  res.injured.forEach((i) => { const h = findHero(save, partyIds[i]); h.injury = content.tables.injury.delves; summary.injured.push(h.id); });

  if (res.outcome === 1) {
    const rw = res.rewards;
    summary.xp = rw.xp;
    for (const id of partyIds) { const h = findHero(save, id), from = h.level; if (gainXp(h, rw.xp, content) > 0) summary.levelUps.push({ heroId: id, name: h.name, from, to: h.level }); }
    for (const id of benchedHealthy) { const h = findHero(save, id), from = h.level; if (gainXp(h, mulbp(rw.xp, p.restXpBp), content) > 0) summary.levelUps.push({ heroId: id, name: h.name, from, to: h.level }); }
    save.currency.hacksilver += rw.hacksilver; summary.hacksilver = rw.hacksilver;
    for (const r of content.realms) for (const key of [r.material, r.rareMaterial]) {
      const n = rw.materials[key] || 0;
      if (n > 0) { save.materials[key] += n; summary.materials.push({ id: key, n }); }
    }
    save.reputation[realm] += rw.reputation; summary.reputation = rw.reputation;
    save.threads += rw.threads; summary.threads = rw.threads;
    for (const it of rw.items) {
      if (stashCount(save) >= content.items.stashMax) { summary.droppedItems++; continue; }
      const added = { ...clone(it), id: save.nextId++ };
      save.items.push(added); summary.items.push(added.id);
    }
    if (level === save.unlocked[realm] && level < p.unlockCap) { save.unlocked[realm]++; summary.unlocked = { realm, level: save.unlocked[realm] }; }
  }
  return summary;
}

// Plays a delve with the save's party. force: ids of injured heroes the player chooses to send anyway (half stats).
export function playDelve(save, content, { realm, level, force = [] }) {
  const next = clone(save), r = content.realmById[realm];
  if (!r) throw new GameError('unknown_realm', `there is no realm "${realm}"`);
  if (!Number.isInteger(level) || level < 1 || level > next.unlocked[realm]) throw new GameError('level_locked', `${r.name} is open up to level ${next.unlocked[realm]}`);
  const heroes = next.party.map((id) => findHero(next, id));
  for (const f of force) if (!next.party.includes(f)) throw new GameError('force_not_in_party', 'only a hero in the party can be forced');
  for (const h of heroes) if (h.injury > 0 && !force.includes(h.id)) throw new GameError('injured_not_forced', `${h.name} is injured for ${h.injury} more delve${h.injury === 1 ? '' : 's'}; rest them or send them at half strength`);
  const byId = itemsById(next);
  const party = heroes.map((h) => buildHeroUnit(h, byId, content, { forced: h.injury > 0 }));
  const seed = nextSeed(next);
  const replay = createReplay({ realm, level, seed, party, setAllowed: next.reputation[realm] >= content.tables.progress.rep.trusted }, content);
  const summary = applyDelveResult(next, content, replay, heroes.map((h) => h.id));
  return { save: next, replay, summary };
}
