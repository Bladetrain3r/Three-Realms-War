import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'client/art';
const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));

test('art: client/art has the modules the design names', () => {
  for (const f of ['color', 'noise', 'paper', 'brush', 'parts', 'heroes', 'monsters', 'figures', 'runes', 'backdrop', 'woodcut', 'index']) assert.ok(files.includes(`${f}.js`), f);
});
test('art: nothing under client/art reads Math.random, the clock or crypto (assets are reproducible from their seeds)', () => {
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of [/Math\.random/, /Date\.now/, /new Date\b/, /performance\.now/, /crypto\./]) assert.doesNotMatch(src, bad, `${f} uses ${bad}`);
  }
});
test('art: files stay under 400 lines and import nothing from outside client/art or sim/prng', () => {
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    assert.ok(src.split('\n').length < 400, `${f} is too long`);
    for (const m of src.matchAll(/^import .* from '([^']+)'/gm)) assert.ok(m[1].startsWith('./') || m[1] === '../../sim/prng.js', `${f} imports ${m[1]}`);
  }
});
test('art: every hero class and monster has a figure recipe', async () => {
  const { HEROES } = await import('../client/art/heroes.js'); const { ARCHETYPE, SIGNATURE, BOSS } = await import('../client/art/monsters.js');
  const read = (n) => JSON.parse(readFileSync(`content/${n}.json`, 'utf8'));
  for (const h of read('heroes')) assert.equal(typeof HEROES[h.id], 'function', h.id);
  const mon = read('monsters');
  for (const m of mon.roster) assert.ok(SIGNATURE[m.id] || ARCHETYPE[m.archetype], m.id);
  for (const b of mon.bosses) assert.equal(typeof BOSS[b.id], 'function', b.id);
  const { LEGEND_REALM } = await import('../client/art/monsters.js');
  for (const l of mon.legends) { assert.equal(typeof BOSS[l.id], 'function', l.id); assert.ok(['midgard', 'asgard', 'helheim'].includes(LEGEND_REALM[l.id]), l.id); }
});
