// content/ must equal the tables in DESIGN.md, row by row and number by number. The design is the stone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { rowsOf, slug, TYPE_NAME, parseRiders, proseRaw, clean } from '../helpers/mdtables.mjs';

const STATS = ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD'];
const nums = (a) => a.map(Number);
const statsOf = (cells) => Object.fromEntries(STATS.map((s, i) => [s, Number(cells[i])]));
const byId = (id) => content.skillById[id];

// Compare one skill row (id, name?, type, range, target, power, element, cd, riders) with the content skill.
function sameSkill(sk, { id, name, type, range, target, power, element, cd, riders, owner }) {
  assert.ok(sk, `content has no skill ${id}`);
  if (name !== undefined) assert.equal(sk.name, name, id);
  assert.equal(sk.type, TYPE_NAME[type] || type, `${id} type`);
  assert.equal(sk.range, range, `${id} range`);
  assert.equal(sk.target, target, `${id} target`);
  assert.equal(sk.power, Number(power), `${id} power`);
  assert.equal(sk.element, element, `${id} element`);
  assert.equal(sk.cooldown, Number(cd), `${id} cooldown`);
  const p = parseRiders(riders);
  assert.deepEqual(sk.riders, p.riders, `${id} riders`);
  assert.equal(sk.lifestealBp || 0, p.lifestealBp, `${id} lifesteal`);
  if (owner !== undefined) assert.equal(sk.owner, owner, `${id} owner`);
}

test('design tables: 7.3 the 15 hero classes, every number', () => {
  const rows = rowsOf('7.3 Classes');
  assert.equal(rows.length, 15);
  assert.equal(content.heroes.length, 15);
  rows.forEach(([id, name, realm, rarity, role, atk, ...st], i) => {
    const h = content.heroes[i];
    assert.deepEqual(
      { id: h.id, name: h.name, realm: h.realm, rarity: h.rarity, role: h.role, row: h.row, attack: h.attack, stats: h.stats },
      { id, name, realm: realm.toLowerCase(), rarity, role: role.slice(0, -2), row: role.endsWith(' F') ? 'front' : 'back', attack: atk, stats: statsOf(st) }, id);
  });
});

test('design tables: 7.4 the 33 hero skills, every number, and each class lists its own in table order', () => {
  const rows = rowsOf('7.4 Skills');
  assert.equal(rows.length, 33);
  for (const [id, name, cls, type, range, target, power, element, cd, riders] of rows) {
    sameSkill(byId(id), { id, name, type, range, target, power, element, cd, riders, owner: cls });
  }
  for (const h of content.heroes) assert.deepEqual(h.skills, rows.filter((r) => r[2] === h.id).map((r) => r[0]), h.id);
  assert.equal(content.skills.filter((s) => content.heroById[s.owner]).length, 33);
});

test('design tables: 7.3 basic attacks (Strike, Shoot, Bolt) at power 10000, no cooldown, no element', () => {
  for (const [id, type, range] of [['strike', 'physical', 'melee'], ['shoot', 'physical', 'ranged'], ['bolt', 'magic', 'ranged']]) {
    const s = byId(id);
    assert.deepEqual([s.type, s.range, s.target, s.power, s.element, s.cooldown, s.riders.length], [type, range, 'enemy', 10000, 'none', 0, 0], id);
  }
});

test('design tables: 8.2 tiers', () => {
  const rows = rowsOf('8.2 Tiers');
  assert.equal(content.items.tiers.length, rows.length);
  rows.forEach(([name, mult, lines, maxStar, setOk], i) => {
    const t = content.items.tiers[i];
    assert.deepEqual([t.name, t.id, t.multiplierBp, t.lines, t.maxStar, t.setAllowed], [name, name.toLowerCase(), Number(mult), Number(lines), Number(maxStar), setOk === 'yes'], name);
  });
});

test('design tables: 8.3 the ten bonus lines and their ranges', () => {
  const ids = ['VIG_PCT', 'MIT_PCT', 'ARC_PCT', 'GRD_PCT', 'WRD_PCT', 'SPD_PCT', 'CRIT', 'CRITDMG', 'SRES', 'RES_REALM'];
  const rows = rowsOf('8.3 Bonus lines');
  assert.equal(rows.length, 10);
  rows.forEach(([n, kind, range], i) => {
    const [lo, hi] = range.match(/\d+/g).map(Number), l = content.items.lines[i];
    assert.deepEqual([l.index, l.id, l.lo, l.hi], [Number(n), ids[i], lo, hi], kind);
  });
});

