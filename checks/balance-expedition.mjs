// The G5 balance runner: plays whole expeditions with the bot (checks/expedition-bot.mjs) and evaluates the `expedition:` bounds of
// checks/balance.yaml. Usage:
//   node checks/balance-expedition.mjs [--write evidence/G5-balance.json] [--per-cell N] [--baseline v1|v2 (default v2)] [--levels 10,20] [--set tables.expedition.siteLevelDiv=6 ...]
// --set changes a content table for an experiment (never for a real run). The report holds no time or date, so reruns are byte-identical.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAll } from './balance-lib.mjs';
import { runedSave, wellBuiltSave, runExpedition } from './expedition-bot.mjs';
import { indexContent } from '../sim/content.js';
import { encounterRewards } from '../sim/progress.js';

const nearest = (c) => c.slice().sort((a, b) => a.path.cost - b.path.cost || a.site.id - b.site.id)[0] || null;
const CHOOSERS = {
  nearest,
  shallow: (c) => nearest(c.filter((x) => x.site.dist <= 6)),
  deep: (c) => nearest(c.filter((x) => x.site.dist >= 12)),
};

function withSets(ctx, sets) {
  if (!sets.length) return ctx;
  const raw = structuredClone(ctx.content.raw);
  for (const kv of sets) { const [path, v] = kv.split('='), keys = path.split('.'); let o = raw; for (const k of keys.slice(0, -1)) o = o[k]; o[keys.at(-1)] = Number(v); }
  return { ...ctx, content: indexContent(raw) };
}

export function runExpeditions(ctx, perCell) {
  const { content, B } = ctx, E = B.expedition, cells = [];
  for (const level of E.levels) for (const realm of content.realms.map((r) => r.id)) {
    const cell = { level, realm, runs: 0, wiped: 0, banked: 0, starved: 0, embarked: 0, died: 0, saveDeaths: 0, saveHeroEncounters: 0, packs: 0, bought: 0, matBanked: 0, xpBanked: 0, silverBanked: 0, items: 0, delveMat: 0, delveXp: 0, noSite: 0 };
    for (let i = 0; i < perCell; i++) {
      const seed = B.run.seed_base + level * 100000 + realm.length * 1000 + i;
      const { record: r } = runExpedition(runedSave(content, level, seed), content, { realm, level, choose: CHOOSERS.nearest });
      if (r.noSite) { cell.noSite++; continue; }
      cell.runs++; cell.embarked += r.embarked; cell.died += r.died; cell.saveDeaths += r.saveDeaths; cell.saveHeroEncounters += r.saveHeroEncounters; cell.bought += r.bought;
      if (r.wiped) cell.wiped++; if (r.starved) cell.starved++;
      if (r.banked && r.pack && !r.starved) {
        cell.banked++; cell.silverBanked += r.pack.hacksilver; cell.items += r.pack.items + r.pack.droppedItems; cell.xpBanked += r.pack.xp;
        cell.matBanked += r.pack.materials.filter((m) => m.id === content.realmById[realm].material).reduce((a, m) => a + m.n, 0);
        // the same cleared encounters valued by the delve formula at level E
        const p = content.tables.progress, per = content.tables.expedition.encountersPerFloor;
        const cleared = r.encountersCleared, bossCleared = r.site && r.encountersCleared === r.site.floors * per;
        for (let k = 0; k < cleared; k++) { const rw = encounterRewards(level, bossCleared && k === cleared - 1, p); cell.delveMat += rw.materials; cell.delveXp += rw.xp; }
        cell.packs++; cell.provSpentOnBanked = (cell.provSpentOnBanked || 0) + r.bought;
      }
    }
    cells.push(cell);
  }
  // depth: shallow versus deep sites, pooled over realms per level
  const depth = [];
  for (const level of E.levels) {
    const acc = { level, shallow: { deaths: 0, heroEnc: 0, n: 0 }, deep: { deaths: 0, heroEnc: 0, n: 0 } };
    for (const cls of ['shallow', 'deep']) for (let i = 0; i < perCell; i++) {
      const realm = content.realms[i % content.realms.length].id, seed = B.run.seed_base + 7000000 + level * 100000 + i;
      const { record: r } = runExpedition(runedSave(content, level, seed), content, { realm, level, choose: CHOOSERS[cls] });
      if (r.noSite) continue;
      acc[cls].n++; acc[cls].deaths += r.died; acc[cls].heroEnc += r.heroEncounters;
    }
    depth.push(acc);
  }
  return { cells, depth };
}

// expedition_v2: the well-built party at the nearest site and at a deep one (12 or more cells away), pooled over realms per level.
export function runWellBuilt(ctx, perCell) {
  const { content, B } = ctx, W = B.expedition_v2.well_built, out = [];
  for (const level of W.levels) {
    const acc = { level, nearest: { n: 0, wiped: 0, died: 0, embarked: 0, silver: 0, xp: 0 }, deep: { n: 0, wiped: 0, died: 0, embarked: 0, silver: 0, xp: 0 } };
    for (const cls of ['nearest', 'deep']) for (const realm of content.realms.map((r) => r.id)) for (let i = 0; i < perCell; i++) {
      const seed = B.run.seed_base + 9000000 + level * 100000 + realm.length * 1000 + (cls === 'deep' ? 500 : 0) + i;
      const { record: r } = runExpedition(wellBuiltSave(content, level, seed), content, { realm, level, choose: CHOOSERS[cls] });
      if (r.noSite) continue;
      const a = acc[cls]; a.n++; a.died += r.died; a.embarked += r.embarked; if (r.wiped) a.wiped++;
      if (r.banked && r.pack && !r.starved) { a.silver += r.pack.hacksilver; a.xp += r.pack.xp; }
    }
    out.push(acc);
  }
  return out;
}

