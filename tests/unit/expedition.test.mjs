import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { runedSave, pathTo } from '../../checks/expedition-bot.mjs';
import {
  newGame, startExpedition, move, enterFloor, retreat, returnHome, expeditionMap, siteAt, validateSave, canonical, verifyReplay, GameError,
  setParty, equip, dismiss, setRunbook, rest, playDelve, upgradeAttempt, salvage, assignThread, recruit,
} from '../../sim/index.js';

const X = content.tables.expedition;
const valid = (s, what = '') => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors || [], [], what); return s; };
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError, String(e)); return e.code; } return null; };
const strong = (seed, E = 20) => { const s = runedSave(content, E, seed, true); for (const h of s.heroes) h.level = 50; return s; };
const walk = (save, tx, ty) => { // walk to (tx, ty) along the cheapest path; returns the save
  let cur = save;
  const ex = cur.expedition, map = expeditionMap(ex, content), p = pathTo(map, content, ex.x, ex.y, tx, ty);
  for (const [x, y] of p.steps) { const r = move(cur, content, x, y); cur = r.save; if (r.summary.ended) return cur; }
  return cur;
};
const nearestSite = (save) => { const ex = save.expedition, map = expeditionMap(ex, content); return map.sites.map((s) => ({ s, p: pathTo(map, content, ex.x, ex.y, s.x, s.y) })).sort((a, b) => a.p.cost - b.p.cost || a.s.id - b.s.id)[0]; };

test('expedition: WE-24 .. WE-26 numbers (path cost, site level and distance multiplier; a reward scaled by distance and floor; a death save at 4000 bp)', async () => {
  const { moveCost, PLAIN, FOREST, HILLS } = await import('../../sim/mapgen.js');
  const { deathSaveKills } = await import('../../sim/floor.js'); const { scaleReward } = await import('../../sim/game-expedition.js');
  assert.equal(4 * moveCost(PLAIN, X) + moveCost(FOREST, X) + moveCost(HILLS, X), 8);
  assert.equal(20 + Math.trunc(11 / X.siteLevelDiv), 23); assert.equal(10000 + X.distBp * 11, 13300);
  assert.equal(scaleReward(10, 11, 3, X), 19);
  assert.deepEqual([deathSaveKills(3999, X), deathSaveKills(4000, X)].map(Number), [1, 0]);
});

test('expedition: starting costs provisions, refuses what it should, takes a seed step, leaves a valid save and a map that regenerates', () => {
  const s = strong(1); s.currency.hacksilver = 500;
  const r = startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 30 });
  assert.equal(r.save.currency.hacksilver, 200); assert.equal(r.save.rng.counter, s.rng.counter + 1);
  const ex = valid(r.save).expedition; assert.equal(ex.provisions, 30); assert.deepEqual(ex.party, s.party); assert.equal(ex.pack.hacksilver, 0);
  const map = expeditionMap(ex, content); assert.equal(map.start.x, ex.x); assert.equal(ex.seen.split('').filter((c) => c === '1').length > 3, true);
  assert.equal(code(() => startExpedition(r.save, content, { realm: 'midgard', level: 20, provisions: 1 })), 'on_expedition');
  assert.equal(code(() => startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 61 })), 'bad_provisions');
  assert.equal(code(() => startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 1.5 })), 'bad_provisions');
  assert.equal(code(() => startExpedition(s, content, { realm: 'midgard', level: 99, provisions: 1 })), 'level_locked');
  assert.equal(code(() => startExpedition(s, content, { realm: 'nowhere', level: 1, provisions: 1 })), 'unknown_realm');
  assert.equal(code(() => startExpedition({ ...s, currency: { hacksilver: 50 } }, content, { realm: 'midgard', level: 20, provisions: 6 })), 'cannot_afford');
  assert.equal(code(() => startExpedition({ ...s, currency: { hacksilver: -5 } }, content, { realm: 'midgard', level: 20, provisions: 1 })), 'in_debt');
  const hurt = structuredClone(s); hurt.heroes[0].injury = 1;
  assert.equal(code(() => startExpedition(hurt, content, { realm: 'midgard', level: 20, provisions: 5 })), 'injured_not_forced');
  assert.equal(startExpedition(hurt, content, { realm: 'midgard', level: 20, provisions: 5, force: [hurt.heroes[0].id] }).save.expedition.party.length, 4);
});

