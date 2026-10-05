// The rules layer, part 5: expeditions (DESIGN.md 12). The map is never stored: it is regenerated from `expedition.seed`.
// Every action is a pure function (save, content, ...) -> { save, ... } or throws GameError.
import { mulbp } from './arith.js';
import { createRng } from './prng.js';
import { GameError } from './gameerror.js';
import { buildHeroUnit } from './hero.js';
import { createFloorReplay } from './replay.js';
import { encounterRewards } from './progress.js';
import { generateItem, legendItem } from './items.js';
import { lairSpecs, lairsFor, legendIlvl } from './game-legends.js';
import { mapFromSeed, moveCost, cellsWithin } from './mapgen.js';
import { clone, findHero, itemsById, nextSeed, stashCount, addHero } from './game.js';
import { gainXp } from './game-delve.js';

const TIER = ['plain', 'fine', 'runed', 'heirloom', 'legendary'];
const cache = Object.create(null); // maps are pure functions of (seed, level); this only saves recomputing them
export function expeditionMap(ex, content) {
  const key = `${ex.seed}:${ex.level}:${ex.lairs.join(',')}`;
  if (cache[key] === undefined) cache[key] = mapFromSeed(ex.seed, ex.level, content.tables.expedition, lairSpecs(ex.lairs, content), content.tables.legend);
  return cache[key];
}
export const emptyPack = () => ({ xp: 0, hacksilver: 0, reputation: 0, threads: 0, paragon: 0, materials: {}, items: [], legends: [] });

function requireExpedition(save) {
  if (save.expedition === null) throw new GameError('no_expedition', 'there is no expedition under way');
  return save.expedition;
}
export const siteAt = (map, x, y) => map.sites.find((s) => s.x === x && s.y === y) || null;
function reveal(ex, map, content) {
  const x = content.tables.expedition, seen = ex.seen.split('');
  for (const i of cellsWithin(ex.x, ex.y, x.revealRadius, map.width, map.height)) seen[i] = '1';
  ex.seen = seen.join('');
}

// ---- starting ---------------------------------------------------------------------------------------------------------------
export function startExpedition(save, content, { realm, level, provisions, force = [] }) {
  const x = content.tables.expedition, r = content.realmById[realm];
  if (save.expedition !== null) throw new GameError('on_expedition', 'an expedition is already under way');
  if (!r) throw new GameError('unknown_realm', `there is no realm "${realm}"`);
  if (!Number.isInteger(level) || level < 1 || level > save.unlocked[realm]) throw new GameError('level_locked', `${r.name} is open up to level ${save.unlocked[realm]}`);
  if (!Number.isInteger(provisions) || provisions < 0 || provisions > x.provisionMax) throw new GameError('bad_provisions', `carry 0 to ${x.provisionMax} provisions`);
  const cost = provisions * x.provisionCost;
  if (save.currency.hacksilver <= 0 && cost > 0) throw new GameError('in_debt', save.currency.hacksilver < 0 ? `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve first` : 'you have no hacksilver for provisions');
  if (save.currency.hacksilver < cost) throw new GameError('cannot_afford', `${provisions} provisions cost ${cost} hacksilver (you have ${save.currency.hacksilver})`);
  const heroes = save.party.map((id) => findHero(save, id));
  for (const f of force) if (!save.party.includes(f)) throw new GameError('force_not_in_party', 'only a hero in the party can be forced');
  for (const h of heroes) if (h.injury > 0 && !force.includes(h.id)) throw new GameError('injured_not_forced', `${h.name} is injured for ${h.injury} more delve${h.injury === 1 ? '' : 's'}; rest them or send them at half strength`);
  const next = clone(save);
  next.currency.hacksilver -= cost;
  const ex = { realm, level, seed: nextSeed(next), provisions, bought: provisions, x: 0, y: 0, seen: '0'.repeat(x.width * x.height), party: save.party.slice(), hp: save.party.map(() => -1), floors: [], site: null, pack: emptyPack(), steps: 0, lairs: lairsFor(save, content, level) };
  const map = expeditionMap(ex, content);
  ex.x = map.start.x; ex.y = map.start.y; ex.floors = map.sites.map(() => 0);
  reveal(ex, map, content);
  next.expedition = ex;
  return { save: next, summary: { provisions, cost, sites: map.sites.length } };
}

