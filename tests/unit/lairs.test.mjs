import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { builtSave, pathTo } from '../../checks/expedition-bot.mjs';
import { createRng } from '../../sim/prng.js';
import {
  newGame, startExpedition, move, enterFloor, returnHome, expeditionMap, validateSave, fillDefaults, lairsFor, lairSpecs, legendStatus, mapFromSeed, GameError, stashCount, salvage,
} from '../../sim/index.js';

const X = content.tables.expedition, L = content.tables.legend;
const valid = (s, what = '') => { const v = validateSave(s, content, saveSchema); assert.deepEqual(v.errors || [], [], what); return s; };
const invalid = (s) => validateSave(s, content, saveSchema).errors.map((e) => `${e.key}: ${e.message}`).join(' | ');
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof GameError, String(e)); return e.code; } return null; };
const strong = (seed) => builtSave(content, { heroLevel: 50, tier: 'heirloom', star: 5, ilvl: 50, withLines: true }, seed);
const beaten = (ids) => { const s = strong(1); s.legendsBeaten = ids.slice(); s.won = ids.includes('chaos'); return s; };
const walkTo = (save, site) => { let cur = save; const ex = cur.expedition, map = expeditionMap(ex, content), p = pathTo(map, content, ex.x, ex.y, site.x, site.y); for (const [x, y] of p.steps) { const r = move(cur, content, x, y); cur = r.save; if (r.summary.ended) throw new Error('starved on the way'); } return cur; };
const lairOf = (save) => expeditionMap(save.expedition, content).sites.find((s) => s.lair);

test('lairs: which legends an expedition carries (the lowest unbeaten one the level has reached; the final boss after four have fallen and level 50)', () => {
  const ids = (s, lv) => lairsFor(s, content, lv);
  assert.deepEqual(ids(beaten([]), 9), []); assert.deepEqual(ids(beaten([]), 10), ['fenris']); assert.deepEqual(ids(beaten([]), 45), ['fenris']);
  assert.deepEqual(ids(beaten(['fenris']), 19), []); assert.deepEqual(ids(beaten(['fenris']), 20), ['jormungandr']);
  assert.deepEqual(ids(beaten(['fenris', 'ymir']), 30), ['jormungandr']); // order is by tier, not by what was beaten
  const four = ['fenris', 'jormungandr', 'ymir', 'beowulf'];
  assert.deepEqual(ids(beaten(four), 49), []); assert.deepEqual(ids(beaten(four), 50), ['odin', 'chaos']);
  assert.deepEqual(ids(beaten(['fenris', 'jormungandr', 'ymir', 'odin']), 50), ['beowulf', 'chaos']); // any four open it
  assert.deepEqual(ids(beaten([...four, 'odin']), 50), ['chaos']); assert.deepEqual(ids(beaten([...four, 'odin', 'chaos']), 50), []);
  assert.deepEqual(ids(beaten(['fenris', 'jormungandr', 'ymir']), 50), ['beowulf']); // three are not enough
  const st = legendStatus(beaten(['fenris', 'ymir']), content); assert.deepEqual([st.beaten, st.needed, st.chaosOpen, st.won], [2, 4, false, false]);
});

