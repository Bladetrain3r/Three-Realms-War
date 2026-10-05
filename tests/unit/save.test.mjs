import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content, saveSchema } from '../helpers/content.mjs';
import { newGame, validateSave, canonical, hashOf } from '../../sim/index.js';
import { play } from '../helpers/bot.mjs';

const base = () => newGame(content, 5, { savedAt: '2026-10-02T09:00:00Z', build: 'test' });
const errs = (mut) => { const s = base(); mut(s); return validateSave(s, content, saveSchema).errors; };
const refused = (errors, key, re) => assert.ok(errors.some((e) => e.key === key && (!re || re.test(e.message))), `expected ${key} ${re || ''}; got ${errors.map((e) => `${e.key}: ${e.message}`).join(' | ') || 'no errors'}`);

test('save: a new game is valid', () => assert.deepEqual(validateSave(base(), content, saveSchema), { ok: true, errors: [] }));

const CASES = [
  ['an unknown top-level key', (s) => { s.cheat = 1; }, 'cheat', /unknown key/],
  ['a higher version', (s) => { s.version = 2; }, 'version', /must be 1/],
  ['a negative stock', (s) => { s.materials.forge_iron = -1; }, 'materials.forge_iron', /at least 0/],
  ['a missing material', (s) => { delete s.materials.rime_heart; }, 'materials.rime_heart', /missing required key/],
  ['a hero level above the cap', (s) => { s.heroes[0].level = 51; }, 'heroes[0].level', /at most 50/],
  ['a fractional hacksilver', (s) => { s.currency.hacksilver = 1.5; }, 'currency.hacksilver', /expected integer/],
  ['an empty party', (s) => { s.party = []; }, 'party', /at least 1/],
  ['a duplicate hero id', (s) => { s.heroes[1].id = s.heroes[0].id; }, 'heroes[1].id', /duplicate hero id/],
  ['a party member who does not exist', (s) => { s.party[0] = 9999; }, 'party[0]', /does not exist/],
  ['a hero in the party twice', (s) => { s.party[1] = s.party[0]; }, 'party[1]', /twice/],
  ['a hero wearing an item that does not exist', (s) => { s.heroes[0].slots.helm = 9999; }, 'heroes[0].slots.helm', /does not exist/],
  ['an item worn by two heroes', (s) => { s.heroes[1].slots.weapon = s.heroes[0].slots.weapon; }, 'heroes[1].slots.weapon', /also worn by hero/],
  ['an item in the wrong slot', (s) => { s.heroes[0].slots.helm = s.heroes[0].slots.armour; }, 'heroes[0].slots.helm', /is a armour, not a helm/],
  ['an item too high for its wearer', (s) => { s.items.find((i) => i.id === s.heroes[0].slots.armour).ilvl = 7; }, 'heroes[0].slots.armour', /too high for a level 1 hero/],
  ['an unknown class', (s) => { s.heroes[0].class = 'wizard'; }, 'heroes[0].class', /unknown class/],
  ['injury above the limit', (s) => { s.heroes[0].injury = 3; }, 'heroes[0].injury', /at most 2/],
  ['a runbook the validator refuses', (s) => { s.heroes[0].runbook = { v: 1, rules: [{ when: [{ c: 'self_hp_below', pct: 55 }], do: { a: 'basic' }, target: 'lowest_hp' }] }; }, 'heroes[0].runbook', /E05/],
  ['a star above the tier maximum', (s) => { s.items[0].star = 4; }, 'items[0].star', /stops at 3 stars/],
  ['a Plain item with a line', (s) => { s.items[0].lines = [[0, 500]]; }, 'items[0].lines', /has 0 lines/],
  ['a line value out of range', (s) => { Object.assign(s.items[0], { tier: 'fine', lines: [[0, 9000]] }); }, 'items[0].lines[0]', /outside 400 to 1200/],
  ['a repeated line kind', (s) => { Object.assign(s.items[0], { tier: 'runed', lines: [[0, 500], [0, 600]] }); }, 'items[0].lines[1]', /appears twice/],
  ['a pending attempt without heldStar', (s) => { Object.assign(s.items[0], { tier: 'fine', lines: [[0, 500]], held: [[1, 500]] }); }, 'items[0].heldStar', /heldStar is missing/],
  ['a pending attempt holding the wrong number of lines', (s) => { Object.assign(s.items[0], { tier: 'fine', lines: [[0, 500]], held: [[1, 500], [2, 500]], heldStar: 0 }); }, 'items[0].held', /held lines must number 1/],
  ['a heldStar with nothing pending', (s) => { s.items[0].heldStar = 0; }, 'items[0].heldStar', /no attempt is pending/],
  ['a set on a Plain item', (s) => { s.items[0].set = 'hearthforged'; }, 'items[0].set', /cannot carry a set/],
  ['a set of another realm', (s) => { Object.assign(s.items[0], { tier: 'runed', lines: [[0, 500], [1, 500]], set: 'stormbound', realm: 'midgard' }); }, 'items[0].set', /another realm/],
  ['a weapon without a kind', (s) => { s.items.find((i) => i.slot === 'weapon').kind = null; }, 'items[0].kind', /only a weapon has a kind/],
  ['an item id at or above nextId', (s) => { s.nextId = 3; }, 'items[2].id', /not below nextId/],
  ['a full-looking stash', (s) => { for (let i = 0; i < 101; i++) s.items.push({ ...structuredClone(s.items[1]), id: s.nextId++, slot: 'armour' }); }, 'items', /stash holds at most 100/],
];
for (const [label, mut, key, re] of CASES) test(`save: refused, naming the key: ${label}`, () => refused(errs(mut), key, re));

test('save: export then import restores a byte-identical canonical save (text round trip)', () => {
  const { save } = play(base(), 120, 77);
  const text = canonical(save), back = JSON.parse(text);
  assert.equal(canonical(back), text);
  assert.equal(hashOf(back), hashOf(save));
  assert.deepEqual(validateSave(back, content, saveSchema).errors, []);
  assert.ok(text.length < 512 * 1024, `save is ${text.length} bytes`);
});

test('save: pretty-printed JSON with shuffled key order imports to the same canonical save', () => {
  const { save } = play(base(), 60, 3);
  const shuffled = JSON.parse(JSON.stringify(save, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v), 2));
  assert.equal(canonical(shuffled), canonical(save));
});