export function checkV2(res, ctx) {
  const { B } = ctx, V = B.expedition_v2, out = [];
  const add = (id, value, [lo, hi]) => out.push({ id, value: Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null, lo, hi, ok: Number.isFinite(value) && value >= lo && value <= hi });
  for (const w of res.wellBuilt) {
    add(`v2.well_built.L${w.level}.nearest_wipe`, w.nearest.wiped / w.nearest.n, V.well_built.nearest_wipe[`L${w.level}`]);
    add(`v2.well_built.L${w.level}.deep_wipe`, w.deep.wiped / w.deep.n, V.well_built.deep_wipe);
    add(`v2.well_built.L${w.level}.deep_over_nearest_expected_silver`, (w.deep.silver / w.deep.n) / (w.nearest.silver / w.nearest.n), V.well_built.deep_over_nearest_expected_silver);
    add(`v2.well_built.L${w.level}.deep_over_nearest_expected_xp`, (w.deep.xp / w.deep.n) / (w.nearest.xp / w.nearest.n), V.well_built.deep_over_nearest_expected_xp);
  }
  for (const c of res.cells) {
    add(`v2.badly_built.${c.realm}.L${c.level}.nearest_wipe`, c.wiped / c.runs, V.badly_built.nearest_wipe);
    add(`v2.badly_built.${c.realm}.L${c.level}.hero_death_per_embarked_hero`, c.died / c.embarked, V.badly_built.hero_death_per_embarked_hero);
  }
  return out;
}

const V1_LETHALITY = ['hero_death_per_embarked_hero', 'wipe_rate', 'hero_death_per_won_encounter'];
export function checkExpeditions(res, ctx, baseline = 'v2') {
  const all = checkV1(res, ctx);
  if (baseline === 'v1') return all;
  return [...all.filter((c) => !V1_LETHALITY.some((k) => c.id.endsWith(`.${k}`))), ...checkV2(res, ctx)];
}

function checkV1(res, ctx) {
  const { content, B } = ctx, E = B.expedition, out = [];
  const add = (id, value, [lo, hi]) => out.push({ id, value: Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null, lo, hi, ok: Number.isFinite(value) && value >= lo && value <= hi });
  for (const c of res.cells) {
    const k = `${c.realm}.L${c.level}`;
    add(`exp.${k}.hero_death_per_embarked_hero`, c.died / c.embarked, E.hero_death_per_embarked_hero);
    add(`exp.${k}.wipe_rate`, c.wiped / c.runs, E.wipe_rate);
    add(`exp.${k}.hero_death_per_won_encounter`, c.saveDeaths / c.saveHeroEncounters, E.hero_death_per_won_encounter);
    add(`exp.${k}.starvation_rate`, c.starved / c.runs, E.starvation_rate);
    add(`exp.${k}.materials_per_encounter_vs_delve`, c.matBanked / c.delveMat, E.materials_per_encounter_vs_delve);
    add(`exp.${k}.xp_per_encounter_vs_delve`, c.xpBanked / c.delveXp, E.xp_per_encounter_vs_delve);
    add(`exp.${k}.silver_return_on_provisions`, c.silverBanked / (c.provSpentOnBanked * content.tables.expedition.provisionCost), E.silver_return_on_provisions);
    add(`exp.${k}.items_per_completed_expedition`, c.items / c.packs, E.items_per_completed_expedition);
  }
  for (const d of res.depth) add(`exp.L${d.level}.deep_over_shallow_death_ratio`, (d.deep.deaths / d.deep.heroEnc) / (d.shallow.deaths / d.shallow.heroEnc), E.deep_over_shallow_death_ratio);
  const x = content.tables.expedition; let sum = 0;
  for (let f = 1; f <= 5; f++) sum += (10000 + x.floorBp * f) / (10000 + x.floorBp * (f - 1));
  add('exp.floor_step_ratio', sum / 5, E.floor_step_ratio);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
  const sets = process.argv.flatMap((a, i) => (a === '--set' ? [process.argv[i + 1]] : []));
  const ctx = withSets(loadAll(), sets), perCell = Number(arg('--per-cell') || 800);
  if (arg('--levels')) ctx.B.expedition.levels = arg('--levels').split(',').map(Number); // experiments only
  const baseline = arg('--baseline') || 'v2', res = runExpeditions(ctx, perCell);
  if (baseline !== 'v1') res.wellBuilt = runWellBuilt(ctx, Math.max(50, Math.round(perCell / 3)));
  const checks = checkExpeditions(res, ctx, baseline), bad = checks.filter((c) => !c.ok);
  const report = { thresholds: { file: 'checks/balance.yaml', section: baseline === 'v1' ? 'expedition' : 'expedition + expedition_v2' }, perCell, sets, cells: res.cells, depth: res.depth, wellBuilt: res.wellBuilt, checks, failed: bad.map((c) => c.id) };
  if (arg('--write')) writeFileSync(arg('--write'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${checks.length} checks, ${checks.length - bad.length} in bounds, ${bad.length} out of bounds${sets.length ? ` (with ${sets.join(', ')})` : ''}`);
  for (const c of bad) console.log(`  OUT  ${c.id}: ${c.value}  (bound ${c.lo} .. ${c.hi})`);
  process.exit(bad.length ? 1 : 0);
}