// ---- banking and ending ------------------------------------------------------------------------------------------------------
// Bank the pack into the save (a safe return). Items beyond the stash limit are lost and counted.
function bank(next, content, how) {
  const ex = next.expedition, p = ex.pack, out = { how, xp: p.xp, hacksilver: p.hacksilver, reputation: p.reputation, threads: p.threads, paragon: p.paragon, materials: [], items: 0, droppedItems: 0, levelUps: [] };
  for (const id of ex.party) { const h = findHero(next, id), from = h.level; if (gainXp(h, p.xp, content) > 0) out.levelUps.push({ heroId: id, name: h.name, from, to: h.level }); }
  next.currency.hacksilver += p.hacksilver; next.reputation[ex.realm] += p.reputation; next.threads += p.threads; next.paragonPoints += p.paragon;
  for (const r of content.realms) for (const key of [r.material, r.rareMaterial]) if (p.materials[key]) { next.materials[key] += p.materials[key]; out.materials.push({ id: key, n: p.materials[key] }); }
  for (const it of p.items) { if (it.tier !== 'legendary' && stashCount(next) >= content.items.stashMax) out.droppedItems++; else { next.items.push(it); out.items++; } } // a legendary item is never turned away
  out.legends = p.legends.slice();
  for (const id of p.legends) if (!next.legendsBeaten.includes(id)) { next.legendsBeaten.push(id); if (content.legendById[id].final) next.won = true; }
  next.expedition = null;
  return out;
}

export function returnHome(save, content) {
  const ex = requireExpedition(save);
  if (ex.site !== null) throw new GameError('in_site', 'leave the site first (retreat), then walk home');
  const next = clone(save);
  return { save: next, summary: bank(next, content, 'home') };
}

// ---- walking --------------------------------------------------------------------------------------------------------------
export function move(save, content, tx, ty) {
  const ex = requireExpedition(save), x = content.tables.expedition, map = expeditionMap(ex, content);
  if (ex.site !== null) throw new GameError('in_site', 'you are inside a site; descend or retreat first');
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || Math.abs(tx - ex.x) + Math.abs(ty - ex.y) !== 1) throw new GameError('not_adjacent', 'you can only step to a neighbouring cell');
  const cost = moveCost(map.terrain[ty * map.width + tx], x);
  if (cost === 0) throw new GameError('blocked', 'water and peaks cannot be crossed');
  const next = clone(save), nex = next.expedition;
  if (nex.provisions < cost) return { save: next, summary: { ended: 'starved', ...bank(next, content, 'starved') } };
  nex.provisions -= cost; nex.x = tx; nex.y = ty; nex.steps++;
  reveal(nex, map, content);
  const site = siteAt(map, tx, ty);
  return { save: next, summary: { ended: null, cost, site: site ? site.id : null } };
}

// ---- sites and floors ----------------------------------------------------------------------------------------------------------
// 12.3: a reward value scaled by the site's distance and by how deep the floor is.
export const scaleReward = (v, dist, floor, x) => mulbp(mulbp(v, 10000 + x.distBp * dist), 10000 + x.floorBp * (floor - 1));

