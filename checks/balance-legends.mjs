// The legendary-boss balance runner: plays each legend (and the final boss) against measuring parties and evaluates the `legends:` and
// `final:` bounds of checks/balance.yaml. A fight is the legend alone against the party, as an expedition lair plays it (resolveFloor with
// `legend`). Usage: node checks/balance-legends.mjs [--write evidence/legends-balance.json] [--fights N] [--only fenris,chaos]
//   [--set tables.legend.x=1 | --legend fenris.vigBp=70000 ...]   (--set and --legend change content for an experiment, never for a real run)
// The report holds no time or date, so reruns are byte-identical.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAll } from './balance-lib.mjs';
import { builtSave } from './expedition-bot.mjs';
import { indexContent, STATS } from '../sim/content.js';
import { buildHeroUnit } from '../sim/hero.js';
import { itemsById } from '../sim/game.js';
import { legendItem } from '../sim/items.js';
import { resolveFloor } from '../sim/floor.js';

const REALMS = ['midgard', 'asgard', 'helheim'];

function party(content, spec, seed, extra = null) {
  const s = builtSave(content, { heroLevel: spec.heroLevel, tier: spec.tier, star: spec.star, ilvl: spec.ilvl, withLines: true }, seed);
  if (extra) extra(s);
  const by = itemsById(s);
  return s.party.map((id) => buildHeroUnit(s.heroes.find((h) => h.id === id), by, content));
}

// paragon: stars per stat, bought at level `at` (the save format: stat -> levels).
const withParagon = (stars, at) => (s) => { for (const h of s.heroes) { h.paragon = {}; for (const st of STATS) h.paragon[st] = Array(stars).fill(at); } };
// the four non-final legends' items, 5 stars, one per hero in its own slot (a hero's old piece in that slot is replaced)
function withLegendaries(content) {
  return (s) => {
    const prizes = content.legends.filter((l) => !l.final).slice(0, 4);
    s.heroes.forEach((h, i) => {
      const l = prizes[i % prizes.length], it = { ...legendItem(l, 50, s.nextId++), star: 5 };
      s.items = s.items.filter((x) => x.id !== h.slots[l.item.slot]); s.items.push(it); h.slots[l.item.slot] = it.id;
    });
  };
}

export function fights(content, legend, level, spec, n, extra = null) {
  const out = { n, wins: 0, rounds: [], lastPhase: 0, died: 0, embarkedWon: 0, diedWon: 0 };
  const L = content.legendById[legend], lastIdx = L.phases.length - 1;
  const units = party(content, spec, 1000 + level, extra);
  for (let i = 0; i < n; i++) {
    const r = resolveFloor({ realm: REALMS[i % 3], level, seed: 9100000 + level * 1000 + i, boss: true, legend, party: units, heroHp: null }, content);
    const won = r.result.outcome === 1, rounds = r.events.find((e) => e[0] === 11)[2];
    out.rounds.push(rounds);
    if (won) {
      out.wins++; out.embarkedWon += units.length; out.diedWon += r.result.died.length;
      if (r.events.some((e) => e[0] === 15 && e[2] === lastIdx)) out.lastPhase++;
    }
  }
  out.rounds.sort((a, b) => a - b);
  out.median = out.rounds[Math.trunc(n / 2)];
  return out;
}

export function runLegends(ctx, nFights, only = null) {
  const { content, B } = ctx, G = B.legends, F = B.final, res = { legends: [], final: [] };
  for (const l of content.legends) {
    if (only && !only.includes(l.id)) continue;
    if (l.final) {
      const lv = F.level;
      const row = (name, spec, extra) => res.final.push({ legend: l.id, party: name, level: lv, ...fights(content, l.id, lv, spec, nFights, extra), rounds: undefined });
      row('solid', { heroLevel: 50, tier: 'heirloom', star: 5, ilvl: 50 }, withParagon(F.solid.paragon_stars_per_stat, F.solid.paragon_bought_at));
      row('under', { heroLevel: 50, tier: 'runed', star: 3, ilvl: 50 }, null);
      row('full', { heroLevel: 50, tier: 'heirloom', star: 5, ilvl: 50 }, (s) => { withParagon(3, 10)(s); withLegendaries(content)(s); });
      continue;
    }
    const E = G.levels[l.id], lv = E + 5;
    const row = (name, spec) => res.legends.push({ legend: l.id, party: name, level: lv, E, ...fights(content, l.id, lv, spec, nFights), rounds: undefined });
    row('ready', { heroLevel: Math.min(50, E + G.ready.hero_over_level), tier: G.ready.tier, star: G.ready.star, ilvl: E });
    row('weak', { heroLevel: Math.max(1, E - G.weak.hero_under_level), tier: G.weak.tier, star: G.weak.star, ilvl: Math.max(1, E - G.weak.hero_under_level) });
    row('strong', { heroLevel: G.strong.hero_level, tier: G.strong.tier, star: G.strong.star, ilvl: E });
  }
  return res;
}

