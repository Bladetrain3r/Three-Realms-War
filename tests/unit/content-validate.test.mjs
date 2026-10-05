import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentTexts, schemaTexts } from '../helpers/content.mjs';
import { validateContent, loadContent, ContentError, FILES } from '../../sim/contentcheck.js';

const schemas = Object.fromEntries(FILES.map((f) => [f, JSON.parse(schemaTexts[f])]));
const fresh = () => Object.fromEntries(FILES.map((f) => [f, JSON.parse(contentTexts[f])]));
const run = (mutate) => { const f = fresh(); mutate(f); return validateContent(f, schemas).errors; };
const find = (arr, id) => arr.findIndex((x) => x.id === id);

// Every refusal must name the file and the key; message is checked loosely.
function refused(errors, file, key, re) {
  const hit = errors.find((e) => e.file === `${file}.json` && e.key === key && (!re || re.test(e.message)));
  assert.ok(hit, `expected ${file}.json ${key} ${re || ''}; got:\n${errors.map((e) => `  ${e.file} ${e.key}: ${e.message}`).join('\n') || '  (no errors)'}`);
}

test('content: the real content bundle is valid', () => assert.deepEqual(validateContent(fresh(), schemas), { ok: true, errors: [] }));

test('content: the schema directory covers exactly the ten content files', () => assert.deepEqual(Object.keys(schemas).sort(), [...FILES].sort()));

