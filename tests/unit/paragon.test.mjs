import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { loadFixture } from '../helpers/fixture.mjs';
import { heroBase, heroBaseParagon } from '../../sim/stats.js';
import { buildHeroUnit } from '../../sim/hero.js';
import { newGame, addParagonStar, paragonCost, paragonStars, paragonComplete, validateSave, fillDefaults, GameError, startExpedition } from '../../sim/index.js';
import { makeContext, resolveEncounter } from '../../sim/combat.js';
import { createRng } from '../../sim/prng.js';
import { mulbp } from '../../sim/arith.js';
import { heroDef, mkDef } from '../helpers/units.mjs';

const T = content.tables.stats, P = content.tables.paragon;
const fresh = () => { const s = newGame(content, 21, { savedAt: '', build: 't' }); s.paragonPoints = 50; for (const k of Object.keys(s.materials)) s.materials[k] = 5000; return s; };
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError, String(e)); return e.code; } return null; };

test('paragon: without stars the curve is exactly the old one; stars only grow the levels gained after they were bought, never retroactively (Ziggy\'s examples)', () => {
  for (const s1 of [4, 12, 22, 40]) for (const L of [1, 7, 25, 50]) assert.equal(heroBaseParagon(s1, L, [], T, P.starBp), heroBase(s1, L, T));
  const s1 = 100, plain = heroBase(s1, 50, T);
  const at10 = heroBaseParagon(s1, 50, [10, 10, 10], T, P.starBp), at40 = heroBaseParagon(s1, 50, [40, 40, 40], T, P.starBp), at50 = heroBaseParagon(s1, 50, [50, 50, 50], T, P.starBp);
  // 3 stars (+33%) on all 40 level-ups after level 10; on the last 10 only; on none
  const growth10 = heroBase(s1, 50, T) - heroBase(s1, 10, T), growth40 = heroBase(s1, 50, T) - heroBase(s1, 40, T);
  assert.ok(Math.abs((at10 - plain) - growth10 * 0.33) <= 2, `${at10 - plain} vs ${growth10 * 0.33}`);
  assert.ok(Math.abs((at40 - plain) - growth40 * 0.33) <= 2, `${at40 - plain} vs ${growth40 * 0.33}`);
  assert.equal(at50, plain, 'a star bought at the cap does nothing');
  assert.equal(heroBaseParagon(s1, 10, [10, 10, 10], T, P.starBp), heroBase(s1, 10, T), 'nor does a star at the current level, yet');
  assert.ok(at10 > at40 && at40 > plain, 'earlier stars are worth more');
  assert.equal(heroBaseParagon(s1, 30, [10], T, P.starBp), heroBaseParagon(s1, 30, [10], T, P.starBp));
});

test('paragon: spending a star costs a Paragon Point and heartBase x (stars owned + 1) hearts of the hero\'s realm, records the level, and changes the unit', () => {
  const s = fresh(); const h = s.heroes[0]; h.level = 20; const realm = content.realmById[content.heroById[h.class].realm];
  const before = buildHeroUnit(h, Object.fromEntries(s.items.map((i) => [i.id, i])), content), items = Object.fromEntries(s.items.map((i) => [i.id, i]));
  assert.equal(paragonCost(h, content), P.heartBase);
  const t = addParagonStar(s, content, h.id, 'VIG'), h2 = t.heroes[0];
  assert.deepEqual(h2.paragon, { VIG: [20] }); assert.equal(t.paragonPoints, 49); assert.equal(t.materials[realm.rareMaterial], 5000 - P.heartBase);
  assert.equal(paragonCost(h2, content), P.heartBase * 2);
  assert.equal(validateSave(t, content, saveSchema).ok, true);
  assert.equal(buildHeroUnit(h2, items, content).stats.VIG.base, before.stats.VIG.base, 'no effect until the next level is gained');
  const lvl = structuredClone(t); lvl.heroes[0].level = 30;
  const was = buildHeroUnit({ ...t.heroes[0], level: 30, paragon: {} }, items, content).stats.VIG.base, now = buildHeroUnit(lvl.heroes[0], items, content).stats.VIG.base;
  assert.ok(now > was, `${now} vs ${was}`);
});