test('lairs: the ordinary map does not change; lairs are extra one-floor sites, reachable, far, apart from the others, the same every time', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const E = 10 + (seed % 5) * 10, plain = mapFromSeed(seed, E, X), withL = mapFromSeed(seed, E, X, lairSpecs(['fenris', 'chaos'], content), L);
    assert.deepEqual(withL.terrain, plain.terrain); assert.deepEqual(withL.sites.slice(0, plain.sites.length), plain.sites); assert.equal(withL.sites.length, plain.sites.length + 2);
    assert.deepEqual(mapFromSeed(seed, E, X, lairSpecs(['fenris', 'chaos'], content), L), withL);
    const [a, b] = withL.sites.slice(-2);
    assert.deepEqual([a.lair, b.lair, a.floors, b.floors, a.id, b.id], ['fenris', 'chaos', 1, 1, plain.sites.length, plain.sites.length + 1]);
    assert.equal(b.level, L.chaosLevel); assert.equal(a.level, E + Math.trunc(a.dist / X.siteLevelDiv) + L.levelBonus);
    for (const s of [a, b]) {
      assert.ok(s.dist >= L.minDist - 4, `seed ${seed}: dist ${s.dist}`); assert.ok(pathTo(withL, content, withL.start.x, withL.start.y, s.x, s.y), `seed ${seed}: unreachable`);
      for (const o of withL.sites) if (o !== s) assert.ok(Math.abs(o.x - s.x) + Math.abs(o.y - s.y) >= X.siteSpacing, `seed ${seed}: spacing`);
    }
  }
  for (let seed = 1; seed <= 30; seed++) { // a crowd of lairs still keeps its distance from every site and from each other
    const m = mapFromSeed(seed, 20, X, lairSpecs(['fenris', 'fenris', 'fenris', 'fenris', 'fenris', 'fenris'], content), L);
    for (const a of m.sites) for (const b of m.sites) if (a.id < b.id) assert.ok(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= X.siteSpacing, `seed ${seed}: sites ${a.id} and ${b.id}`);
  }
  let far = 0; for (let seed = 1; seed <= 200; seed++) { const m = mapFromSeed(seed, 20, X, lairSpecs(['fenris'], content), L); if (m.sites.at(-1).dist >= L.minDist) far++; }
  assert.ok(far >= 190, `${far} of 200 lairs at the full distance`);
});

test('lairs: a fight through the rules layer; the pack holds the fixed item and the kill, a safe return banks both and the legend is gone for good', () => {
  const s0 = strong(3), st = startExpedition(s0, content, { realm: 'midgard', level: 12, provisions: 60 });
  assert.deepEqual(st.save.expedition.lairs, ['fenris']); valid(st.save);
  const lair = lairOf(st.save); assert.ok(lair && lair.lair === 'fenris');
  let cur = walkTo(st.save, lair); assert.equal(code(() => move(cur, content, 0, 0)), 'not_adjacent');
  const r = enterFloor(cur, content); cur = r.save;
  assert.equal(r.replay.inputs.legend, 'fenris'); assert.equal(r.replay.plan[0].length, 1); assert.equal(r.replay.kind, 'floor');
  assert.equal(r.summary.outcome, 1, 'the party should win this'); assert.equal(r.summary.lair, 'fenris'); assert.equal(r.summary.cleared, true); assert.equal(r.summary.rewards.legend, 'fenris');
  const p = cur.expedition.pack; assert.deepEqual(p.legends, ['fenris']); assert.equal(p.items.length, 1);
  const it = p.items[0], l = content.legendById.fenris;
  assert.deepEqual([it.tier, it.slot, it.kind, it.realm, it.legend, it.set, it.star, it.mulligan, it.held], ['legendary', 'weapon', 'MIT', 'helheim', 'fenris', null, 0, 0, null]);
  assert.deepEqual(it.lines, l.item.lines); assert.equal(it.ilvl, Math.min(50, r.replay.plan[0][0].level));
  assert.equal(p.paragon, L.paragon); assert.equal(p.materials[content.realmById.midgard.rareMaterial], L.hearts); assert.equal(cur.legendsBeaten.length, 0, 'not banked yet'); valid(cur);
  assert.equal(code(() => enterFloor(cur, content)), 'site_cleared');
  const home = returnHome(cur, content); const sv = home.save;
  assert.deepEqual(sv.legendsBeaten, ['fenris']); assert.equal(sv.items.filter((x) => x.legend === 'fenris').length, 1); assert.deepEqual(home.summary.legends, ['fenris']); valid(sv);
  assert.deepEqual(lairsFor(sv, content, 12), []);
  assert.equal(code(() => salvage(sv, content, sv.items.find((x) => x.legend).id)), 'legendary_kept');
});

test('lairs: a legendary item is never turned away by a full stash and does not count towards it', () => {
  const s = strong(4); const extra = content.items.stashMax;
  for (let i = 0; i < extra; i++) s.items.push({ id: s.nextId++, slot: 'helm', kind: null, tier: 'plain', ilvl: 5, realm: 'midgard', set: null, star: 0, lines: [], held: null, heldStar: null, mulligan: 1 });
  assert.equal(stashCount(s), extra);
  let cur = startExpedition(s, content, { realm: 'asgard', level: 12, provisions: 60 }).save; cur = walkTo(cur, lairOf(cur)); const r = enterFloor(cur, content);
  assert.equal(r.summary.outcome, 1); const home = returnHome(r.save, content);
  assert.equal(home.save.items.filter((x) => x.legend).length, 1); assert.equal(stashCount(home.save), extra); valid(home.save);
});

