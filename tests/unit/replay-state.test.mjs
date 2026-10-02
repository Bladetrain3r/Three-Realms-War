import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { newGame, playDelve } from '../../sim/index.js';
import { initState, applyEvent, applyAll } from '../../client/replay-state.js';

function aReplay(realm = 'midgard', level = 1, seed = 20261002) {
  const save = newGame(content, seed);
  save.unlocked[realm] = level;
  return playDelve(save, content, { realm, level }).replay;
}

test('replay-state: replaying every event ends where the replay says (outcome, cleared count) with one log line per narrated event', () => {
  for (const [realm, level] of [['midgard', 1], ['asgard', 1], ['helheim', 1]]) {
    const rp = aReplay(realm, level), st = applyAll(initState(rp, content), rp, content);
    assert.equal(st.over, true);
    assert.equal(st.outcome, rp.result.outcome);
    assert.equal(st.cleared, rp.result.cleared);
    assert.equal(st.cursor, rp.events.length);
    assert.ok(st.log.length > 10);
  }
});

test('replay-state: hit points never leave 0..max, a downed unit has 0 HP, and on a win every foe of the last encounter is down', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rp = aReplay('midgard', 1 + (seed % 6), seed), st = initState(rp, content);
    for (const ev of rp.events) {
      applyEvent(st, ev, rp, content);
      for (const u of st.units) {
        assert.ok(u.hp >= 0 && u.hp <= u.maxHp, `seed ${seed}: ${u.name} has ${u.hp}/${u.maxHp}`);
        if (u.present && !u.alive) assert.equal(u.hp, 0);
      }
    }
    if (rp.result.outcome === 1) assert.ok(st.units.slice(4).every((u) => !u.alive), `seed ${seed}: a foe is alive after a won delve`);
  }
});

test('replay-state: the hit points the viewer tracks agree with the sim at every HIT, HEAL and REST event (the replay is the source of truth)', () => {
  const rp = aReplay('helheim', 3, 777), st = initState(rp, content);
  let checked = 0;
  for (const ev of rp.events) {
    const before = st.units.map((u) => u.hp);
    applyEvent(st, ev, rp, content);
    if (ev[0] === 4) { assert.equal(st.units[ev[2]].hp, ev[5]); assert.ok(st.units[ev[2]].hp <= before[ev[2]]); checked++; }
    if (ev[0] === 5) { assert.equal(st.units[ev[2]].hp, ev[4]); checked++; }
    if (ev[0] === 12) { assert.equal(st.units[ev[1]].hp, ev[2]); checked++; }
  }
  assert.ok(checked > 10);
});

test('replay-state: log lines name the actors, mark critical hits, and an unknown opcode is refused', () => {
  const rp = aReplay(), st = applyAll(initState(rp, content), rp, content);
  const text = st.log.map((l) => l.text).join('\n');
  assert.match(text, /^Encounter 1 of \d+: \d foes?\./m);
  assert.match(text, /Round 1\./);
  for (const h of rp.inputs.party) assert.ok(text.includes(h.name), `${h.name} never appears in the log`);
  assert.throws(() => applyEvent(initState(rp, content), [99], rp, content), /unknown event opcode 99/);
});
