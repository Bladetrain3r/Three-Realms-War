import { content, hero, item } from './content.mjs';
import { buildHeroUnit } from '../../sim/hero.js';

export const CLASSES = ['shieldwarden', 'huscarl', 'stormcaller', 'hearthkeeper'];
export function party(level, classes = CLASSES, rulesFor = () => []) {
  return classes.map((cls, i) => buildHeroUnit(hero({ id: i + 1, class: cls, level, runbook: { v: 1, rules: rulesFor(cls) } }), {}, content));
}
export const input = (over = {}) => ({ realm: 'midgard', level: 1, seed: 1, party: party(50), setAllowed: false, ...over });

// Rebuild each hero's HP from the event stream alone (the replay viewer relies on this being possible).
export function heroHpFromEvents(events, party) {
  const hp = party.map((p) => p.maxHp);
  for (const e of events) {
    if (e[0] === 4 && e[2] < 4) hp[e[2]] = e[5];
    else if (e[0] === 5 && e[2] < 4) hp[e[2]] = e[4];
    else if (e[0] === 7 && e[1] < 4) hp[e[1]] += e[2] === 0 ? -e[3] : e[3];
    else if (e[0] === 12) hp[e[1]] = e[2];
  }
  return hp;
}
export { content, hero, item };

// A party wearing a full set of gear (weapon matched to the class's attack stat).
export function gearedParty(level, { ilvl, tier = 'runed', star = 3, classes = CLASSES } = {}) {
  let id = 100;
  return classes.map((cls, i) => {
    const attack = content.heroById[cls].attack === 'magic' ? 'ARC' : 'MIT';
    const slots = {}, items = {};
    for (const slot of content.items.slotOrder) {
      id++;
      items[id] = item({ id, slot, kind: slot === 'weapon' ? attack : null, tier, ilvl, star, realm: content.heroById[cls].realm, lines: [] });
      slots[slot] = id;
    }
    return buildHeroUnit(hero({ id: i + 1, class: cls, level, slots, runbook: { v: 1, rules: [] } }), items, content);
  });
}