test('lairs: a wipe loses the pack and the kill; the legend can be fought again', () => {
  const s = builtSave(content, { heroLevel: 1, tier: 'plain', star: 0, ilvl: 1 }, 5); s.unlocked.midgard = 50;
  let cur = startExpedition(s, content, { realm: 'midgard', level: 10, provisions: 60 }).save; cur = walkTo(cur, lairOf(cur));
  const r = enterFloor(cur, content); assert.equal(r.summary.ended, 'wiped'); assert.equal(r.save.expedition, null); assert.deepEqual(r.save.legendsBeaten, []);
  assert.deepEqual(lairsFor(r.save, content, 10), ['fenris']); valid(r.save);
});

test('lairs: the final boss: open after four legends, fixed level, no item; banking its kill sets won', () => {
  const four = ['fenris', 'jormungandr', 'ymir', 'beowulf'], s = beaten(four);
  let cur = startExpedition(s, content, { realm: 'helheim', level: 50, provisions: 60 }).save; assert.deepEqual(cur.expedition.lairs, ['odin', 'chaos']); valid(cur);
  const chaos = expeditionMap(cur.expedition, content).sites.find((x) => x.lair === 'chaos'); assert.equal(chaos.level, 60);
  cur.expedition.pack.legends.push('chaos'); // the fight itself is measured in checks/balance-legends.mjs; here the bank
  const home = returnHome(cur, content); assert.equal(home.save.won, true); assert.deepEqual(home.save.legendsBeaten, [...four, 'chaos']); valid(home.save);
  assert.deepEqual(lairsFor(home.save, content, 50), ['odin']);
});

test('save: the legend keys are checked (unknown ids, won out of step, a prize whose boss stands, a prize twice, a lair the level has not reached)', () => {
  const s = strong(6), mk = () => { const c = structuredClone(s); return c; };
  let c = mk(); c.legendsBeaten = ['nobody']; assert.match(invalid(c), /unknown legend "nobody"/);
  c = mk(); c.won = true; assert.match(invalid(c), /won is set exactly when/);
  c = mk(); c.legendsBeaten = ['chaos']; assert.match(invalid(c), /won is set exactly when/);
  const prize = (id) => ({ id, slot: 'weapon', kind: 'MIT', tier: 'legendary', ilvl: 10, realm: 'helheim', set: null, star: 0, lines: content.legendById.fenris.item.lines, held: null, heldStar: null, mulligan: 0, legend: 'fenris' });
  c = mk(); c.items.push(prize(c.nextId++)); assert.match(invalid(c), /who has not been beaten/);
  c.legendsBeaten = ['fenris']; assert.equal(invalid(c), '');
  c.items.push(prize(c.nextId++)); assert.match(invalid(c), /exists twice/);
  c = mk(); c.legendsBeaten = ['fenris']; c.items.push({ ...prize(c.nextId++), slot: 'helm', kind: null }); assert.match(invalid(c), /is not the legendary weapon/);
  c = startExpedition(strong(7), content, { realm: 'midgard', level: 12, provisions: 10 }).save; c.expedition.lairs = ['odin']; assert.match(invalid(c), /unknown legend or one the expedition level has not reached/);
});

test('save: a save from before the legends gets its keys, and loads', () => {
  const old = strong(8); delete old.legendsBeaten; delete old.won;
  const st = startExpedition(strong(9), content, { realm: 'midgard', level: 12, provisions: 10 }).save, o2 = structuredClone(st); o2.expedition.floors.pop(); delete o2.expedition.lairs; // an expedition begun before the legends: no lair, one entry fewer delete o2.expedition.pack.legends;
  assert.ok(invalid(old).length > 0); fillDefaults(old); valid(old);
  fillDefaults(o2); assert.deepEqual([o2.expedition.lairs, o2.expedition.pack.legends], [[], []]); valid(o2);
});