const CASES = [
  // [label, file, mutate, key, message pattern]
  ['renamed key in a realm', 'realms', (f) => { f.realms[0].elemnt = f.realms[0].element; delete f.realms[0].element; }, '[0].elemnt', /did you mean "element"/],
  ['the same rename also reports the missing key', 'realms', (f) => { f.realms[0].elemnt = f.realms[0].element; delete f.realms[0].element; }, '[0].element', /missing required key/],
  ['bad element', 'realms', (f) => { f.realms[1].element = 'plasma'; }, '[1].element', /must be one of fire, frost, lightning/],
  ['realm names a boss that does not exist', 'realms', (f) => { f.realms[2].boss = 'nobody'; }, '[2].boss', /unknown boss "nobody"/],
  ['realm weak to its own element', 'realms', (f) => { f.realms[0].weakTo = f.realms[0].element; }, '[0].weakTo', /cannot be weak to its own element/],
  ['two realms share a material', 'realms', (f) => { f.realms[1].material = f.realms[0].material; }, '[1].material', /must differ between realms/],
  ['only two realms', 'realms', (f) => { f.realms.pop(); }, '(root)', /at least 3 items/],
  ['status duration is text', 'statuses', (f) => { f.statuses[3].duration = 'long'; }, '[3].duration', /expected integer, got string/],
  ['a debuff with a positive modifier', 'statuses', (f) => { f.statuses[find(f.statuses, 'chill')].mods.SPD = 3000; }, `[1].mods.SPD`, /must not be positive/],
  ['renamed stats block in a hero', 'heroes', (f) => { f.heroes[2].stat = f.heroes[2].stats; delete f.heroes[2].stats; }, '[2].stat', /did you mean "stats"/],
  ['hero stats missing after the rename', 'heroes', (f) => { f.heroes[2].stat = f.heroes[2].stats; delete f.heroes[2].stats; }, '[2].stats', /missing required key/],
  ['bad rarity tier', 'heroes', (f) => { f.heroes[4].rarity = 'epic'; }, '[4].rarity', /must be one of common, rare, legendary, unique \(got "epic"\)/],
  ['negative stat', 'heroes', (f) => { f.heroes[0].stats.VIG = -3; }, '[0].stats.VIG', /at least 1 \(got -3\)/],
  ['a stat far too large', 'heroes', (f) => { f.heroes[0].stats.MIT = 4000; }, '[0].stats.MIT', /at most 400/],
  ['hero names a skill that does not exist', 'heroes', (f) => { f.heroes[1].skills[0] = 'nonesuch'; }, '[1].skills[0]', /unknown skill "nonesuch"/],
  ['hero uses another class\'s skill', 'heroes', (f) => { f.heroes[1].skills[0] = 'hex'; }, '[1].skills[0]', /belongs to "volva"/],
  ['unknown realm', 'heroes', (f) => { f.heroes[3].realm = 'vanaheim'; }, '[3].realm', /unknown realm "vanaheim"/],
  ['duplicate hero id', 'heroes', (f) => { f.heroes[1].id = f.heroes[0].id; }, '[1].id', /duplicate id "shieldwarden"/],
  ['a common class with three skills', 'heroes', (f) => { f.heroes[0].skills.push('hex'); }, '[0].skills', /a common class has 2 skills/],
  ['skill rider names an unknown status', 'skills', (f) => { f.skills[find(f.skills, 'shield_bash')].riders[0].status = 'poison'; }, `[${0 + 1}].riders[0].status`, /unknown status "poison"/],
  ['skill power is text', 'skills', (f) => { f.skills[0].power = 'big'; }, '[0].power', /expected integer, got string/],
  ['skill type outside the vocabulary', 'skills', (f) => { f.skills[0].type = 'ranged'; }, '[0].type', /must be one of physical, magic, heal, utility, best/],
  ['skill without a cooldown', 'skills', (f) => { delete f.skills[0].cooldown; }, '[0].cooldown', /missing required key/],
  ['"realm" element on a hero skill', 'skills', (f) => { f.skills[0].element = 'realm'; }, '[0].element', /only for monster/],
  ['a basic attack removed', 'skills', (f) => { f.skills.splice(find(f.skills, 'strike'), 1); }, '(root)', /basic attack "strike" is missing/],
  ['a damaging skill that targets allies', 'skills', (f) => { f.skills[find(f.skills, 'shield_bash')].target = 'ally'; }, `[${1}].target`, /damaging skill targets enemies/],
  ['monster of an unknown archetype', 'monsters', (f) => { f.monsters.roster[7].archetype = 'wizard'; }, 'roster[7].archetype', /unknown archetype "wizard"/],
  ['monster band out of range', 'monsters', (f) => { f.monsters.roster[0].band = 4; }, 'roster[0].band', /at most 3/],
  ['signature monster without a special', 'monsters', (f) => { f.monsters.roster[find(f.monsters.roster, 'midgard_warband_chief')].special = null; }, 'roster[24].special', /signature monster needs a special/],
  ['boss with a skill that does not exist', 'monsters', (f) => { f.monsters.bosses[0].skills[1] = 'nonesuch'; }, 'bosses[0].skills[1]', /unknown skill/],
  ['monster special belongs to a hero', 'monsters', (f) => { f.monsters.roster[find(f.monsters.roster, 'midgard_warband_chief')].special = 'hex'; }, 'roster[24].special', /belongs to "volva", expected "special"/],
  ['affix modifier is text', 'monsters', (f) => { f.monsters.affixes[0].effect.mods.VIG = 'lots'; }, 'affixes[0].effect.mods.VIG', /expected integer/],
  ['archetype stat key renamed', 'monsters', (f) => { f.monsters.archetypes[0].stats.VIGOR = 1; delete f.monsters.archetypes[0].stats.VIG; }, 'archetypes[0].stats.VIGOR', /unknown key/],
  ['a tier that does not exist in the drop weights', 'items', (f) => { f.items.drops.tierWeights.epic = 100; }, 'drops.tierWeights.epic', /unknown key "epic"/],
  ['a tier id outside the four', 'items', (f) => { f.items.tiers[1].id = 'epic'; }, 'tiers[1].id', /must be one of plain, fine, runed, heirloom/],
  ['a tier whose max star the success table cannot cover', 'items', (f) => { f.items.tiers[2].maxStar = 9; }, 'tiers[2].maxStar', /needs 9 entries in starSuccessBp/],
  ['line indexes out of sequence', 'items', (f) => { f.items.lines[3].index = 7; }, 'lines[3].index', /must run 0, 1, 2/],
  ['line range inverted', 'items', (f) => { f.items.lines[0].lo = 5000; }, 'lines[0].lo', /lo must not exceed hi/],
  ['star table too short', 'items', (f) => { f.items.starSuccessBp.pop(); }, 'starSuccessBp', /at least 7 items/],
  ['set in an unknown realm', 'items', (f) => { f.items.sets[0].realm = 'nowhere'; }, 'sets[0].realm', /unknown realm/],
  ['round cap of zero', 'tables', (f) => { f.tables.combat.roundCap = 0; }, 'combat.roundCap', /at least 1/],
  ['band weights with two entries', 'tables', (f) => { f.tables.delve.bandWeights.first.pop(); }, 'delve.bandWeights.first', /at least 3 items/],
  ['a rare class in the starting roster', 'tables', (f) => { f.tables.recruit.startingRoster[0] = 'berserker'; }, 'recruit.startingRoster[0]', /not a common class/],
  ['misspelled table key', 'tables', (f) => { f.tables.stats.levelCapp = f.tables.stats.levelCap; delete f.tables.stats.levelCap; }, 'stats.levelCapp', /did you mean "levelCap"/],
  ['reputation standings out of order', 'tables', (f) => { f.tables.progress.rep.known = 999; }, 'progress.rep', /known < trusted < honoured/],
  ['too few names for a realm', 'names', (f) => { f.names.midgard = ['a', 'b', 'c']; }, 'midgard', /at least 5 items/],
  ['a realm with no names', 'names', (f) => { delete f.names.helheim; }, 'helheim', /missing required key/],
  ['names for a realm that does not exist', 'names', (f) => { f.names.vanaheim = ['a', 'b', 'c', 'd', 'e']; }, 'vanaheim', /unknown key/],
  ['a condition with an unknown argument type', 'runbook', (f) => { f.runbook.conditions[2].args.pct = 'bogus'; }, 'conditions[2].args.pct', /unknown argument type "bogus"/],
  ['argument type pointing at nothing real', 'runbook', (f) => { f.runbook.argTypes.status.of = 'things'; }, 'argTypes.status.of', /statuses or skills/],
  ['a selector for a target kind that does not exist', 'runbook', (f) => { f.runbook.selectors[0].for.push('moon'); }, 'selectors[0].for[2]', /must be one of enemy, ally, self/],
  ['a stray key in an argument type', 'runbook', (f) => { f.runbook.argTypes.pct.colour = 'red'; }, 'argTypes.pct.colour', /unknown key/],
];

