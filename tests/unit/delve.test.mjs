import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, party, gearedParty, input, heroHpFromEvents } from '../helpers/delve.mjs';
import { createRng } from '../../sim/prng.js';
import { generateDelve, resolveDelve } from '../../sim/delve.js';

const REALMS = ['midgard', 'asgard', 'helheim'];

test('delve: 3,000 generated delves stay inside the design (counts, levels, slots, bosses, affix rules)', () => {
  const dice = createRng(4242);
  const counts = { 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < 3000; i++) {
    const realm = REALMS[dice.range(3)], level = 1 + dice.range(50);
    const enc = generateDelve(createRng(10000 + i), { realm, level }, content);
    assert.ok(enc.length >= 3 && enc.length <= 5);
    counts[enc.length]++;
    enc.forEach((es, k) => {
      const last = k === enc.length - 1;
      assert.equal(es.length, last ? 3 : k === 0 ? 3 : 4, `encounter ${k} of ${enc.length}`);
      assert.deepEqual(es.map((e) => e.slot), [...new Set(es.map((e) => e.slot))].sort((a, b) => a - b));
      assert.ok(es.every((e) => e.slot >= 0 && e.slot <= 3 && e.realm === realm));
      assert.equal(es.filter((e) => e.boss).length, last ? 1 : 0);
      for (const e of es) {
        if (e.boss) { assert.equal(e.level, level + 2); assert.equal(e.slot, 0); assert.deepEqual(e.affixes, []); }
        else {
          assert.equal(e.level, level);
          if (level < 10) assert.deepEqual(e.affixes, []);
          assert.ok(e.affixes.length <= (level >= 25 ? 2 : level >= 10 ? 1 : 0));
          assert.equal(new Set(e.affixes).size, e.affixes.length);
          for (const id of e.affixes) assert.ok(content.affixes.find((a) => a.id === id).minLevel <= level);
        }
      }
    });
  }
  for (const n of [3, 4, 5]) assert.ok(counts[n] > 800 && counts[n] < 1200, `n=${n}: ${counts[n]}`);
});

test('delve: when neither row overflows, front-position units stand in the front row and back-position units in the back', () => {
  let checked = 0;
  for (let i = 0; i < 1500; i++) {
    for (const es of generateDelve(createRng(i), { realm: REALMS[i % 3], level: 1 + (i % 50) }, content)) {
      const pos = (e) => (e.boss ? 'front' : content.archetypeById[e.archetypeId || content.roster.find((m) => m.id === e.monsterId).archetype].position);
      const front = es.filter((e) => pos(e) === 'front'), back = es.filter((e) => pos(e) === 'back');
      if (front.length > 2 || back.length > 2) continue;
      checked++;
      assert.ok(front.every((e) => e.slot <= 1), `front unit in the back row: ${JSON.stringify(es.map((e) => [e.name, e.slot]))}`);
      assert.ok(back.every((e) => e.slot >= 2), `back unit in the front row: ${JSON.stringify(es.map((e) => [e.name, e.slot]))}`);
    }
  }
  assert.ok(checked > 1000, `only ${checked} encounters qualified`);
});

test('delve: the first encounter leans on weak monsters, the boss adds lean strong (DESIGN.md 10.5)', () => {
  const bandOf = (id) => content.roster.find((m) => m.id === id).band;
  const first = [0, 0, 0, 0], adds = [0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) {
    const enc = generateDelve(createRng(i), { realm: 'asgard', level: 5 }, content);
    for (const e of enc[0]) first[bandOf(e.monsterId)]++;
    for (const e of enc.at(-1)) if (!e.boss) adds[bandOf(e.monsterId)]++;
  }
  const share = (a, b) => a[b] / (a[1] + a[2] + a[3]);
  assert.ok(Math.abs(share(first, 1) - 0.6) < 0.05, `first band1 ${share(first, 1)}`);
  assert.ok(Math.abs(share(first, 3) - 0.1) < 0.04);
  assert.ok(Math.abs(share(adds, 3) - 0.4) < 0.05, `adds band3 ${share(adds, 3)}`);
});

