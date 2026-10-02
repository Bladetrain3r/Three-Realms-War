// Validating a save: the schema, then the invariants of DESIGN.md 19. Every refusal names the key path and the reason.
import { validateAgainst, pathKey } from './schema.js';
import { validateRunbook } from './runbook.js';
import { kitOf, canEquip } from './hero.js';

export function validateSave(save, content, schema) {
  const errors = validateAgainst(save, schema);
  if (errors.length) return { ok: false, errors };
  const bad = (segs, message) => errors.push({ key: pathKey(segs), message });
  const byId = Object.create(null), worn = Object.create(null);
  save.items.forEach((it, i) => {
    if (byId[it.id] !== undefined) bad(['items', i, 'id'], `duplicate item id ${it.id}`); else byId[it.id] = it;
    if (it.id >= save.nextId) bad(['items', i, 'id'], `id ${it.id} is not below nextId ${save.nextId}`);
    const tier = content.tierById[it.tier], realm = content.realmById[it.realm];
    if (!realm) bad(['items', i, 'realm'], `unknown realm "${it.realm}"`);
    if (it.star > tier.maxStar) bad(['items', i, 'star'], `a ${tier.name} item stops at ${tier.maxStar} stars`);
    if ((it.slot === 'weapon') !== (it.kind !== null)) bad(['items', i, 'kind'], 'only a weapon has a kind (MIT or ARC)');
    if (it.set !== null) {
      if (!tier.setAllowed) bad(['items', i, 'set'], `a ${tier.name} item cannot carry a set`);
      else if (!content.setById[it.set]) bad(['items', i, 'set'], `unknown set "${it.set}"`);
      else if (realm && content.setById[it.set].realm !== it.realm) bad(['items', i, 'set'], `set "${it.set}" belongs to another realm`);
    }
    if (it.held === null) {
      if (it.lines.length !== tier.lines) bad(['items', i, 'lines'], `a ${tier.name} item has ${tier.lines} line${tier.lines === 1 ? '' : 's'} (this has ${it.lines.length})`);
      if (it.heldStar !== null) bad(['items', i, 'heldStar'], 'heldStar is set but no attempt is pending');
    } else {
      if (it.heldStar === null) bad(['items', i, 'heldStar'], 'an attempt is pending but heldStar is missing');
      if (it.held.length !== tier.lines) bad(['items', i, 'held'], `held lines must number ${tier.lines}`);
    }
    for (const [list, name] of [[it.lines, 'lines'], [it.held || [], 'held']]) {
      const kinds = [];
      list.forEach((l, j) => {
        const def = content.items.lines[l[0]];
        if (!def) return bad(['items', i, name, j], `unknown line kind ${l[0]}`);
        if (l[1] < def.lo || l[1] > def.hi) bad(['items', i, name, j], `value ${l[1]} is outside ${def.lo} to ${def.hi}`);
        if (kinds.includes(l[0])) bad(['items', i, name, j], `line kind ${l[0]} appears twice`);
        kinds.push(l[0]);
      });
    }
  });

  const heroIds = [];
  save.heroes.forEach((h, i) => {
    if (heroIds.includes(h.id)) bad(['heroes', i, 'id'], `duplicate hero id ${h.id}`);
    heroIds.push(h.id);
    if (h.id >= save.nextId) bad(['heroes', i, 'id'], `id ${h.id} is not below nextId ${save.nextId}`);
    if (!content.heroById[h.class]) return bad(['heroes', i, 'class'], `unknown class "${h.class}"`);
    if (h.injury > content.tables.injury.delves) bad(['heroes', i, 'injury'], `at most ${content.tables.injury.delves}`);
    for (const slot of content.items.slotOrder) {
      const id = h.slots[slot];
      if (id === null) continue;
      const it = byId[id];
      if (!it) { bad(['heroes', i, 'slots', slot], `wears item ${id}, which does not exist`); continue; }
      if (it.slot !== slot) bad(['heroes', i, 'slots', slot], `item ${id} is a ${it.slot}, not a ${slot}`);
      else if (!canEquip(h, it, content)) bad(['heroes', i, 'slots', slot], `item ${id} (level ${it.ilvl}) is too high for a level ${h.level} hero`);
      if (worn[id] !== undefined) bad(['heroes', i, 'slots', slot], `item ${id} is also worn by hero ${worn[id]}`); else worn[id] = h.id;
    }
    const v = validateRunbook(h.runbook, kitOf(h, byId, content), content);
    if (!v.ok) bad(['heroes', i, 'runbook'], `${v.errors[0].code}: ${v.errors[0].message}`);
  });
  save.party.forEach((id, i) => {
    if (!heroIds.includes(id)) bad(['party', i], `hero ${id} does not exist`);
    if (save.party.indexOf(id) !== i) bad(['party', i], `hero ${id} is in the party twice`);
  });
  if (save.items.filter((it) => worn[it.id] === undefined).length > content.items.stashMax) bad(['items'], `the stash holds at most ${content.items.stashMax} items`);
  for (const r of content.realms) {
    if (save.unlocked[r.id] > content.tables.progress.unlockCap) bad(['unlocked', r.id], `at most ${content.tables.progress.unlockCap}`);
  }
  return { ok: errors.length === 0, errors };
}