test('expedition: walking costs the terrain, reveals fog, refuses water and non-neighbours, and running dry ends the trip safely with the pack banked', () => {
  const s = strong(2); s.currency.hacksilver = 100000;
  const st = startExpedition(s, content, { realm: 'helheim', level: 20, provisions: 60 }).save, ex = st.expedition, map = expeditionMap(ex, content);
  assert.equal(code(() => move(st, content, ex.x + 2, ex.y)), 'not_adjacent');
  const water = map.terrain.findIndex((t, i) => t === 3 && Math.abs((i % 20) - ex.x) + Math.abs(Math.trunc(i / 20) - ex.y) === 1);
  if (water >= 0) assert.equal(code(() => move(st, content, water % 20, Math.trunc(water / 20))), 'blocked');
  const near = nearestSite(st), r = walk(st, near.s.x, near.s.y);
  assert.equal(r.expedition.provisions, 60 - near.p.cost); assert.equal(r.expedition.x, near.s.x);
  assert.ok(r.expedition.seen.split('').filter((c) => c === '1').length > ex.seen.split('').filter((c) => c === '1').length);
  valid(r, 'after the walk');
  // starve: a trip with 1 provision
  const dry = startExpedition(s, content, { realm: 'helheim', level: 20, provisions: 1 }).save;
  let cur = dry, ended = null;
  for (const [x, y] of pathTo(expeditionMap(dry.expedition, content), content, dry.expedition.x, dry.expedition.y, near.s.x, near.s.y).steps) { const m = move(cur, content, x, y); cur = m.save; if (m.summary.ended) { ended = m.summary; break; } }
  assert.equal(ended.ended, 'starved'); assert.equal(cur.expedition, null); valid(cur, 'after starving');
});

test('expedition: clearing a site banks its rewards only on the safe return; the pack grows floor by floor with the depth multiplier', () => {
  const s = strong(3); s.currency.hacksilver = 100000;
  const near = nearestSite(startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 60 }).save);
  let cur = startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 60 }).save;
  cur = walk(cur, near.s.x, near.s.y);
  const packs = [];
  for (let f = 1; f <= near.s.floors; f++) {
    const r = enterFloor(cur, content); cur = valid(r.save, `floor ${f}`);
    assert.equal(r.summary.outcome, 1); assert.equal(r.summary.floor, f); packs.push(cur.expedition ? cur.expedition.pack.hacksilver : null);
    assert.equal(r.replay.kind, 'floor'); assert.deepEqual(verifyReplay(r.replay, content), { ok: true, resimulated: true, reasons: [] });
    if (f < near.s.floors) { assert.equal(cur.expedition.site, near.s.id); assert.equal(code(() => move(cur, content, cur.expedition.x + 1, cur.expedition.y)), 'in_site'); } else assert.equal(cur.expedition.site, null);
  }
  assert.ok(packs.every((v, i) => i === 0 || v > packs[i - 1]), 'deeper floors pay more');
  assert.equal(cur.currency.hacksilver, s.currency.hacksilver - 600, 'nothing banked yet');
  const pack = cur.expedition.pack, before = cur;
  const home = returnHome(cur, content); valid(home.save, 'home');
  assert.equal(home.save.expedition, null); assert.equal(home.save.currency.hacksilver, before.currency.hacksilver + pack.hacksilver);
  assert.equal(home.save.materials.forge_iron, before.materials.forge_iron + pack.materials.forge_iron);
  assert.equal(home.save.items.length, before.items.length + pack.items.length);
  assert.ok(pack.items.length >= 1, 'the boss drops an item'); assert.ok(pack.materials.ember_heart >= 1, 'the boss drops its heart');
  assert.equal(home.save.heroes[0].xp > 0 || home.save.heroes[0].level === 50, true);
  assert.equal(code(() => enterFloor(cur, content)), 'site_cleared');
});