test('delve: affix frequency matches the design at levels 12 and 30', () => {
  const rate = (level) => {
    let one = 0, two = 0, total = 0;
    for (let i = 0; i < 1500; i++) for (const es of generateDelve(createRng(i), { realm: 'helheim', level }, content)) for (const e of es) {
      if (e.boss) continue;
      total++; if (e.affixes.length >= 1) one++; if (e.affixes.length === 2) two++;
    }
    return [one / total, two / total];
  };
  const [a12, b12] = rate(12), [a30, b30] = rate(30);
  assert.ok(Math.abs(a12 - 0.3) < 0.03 && b12 === 0, `${a12} ${b12}`);
  assert.ok(Math.abs(a30 - 0.5) < 0.03, `${a30}`);
  assert.ok(Math.abs(b30 - 0.5 * 0.15) < 0.02, `${b30}`);
});

test('delve: a strong party wins a level-1 delve and is paid exactly per DESIGN.md 11.2', () => {
  const r = resolveDelve(input({ level: 1, realm: 'midgard', seed: 21 }), content);
  assert.equal(r.result.outcome, 1);
  const n = r.result.encounters, D = 1, p = content.tables.progress;
  const enc = 10 + 4 * D, mat = 2 + Math.floor(D / 3), sv = 5 + D;
  assert.equal(r.result.rewards.xp, (n - 1) * enc + 2 * enc);
  assert.equal(r.result.rewards.materials.forge_iron, (n - 1) * mat + 2 * mat);
  assert.equal(r.result.rewards.materials.ember_heart, 1);
  assert.equal(r.result.rewards.hacksilver, (n - 1) * sv + 3 * sv);
  assert.equal(r.result.rewards.reputation, p.repWin + p.repBoss);
  assert.equal(r.result.cleared, n);
  assert.ok(r.result.rewards.items.length >= 1);
  assert.ok(r.result.rewards.items.every((it) => it.ilvl === D && it.realm === 'midgard' && it.id === 0));
  assert.deepEqual(r.events.at(-1), [13, 1, n]);
});

test('delve: the documented level-20 reward arithmetic holds for a real delve (DESIGN.md WE-22)', () => {
  // Seeds that give exactly 4 encounters (3 + the boss).
  let found = 0;
  for (let s = 1; s < 200 && found < 3; s++) {
    const r = resolveDelve(input({ level: 20, seed: s, party: gearedParty(50, { ilvl: 30, tier: 'heirloom', star: 5 }) }), content);
    if (r.result.encounters !== 4 || r.result.outcome !== 1) continue;
    found++;
    assert.equal(r.result.rewards.xp, 450);
    assert.equal(r.result.rewards.materials.forge_iron, 40);
    assert.equal(r.result.rewards.hacksilver, 150);
  }
  assert.equal(found, 3);
});

test('delve: a losing party is paid nothing, everyone downed is injured, and the loss is logged', () => {
  const r = resolveDelve(input({ level: 40, party: party(1), seed: 5 }), content);
  assert.equal(r.result.outcome, 0);
  assert.equal(r.result.rewards, null);
  assert.deepEqual(r.result.injured, [0, 1, 2, 3]);
  assert.ok(r.result.cleared < r.result.encounters);
  assert.deepEqual(r.events.at(-1).slice(0, 2), [13, 0]);
});