test('design tables: 8.1 slot main stats per item level', () => {
  const rows = rowsOf('8.1 Slots and main stats'), S = content.items.slots;
  assert.equal(rows.length, 4);
  assert.deepEqual(content.items.slotOrder, rows.map((r) => r[0]));
  const by = Object.fromEntries(rows.map((r) => [r[0], clean(r[1])]));
  const [w1, w2] = proseCells(by.weapon, /^(\d+) MIT or (\d+) ARC/);
  assert.deepEqual(S.weapon.main, [{ stat: 'MIT_OR_ARC', coef: w1 }]); assert.equal(w1, w2);
  const [a1, a2] = proseCells(by.armour, /^(\d+) GRD and (\d+) VIG/);
  assert.deepEqual(S.armour.main, [{ stat: 'GRD', coef: a1 }, { stat: 'VIG', coef: a2 }]);
  const [h1, h2] = proseCells(by.helm, /^(\d+) WRD and (\d+) VIG/);
  assert.deepEqual(S.helm.main, [{ stat: 'WRD', coef: h1 }, { stat: 'VIG', coef: h2 }]);
  const [c1, c2] = proseCells(by.charm, /^(\d+) SPD, and (\d+) bp x i/);
  assert.deepEqual(S.charm, { main: [{ stat: 'SPD', coef: c1 }], resistBpPerLevel: c2 });
});
function proseCells(text, re) { const m = re.exec(text); assert.ok(m, `cannot read "${text}"`); return m.slice(1).map(Number); }

test('design tables: 8.5 set bonuses and the three set skills', () => {
  const rows = rowsOf('8.5 Sets', 0);
  assert.equal(content.items.sets.length, 3);
  rows.forEach(([name, realm, two, four], i) => {
    const s = content.items.sets[i];
    assert.deepEqual([s.name, s.realm], [name, realm.toLowerCase()]);
    assert.equal(s.four.skill, /grants the skill (\w+)/.exec(clean(four))[1], name);
    const stat = /^(VIG|SPD) \+(\d+) bp$/.exec(clean(two)), frost = /^frost resist \+(\d+), SRES \+(\d+)$/.exec(clean(two));
    if (stat) assert.deepEqual(s.two, { mods: { [stat[1]]: Number(stat[2]) } }, name);
    else { assert.ok(frost, `cannot read "${two}"`); assert.deepEqual(s.two, { res: { frost: Number(frost[1]) }, sresBp: Number(frost[2]) }, name); }
  });
  for (const [id, name, type, range, target, power, element, cd, riders] of rowsOf('8.5 Sets', 1)) sameSkill(byId(id), { id, name, type, range, target, power, element, cd, riders, owner: 'set' });
  assert.equal(content.skills.filter((s) => s.owner === 'set').length, 3);
});

