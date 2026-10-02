import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content, saveSchema } from '../helpers/content.mjs';
import { salvageMany, salvage, validateSave, GameError, canonical } from '../../sim/index.js';
import { wornIds } from '../../sim/game.js';
import { listItems, matching, yieldOf } from '../../client/forge-filter.js';

// a real mid-game save from Ziggy's first playtest (2026-10-02): 8 heroes, 68 items
const save = JSON.parse(readFileSync(new URL('../fixtures/playtest-2026-10-02.json', import.meta.url), 'utf8'));
const worn = wornIds(save), stash = save.items.filter((i) => worn[i.id] === undefined);

test('forge filter: the playtest save is a valid save of this build (the fixture is real)', () => {
  assert.equal(validateSave(save, content, saveSchema).ok, true);
  assert.equal(save.items.length, 68); assert.ok(stash.length > 30);
});

test('forge filter: owner, tier, slot and realm narrow the list, and the owner filter takes a hero id', () => {
  const ids = (f) => listItems(save, content, f).map((i) => i.id);
  assert.equal(ids({ owner: 'stash' }).length, stash.length);
  assert.equal(ids({ owner: 'worn' }).length, save.items.length - stash.length);
  const leif = save.heroes[0]; assert.deepEqual(ids({ owner: leif.id }).sort((a, b) => a - b), Object.values(leif.slots).sort((a, b) => a - b));
  assert.ok(ids({ tier: 'heirloom' }).every((id) => save.items.find((i) => i.id === id).tier === 'heirloom'));
  assert.equal(ids({ tier: 'heirloom', slot: 'weapon', owner: 'stash' }).length, stash.filter((i) => i.tier === 'heirloom' && i.slot === 'weapon').length);
  assert.ok(ids({ realm: 'helheim' }).length > 20);
  assert.equal(ids({}).length, save.items.length);
});

test('forge filter: sorting by tier, level, star, owner and slot is stable, ascending or descending', () => {
  const by = (key, desc) => listItems(save, content, {}, { key, desc });
  const tier = by('tier', false).map((i) => ['plain', 'fine', 'runed', 'heirloom'].indexOf(i.tier));
  assert.deepEqual(tier, [...tier].sort((a, b) => a - b));
  const lv = by('ilvl', true).map((i) => i.ilvl); assert.deepEqual(lv, [...lv].sort((a, b) => b - a));
  const st = by('star', true).map((i) => i.star); assert.deepEqual(st, [...st].sort((a, b) => b - a)); assert.equal(st[0], 5);
  const ow = by('owner', false); assert.equal(ow[0].id, listItems(save, content, { owner: 'stash' })[0].id, 'stash (no owner) sorts first');
  const ties = by('ilvl', false).filter((i) => i.ilvl === 10).map((i) => i.id); assert.deepEqual(ties, [...ties].sort((a, b) => a - b), 'equal keys fall back to id');
  const slot = by('slot', false).map((i) => content.items.slotOrder.indexOf(i.slot)); assert.deepEqual(slot, [...slot].sort((a, b) => a - b));
});

test('forge filter: "select matching" never picks a worn item, a mid-attempt item or (when asked) a set piece, and honours each limit', () => {
  const pick = (r) => matching(save, r), item = (id) => save.items.find((i) => i.id === id);
  const all = pick({});
  assert.equal(all.length, stash.length); assert.ok(all.every((id) => worn[id] === undefined));
  const plain = pick({ maxTier: 'plain' }); assert.ok(plain.length > 5 && plain.every((id) => item(id).tier === 'plain'));
  const fine = pick({ maxTier: 'fine', maxLevel: 10, maxStar: 0, noSet: true });
  assert.ok(fine.every((id) => ['plain', 'fine'].includes(item(id).tier) && item(id).ilvl <= 10 && item(id).star === 0 && item(id).set === null));
  assert.ok(pick({ maxTier: 'runed', noSet: false }).some((id) => item(id).set !== null), 'without noSet, set pieces are picked');
  const pending = structuredClone(save); const target = stash.find((i) => i.tier === 'plain'); pending.items.find((i) => i.id === target.id).held = [];
  assert.ok(!matching(pending, {}).includes(target.id), 'an item with a pending attempt is not auto-selected');
});

test('salvage many: gives the sum of the single salvages, is atomic, and refuses worn, duplicate, missing and empty lists', () => {
  const ids = matching(save, { maxTier: 'fine', maxStar: 0 });
  const r = salvageMany(save, content, ids);
  let single = save; for (const id of ids) single = salvage(single, content, id);
  assert.deepEqual(r.save.materials, single.materials); assert.equal(canonical(r.save.items), canonical(single.items));
  assert.deepEqual(r.summary.materials, yieldOf(save, content, ids)); assert.equal(r.summary.count, ids.length);
  assert.equal(validateSave(r.save, content, saveSchema).ok, true);
  const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError); return e.code; } };
  const wornId = Object.keys(worn)[0] * 1;
  assert.equal(code(() => salvageMany(save, content, [ids[0], wornId])), 'item_worn');
  assert.equal(code(() => salvageMany(save, content, [ids[0], ids[0]])), 'item_twice');
  assert.equal(code(() => salvageMany(save, content, [ids[0], 99999])), 'no_such_item');
  assert.equal(code(() => salvageMany(save, content, [])), 'nothing_selected');
  assert.equal(save.items.length, 68, 'a refused call changes nothing');
});
