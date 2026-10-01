// Varied but fully seed-determined delve inputs for the determinism tests.
import { content, hero, item } from './content.mjs';
import { randomRunbook } from './random.mjs';
import { createRng } from '../../sim/prng.js';
import { rollLines } from '../../sim/items.js';
import { buildHeroUnit } from '../../sim/hero.js';
import { REALMS } from '../../sim/content.js';

const TIERS = ['plain', 'fine', 'runed', 'heirloom'];

export function scenarioFor(seed) {
  const dice = createRng((seed ^ 0x5bd1e995) >>> 0);
  const realm = REALMS[dice.range(3)], level = 1 + dice.range(50);
  const size = 2 + dice.range(3), party = [];
  let id = 1000;
  for (let i = 0; i < size; i++) {
    const cls = content.heroes[dice.range(content.heroes.length)];
    const heroLevel = Math.max(1, Math.min(50, level + dice.range(21) - 4));
    const geared = dice.range(8) > 0, slots = {}, items = {};
    if (geared) {
      const tier = TIERS[dice.range(4)], tdef = content.tierById[tier];
      for (const slot of content.items.slotOrder) {
        id++;
        items[id] = item({ id, slot, kind: slot === 'weapon' ? (cls.attack === 'magic' ? 'ARC' : 'MIT') : null, tier, ilvl: Math.max(1, Math.min(heroLevel + 5, level + 5)), realm: cls.realm,
          star: dice.range(tdef.maxStar + 1), lines: rollLines(dice, tdef.lines, content), set: tdef.setAllowed && dice.range(2) === 0 ? content.realmById[cls.realm].set : null });
        slots[slot] = id;
      }
    }
    const rb = randomRunbook(dice, cls.skills);
    party.push(buildHeroUnit(hero({ id: i + 1, class: cls.id, level: heroLevel, slots, runbook: rb }), items, content, { forced: dice.range(10) === 0 }));
  }
  return { realm, level, seed, party, setAllowed: dice.range(2) === 1 };
}

// The fixed inputs behind the golden hashes: no dice, nothing but the seed.
import { gearedParty } from './delve.mjs';
export function standardInput(seed) {
  const level = 1 + ((seed * 7) % 50), heroLevel = Math.min(50, level + 8);
  return { realm: REALMS[seed % 3], level, seed, setAllowed: seed % 2 === 0,
    party: gearedParty(heroLevel, { ilvl: level, tier: TIERS[1 + (seed % 3)], star: 1 + (seed % 3) }) };
}
