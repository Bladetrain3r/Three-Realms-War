import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, rawContent } from '../helpers/content.mjs';
import { mkDef, ctxWith, scripted } from '../helpers/units.mjs';
import { builtSave } from '../../checks/expedition-bot.mjs';
import { buildHeroUnit } from '../../sim/hero.js';
import { buildLegend } from '../../sim/monster.js';
import { makeUnit, statOf } from '../../sim/unit.js';
import { enterPhases, PHASE } from '../../sim/phase.js';
import { indexContent } from '../../sim/content.js';
import { createFloorReplay, verifyReplay, itemsById } from '../../sim/index.js';

const party = (hl, tier, star, ilvl, seed = 1) => { const s = builtSave(content, { heroLevel: hl, tier, star, ilvl, withLines: true }, seed), by = itemsById(s); return s.party.map((id) => buildHeroUnit(s.heroes.find((h) => h.id === id), by, content)); };
const fight = (legend, level, p, seed = 7, c = content) => createFloorReplay({ realm: 'midgard', level, seed, boss: true, legend, party: p, heroHp: null }, c);

test('legends: six of them, one final, each phase list falls from 10000 and names legend skills only', () => {
  assert.equal(content.legends.length, 6);
  assert.deepEqual(content.legends.filter((l) => l.final).map((l) => l.id), ['chaos']);
  for (const l of content.legends) {
    assert.equal(l.phases[0].atBp, 10000, l.id);
    l.phases.forEach((p, j) => { if (j) assert.ok(p.atBp < l.phases[j - 1].atBp, `${l.id} ${j}`); for (const s of p.skills) assert.equal(content.skillById[s].owner, 'legend', s); });
    assert.equal(l.item === null, l.final, l.id);
  }
});

test('phase: entering is by HP threshold, in order, once each; a big drop enters several phases at once; skills, cooldowns and stat bonuses change', () => {
  const l = content.legendById.fenris, def = buildLegend(l, 30, 'midgard', content), ev = [], ctx = ctxWith(scripted([]), ev);
  const u = makeUnit({ ...def, slot: 0 }, 4, 1, 0, null, content);
  assert.deepEqual([u.phase, u.skillIds], [0, l.phases[0].skills]);
  enterPhases(ctx, u); assert.deepEqual(ev, []); // full HP: nothing
  const mit0 = statOf(u, 'MIT', content), spd0 = statOf(u, 'SPD', content);
  u.hp = Math.floor(u.maxHp * l.phases[1].atBp / 10000) + 1; enterPhases(ctx, u); assert.equal(u.phase, 0); assert.deepEqual(ev, []); // one HP above the line
  u.hp -= 1; u.cd = [3, 2]; enterPhases(ctx, u);
  assert.deepEqual(ev, [[PHASE, 4, 1]]); assert.deepEqual([u.phase, u.skillIds, u.cd], [1, l.phases[1].skills, [0, 0, 0, 0]]);
  assert.ok(statOf(u, 'MIT', content) > mit0 && statOf(u, 'SPD', content) > spd0);
  enterPhases(ctx, u); assert.equal(ev.length, 1); // entering twice is a no-op
  u.hp = 1; enterPhases(ctx, u); assert.deepEqual(ev.slice(1), [[PHASE, 4, 2]]); // at 3300 bp the third phase
  const m = statOf(u, 'MIT', content); assert.equal(m, Math.max(1, Math.floor(def.stats.MIT.base * (10000 + l.phases[1].mods.MIT + l.phases[2].mods.MIT) / 10000)));
  const u2 = makeUnit({ ...def, slot: 0 }, 4, 1, 0, null, content); u2.hp = 1; ev.length = 0; enterPhases(ctx, u2);
  assert.deepEqual(ev, [[PHASE, 4, 1], [PHASE, 4, 2]]); // two thresholds crossed at once: both, in order
});