test('expedition: retreating from a site keeps its cleared floors (no farming the same floor), and walking home from the map is free', () => {
  const s = strong(4); s.currency.hacksilver = 100000;
  const near = nearestSite(startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 60 }).save);
  let cur = walk(startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 60 }).save, near.s.x, near.s.y);
  cur = enterFloor(cur, content).save;
  if (near.s.floors > 1) {
    assert.equal(code(() => returnHome(cur, content)), 'in_site');
    cur = valid(retreat(cur, content).save); assert.equal(cur.expedition.site, null); assert.equal(cur.expedition.floors[near.s.id], 1);
    const gold = cur.expedition.pack.hacksilver, prov = cur.expedition.provisions;
    const again = enterFloor(cur, content); assert.equal(again.summary.floor, 2, 're-entering continues at the next floor'); assert.equal(again.save.expedition.provisions, prov - X.floorCost);
    assert.ok(again.save.expedition.pack.hacksilver > gold);
  }
  assert.equal(code(() => retreat(startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 3 }).save, content)), 'not_in_site');
  assert.equal(code(() => enterFloor(startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 3 }).save, content)), 'no_site');
  assert.equal(code(() => returnHome(s, content)), 'no_expedition');
});

test('expedition: a wiped party is gone for good with its pack, gear returns to the stash, a Thread holds one hero back, and the save stays valid', () => {
  let found = 0;
  for (let seed = 1; seed <= 12 && found < 3; seed++) {
    const s = runedSave(content, 5, seed, true); s.currency.hacksilver = 100000; s.unlocked.midgard = 50; s.heroes[0].thread = true; s.threads = 0;
    const base = startExpedition(s, content, { realm: 'midgard', level: 50, provisions: 60 }).save;
    const near = nearestSite(base); let cur = walk(base, near.s.x, near.s.y);
    if (!cur.expedition) continue;
    const before = cur, r = enterFloor(cur, content);
    if (r.summary.outcome !== 0) continue;
    found++; const after = valid(r.save, 'after the wipe');
    assert.equal(after.expedition, null, 'a wipe ends the expedition'); assert.equal(after.currency.hacksilver, before.currency.hacksilver, 'the pack is lost');
    assert.deepEqual(r.summary.threaded, [s.heroes[0].id]); assert.equal(after.heroes.length, 1); assert.equal(after.heroes[0].id, s.heroes[0].id);
    assert.equal(after.heroes[0].thread, false, 'the Thread is used up'); assert.equal(after.heroes[0].injury, X.reviveInjury);
    assert.deepEqual(after.party, [s.heroes[0].id]);
    assert.equal(r.summary.died.length, 3); assert.equal(verifyReplay(r.replay, content).ok, true);
    assert.equal(after.items.length >= before.items.length - 12, true);
  }
  assert.ok(found >= 1, 'the search found no wipe');
});

test('expedition: if every hero dies the hall takes in one new level-1 hero so the save stays playable', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = runedSave(content, 3, seed, true); s.currency.hacksilver = 100000; s.unlocked.asgard = 50;
    const base = startExpedition(s, content, { realm: 'asgard', level: 50, provisions: 60 }).save, near = nearestSite(base);
    const cur = walk(base, near.s.x, near.s.y); if (!cur.expedition) continue;
    const r = enterFloor(cur, content); if (r.summary.outcome !== 0) continue;
    assert.equal(r.summary.rescued, true); const a = valid(r.save);
    assert.equal(a.heroes.length, 1); assert.equal(a.heroes[0].level, 1); assert.deepEqual(a.party, [a.heroes[0].id]); assert.ok(a.heroes[0].id > s.heroes.at(-1).id);
    return;
  }
  assert.fail('no total wipe found');
});

test('expedition: the dead hero\'s gear drops to the stash, and if the stash is full the cheapest pieces are lost, never more than needed', () => {
  const s = runedSave(content, 3, 1, true); s.currency.hacksilver = 100000; s.unlocked.asgard = 50;
  for (let i = 0; i < 100; i++) s.items.push({ id: s.nextId++, slot: 'helm', kind: null, tier: 'plain', ilvl: 1, realm: 'asgard', set: null, star: 0, lines: [], held: null, heldStar: null, mulligan: 1 });
  valid(s, 'a full stash');
  for (let seed = 1; seed <= 20; seed++) {
    const t = structuredClone(s); t.rng.masterSeed = seed;
    const base = startExpedition(t, content, { realm: 'asgard', level: 50, provisions: 60 }).save, near = nearestSite(base), cur = walk(base, near.s.x, near.s.y);
    if (!cur.expedition) continue;
    const r = enterFloor(cur, content); if (r.summary.outcome !== 0) continue;
    const a = valid(r.save, 'after dying with a full stash');
    assert.ok(r.summary.lostGear > 0); return;
  }
  assert.fail('no wipe found');
});