test('design tables: 5.6 the seven statuses', () => {
  const rows = rowsOf('5.6 Statuses');
  assert.deepEqual(content.statuses.map((s) => s.id), rows.map((r) => r[0]));
  const eff = {
    burn: (t) => ({ tickDamageBp: Number(/mulbp\(maxHP, (\d+)\)/.exec(t)[1]) }),
    chill: (t) => ({ mods: { SPD: Number(/SPD (-\d+) bp/.exec(t)[1]) } }),
    shock: (t) => ({ skipsAction: /skips the bearer's next action/.test(t), immuneTurns: Number(/immune to shock for (\d+) turns/.exec(t)[1]), bossImmune: /bosses are immune/.test(t) }),
    mark: (t) => ({ damageTakenBp: Number(/takes \+(\d+) bp damage/.exec(t)[1]) }),
    bulwark: (t) => ({ mods: { GRD: Number(/\+(\d+) bp/.exec(t)[1]), WRD: Number(/\+(\d+) bp/.exec(t)[1]) } }),
    fury: (t) => ({ mods: { MIT: Number(/\+(\d+) bp/.exec(t)[1]), ARC: Number(/\+(\d+) bp/.exec(t)[1]) } }),
    mend: (t) => ({ tickHealBp: Number(/mulbp\(maxHP, (\d+)\)/.exec(t)[1]) }),
  };
  for (const [id, kind, effect, dur] of rows) {
    const s = content.statusById[id];
    assert.deepEqual(s, { id, kind, duration: Number(dur), ...eff[id](clean(effect)) }, id);
  }
});

test('design tables: realms: 6 (cycle), 7.1 (affinity) and 10.1 (dungeons, materials, bosses)', () => {
  const dung = rowsOf('10.1 The three dungeons'), aff = rowsOf('7.1 Realm affinity stats'), cyc = rowsOf('6. Elements');
  assert.equal(content.realms.length, 3);
  dung.forEach(([realm, dungeon, element, weak, mat, rare, boss], i) => {
    const r = content.realms[i];
    assert.deepEqual([r.id, r.name, r.dungeon, r.element, r.weakTo, r.material, r.rareMaterial], [realm.toLowerCase(), realm, dungeon, element, weak, slug(mat), slug(rare)], realm);
    assert.equal(content.bossById[r.boss].name, boss, realm);
    assert.equal(content.bossById[r.boss].realm, r.id);
  });
  aff.forEach(([realm, stats, res], i) => {
    assert.deepEqual(content.realms[i].affinityStats, stats.split(',').map((x) => x.trim()), realm);
    assert.equal(content.realms[i].element, res.split(' ')[1] ? /(fire|frost|lightning)/.exec(res)[1] : res, realm);
  });
  cyc.forEach(([realm, element, resist, weak]) => {
    const r = content.realmById[realm.toLowerCase()];
    assert.equal(r.element, element);
    assert.equal(Number(/(-?\d+)/.exec(resist)[1]), content.tables.enemy.ownResistBp, `${realm} own resist`);
    assert.equal(Number(/(-?\d+)/.exec(weak)[1]), content.tables.enemy.weakResistBp, `${realm} weak`);
    assert.equal(/(fire|frost|lightning)/.exec(weak)[1], r.weakTo);
  });
  const raw = proseRaw(/Midgard\s+`(\w+) (\d+)\/(\d+)`,\s+Asgard\s+`(\w+) (\d+)\/(\d+)`,\s+Helheim\s+`(\w+) (\d+)\/(\d+)`/, 'realm riders');
  ['midgard', 'asgard', 'helheim'].forEach((id, i) => {
    const [st, ch, du] = raw.slice(i * 3, i * 3 + 3);
    assert.deepEqual(content.realmById[id].realmRider, { status: st, chance: Number(ch), duration: Number(du) }, id);
  });
});

test('design tables: 10.2 the eight archetypes and their skills', () => {
  const rows = rowsOf('10.2 Monster archetypes', 0), skills = rowsOf('10.2 Monster archetypes', 1);
  assert.equal(content.archetypeById.brute !== undefined && rows.length, 8);
  rows.forEach(([id, pos, atk, ...rest]) => {
    const a = content.archetypeById[id];
    assert.deepEqual([a.position, a.attack, a.stats, a.threat, a.skill], [pos === 'F' ? 'front' : 'back', atk, statsOf(rest), Number(rest[6]), rest[7]], id);
  });
  assert.equal(skills.length, 8);
  for (const [id, type, range, target, power, cd, other] of skills) {
    const sk = byId(id), plain = other.replace(/\(no realm rider\)/, ''), realm = /realm rider/.test(plain);
    sameSkill(sk, { id, type, range, target, power, element: type === 'P' || type === 'M' ? 'realm' : 'none', cd, riders: other.replace(/only if an ally is below \d+ bp/, ''), owner: 'archetype' });
    assert.equal(Boolean(sk.realmRider), realm, `${id} realmRider`);
    const below = /only if an ally is below (\d+) bp/.exec(other);
    assert.equal(sk.healBelowBp, below ? Number(below[1]) : undefined, `${id} healBelowBp`);
  }
});

test('design tables: 10.3 the 36 monsters, their bands, and the 12 specials', () => {
  const rows = rowsOf('10.3 The 36 monsters', 0), specials = rowsOf('10.3 The 36 monsters', 1);
  assert.equal(content.roster.length, 36);
  const archetypeFor = (n, role, realm) => (n <= 8 ? role : n === 12 ? (realm === 'helheim' ? 'hexer' : 'skirmisher') : role.replace('signature ', ''));
  const sigNote = proseRaw(/Drake Whelp and Storm-Raven are\s+(\w+),\s+the\s+Banshee\s+a\s+(\w+)\)/, 'row 12 archetypes');
  assert.deepEqual(sigNote, ['skirmishers', 'hexer']);
  rows.forEach(([n, role, ...rest]) => {
    const band = Number(rest.pop()), row = Number(n);
    ['midgard', 'asgard', 'helheim'].forEach((realm, k) => {
      const m = /^(.*?) \(`?(\w+)`?\)$/.exec(rest[k]), name = m ? m[1] : rest[k], special = m ? m[2] : null;
      const c = content.roster.find((x) => x.id === `${realm}_${slug(name)}`);
      assert.ok(c, `no content monster for ${realm} ${name}`);
      assert.deepEqual([c.name, c.realm, c.archetype, c.signature, c.special, c.band], [name, realm, archetypeFor(row, role, realm), row > 8, special, band], `${realm} ${name}`);
    });
  });
  assert.equal(specials.length, 12);
  for (const [id, type, range, target, power, cd, riders] of specials) {
    const sk = byId(id);
    sameSkill(sk, { id, type, range, target, power, element: type === 'P' || type === 'M' ? 'realm' : 'none', cd, riders, owner: 'special' });
    assert.equal(Boolean(sk.realmRider), /realm rider/.test(riders), `${id} realmRider`);
  }
});

test('design tables: 10.4 the three bosses and their two skills each', () => {
  const rows = rowsOf('10.4 Bosses and monster behaviour');
  assert.equal(rows.length, 3);
  for (const [boss, s1, s2] of rows) {
    const b = content.bossById[boss.toLowerCase()];
    assert.ok(b, boss);
    [[s1, 2], [s2, 4]].forEach(([cell, cd], j) => {
      const m = /^(.+?): (\w+) (\w+) (\w+) (\d+) (\w+)(?:, (.*))?$/.exec(clean(cell));
      assert.ok(m, `cannot read "${cell}"`);
      assert.equal(b.skills[j], slug(m[1]), boss);
      sameSkill(byId(b.skills[j]), { id: b.skills[j], name: m[1], type: m[2], range: m[3], target: m[4], power: m[5], element: m[6], cd, riders: m[7] || '', owner: 'boss' });
    });
  }
});

test('design tables: 10.5 the eight affixes', () => {
  const rows = rowsOf('10.5 Delve generation');
  assert.equal(content.affixes.length, 8);
  const eff = {
    Hardy: (t) => ({ mods: { VIG: Number(/\+(\d+) bp/.exec(t)[1]) } }),
    Swift: (t) => ({ mods: { SPD: Number(/\+(\d+) bp/.exec(t)[1]) } }),
    Brutal: (t) => { const v = Number(/\+(\d+) bp/.exec(t)[1]); return { mods: { MIT: v, ARC: v } }; },
    Armoured: (t) => { const v = Number(/\+(\d+) bp/.exec(t)[1]); return { mods: { GRD: v, WRD: v } }; },
    Resolute: (t) => ({ sresBp: Number(/\+(\d+) bp/.exec(t)[1]) }),
    Vampiric: (t) => ({ lifestealBp: Number(/lifesteal (\d+) bp/.exec(t)[1]) }),
    Regenerating: (t) => ({ regenBp: Number(/\((\d+)% max HP/.exec(t)[1]) * 100 }),
    Marking: (t) => { const m = /add mark (\d+)\/(\d+)/.exec(t); return { riders: [{ status: 'mark', chance: Number(m[1]), duration: Number(m[2]), on: 'target' }] }; },
  };
  rows.forEach(([name, minD, effect], i) => {
    const a = content.affixes[i];
    assert.deepEqual(a, { id: slug(name), name, minLevel: Number(minD), effect: eff[name](clean(effect)) }, name);
  });
});

test('design tables: 9.1 to 9.3 the runbook vocabulary', () => {
  const R = content.runbook, cond = rowsOf('9.1 Conditions'), act = rowsOf('9.2 Actions'), sel = rowsOf('9.3 Target selectors');
  assert.deepEqual(R.conditions.map((c) => c.id), cond.map((r) => r[0]));
  assert.equal(R.conditions.length, 16);
  for (const [id, args] of cond) {
    const c = R.conditions.find((x) => x.id === id), text = clean(args);
    if (text === 'none') { assert.deepEqual(c.args, {}, id); continue; }
    const name = /^(\w+)/.exec(text)[1];
    assert.deepEqual(Object.keys(c.args), [name], id);
    const T = R.argTypes[c.args[name]];
    const range = /(\d+) to (\d+)/.exec(text), step = /step (\d+)/.exec(text);
    if (range) assert.deepEqual([T.min, T.max, T.step], [Number(range[1]), Number(range[2]), step ? Number(step[1]) : undefined], id);
    if (/front, back/.test(text)) assert.deepEqual(T.values, ['front', 'back'], id);
  }
  assert.deepEqual(R.actions.map((a) => [a.id, Object.keys(a.args).join()]), act.map((r) => [r[0], clean(r[1]) === 'none' ? '' : /^(\w+)/.exec(clean(r[1]))[1]]));
  assert.deepEqual(R.selectors.map((s) => [s.id, s.for.join(', ')]), sel.map((r) => [r[0], r[1]]));
  assert.equal(R.selectors.length, 7);
});

test('design tables: 11.3 reputation standings', () => {
  const rows = rowsOf('11.3 Reputation');
  assert.deepEqual(rows.map((r) => [r[0].toLowerCase(), Number(r[1])]), Object.entries(content.tables.progress.rep));
});