test('paragon: refusals (no point, not enough hearts, a fourth star, a bad stat, away on an expedition), and the cost climbs with every star', () => {
  const s = fresh(); const h = s.heroes[0]; let cur = s;
  const costs = []; for (let i = 0; i < 3; i++) { costs.push(paragonCost(cur.heroes[0], content)); cur = addParagonStar(cur, content, h.id, 'MIT'); }
  assert.deepEqual(costs, [P.heartBase, P.heartBase * 2, P.heartBase * 3]);
  assert.equal(code(() => addParagonStar(cur, content, h.id, 'MIT')), 'paragon_max');
  assert.equal(code(() => addParagonStar(cur, content, h.id, 'LUCK')), 'bad_stat');
  assert.equal(code(() => addParagonStar({ ...cur, paragonPoints: 0 }, content, h.id, 'VIG')), 'no_point');
  const poor = structuredClone(cur); poor.materials.ember_heart = 1; poor.materials.storm_heart = 1; poor.materials.rime_heart = 1;
  assert.equal(code(() => addParagonStar(poor, content, h.id, 'VIG')), 'cannot_afford');
  const away = startExpedition({ ...fresh(), currency: { hacksilver: 1000 } }, content, { realm: 'midgard', level: 1, provisions: 3 }).save;
  assert.equal(code(() => addParagonStar(away, content, away.heroes[0].id, 'VIG')), 'on_expedition');
});

test('paragon: all 18 stars earn the class bonus (crit, critDmg, sres, lifesteal or healing strength) and 17 do not', () => {
  const s = fresh(); const items = Object.fromEntries(s.items.map((i) => [i.id, i]));
  const STATS = ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD'];
  for (const cls of content.heroes) {
    const h = { ...s.heroes[0], class: cls.id, level: 30, paragon: Object.fromEntries(STATS.map((k) => [k, [1, 1, 1]])) };
    const base = buildHeroUnit({ ...h, paragon: {} }, items, content, {}), full = buildHeroUnit(h, items, content, {}), almost = buildHeroUnit({ ...h, paragon: { ...h.paragon, SPD: [1, 1] } }, items, content, {});
    const b = cls.paragonBonus;
    assert.equal(paragonComplete(h, content), true); assert.equal(paragonStars(h), 18);
    if (b.kind === 'crit') assert.equal(full.crit - base.crit, b.bp); else if (b.kind === 'critDmg') assert.equal(full.critDmg - base.critDmg, b.bp); else if (b.kind === 'sres') assert.equal(full.sres - base.sres, b.bp);
    else if (b.kind === 'heal') assert.equal(full.healBp, b.bp); else assert.equal(full.lifestealBp, b.bp);
    assert.equal(almost.healBp, undefined); assert.equal(almost.lifestealBp, undefined); assert.equal(almost.crit, base.crit);
  }
});

test('paragon: a healer with the bonus heals 5% more, one without is unchanged (the draw order and the old numbers are untouched)', () => {
  const run = (healBp) => {
    const ctx = makeContext(content, createRng(5), []), healer = { ...heroDef('hearthkeeper', 20, [{ when: [{ c: 'always' }], do: { a: 'skill', skill: 'hearth_light' }, target: 'lowest_hp_pct' }]), ...(healBp ? { healBp } : {}) };
    const tank = heroDef('shieldwarden', 20, []), foe = mkDef({ stats: { VIG: 60 } });
    resolveEncounter(ctx, { index: 0, heroes: [{ ...tank, slot: 0 }, { ...healer, slot: 3 }], heroHp: [Math.floor(tank.maxHp / 3), null], enemies: [{ ...foe, slot: 0 }] });
    return ctx.events.filter((e) => e[0] === 5).map((e) => e[3]);
  };
  const plain = run(0), boosted = run(500);
  assert.ok(plain.length > 0 && plain[0] > 0);
  assert.equal(boosted[0], mulbp(plain[0], 10500), 'the first heal is exactly 5% larger');
});

test('paragon: an older save (no paragon keys) is filled in and valid; a star bought at a future level or too many stars is refused', () => {
  const old = loadFixture('playtest-2026-10-05.json'); assert.equal(old.paragonPoints, 0); assert.ok(old.heroes.every((h) => Object.keys(h.paragon).length === 0));
  const raw = JSON.parse(JSON.stringify(old)); delete raw.paragonPoints; for (const h of raw.heroes) delete h.paragon;
  assert.equal(validateSave(raw, content, saveSchema).ok, false, 'without the fill the old save lacks the keys');
  assert.equal(validateSave(fillDefaults(raw), content, saveSchema).ok, true);
  const bad = structuredClone(old); bad.heroes[0].paragon = { VIG: [51] };
  assert.equal(validateSave(bad, content, saveSchema).ok, false);
  bad.heroes[0].paragon = { VIG: [10, 10, 10, 10] }; assert.equal(validateSave(bad, content, saveSchema).ok, false);
  bad.heroes[0].paragon = { VIG: [20, 10] }; assert.match(validateSave(bad, content, saveSchema).errors.map((e) => e.message).join(), /out of order/);
});
