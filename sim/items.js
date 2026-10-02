// Equipment: main stats, bonus lines, upgrading with the mulligan, salvage, drops (DESIGN.md section 8).
import { idiv, mulbp } from './arith.js';

const BP = 10000;

export const starMultiplier = (star, items) => BP + items.starBonusBp * star;

// 8.1: main stat of one slot entry for an item of level `ilvl`, tier multiplier and star.
export function mainValue(coef, ilvl, tierBp, star, items) {
  return mulbp(mulbp(coef * ilvl, tierBp), starMultiplier(star, items));
}

// 8.3: the value in effect for a stored raw roll.
export function lineValue(raw, star, items) {
  return mulbp(raw, starMultiplier(star, items));
}

// Flat main stats an item gives: { VIG, MIT, ARC, GRD, WRD, SPD } entries plus a charm's resist.
export function itemMain(item, content) {
  const items = content.items, tierBp = content.tierById[item.tier].multiplierBp;
  const slot = items.slots[item.slot];
  const flat = [];
  for (const m of slot.main) {
    const stat = m.stat === 'MIT_OR_ARC' ? item.kind : m.stat;
    flat.push([stat, mainValue(m.coef, item.ilvl, tierBp, item.star, items)]);
  }
  const resist = slot.resistBpPerLevel ? mainValue(slot.resistBpPerLevel, item.ilvl, tierBp, item.star, items) : 0;
  return { flat, resist };
}

// 8.3: roll `count` distinct line kinds. `rng` only needs range(n).
export function rollLines(rng, count, content) {
  const remaining = content.items.lines.map((l) => l.index);
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = remaining.splice(rng.range(remaining.length), 1)[0];
    const def = content.items.lines[k];
    out.push([k, def.lo + rng.range(def.hi - def.lo + 1)]);
  }
  return out;
}

function pickWeighted(rng, weights) { // weights: array of [id, weight] in a fixed order
  let total = 0;
  for (const w of weights) total += w[1];
  let r = rng.range(total);
  for (const w of weights) {
    if (r < w[1]) return w[0];
    r -= w[1];
  }
  throw new Error('unreachable');
}

const TIER_ORDER = ['plain', 'fine', 'runed', 'heirloom'];

// 8.6: a dropped item. Draw order: tier, slot, weapon kind (weapon only), set tag (only if allowed), lines.
export function generateItem(rng, { ilvl, realm, boss, setAllowed }, content) {
  const items = content.items, drops = items.drops;
  const weights = boss ? drops.bossTierWeights : drops.tierWeights;
  const tier = pickWeighted(rng, TIER_ORDER.filter((t) => weights[t] !== undefined).map((t) => [t, weights[t]]));
  const slot = items.slotOrder[rng.range(items.slotOrder.length)];
  const kind = slot === 'weapon' ? (rng.range(2) === 0 ? 'MIT' : 'ARC') : null;
  const tierDef = content.tierById[tier];
  let set = null;
  if (tierDef.setAllowed && setAllowed && rng.range(BP) < drops.setTagBp) set = content.realmById[realm].set;
  return { id: 0, slot, kind, tier, ilvl, realm, set, star: 0, lines: rollLines(rng, tierDef.lines, content), held: null, heldStar: null, mulligan: 1 };
}

// 8.4: cost of one attempt.
export function upgradeCost(item, content) {
  const c = content.items.upgradeCost;
  return {
    common: c.commonBase + idiv(item.ilvl * (item.star + 1), c.commonDivisor),
    rare: item.star >= c.rareFromStar ? item.star - (c.rareFromStar - 1) : 0,
  };
}

// 8.4: one attempt. Returns a new item holding the old lines; the caller then accepts or uses the mulligan.
export function attemptUpgrade(item, rng, content) {
  const tierDef = content.tierById[item.tier];
  if (item.held !== null) throw new Error('resolve the previous attempt first');
  if (item.star >= tierDef.maxStar) throw new RangeError('item is at its maximum star');
  const success = rng.range(BP) < content.items.starSuccessBp[item.star];
  const lines = rollLines(rng, tierDef.lines, content);
  return { ...item, star: item.star + (success ? 1 : 0), lines, held: item.lines, heldStar: item.star, mulligan: success ? 1 : item.mulligan };
}

export function acceptUpgrade(item) {
  if (item.held === null) throw new Error('no attempt to accept');
  return { ...item, held: null, heldStar: null };
}

export function useMulligan(item) {
  if (item.held === null) throw new Error('no attempt to undo');
  if (item.mulligan < 1) throw new Error('the mulligan for this star is spent');
  return { ...item, lines: item.held, held: null, heldStar: null, mulligan: 0 };
}

// 8.6: common materials returned by salvage.
export function salvageValue(item) {
  return idiv(item.ilvl, 2) * (TIER_ORDER.indexOf(item.tier) + 1);
}