function rewardsForFloor(next, content, ex, site, floor, cleared, boss) {
  const p = content.tables.progress, x = content.tables.expedition, rng = createRng(nextSeed(next));
  const out = { xp: 0, hacksilver: 0, materials: 0, items: [], threads: 0, reputation: 0, heart: 0, paragon: 0 };
  const scale = (v) => scaleReward(v, site.dist, floor, x);
  for (let k = 0; k < cleared; k++) {
    const isBoss = boss && k === x.encountersPerFloor - 1, r = encounterRewards(site.level, isBoss, p);
    out.xp += scale(r.xp); out.materials += scale(r.materials); out.hacksilver += scale(r.hacksilver);
    const setAllowed = next.reputation[ex.realm] >= p.rep.trusted;
    if (isBoss) {
      const it = generateItem(rng, { ilvl: site.level, realm: ex.realm, boss: true, setAllowed, source: 'expedition' }, content); it.id = next.nextId++; out.items.push(it);
      out.heart += 1; out.reputation += p.repBoss; if (rng.range(10000) < p.threadBp) out.threads += 1;
      if (rng.range(10000) < x.paragonBp) out.paragon += 1; // a Paragon Point (4.6): rare, expeditions only
    } else if (rng.range(10000) < content.items.drops.encounterBp) { const it = generateItem(rng, { ilvl: site.level, realm: ex.realm, boss: false, setAllowed, source: 'expedition' }, content); it.id = next.nextId++; out.items.push(it); }
  }
  return out;
}

// 12.6: the reward for a lair: a boss encounter's reward times the legend multiplier, scaled as a deepest-floor reward, hearts, Paragon Points
// and, for a legend, its one fixed item. The final boss has no item; beating it is the end of a core run (`won`, set when the pack is banked).
function rewardsForLair(next, content, site) {
  const p = content.tables.progress, x = content.tables.expedition, L = content.tables.legend, l = content.legendById[site.lair];
  const r = encounterRewards(site.level, true, p), scale = (v) => L.rewardMul * scaleReward(v, site.dist, x.floorsMax, x);
  const out = { xp: scale(r.xp), hacksilver: scale(r.hacksilver), materials: scale(r.materials), items: [], threads: 0, reputation: p.repBoss, heart: L.hearts, paragon: l.final ? L.chaosParagon : L.paragon, legend: l.id };
  if (l.item) out.items.push(legendItem(l, legendIlvl(site.level), next.nextId++));
  return out;
}

function removeHero(next, content, id) {
  const h = findHero(next, id), items = itemsById(next), worn = content.items.slotOrder.filter((slot) => h.slots[slot] !== null).map((slot) => items[h.slots[slot]]);
  next.heroes = next.heroes.filter((x) => x.id !== id); next.party = next.party.filter((x) => x !== id);
  let lost = 0;
  while (stashCount(next) > content.items.stashMax) { // the dead hero's gear is dropped, cheapest first, only as far as the stash limit needs
    let drop = null; // the cheapest piece still in the stash: lowest tier, then lowest id; a legendary piece is never dropped
    for (const it of worn) if (it.tier !== 'legendary' && next.items.some((y) => y.id === it.id) && (drop === null || TIER.indexOf(it.tier) < TIER.indexOf(drop.tier) || (it.tier === drop.tier && it.id < drop.id))) drop = it;
    if (drop === null) break;
    next.items = next.items.filter((y) => y.id !== drop.id); lost++;
  }
  return lost;
}

