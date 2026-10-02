// The rules layer, part 1: the save, the roster and equipment (DESIGN.md 19). Every action is a pure function
// (save, content, ...) -> a new save, or it throws GameError. Nothing here reads a clock or any randomness except the
// seeded stream derived from the save's own counter.
import { deriveSeed, createRng } from './prng.js';
import { GameError } from './gameerror.js';
import { recruitLevel, recruitCost, recruitKitLevel } from './progress.js';
import { validateRunbook } from './runbook.js';
import { kitOf, canEquip } from './hero.js';

export { GameError };
export const SAVE_FORMAT = 'three-realms-save';
export const SAVE_VERSION = 1;

export const clone = (x) => structuredClone(x);

export function itemsById(save) {
  const m = Object.create(null);
  for (const it of save.items) m[it.id] = it;
  return m;
}

export function findHero(save, id) {
  const h = save.heroes.find((x) => x.id === id);
  if (!h) throw new GameError('no_such_hero', `there is no hero with id ${id}`);
  return h;
}

export function findItem(save, id) {
  const it = save.items.find((x) => x.id === id);
  if (!it) throw new GameError('no_such_item', `there is no item with id ${id}`);
  return it;
}

export function wornIds(save) {
  const w = Object.create(null);
  for (const h of save.heroes) for (const s of ['weapon', 'armour', 'helm', 'charm']) if (h.slots[s] !== null) w[h.slots[s]] = h.id;
  return w;
}

export function stashCount(save) {
  const w = wornIds(save);
  return save.items.filter((it) => w[it.id] === undefined).length;
}

// Actions that move items into the stash (unequip, a swap, dismissing) are refused when that would overfill it.
function checkStash(before, after, content) {
  const n = stashCount(after);
  if (n > content.items.stashMax && n > stashCount(before)) throw new GameError('stash_full', `the stash holds at most ${content.items.stashMax} items; salvage some first`);
  return after;
}

// While an expedition is under way the party, their gear, runbooks and Threads are locked, and so are delves and rests.
export function assertFree(save, what) {
  if (save.expedition !== null) throw new GameError('on_expedition', `${what} is not possible while an expedition is under way`);
}
// An item worn by a hero who is out on the expedition cannot be upgraded or salvaged.
export function assertNotAway(save, itemId, what) {
  if (save.expedition === null) return;
  const away = wornIds(save)[itemId];
  if (away !== undefined && save.expedition.party.includes(away)) throw new GameError('on_expedition', `${what}: that item is worn by a hero away on the expedition`);
}

export const topLevel = (save) => save.heroes.reduce((m, h) => (h.level > m ? h.level : m), 1);

// The next seed in this save's stream. Mutates the (already cloned) save.
export function nextSeed(save) {
  const seed = deriveSeed(save.rng.masterSeed, save.rng.counter);
  save.rng.counter++;
  return seed;
}

function newItem(save, slot, kind, ilvl, realm) {
  const it = { id: save.nextId++, slot, kind, tier: 'plain', ilvl, realm, set: null, star: 0, lines: [], held: null, heldStar: null, mulligan: 1 };
  save.items.push(it);
  return it;
}

function pickName(save, content, realm) {
  const rng = createRng(nextSeed(save)), pool = content.names[realm];
  const free = pool.filter((n) => !save.heroes.some((h) => h.name === n));
  const base = (free.length ? free : pool)[rng.range(free.length ? free.length : pool.length)];
  let name = base, n = 1;
  while (save.heroes.some((h) => h.name === name)) { n++; name = `${base} ${n}`; }
  return name;
}

// Adds a hero with a full Plain kit at `ilvl`. Mutates the cloned save.
export function addHero(save, content, classId, level, ilvl) {
  const cls = content.heroById[classId], slots = {};
  for (const slot of content.items.slotOrder) {
    const kind = slot === 'weapon' ? (cls.attack === 'magic' ? 'ARC' : 'MIT') : null;
    slots[slot] = newItem(save, slot, kind, ilvl, cls.realm).id;
  }
  const hero = { id: save.nextId++, class: classId, name: pickName(save, content, cls.realm), level, xp: 0, injury: 0, slots, thread: false, runbook: clone(content.starterRunbooks[classId]) };
  save.heroes.push(hero);
  return hero;
}

export function newGame(content, masterSeed, meta = { savedAt: '', build: '' }) {
  if (!Number.isInteger(masterSeed) || masterSeed < 0 || masterSeed > 4294967295) throw new GameError('bad_seed', 'the master seed must be an integer from 0 to 4294967295');
  const save = {
    format: SAVE_FORMAT, version: SAVE_VERSION, meta: { savedAt: meta.savedAt, build: meta.build }, rng: { masterSeed, counter: 0 }, nextId: 1,
    currency: { hacksilver: 0 }, materials: {}, reputation: {}, unlocked: {}, heroes: [], party: [], items: [], threads: 0, expedition: null,
  };
  for (const r of content.realms) { save.materials[r.material] = 0; save.materials[r.rareMaterial] = 0; save.reputation[r.id] = 0; save.unlocked[r.id] = 1; }
  for (const classId of content.tables.recruit.startingRoster) save.party.push(addHero(save, content, classId, 1, 1).id);
  return save;
}

