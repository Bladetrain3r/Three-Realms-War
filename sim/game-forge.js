// The rules layer, part 3: upgrading and salvage (DESIGN.md 8.4 and 19).
import { createRng } from './prng.js';
import { GameError } from './gameerror.js';
import { attemptUpgrade, acceptUpgrade, useMulligan, upgradeCost, salvageValue } from './items.js';
import { clone, findItem, nextSeed, wornIds } from './game.js';

function replaceItem(save, item) {
  save.items = save.items.map((x) => (x.id === item.id ? item : x));
}

export function upgradeAttempt(save, content, itemId) {
  const next = clone(save), item = findItem(next, itemId), realm = content.realmById[item.realm], tier = content.tierById[item.tier];
  if (item.held !== null) throw new GameError('upgrade_pending', 'accept or undo the previous attempt first');
  if (item.star >= tier.maxStar) throw new GameError('upgrade_max', `a ${tier.name} item stops at ${tier.maxStar} stars`);
  const cost = upgradeCost(item, content);
  if (next.materials[realm.material] < cost.common || next.materials[realm.rareMaterial] < cost.rare) {
    throw new GameError('cannot_afford', `this attempt costs ${cost.common} ${realm.material}${cost.rare ? ` and ${cost.rare} ${realm.rareMaterial}` : ''}`, cost);
  }
  next.materials[realm.material] -= cost.common; next.materials[realm.rareMaterial] -= cost.rare;
  replaceItem(next, attemptUpgrade(item, createRng(nextSeed(next)), content));
  return next;
}

export function acceptAttempt(save, content, itemId) {
  const next = clone(save), item = findItem(next, itemId);
  if (item.held === null) throw new GameError('no_pending', 'there is no attempt to accept');
  replaceItem(next, acceptUpgrade(item));
  return next;
}

export function undoAttempt(save, content, itemId) {
  const next = clone(save), item = findItem(next, itemId);
  if (item.held === null) throw new GameError('no_pending', 'there is no attempt to undo');
  if (item.mulligan < 1) throw new GameError('mulligan_spent', 'the mulligan for this star is already spent');
  replaceItem(next, useMulligan(item));
  return next;
}

export function salvage(save, content, itemId) {
  const next = clone(save), item = findItem(next, itemId);
  if (wornIds(next)[itemId] !== undefined) throw new GameError('item_worn', 'take the item off first');
  next.materials[content.realmById[item.realm].material] += salvageValue(item);
  next.items = next.items.filter((x) => x.id !== itemId);
  return next;
}

// Salvage several items at once, atomically: if any one is worn, missing or listed twice, nothing happens.
// Returns { save, summary: { count, materials: { <id>: n } } }.
export function salvageMany(save, content, ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new GameError('nothing_selected', 'no items are selected');
  const next = clone(save), worn = wornIds(next), gain = {};
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) throw new GameError('item_twice', `item ${id} is listed twice`);
    const item = findItem(next, id);
    if (worn[id] !== undefined) throw new GameError('item_worn', `${itemLabel(item)} is worn; take it off first`);
    const mat = content.realmById[item.realm].material;
    gain[mat] = (gain[mat] || 0) + salvageValue(item);
  });
  for (const r of content.realms) if (gain[r.material]) next.materials[r.material] += gain[r.material]; // fixed realm order, not key order
  next.items = next.items.filter((x) => ids.indexOf(x.id) < 0);
  return { save: next, summary: { count: ids.length, materials: gain } };
}
const itemLabel = (it) => `${it.tier} ${it.realm} ${it.slot} (level ${it.ilvl})`;
