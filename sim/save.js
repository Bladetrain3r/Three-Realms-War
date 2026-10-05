// Validating a save: the schema, then the invariants of DESIGN.md 19. Every refusal names the key path and the reason.
import { validateAgainst, pathKey } from './schema.js';
import { validateRunbook } from './runbook.js';
import { kitOf, canEquip } from './hero.js';
import { mapFromSeed, WATER, PEAK } from './mapgen.js';
import { STATS } from './content.js';
import { lairSpecs } from './game-legends.js';

// Saves written before a key existed get its default (DESIGN 13: additive keys inside version 1). Mutates and returns `save`.
export function fillDefaults(save) {
  if (save === null || typeof save !== 'object') return save;
  if (save.paragonPoints === undefined) save.paragonPoints = 0;
  if (save.legendsBeaten === undefined) save.legendsBeaten = [];
  if (save.won === undefined) save.won = false;
  if (Array.isArray(save.heroes)) for (const h of save.heroes) if (h && typeof h === 'object' && h.paragon === undefined) h.paragon = {};
  if (save.expedition && save.expedition.pack && save.expedition.pack.paragon === undefined) save.expedition.pack.paragon = 0;
  if (save.expedition && save.expedition.pack && save.expedition.pack.legends === undefined) save.expedition.pack.legends = [];
  if (save.expedition && save.expedition.lairs === undefined) save.expedition.lairs = [];
  return save;
}

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
    for (const stat of STATS) { // unknown stat keys are refused by the schema
      const at = h.paragon[stat] || [];
      if (at.length > content.tables.paragon.maxPerStat) bad(['heroes', i, 'paragon', stat], `at most ${content.tables.paragon.maxPerStat} stars`);
      at.forEach((lv, j) => { if (lv > h.level || (j > 0 && lv < at[j - 1])) bad(['heroes', i, 'paragon', stat, j], `a star bought at level ${lv} by a level ${h.level} hero, out of order or in the future`); });
    }
    const v = validateRunbook(h.runbook, kitOf(h, byId, content), content);
    if (!v.ok) bad(['heroes', i, 'runbook'], `${v.errors[0].code}: ${v.errors[0].message}`);
  });
  save.party.forEach((id, i) => {
    if (!heroIds.includes(id)) bad(['party', i], `hero ${id} does not exist`);
    if (save.party.indexOf(id) !== i) bad(['party', i], `hero ${id} is in the party twice`);
  });
  if (save.items.filter((it) => worn[it.id] === undefined && it.tier !== 'legendary').length > content.items.stashMax) bad(['items'], `the stash holds at most ${content.items.stashMax} items`);
  for (const r of content.realms) {
    if (save.unlocked[r.id] > content.tables.progress.unlockCap) bad(['unlocked', r.id], `at most ${content.tables.progress.unlockCap}`);
  }
  save.legendsBeaten.forEach((id, i) => { if (!content.legendById[id]) bad(['legendsBeaten', i], `unknown legend "${id}"`); });
  const finalId = content.legends.find((l) => l.final).id;
  if (save.won !== save.legendsBeaten.includes(finalId)) bad(['won'], 'won is set exactly when the final boss has been beaten');
  const legendOwners = Object.create(null);
  for (const [it, where] of save.items.map((x) => [x, 'items']).concat(save.expedition ? save.expedition.pack.items.map((x) => [x, 'expedition.pack.items']) : [])) {
    if (it.legend === undefined) continue;
    const l = content.legendById[it.legend], at = it.id;
    if (!l || l.item === null) { bad([where], `item ${at} belongs to unknown legend "${it.legend}"`); continue; }
    if (it.tier !== 'legendary' || it.slot !== l.item.slot) bad([where], `item ${at} is not the legendary ${l.item.slot} of ${l.name}`);
    if (legendOwners[it.legend] !== undefined) bad([where], `${l.name}'s item exists twice (items ${legendOwners[it.legend]} and ${at})`); else legendOwners[it.legend] = at;
    if (where === 'items' && !save.legendsBeaten.includes(it.legend)) bad([where], `item ${at} is the prize of ${l.name}, who has not been beaten`);
  }
  if (save.expedition !== null) {
    const ex = save.expedition, x = content.tables.expedition, p = ['expedition'];
    if (!content.realmById[ex.realm]) return { ok: false, errors: [...errors, { key: 'expedition.realm', message: `unknown realm "${ex.realm}"` }] };
    if (ex.level > save.unlocked[ex.realm]) bad([...p, 'level'], `the realm is open only to level ${save.unlocked[ex.realm]}`);
    if (ex.provisions > x.provisionMax) bad([...p, 'provisions'], `at most ${x.provisionMax}`);
    if (ex.seen.length !== x.width * x.height) bad([...p, 'seen'], `must have ${x.width * x.height} cells (has ${ex.seen.length})`);
    else {
      const lairsOk = ex.lairs.every((id) => content.legendById[id] && content.legendById[id].from <= ex.level);
      if (!lairsOk) bad([...p, 'lairs'], 'a lair names an unknown legend or one the expedition level has not reached');
      const map = mapFromSeed(ex.seed, ex.level, x, lairsOk ? lairSpecs(ex.lairs, content) : [], content.tables.legend);
      if (ex.x >= x.width || ex.y >= x.height || map.terrain[ex.y * x.width + ex.x] === WATER || map.terrain[ex.y * x.width + ex.x] === PEAK) bad([...p, 'x'], 'the party stands on water, a peak or off the map');
      if (ex.floors.length !== map.sites.length) bad([...p, 'floors'], `needs one entry per site (${map.sites.length})`);
      else ex.floors.forEach((f, i) => { if (f > map.sites[i].floors) bad([...p, 'floors', i], `site ${i} has only ${map.sites[i].floors} floors`); });
      if (ex.site !== null && (ex.site >= map.sites.length || map.sites[ex.site].x !== ex.x || map.sites[ex.site].y !== ex.y)) bad([...p, 'site'], 'the party is inside a site it is not standing on');
    }
    if (ex.party.length !== ex.hp.length) bad([...p, 'hp'], 'needs one entry per expedition hero');
    if (JSON.stringify(ex.party) !== JSON.stringify(save.party)) bad([...p, 'party'], 'the expedition party must be the save party, in the same order');
    ex.party.forEach((id, i) => { if (!heroIds.includes(id)) bad([...p, 'party', i], `hero ${id} does not exist`); });
    ex.pack.items.forEach((it, i) => {
      if (it.id >= save.nextId) bad([...p, 'pack', 'items', i, 'id'], `id ${it.id} is not below nextId ${save.nextId}`);
      if (byId[it.id] !== undefined || ex.pack.items.findIndex((y) => y.id === it.id) !== i) bad([...p, 'pack', 'items', i, 'id'], `duplicate item id ${it.id}`);
    });
  }
  return { ok: errors.length === 0, errors };
}