export function recruit(save, content, classId) {
  const cls = content.heroById[classId], r = content.tables.recruit;
  if (!cls) throw new GameError('unknown_class', `there is no class "${classId}"`);
  if (cls.rarity !== 'common' && cls.rarity !== 'rare') throw new GameError('not_recruitable', `${cls.name} cannot be recruited in this build`);
  if (cls.rarity === 'rare' && save.reputation[cls.realm] < content.tables.progress.rep.known) {
    throw new GameError('rare_locked', `${cls.name} needs ${content.tables.progress.rep.known} reputation in ${content.realmById[cls.realm].name} (you have ${save.reputation[cls.realm]})`);
  }
  if (save.heroes.length >= r.rosterMax) throw new GameError('roster_full', `the roster holds at most ${r.rosterMax} heroes`);
  const level = recruitLevel(topLevel(save), r), cost = recruitCost(level, cls.rarity === 'rare', r);
  if (save.currency.hacksilver < 0) throw new GameError('in_debt', `you owe ${-save.currency.hacksilver} hacksilver; earn it back in a delve before recruiting`);
  if (save.currency.hacksilver < cost) throw new GameError('cannot_afford', `recruiting ${cls.name} costs ${cost} hacksilver (you have ${save.currency.hacksilver})`);
  const next = clone(save);
  next.currency.hacksilver -= cost;
  addHero(next, content, classId, level, recruitKitLevel(level, r));
  return next;
}

export function dismiss(save, content, heroId) {
  assertFree(save, 'dismissing a hero');
  const next = clone(save), h = findHero(next, heroId);
  if (next.heroes.length <= 1) throw new GameError('last_hero', 'the last hero cannot be dismissed');
  if (h.thread) next.threads++;
  next.heroes = next.heroes.filter((x) => x.id !== heroId);
  next.party = next.party.filter((id) => id !== heroId);
  if (next.party.length === 0) next.party = [next.heroes[0].id];
  return checkStash(save, next, content);
}

export function equip(save, content, heroId, slot, itemId) {
  assertFree(save, 'changing equipment');
  const next = clone(save), h = findHero(next, heroId);
  if (!content.items.slotOrder.includes(slot)) throw new GameError('bad_slot', `there is no slot "${slot}"`);
  if (itemId === null) { h.slots[slot] = null; return checkStash(save, next, content); }
  const it = findItem(next, itemId);
  if (it.slot !== slot) throw new GameError('bad_slot', `that item is for the ${it.slot} slot, not ${slot}`);
  if (!canEquip(h, it, content)) throw new GameError('level_slack', `${h.name} (level ${h.level}) can wear items up to level ${h.level + content.items.levelSlack}; this is level ${it.ilvl}`);
  for (const o of next.heroes) if (o.slots[slot] === itemId) o.slots[slot] = null;
  h.slots[slot] = itemId;
  return checkStash(save, next, content);
}

export function setParty(save, content, ids) {
  assertFree(save, 'changing the party');
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4) throw new GameError('party_size', 'a party has one to four heroes');
  if (ids.some((id, i) => ids.indexOf(id) !== i)) throw new GameError('party_dup', 'a hero can be in the party only once');
  const next = clone(save);
  for (const id of ids) findHero(next, id);
  next.party = ids.slice();
  return next;
}

export function setRunbook(save, content, heroId, runbook) {
  assertFree(save, 'editing a runbook');
  const next = clone(save), h = findHero(next, heroId);
  const rb = typeof runbook === 'string' ? runbook : JSON.stringify(runbook);
  const v = validateRunbook(rb, kitOf(h, itemsById(next), content), content);
  if (!v.ok) throw new GameError('runbook_invalid', v.errors[0].message, v.errors);
  h.runbook = JSON.parse(rb);
  return next;
}

export function assignThread(save, content, heroId) {
  assertFree(save, 'binding a Thread');
  const next = clone(save), h = findHero(next, heroId);
  if (h.thread) throw new GameError('thread_has', `${h.name} already holds a Thread of the Norns`);
  if (next.threads < 1) throw new GameError('thread_none', 'you have no Thread of the Norns to assign');
  h.thread = true; next.threads--;
  return next;
}

export function unassignThread(save, content, heroId) {
  assertFree(save, 'releasing a Thread');
  const next = clone(save), h = findHero(next, heroId);
  if (!h.thread) throw new GameError('thread_none', `${h.name} holds no Thread of the Norns`);
  h.thread = false; next.threads++;
  return next;
}

export function buyThread(save, content, realmId) {
  const realm = content.realmById[realmId], p = content.tables.progress;
  if (!realm) throw new GameError('unknown_realm', `there is no realm "${realmId}"`);
  if (save.reputation[realmId] < p.rep.honoured) throw new GameError('rep_locked', `a Thread can be bought at ${p.rep.honoured} reputation in ${realm.name} (you have ${save.reputation[realmId]})`);
  if (save.materials[realm.rareMaterial] < p.threadHearts) throw new GameError('cannot_afford', `a Thread costs ${p.threadHearts} hearts of ${realm.name} (you have ${save.materials[realm.rareMaterial]})`);
  const next = clone(save);
  next.materials[realm.rareMaterial] -= p.threadHearts; next.threads++;
  return next;
}