test('delve: injured heroes are exactly those at 0 HP, reconstructible from the events alone', () => {
  let sawInjuredWin = false, sawLoss = false;
  const mixed = party(30);
  mixed[2] = party(2)[2];
  for (let s = 1; s <= 60; s++) {
    const level = [1, 8, 15, 25][s % 4];
    const inp = input({ level, seed: s, party: mixed });
    const r = resolveDelve(inp, content);
    // no REST for a hero who is down
    const live = mixed.map((m) => m.maxHp);
    for (const e of r.events) {
      if (e[0] === 4 && e[2] < 4) live[e[2]] = e[5];
      else if (e[0] === 5 && e[2] < 4) live[e[2]] = e[4];
      else if (e[0] === 7 && e[1] < 4) live[e[1]] += e[2] === 0 ? -e[3] : e[3];
      else if (e[0] === 12) { assert.ok(live[e[1]] > 0, `seed ${s}: rested a downed hero`); live[e[1]] = e[2]; }
    }
    const hp = heroHpFromEvents(r.events, mixed);
    const zero = hp.map((h, i) => (h === 0 ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(r.result.injured, zero, `seed ${s}`);
    hp.forEach((h, i) => assert.ok(h >= 0 && h <= mixed[i].maxHp));
    if (r.result.outcome === 1 && zero.length) sawInjuredWin = true;
    if (r.result.outcome === 0) sawLoss = true;
  }
  assert.ok(sawInjuredWin, 'a win with a downed hero should occur in 60 runs');
  assert.ok(sawLoss, 'a loss should occur in 60 runs');
});

test('delve: between encounters living heroes recover 20% of max HP (and the downed do not)', () => {
  const p = party(50);
  for (let s = 1; s < 30; s++) {
    const r = resolveDelve(input({ level: 12, seed: s, party: p }), content);
    const rests = r.events.filter((e) => e[0] === 12);
    if (r.result.encounters > 1) assert.ok(rests.length >= 1 || r.result.outcome === 0);
    let hp = p.map((x) => x.maxHp), i = 0;
    for (const e of r.events) {
      if (e[0] === 4 && e[2] < 4) hp[e[2]] = e[5];
      else if (e[0] === 5 && e[2] < 4) hp[e[2]] = e[4];
      else if (e[0] === 7 && e[1] < 4) hp[e[1]] += e[2] === 0 ? -e[3] : e[3];
      else if (e[0] === 12) {
        assert.ok(hp[e[1]] > 0, 'the downed are not rested');
        assert.equal(e[2], Math.min(p[e[1]].maxHp, hp[e[1]] + Math.floor(p[e[1]].maxHp * 2000 / 10000)));
        hp[e[1]] = e[2]; i++;
      }
    }
  }
});

test('delve: event log framing: one ENC_START/ENC_END pair per fight, encounters in order, one DELVE_END', () => {
  const r = resolveDelve(input({ level: 10, seed: 77 }), content);
  const starts = r.events.filter((e) => e[0] === 0).map((e) => e[1]), ends = r.events.filter((e) => e[0] === 11);
  assert.deepEqual(starts, starts.map((_, i) => i));
  assert.equal(starts.length, ends.length);
  assert.equal(r.events.filter((e) => e[0] === 13).length, 1);
  assert.equal(r.plan.length, r.result.encounters);
  assert.ok(r.skills.every((s) => typeof s === 'string'));
});

test('delve: the same input is byte-identical and a different seed differs', () => {
  const a = JSON.stringify(resolveDelve(input({ level: 14, seed: 9 }), content));
  assert.equal(JSON.stringify(resolveDelve(input({ level: 14, seed: 9 }), content)), a);
  assert.notEqual(JSON.stringify(resolveDelve(input({ level: 14, seed: 10 }), content)), a);
});

test('delve: drop rates: threads about 3%, ordinary encounter items about 25%, set tags only when allowed', () => {
  let wins = 0, threads = 0, ordinary = 0, ordinaryTotal = 0, tagged = 0, taggedOn = 0;
  const p = party(50);
  for (let s = 1; s <= 1500; s++) {
    const on = s % 2 === 0;
    const r = resolveDelve(input({ level: 1, seed: s, party: p, setAllowed: on }), content);
    if (r.result.outcome !== 1) continue;
    wins++; threads += r.result.rewards.threads;
    ordinary += r.result.rewards.items.length - 1; ordinaryTotal += r.result.encounters - 1;
    for (const it of r.result.rewards.items) { if (it.set) { if (on) taggedOn++; else tagged++; } }
  }
  assert.ok(wins > 1400);
  assert.ok(Math.abs(threads / wins - 0.03) < 0.012, `threads ${threads / wins}`);
  assert.ok(Math.abs(ordinary / ordinaryTotal - 0.25) < 0.03, `items ${ordinary / ordinaryTotal}`);
  assert.equal(tagged, 0);
  assert.ok(taggedOn > 0);
});

test('delve: party size must be 1 to 4', () => {
  assert.throws(() => resolveDelve(input({ party: [] }), content), RangeError);
  assert.throws(() => resolveDelve(input({ party: [...party(5), ...party(5)] }), content), RangeError);
});

test('delve: a three-hero party fights in slots 0 to 2, and explicit slots survive gaps', () => {
  const three = party(50).slice(0, 3);
  const r = resolveDelve(input({ level: 1, seed: 3, party: three }), content);
  assert.equal(r.result.outcome, 1);
  const gap = party(50).slice(0, 2).map((d, i) => ({ ...d, slot: i === 0 ? 0 : 3 }));
  const g = resolveDelve(input({ level: 1, seed: 3, party: gap }), content);
  assert.ok(g.events.some((e) => e[0] === 2 && e[1] === 3));
  assert.ok(!g.events.some((e) => e[0] === 2 && (e[1] === 1 || e[1] === 2)));
});
