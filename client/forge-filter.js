// Filtering, sorting and conditional selection of items for the Forge. Pure: no DOM.
import { wornIds } from '../sim/game.js';
import { salvageValue } from '../sim/items.js';

export const TIERS = ['plain', 'fine', 'runed', 'heirloom', 'legendary'];
export const SORTS = ['id', 'tier', 'ilvl', 'star', 'owner', 'slot'];

// filter: { owner: 'all' | 'stash' | 'worn' | <hero id>, tier: 'any' | <tier id>, slot: 'any' | <slot>, realm: 'any' | <realm> }
export function listItems(save, content, filter = {}, sort = { key: 'id', desc: false }) {
  const worn = wornIds(save), heroName = (id) => (save.heroes.find((h) => h.id === id) || { name: '' }).name;
  const f = { owner: 'all', tier: 'any', slot: 'any', realm: 'any', ...filter };
  const rows = save.items.filter((it) => {
    const owner = worn[it.id];
    if (f.owner === 'stash' && owner !== undefined) return false;
    if (f.owner === 'worn' && owner === undefined) return false;
    if (typeof f.owner === 'number' && owner !== f.owner) return false;
    return (f.tier === 'any' || it.tier === f.tier) && (f.slot === 'any' || it.slot === f.slot) && (f.realm === 'any' || it.realm === f.realm);
  });
  const key = {
    id: (it) => it.id, tier: (it) => TIERS.indexOf(it.tier), ilvl: (it) => it.ilvl, star: (it) => it.star, slot: (it) => content.items.slotOrder.indexOf(it.slot),
    owner: (it) => (worn[it.id] === undefined ? '' : heroName(worn[it.id])),
  }[sort.key] || ((it) => it.id);
  const dir = sort.desc ? -1 : 1;
  return rows.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || a.id - b.id; });
}

// The stash items a "select matching" rule would pick: not worn, not mid-attempt, tier at or below `maxTier`, level at or below
// `maxLevel`, star at or below `maxStar` (each condition optional) and, when `noSet`, carrying no set.
export function matching(save, rule) {
  const worn = wornIds(save), maxTier = rule.maxTier === undefined || rule.maxTier === 'any' ? TIERS.length - 1 : TIERS.indexOf(rule.maxTier);
  return save.items.filter((it) => worn[it.id] === undefined && it.held === null && TIERS.indexOf(it.tier) <= maxTier
    && (rule.maxLevel === undefined || it.ilvl <= rule.maxLevel) && (rule.maxStar === undefined || it.star <= rule.maxStar) && it.tier !== 'legendary' && !(rule.noSet && it.set !== null)).map((it) => it.id);
}

// What salvaging `ids` would give, by material id.
export function yieldOf(save, content, ids) {
  const out = {}, want = new Set(ids);
  for (const it of save.items) if (want.has(it.id)) { const m = content.realmById[it.realm].material; out[m] = (out[m] || 0) + salvageValue(it); }
  return out;
}