export function checkLegends(res, ctx) {
  const { B } = ctx, G = B.legends, F = B.final, out = [];
  const add = (id, value, [lo, hi]) => out.push({ id, value: Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null, lo, hi, ok: Number.isFinite(value) && value >= lo && value <= hi });
  for (const r of res.legends) {
    const k = `lg.${r.legend}.${r.party}`, spec = G[r.party];
    add(`${k}.win_rate`, r.wins / r.n, spec.win_rate);
    if (r.party === 'ready') {
      add(`${k}.median_rounds`, r.median, spec.median_rounds);
      add(`${k}.last_phase_share`, r.wins ? r.lastPhase / r.wins : NaN, spec.last_phase_share);
      add(`${k}.hero_death_per_won_fight`, r.embarkedWon ? r.diedWon / r.embarkedWon : NaN, spec.hero_death_per_won_fight);
    }
  }
  for (const r of res.final) {
    const k = `final.${r.party}`, spec = F[r.party];
    add(`${k}.win_rate`, r.wins / r.n, spec.win_rate);
    if (spec.median_rounds) add(`${k}.median_rounds`, r.median, spec.median_rounds);
  }
  return out;
}

export function withSets(ctx, sets, legendSets) {
  if (!sets.length && !legendSets.length) return ctx;
  const raw = structuredClone(ctx.content.raw);
  for (const kv of sets) { const [path, v] = kv.split('='), keys = path.split('.'); let o = raw; for (const k of keys.slice(0, -1)) o = o[k]; o[keys.at(-1)] = Number(v); }
  for (const kv of legendSets) { const [path, v] = kv.split('='), [id, key] = path.split('.'); raw.monsters.legends.find((l) => l.id === id)[key] = Number(v); }
  return { ...ctx, content: indexContent(raw) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
  const all = (flag) => process.argv.flatMap((a, i) => (a === flag ? [process.argv[i + 1]] : []));
  const ctx = withSets(loadAll(), all('--set'), all('--legend')), n = Number(arg('--fights') || ctx.B.legends.fights), only = arg('--only') ? arg('--only').split(',') : null;
  const res = runLegends(ctx, n, only), checks = checkLegends(res, ctx), bad = checks.filter((c) => !c.ok);
  const report = { thresholds: { file: 'checks/balance.yaml', section: 'legends + final' }, fights: n, sets: all('--set').concat(all('--legend')), cells: res.legends.concat(res.final).map(({ rounds, ...r }) => r), checks, failed: bad.map((c) => c.id) };
  if (arg('--write')) writeFileSync(arg('--write'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${checks.length} checks, ${checks.length - bad.length} in bounds, ${bad.length} out of bounds`);
  if (process.argv.includes('--table')) for (const c of report.cells) console.log(`  ${c.legend.padEnd(12)} ${c.party.padEnd(7)} L${c.level}  win ${(c.wins / c.n).toFixed(2)}  median rounds ${c.median}  last phase in ${c.wins ? (c.lastPhase / c.wins).toFixed(2) : '-'} of wins  deaths/won ${c.embarkedWon ? (c.diedWon / c.embarkedWon).toFixed(2) : '-'}`);
  for (const c of bad) console.log(`  OUT  ${c.id}: ${c.value}  (bound ${c.lo} .. ${c.hi})`);
  process.exit(bad.length ? 1 : 0);
}