test('phase: the line itself counts (HP exactly at the threshold enters, one above does not)', () => {
  const l = content.legendById.odin, def = { ...buildLegend(l, 30, 'midgard', content), maxHp: 10000 }, ev = [], ctx = ctxWith(scripted([]), ev);
  const u = makeUnit({ ...def, slot: 0 }, 4, 1, 0, 10000, content);
  u.hp = 6601; enterPhases(ctx, u); assert.equal(u.phase, 0);
  u.hp = 6600; enterPhases(ctx, u); assert.equal(u.phase, 1);
});

test('phase: in a whole fight the PHASE events follow the HP line exactly and the boss only uses its current phase\'s skills', () => {
  const r = fight('fenris', 12, party(30, 'heirloom', 4, 20), 11), l = content.legendById.fenris, id = 4, T = r.tables.skills;
  const max = r.plan[0][0].maxHp; let hp = max, phase = 0, seen = [], used = new Set();
  for (const e of r.events) {
    if (e[0] === 4 && e[2] === id) hp = e[5];
    if (e[0] === 7 && e[1] === id) hp = Math.max(0, hp - e[3]);
    if (e[0] === PHASE) { phase++; seen.push(e[2]); assert.equal(e[2], phase); assert.ok(hp * 10000 <= l.phases[phase].atBp * max, `hp ${hp} at phase ${phase}`); }
    if (e[0] === 3 && e[1] === id) { // an action: every threshold already crossed has been entered
      if (phase < l.phases.length - 1) assert.ok(hp * 10000 > l.phases[phase + 1].atBp * max, 'a threshold crossed but not entered');
      used.add(`${phase}:${T[e[2]]}`);
    }
  }
  assert.deepEqual(seen, [1, 2]);
  for (const u of used) { const [p, s] = u.split(':'); assert.ok(l.phases[Number(p)].skills.includes(s), u); }
  assert.ok(r.events.filter((e) => e[0] === 11).length === 1);
});

test('legend fight: a floor replay of one encounter with the boss alone; same seed, same hash; it verifies, and a changed input does not', () => {
  const p = party(40, 'heirloom', 5, 30), a = fight('jormungandr', 22, p, 5), b = fight('jormungandr', 22, p, 5);
  assert.equal(a.hash, b.hash); assert.equal(a.kind, 'floor'); assert.equal(a.inputs.legend, 'jormungandr');
  assert.equal(a.plan.length, 1); assert.equal(a.plan[0].length, 1); assert.equal(a.plan[0][0].boss, true); assert.equal(a.plan[0][0].level, 22);
  assert.deepEqual(verifyReplay(a, content), { ok: true, resimulated: true, reasons: [] });
  const c = fight('jormungandr', 22, p, 6); assert.notEqual(a.hash, c.hash);
  const t = JSON.parse(JSON.stringify(a)); t.inputs.legend = 'fenris'; assert.equal(verifyReplay(t, content).ok, false);
});

test('legend fight: the round cap is the legend one, not the 30 of a delve', () => {
  const raw = structuredClone(rawContent); raw.tables.legend.roundCap = 2;
  const c2 = indexContent(raw), r = fight('odin', 30, party(20, 'plain', 0, 20), 3, c2);
  assert.equal(r.result.outcome, 0); assert.ok(r.events.find((e) => e[0] === 11)[2] <= 2);
  const wide = fight('fenris', 12, party(50, 'heirloom', 5, 50), 3); assert.equal(wide.result.outcome, 1);
});

test('legend stats: the legend multipliers apply to the boss profile (VIG and the rest) and the realm is the expedition\'s', () => {
  const l = content.legendById.ymir, m = buildLegend(l, 30, 'asgard', content), plain = buildLegend({ ...l, vigBp: content.tables.enemy.bossVigBp, otherBp: content.tables.enemy.bossOtherBp }, 30, 'asgard', content);
  assert.equal(m.realm, 'asgard'); assert.equal(m.boss, true); assert.ok(m.maxHp > plain.maxHp * 3); assert.equal(m.phases.length, 3);
  assert.ok(m.stats.MIT.base > plain.stats.MIT.base);
});
