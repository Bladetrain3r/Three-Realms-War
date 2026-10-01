import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, item, hero } from '../helpers/content.mjs';
import { buildHeroUnit, canEquip } from '../../sim/hero.js';
import { finalStat } from '../../sim/stats.js';

const t = content.tables.stats;
const final = (u, s, inj = u.injured) => finalStat(u.stats[s].base, u.stats[s].pct, inj, t);

function shieldwarden26() {
  const items = {
    10: item({ id: 10, slot: 'armour', ilvl: 26 }),
    11: item({ id: 11, slot: 'helm', ilvl: 26 }),
    12: item({ id: 12, slot: 'charm', tier: 'fine', ilvl: 26, lines: [[0, 1000]] }),
  };
  return { h: hero({ level: 26, slots: { weapon: null, armour: 10, helm: 11, charm: 12 } }), items };
}

test('hero: final VIG and max HP of the documented level-26 Shieldwarden (DESIGN.md WE-08)', () => {
  const { h, items } = shieldwarden26();
  const u = buildHeroUnit(h, items, content);
  assert.deepEqual(u.stats.VIG, { base: 265, pct: 1000 });
  assert.equal(final(u, 'VIG'), 291);
  assert.equal(u.maxHp, 1455);
});

test('hero: a forced injured hero has halved stats and HP (DESIGN.md WE-15)', () => {
  const { h, items } = shieldwarden26();
  const u = buildHeroUnit(h, items, content, { forced: true });
  assert.equal(final(u, 'VIG'), 145);
  assert.equal(u.maxHp, 725);
  assert.equal(finalStat(300, 0, true, t), 150);
});

test('hero: a new level-1 Shieldwarden has 120 HP and fire resist from Midgard affinity', () => {
  const u = buildHeroUnit(hero(), {}, content);
  assert.equal(u.maxHp, 120);
  assert.equal(u.res.fire, 2000);
  assert.equal(u.res.frost, 0);
  assert.equal(u.crit, 500);
  assert.equal(u.sres, 500);
  assert.deepEqual(u.skills, ['hold_the_line', 'shield_bash']);
});

test('hero: the realm affinity applies only to the realm\'s two stats', () => {
  const u = buildHeroUnit(hero({ class: 'stormcaller' }), {}, content); // Asgard: ARC and SPD
  assert.equal(u.stats.ARC.base, 24);  // 22 x 1.1
  assert.equal(u.stats.SPD.base, 12);  // 11 x 1.1
  assert.equal(u.stats.VIG.base, 13);
  assert.equal(u.res.lightning, 2000);
});

test('hero: items above hero level + 5 are refused; the boundary is allowed', () => {
  const h = hero({ level: 10, slots: { weapon: null, armour: 1, helm: null, charm: null } });
  assert.throws(() => buildHeroUnit(h, { 1: item({ id: 1, ilvl: 16 }) }, content), /above hero level/);
  assert.doesNotThrow(() => buildHeroUnit(h, { 1: item({ id: 1, ilvl: 15 }) }, content));
  assert.equal(canEquip(h, item({ ilvl: 15 }), content), true);
  assert.equal(canEquip(h, item({ ilvl: 16 }), content), false);
});

test('hero: an item in the wrong slot is refused', () => {
  const h = hero({ slots: { weapon: 1, armour: null, helm: null, charm: null } });
  assert.throws(() => buildHeroUnit(h, { 1: item({ id: 1, slot: 'helm' }) }, content), /does not fit/);
});

test('hero: set bonuses: two pieces give the stat bonus, four give the skill', () => {
  const mk = (id, slot, extra = {}) => item({ id, slot, tier: 'runed', ilvl: 5, set: 'hearthforged', realm: 'midgard', kind: slot === 'weapon' ? 'MIT' : null, lines: [], ...extra });
  const items = { 1: mk(1, 'weapon'), 2: mk(2, 'armour'), 3: mk(3, 'helm'), 4: mk(4, 'charm') };
  const two = buildHeroUnit(hero({ level: 5, slots: { weapon: 1, armour: 2, helm: null, charm: null } }), items, content);
  assert.equal(two.stats.VIG.pct, 1000);
  assert.ok(!two.skills.includes('hearthfire_surge'));
  const four = buildHeroUnit(hero({ level: 5, slots: { weapon: 1, armour: 2, helm: 3, charm: 4 } }), items, content);
  assert.ok(four.skills.includes('hearthfire_surge'));
  assert.equal(four.stats.VIG.pct, 1000);
});

test('hero: Grave-Shroud two pieces give frost resist and status resist', () => {
  const mk = (id, slot) => item({ id, slot, tier: 'runed', ilvl: 5, set: 'grave_shroud', realm: 'helheim', kind: slot === 'weapon' ? 'ARC' : null });
  const u = buildHeroUnit(hero({ class: 'volva', level: 5, slots: { weapon: 1, armour: 2, helm: null, charm: null } }), { 1: mk(1, 'weapon'), 2: mk(2, 'armour') }, content);
  assert.equal(u.res.frost, 2000 + 1500);
  assert.equal(u.sres, 500 + 1000);
});

test('hero: percentage, crit, crit damage, status and element lines all land where they should', () => {
  // kinds: 3 GRD%, 6 CRIT, 7 CRITDMG, 8 SRES, 9 RES_REALM
  const it = item({ id: 1, slot: 'helm', tier: 'heirloom', ilvl: 5, star: 2, lines: [[3, 1000], [6, 200], [7, 2000]], realm: 'helheim' });
  const it2 = item({ id: 2, slot: 'charm', tier: 'fine', ilvl: 5, star: 0, lines: [[8, 500]], realm: 'helheim' });
  const it3 = item({ id: 3, slot: 'armour', tier: 'fine', ilvl: 5, star: 0, lines: [[9, 400]], realm: 'helheim' });
  const u = buildHeroUnit(hero({ level: 5, slots: { weapon: null, armour: 3, helm: 1, charm: 2 } }), { 1: it, 2: it2, 3: it3 }, content);
  assert.equal(u.stats.GRD.pct, 1100);
  assert.equal(u.crit, 500 + 220);
  assert.equal(u.critDmg, 15000 + 2200);
  assert.equal(u.sres, 500 + 500);
  assert.ok(u.res.frost >= 400);
});
