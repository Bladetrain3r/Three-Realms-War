// Feed rate against consumption (from expected values of the reward and cost formulas) and the upgrade-roll odds.
import { createRng } from '../sim/prng.js';
import { idiv } from '../sim/arith.js';
import { attemptUpgrade, rollLines, upgradeCost } from '../sim/items.js';
import { xpToNext } from '../sim/progress.js';
import { r6 } from './balance-lib.mjs';

const WON_ENCOUNTER_WEIGHT = 5; // E[encounters + 1] for a won delve: (n - 1) normal + 1 boss counted twice, n = 3, 4 or 5 equally likely

export function econ(ctx) {
  const { content, B } = ctx, p = content.tables.progress, P = content.items.starSuccessBp.map((x) => x / 10000);
  const it = (ilvl, star) => ({ ilvl, star });
  const matsPerDelve = (D) => WON_ENCOUNTER_WEIGHT * (p.matBase + idiv(D, p.matDiv));
  const itemMats = (L, from, to) => { let m = 0; for (let s = from; s < to; s++) m += upgradeCost(it(L, s), content).common / P[s]; return m; };
  const itemHearts = (L, from, to) => { let h = 0; for (let s = from; s < to; s++) h += upgradeCost(it(L, s), content).rare / P[s]; return h; };
  const out = {};
  const firstCost = upgradeCost(it(1, 0), content).common;
  out.firstUpgradeDelves = Math.ceil(firstCost / ((content.tables.delve.minEncounters + 1) * (p.matBase + idiv(1, p.matDiv))));
  out.delvesPerItemTo3 = {};
  for (const L of [10, 20, 30, 40, 50]) out.delvesPerItemTo3[`L${L}`] = r6(itemMats(L, 0, 3) / matsPerDelve(L));
  out.delves16To3AtL30 = r6(16 * itemMats(30, 0, 3) / matsPerDelve(30));
  out.heartsVsMaterials = {};
  for (const L of [20, 30, 40, 50]) out.heartsVsMaterials[`L${L}`] = r6((16 * itemHearts(L, 3, 5)) / (16 * itemMats(L, 3, 5) / matsPerDelve(L)));
  out.heartsVsMaterialsMin = Math.min(...Object.values(out.heartsVsMaterials));
  out.materialsGrowth = r6(matsPerDelve(50) / matsPerDelve(1));
  out.delvesPerLevel = {};
  for (const L of [10, 20, 30, 40]) out.delvesPerLevel[`L${L}`] = r6(xpToNext(L, p) / (WON_ENCOUNTER_WEIGHT * (p.encXpBase + p.encXpPerD * L)));
  let total = 0;
  for (let L = 1; L < content.tables.stats.levelCap; L++) total += xpToNext(L, p) / (WON_ENCOUNTER_WEIGHT * (p.encXpBase + p.encXpPerD * L));
  out.delvesToLevel50 = r6(total);

  const rng = createRng(B.run.seed_base + 3), N = B.run.upgrade_attempts_per_star;
  out.upgradeSuccess = {};
  for (let s = 0; s < 5; s++) {
    let ok = 0;
    const base = { id: 0, slot: 'helm', kind: null, tier: 'heirloom', ilvl: 10, realm: 'midgard', set: null, star: s, lines: [], held: null, mulligan: 1 };
    for (let i = 0; i < N; i++) if (attemptUpgrade(base, rng, content).star > s) ok++;
    out.upgradeSuccess[`star${s}`] = { observed: r6(ok / N), table: P[s] };
  }
  const counts = new Array(10).fill(0); let lines = 0, outOfRange = 0;
  for (let i = 0; i < Math.floor(B.run.line_rolls / 3); i++) {
    for (const [k, raw] of rollLines(rng, 3, content)) {
      counts[k]++; lines++;
      if (raw < content.items.lines[k].lo || raw > content.items.lines[k].hi) outOfRange++;
    }
  }
  out.lineKindShare = counts.map((c) => r6(c / lines));
  out.lineValuesOutOfRange = outOfRange;
  return out;
}

export function checkEcon(e, B) {
  const out = [], add = (id, value, lo, hi) => out.push({ id, value, lo, hi, ok: value >= lo && value <= hi });
  const R = B.rewards;
  add('rewards.first_upgrade_max_delves', e.firstUpgradeDelves, 0, R.first_upgrade_max_delves);
  for (const [k, v] of Object.entries(e.delvesPerItemTo3)) add(`rewards.delves_per_item_to_3_stars.${k}`, v, ...R.delves_per_item_to_3_stars[k]);
  add('rewards.delves_for_16_items_to_3_stars_at_L30', e.delves16To3AtL30, ...R.delves_for_16_items_to_3_stars_at_L30);
  add('rewards.hearts_vs_materials_min_ratio', e.heartsVsMaterialsMin, R.hearts_vs_materials_min_ratio, 1000);
  add('rewards.materials_per_delve_growth', e.materialsGrowth, ...R.materials_per_delve_growth);
  for (const [k, v] of Object.entries(e.delvesPerLevel)) add(`rewards.delves_per_level.${k}`, v, ...R.delves_per_level[k]);
  add('rewards.delves_to_level_50', e.delvesToLevel50, ...R.delves_to_level_50);
  const tol = B.upgrade_odds.success_tolerance;
  for (const [k, v] of Object.entries(e.upgradeSuccess)) add(`upgrade_odds.success.${k}`, v.observed, r6(v.table - tol), r6(v.table + tol));
  e.lineKindShare.forEach((v, k) => add(`upgrade_odds.line_kind.${k}`, v, r6(0.1 - B.upgrade_odds.line_kind_tolerance), r6(0.1 + B.upgrade_odds.line_kind_tolerance)));
  add('upgrade_odds.line_values_out_of_range', e.lineValuesOutOfRange, 0, 0);
  return out;
}