for (const [label, file, mutate, key, re] of CASES) {
  test(`content: refused, naming file and key: ${label}`, () => refused(run(mutate), file, key, re));
}

test('content: a missing file is refused by name', () => {
  const f = fresh(); delete f.skills;
  refused(validateContent(f, schemas).errors, 'skills', '(file)', /file is missing/);
});

test('content: a file of the wrong top-level type is refused', () => {
  refused(run((f) => { f.heroes = {}; }), 'heroes', '(root)', /expected array, got object/);
  refused(run((f) => { f.tables = []; }), 'tables', '(root)', /expected object, got array/);
});

test('content: loadContent refuses broken JSON text, naming the file, and throws a ContentError listing file and key', () => {
  const texts = { ...contentTexts, heroes: contentTexts.heroes.slice(0, 200) };
  assert.throws(() => loadContent(texts, schemaTexts), (e) => e instanceof ContentError && e.errors.some((x) => x.file === 'heroes.json' && x.key === '(file)' && /not valid JSON/.test(x.message)));
  const bad = JSON.parse(contentTexts.heroes); bad[0].rarity = 'epic';
  assert.throws(() => loadContent({ ...contentTexts, heroes: JSON.stringify(bad) }, schemaTexts), (e) => /heroes\.json: \[0\]\.rarity: must be one of/.test(e.message));
  assert.doesNotThrow(() => loadContent(contentTexts, schemaTexts));
});

test('content: several problems are all reported, not just the first', () => {
  const errors = run((f) => { f.heroes[0].rarity = 'epic'; f.tables.combat.roundCap = 0; f.realms[1].element = 'plasma'; });
  assert.ok(errors.length >= 3);
  for (const [file, key] of [['heroes', '[0].rarity'], ['tables', 'combat.roundCap'], ['realms', '[1].element']]) refused(errors, file, key);
});

// ---- systematic: no leaf and no key in any file may be unconstrained (starter_runbooks is free-keyed by class and checked by the real
// runbook validator, so it has its own targeted tests below)
const SWEEP_FILES = FILES.filter((f) => f !== 'starter_runbooks');
const FREE_KEYS = /^(runbook\.json:(argTypes\.[a-z0-9_]+$|conditions\[\d+\]\.args\.[a-z]+$|actions\[\d+\]\.args\.[a-z]+$))/;

function leaves(v, segs, out) {
  if (v !== null && typeof v === 'object') {
    if (Array.isArray(v)) v.forEach((x, i) => leaves(x, [...segs, i], out));
    else for (const k of Object.keys(v)) leaves(v[k], [...segs, k], out);
  } else out.push(segs);
  return out;
}
const at = (root, segs) => segs.slice(0, -1).reduce((o, s) => o[s], root);
const keyOf = (segs) => segs.reduce((a, s) => (typeof s === 'number' ? `${a}[${s}]` : a === '' ? s : `${a}.${s}`), '');

test('content: SYSTEMATIC: mutating any leaf of any file to a wrong type is refused at exactly that key', () => {
  let n = 0;
  for (const file of SWEEP_FILES) {
    const base = JSON.parse(contentTexts[file]);
    for (const segs of leaves(base, [], [])) {
      if (!segs.length) continue;
      const f = fresh(); at(f[file], segs)[segs[segs.length - 1]] = { wrong: 'type' };
      const errors = validateContent(f, schemas).errors;
      assert.ok(errors.some((e) => e.file === `${file}.json` && e.key.startsWith(keyOf(segs))), `${file}.json ${keyOf(segs)}: wrong type was accepted`);
      n++;
    }
  }
  assert.ok(n > 1500, `only ${n} leaves exercised`);
});