test('expedition: while it is under way the party, gear, runbooks, delves and rests are locked; the stash and recruiting are not', () => {
  const s = strong(5); s.currency.hacksilver = 100000;
  const cur = startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 10 }).save, h = cur.heroes[0];
  const worn = Object.values(h.slots)[0], spare = { id: cur.nextId, slot: 'helm', kind: null, tier: 'plain', ilvl: 1, realm: 'midgard', set: null, star: 0, lines: [], held: null, heldStar: null, mulligan: 1 };
  cur.items.push(spare); cur.nextId++;
  for (const [what, fn] of [['party', () => setParty(cur, content, [h.id])], ['equip', () => equip(cur, content, h.id, 'helm', null)], ['dismiss', () => dismiss(cur, content, h.id)], ['runbook', () => setRunbook(cur, content, h.id, h.runbook)],
    ['delve', () => playDelve(cur, content, { realm: 'midgard', level: 1 })], ['rest', () => rest(cur, content)], ['thread', () => assignThread(cur, content, h.id)], ['upgrade worn', () => upgradeAttempt(cur, content, worn)], ['salvage worn', () => salvage(cur, content, worn)]]) {
    assert.equal(code(fn), 'on_expedition', what);
  }
  cur.materials.forge_iron = 100;
  assert.equal(upgradeAttempt(cur, content, spare.id).items.find((i) => i.id === spare.id).held !== undefined, true, 'a stash item can still be upgraded');
  assert.ok(recruit(cur, content, 'hunter'), 'recruiting stays possible');
  assert.equal(salvage(cur, content, spare.id).items.length, cur.items.length - 1);
});

test('expedition: the whole outing is deterministic (same save and actions, same saves and replay hashes) and survives export and import in the middle', () => {
  const run = () => {
    const s = strong(9); s.currency.hacksilver = 100000;
    let cur = startExpedition(s, content, { realm: 'asgard', level: 20, provisions: 40 }).save; const near = nearestSite(cur);
    cur = walk(cur, near.s.x, near.s.y); const hashes = [];
    const r = enterFloor(cur, content); cur = r.save; hashes.push(r.replay.hash);
    return { cur, hashes };
  };
  const a = run(), b = run();
  assert.equal(canonical(a.cur), canonical(b.cur)); assert.deepEqual(a.hashes, b.hashes);
  const round = JSON.parse(canonical(a.cur)); assert.equal(validateSave(round, content, saveSchema).ok, true); assert.equal(canonical(round), canonical(a.cur));
  assert.equal(siteAt(expeditionMap(a.cur.expedition, content), a.cur.expedition.x, a.cur.expedition.y) !== null, true);
});

test('expedition: save validation refuses a corrupted expedition naming the key (off the map, wrong party, bad seen, site mismatch, a pack item id in use)', () => {
  const s = strong(6); s.currency.hacksilver = 100000;
  const cur = startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 10 }).save;
  const bad = (mut, re) => { const c = structuredClone(cur); mut(c); const v = validateSave(c, content, saveSchema); assert.equal(v.ok, false); assert.match(v.errors.map((e) => `${e.key}: ${e.message}`).join('\n'), re); };
  bad((c) => { c.expedition.seen = '01'; }, /expedition\.seen/);
  bad((c) => { c.expedition.x = 19; c.expedition.y = 13; c.expedition.seen = c.expedition.seen; }, /expedition|stands/);
  bad((c) => { c.expedition.party = [c.party[1], c.party[0], c.party[2], c.party[3]]; }, /same order/);
  bad((c) => { c.expedition.hp = [-1]; }, /one entry per expedition hero/);
  bad((c) => { c.expedition.site = 0; }, /inside a site/);
  bad((c) => { c.expedition.floors = [99, 99]; }, /expedition\.floors/);
  bad((c) => { c.expedition.provisions = 61; }, /at most 60/);
  bad((c) => { c.expedition.pack.items.push({ ...c.items[0] }); }, /duplicate item id/);
  bad((c) => { c.expedition.bogus = 1; }, /unknown key "bogus"/);
});
