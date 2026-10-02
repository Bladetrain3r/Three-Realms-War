import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { newGame, playDelve, playDelves, validateSave, canonical, GameError, MAX_BATCH } from '../../sim/index.js';

const fresh = (seed = 5) => newGame(content, seed, { savedAt: '', build: 't' });
const strong = (seed) => { const s = fresh(seed); for (const h of s.heroes) h.level = 40; return s; };

test('batch: one delve in a batch is exactly playDelve; three are three playDelve calls in a row on the evolving save', () => {
  const s = strong(1);
  const one = playDelves(s, content, { realm: 'midgard', level: 1 }, 1), single = playDelve(s, content, { realm: 'midgard', level: 1 });
  assert.equal(canonical(one.save), canonical(single.save)); assert.equal(one.runs[0].replay.hash, single.replay.hash);
  const three = playDelves(s, content, { realm: 'midgard', level: 1 }, 3);
  let cur = s; const hashes = [];
  for (let i = 0; i < three.runs.length; i++) { const o = playDelve(cur, content, { realm: 'midgard', level: 1 }); cur = o.save; hashes.push(o.replay.hash); }
  assert.deepEqual(three.runs.map((r) => r.replay.hash), hashes); assert.equal(canonical(three.save), canonical(cur));
  assert.equal(three.runs.length, 3); assert.equal(three.stopped, 'done'); assert.equal(validateSave(three.save, content, saveSchema).ok, true);
});

test('batch: totals are the sums of the runs (silver, xp, materials, reputation, items) and the stop reason is named', () => {
  const r = playDelves(strong(2), content, { realm: 'helheim', level: 1 }, 5), t = r.totals;
  assert.equal(t.delves, r.runs.length);
  assert.equal(t.hacksilver, r.runs.reduce((a, x) => a + x.summary.hacksilver, 0));
  assert.equal(t.xp, r.runs.reduce((a, x) => a + x.summary.xp, 0));
  assert.equal(t.reputation, r.runs.reduce((a, x) => a + x.summary.reputation, 0));
  assert.equal(t.items, r.runs.reduce((a, x) => a + x.summary.items.length, 0));
  const mats = {}; for (const x of r.runs) for (const m of x.summary.materials) mats[m.id] = (mats[m.id] || 0) + m.n;
  assert.deepEqual(t.materials, mats);
  assert.ok(['done', 'lost', 'injury'].includes(r.stopped));
});

test('batch: stops after a lost delve and after an injury, never carrying an injured hero into the next run', () => {
  let lost = 0, injury = 0;
  for (let seed = 1; seed <= 40 && (!lost || !injury); seed++) {
    const s = fresh(seed); s.unlocked.midgard = 6;
    const r = playDelves(s, content, { realm: 'midgard', level: 5, force: [] }, 10);
    if (r.stopped === 'lost') { lost++; assert.equal(r.runs.at(-1).summary.outcome, 0); }
    if (r.stopped === 'injury') { injury++; assert.ok(r.runs.at(-1).summary.injured.length > 0); }
    assert.ok(r.runs.slice(0, -1).every((x) => x.summary.outcome === 1 && x.summary.injured.length === 0), 'only the last run may be a loss or an injury');
    assert.equal(validateSave(r.save, content, saveSchema).ok, true);
  }
  assert.ok(lost + injury > 0, 'the search should have met a stop');
});

test('batch: counts outside 1 to 50 and an injured, unforced party are refused like a single delve', () => {
  const s = fresh();
  for (const n of [0, -1, 1.5, MAX_BATCH + 1, '3']) assert.throws(() => playDelves(s, content, { realm: 'midgard', level: 1 }, n), (e) => e instanceof GameError && e.code === 'bad_count');
  s.heroes[0].injury = 1;
  assert.throws(() => playDelves(s, content, { realm: 'midgard', level: 1 }, 3), (e) => e.code === 'injured_not_forced');
  const forced = playDelves(s, content, { realm: 'midgard', level: 1, force: [s.heroes[0].id] }, 2);
  assert.equal(forced.runs.length, 1, 'a forced hero is still injured afterwards, so the batch stops after one run');
  assert.ok(['injury', 'lost'].includes(forced.stopped));
});