test('content: SYSTEMATIC: every integer leaf is bounded above and below (1e9 and -1e9 are refused at that key)', () => {
  let n = 0;
  for (const file of SWEEP_FILES) {
    const base = JSON.parse(contentTexts[file]);
    for (const segs of leaves(base, [], [])) {
      if (!segs.length || !Number.isInteger(at(base, segs)[segs[segs.length - 1]])) continue;
      for (const v of [1e9, -1e9]) {
        const f = fresh(); at(f[file], segs)[segs[segs.length - 1]] = v;
        const errors = validateContent(f, schemas).errors;
        assert.ok(errors.some((e) => e.file === `${file}.json` && e.key === keyOf(segs)), `${file}.json ${keyOf(segs)} accepted ${v}`);
      }
      n++;
    }
  }
  assert.ok(n > 500, `only ${n} integers exercised`);
});

test('content: SYSTEMATIC: every string leaf refuses the empty string and an uppercase junk string', () => {
  let n = 0;
  for (const file of SWEEP_FILES) {
    const base = JSON.parse(contentTexts[file]);
    for (const segs of leaves(base, [], [])) {
      if (!segs.length || typeof at(base, segs)[segs[segs.length - 1]] !== 'string') continue;
      for (const v of ['', 'ZZ Junk!']) {
        const f = fresh(); at(f[file], segs)[segs[segs.length - 1]] = v;
        const errors = validateContent(f, schemas).errors;
        // a free-text field (a display name) accepts junk but never the empty string
        const free = /\.name$|dungeon$|role$|^midgard\[\d+\]$|^asgard\[\d+\]$|^helheim\[\d+\]$/.test(keyOf(segs));
        if (v === 'ZZ Junk!' && free) continue;
        assert.ok(errors.some((e) => e.file === `${file}.json` && e.key.startsWith(keyOf(segs))), `${file}.json ${keyOf(segs)} accepted ${JSON.stringify(v)}`);
      }
      n++;
    }
  }
  assert.ok(n > 500, `only ${n} strings exercised`);
});

test('content: SYSTEMATIC: renaming any key of any object is refused (unknown key) unless the object is a free-keyed map', () => {
  let n = 0;
  function walk(file, v, segs) {
    if (v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(file, x, [...segs, i]));
    for (const k of Object.keys(v)) {
      if (!FREE_KEYS.test(`${file}.json:${keyOf([...segs, k])}`)) {
        const f = fresh(), parent = segs.reduce((o, s) => o[s], f[file]);
        parent[k + 'Zz'] = parent[k]; delete parent[k];
        const errors = validateContent(f, schemas).errors;
        const where = keyOf([...segs, k + 'Zz']) || k + 'Zz';
        assert.ok(errors.some((e) => e.file === `${file}.json` && e.key === where && /unknown key/.test(e.message)), `${file}.json ${where}: renamed key accepted`);
        n++;
      }
      walk(file, v[k], [...segs, k]);
    }
  }
  for (const file of SWEEP_FILES) walk(file, JSON.parse(contentTexts[file]), []);
  assert.ok(n > 600, `only ${n} keys exercised`);
});

// ---- starter runbooks: each is run through the real runbook validator against its class kit ---------------------------------
test('content: refused, naming file and key: a starter runbook argument out of range', () => {
  refused(run((f) => { f.starter_runbooks.shieldwarden.rules[0].when[0].pct = 55; }), 'starter_runbooks', 'shieldwarden.rules[0]', /E05/);
});
test('content: refused, naming file and key: a starter runbook using a skill outside the class kit', () => {
  refused(run((f) => { f.starter_runbooks.huscarl.rules[1].do.skill = 'hex'; }), 'starter_runbooks', 'huscarl.rules[1]', /E07/);
});
test('content: refused, naming file and key: a class with no starter runbook, and a runbook for no class', () => {
  refused(run((f) => { delete f.starter_runbooks.skald; }), 'starter_runbooks', '(root)', /no starter runbook for class "skald"/);
  refused(run((f) => { f.starter_runbooks.dragon = { v: 1, rules: [] }; }), 'starter_runbooks', 'dragon', /not a hero class/);
});
test('content: refused, naming file and key: a starter runbook with the wrong version or an unknown field', () => {
  refused(run((f) => { f.starter_runbooks.volva.v = 2; }), 'starter_runbooks', 'volva.v', /at most 1/);
  refused(run((f) => { f.starter_runbooks.volva.note = 'x'; }), 'starter_runbooks', 'volva.note', /unknown key/);
});