// Enter the site under the party (first floor) or descend to its next floor, and fight that floor. Costs the floor-entry provisions.
export function enterFloor(save, content) {
  const ex = requireExpedition(save), x = content.tables.expedition, map = expeditionMap(ex, content);
  const site = ex.site === null ? siteAt(map, ex.x, ex.y) : map.sites[ex.site];
  if (!site) throw new GameError('no_site', 'there is no site here');
  const done = ex.floors[site.id];
  if (done >= site.floors) throw new GameError('site_cleared', 'this site is already cleared');
  const next = clone(save), nex = next.expedition;
  if (nex.provisions < x.floorCost) return { save: next, summary: { ended: 'starved', ...bank(next, content, 'starved') } };
  nex.provisions -= x.floorCost; nex.site = site.id;
  const floor = done + 1, boss = floor === site.floors, byId = itemsById(next);
  const party = nex.party.map((id) => { const h = findHero(next, id); return { ...buildHeroUnit(h, byId, content, { forced: h.injury > 0 }), thread: h.thread }; });
  const heroHp = nex.hp.map((v) => (v < 0 ? null : v));
  const replay = createFloorReplay({ realm: nex.realm, level: site.level, seed: nextSeed(next), boss, ...(site.lair ? { legend: site.lair } : {}), party, heroHp }, content);
  const res = replay.result, deadIds = res.died.map((i) => nex.party[i]), lostGear = [], summary = { ended: null, floor, floors: site.floors, site: site.id, lair: site.lair || null, outcome: res.outcome, died: [], injured: [], threaded: [], rewards: null, rescued: false, cleared: false };
  res.injured.forEach((i) => { const h = findHero(next, nex.party[i]); h.injury = x.reviveInjury; summary.injured.push(h.id); });
  res.threaded.forEach((i) => { const h = findHero(next, nex.party[i]); h.injury = x.reviveInjury; h.thread = false; summary.threaded.push(h.id); });
  const hpKeep = nex.party.map((id, i) => ({ id, hp: res.hpAfter[i] })).filter((e) => !deadIds.includes(e.id));
  for (const id of deadIds) { lostGear.push(removeHero(next, content, id)); summary.died.push(nameOf(save, id)); }
  nex.party = hpKeep.map((e) => e.id); nex.hp = hpKeep.map((e) => e.hp);
  if (res.outcome === 1) {
    nex.floors[site.id] = floor;
    const rw = site.lair ? rewardsForLair(next, content, site) : rewardsForFloor(next, content, nex, site, floor, res.cleared, boss), p = nex.pack;
    if (rw.legend) p.legends.push(rw.legend);
    p.xp += rw.xp; p.hacksilver += rw.hacksilver; p.reputation += rw.reputation; p.threads += rw.threads; p.paragon += rw.paragon;
    const realm = content.realmById[nex.realm]; p.materials[realm.material] = (p.materials[realm.material] || 0) + rw.materials;
    if (rw.heart) p.materials[realm.rareMaterial] = (p.materials[realm.rareMaterial] || 0) + rw.heart;
    p.items.push(...rw.items); summary.rewards = { xp: rw.xp, hacksilver: rw.hacksilver, materials: rw.materials, heart: rw.heart, items: rw.items.length, threads: rw.threads, paragon: rw.paragon, legend: rw.legend || null };
    if (boss) { summary.cleared = true; nex.site = null; }
  } else { // a wipe: the party is gone and the pack with it; a hero held back by a Thread walks home alone and hurt
    summary.ended = 'wiped'; next.expedition = null;
  }
  if (next.heroes.length === 0) { // the save must stay playable: the hall takes in one new level-1 hero
    const h = addHero(next, content, content.tables.recruit.startingRoster[0], 1, 1); next.party = [h.id]; summary.rescued = true;
  } else if (next.party.length === 0) next.party = [next.heroes[0].id];
  summary.lostGear = lostGear.reduce((a, b) => a + b, 0);
  return { save: next, replay, summary };
}
const nameOf = (save, id) => (save.heroes.find((h) => h.id === id) || { name: `hero ${id}` }).name;

export function retreat(save, content) {
  const ex = requireExpedition(save);
  if (ex.site === null) throw new GameError('not_in_site', 'you are not inside a site');
  const next = clone(save); next.expedition.site = null;
  return { save: next, summary: { left: ex.site } };
}

// The planning helper the client and the bot share: what standing here allows.
export function options(save, content) {
  const ex = requireExpedition(save), map = expeditionMap(ex, content), x = content.tables.expedition;
  const here = ex.site === null ? siteAt(map, ex.x, ex.y) : map.sites[ex.site];
  return { map, here, canEnter: Boolean(here) && ex.floors[here.id] < here.floors, floorCost: x.floorCost, canHome: ex.site === null };
}
