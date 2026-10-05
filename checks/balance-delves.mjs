// Delve win rates by hero level and gear tier, plus the pooled encounter, injury and death-proxy figures.
import { REALMS } from '../sim/content.js';
import { deriveSeed } from '../sim/prng.js';
import { resolveDelve } from '../sim/delve.js';
import { makeParty, summarizeDelve, median, r6 } from './balance-lib.mjs';

const DEATH_SAVE = 0.4; // DESIGN.md 12.4: a downed hero dies with probability 4000 bp after a won expedition encounter

export function runDelves(ctx) {
  const { B } = ctx, n = B.run.delves_per_cell, tiers = ['none', 'starter', 'fine', 'runed', 'heirloom'];
  const win = {}, runed = { rounds: [], timeouts: 0, encounters: 0, injured: 0, heroesInWins: 0, downs: 0, heroEncounters: 0, wins: 0, byLevel: {} };
  B.delve_winrate.levels.forEach((L, li) => {
    win[L] = {};
    tiers.forEach((tier, ti) => {
      const party = makeParty(ctx, B.run.party, L, tier);
      let wins = 0, injured = 0, heroes = 0;
      const lv = { rounds: [], wins: 0, injured: 0, heroes: 0 };
      for (let i = 0; i < n; i++) {
        const r = resolveDelve({ realm: REALMS[i % 3], level: L, seed: deriveSeed(B.run.seed_base + L * 10 + ti, i), party, setAllowed: false }, ctx.content);
        wins += r.result.outcome;
        if (r.result.outcome === 1) { injured += r.result.injured.length; heroes += party.length; }
        if (tier === 'runed') {
          const s = summarizeDelve(r.events, party);
          runed.rounds.push(...s.rounds); lv.rounds.push(...s.rounds);
          runed.timeouts += s.timeouts; runed.encounters += s.rounds.length;
          runed.downs += s.downsInWon; runed.heroEncounters += s.wonEncounters * party.length;
        }
      }
      win[L][tier] = r6(wins / n);
      if (tier === 'runed') {
        runed.injured += injured; runed.heroesInWins += heroes; runed.wins += wins;
        runed.byLevel[L] = { winRate: r6(wins / n), injuryRate: r6(heroes ? injured / heroes : 0), medianRounds: median(lv.rounds) };
      }
    });
  });
  return {
    winRate: win,
    runedPooled: {
      medianRounds: median(runed.rounds), timeoutRate: r6(runed.timeouts / runed.encounters),
      injuryPerHeroPerWonDelve: r6(runed.injured / runed.heroesInWins),
      deathProxyPerHeroPerWonEncounter: r6((runed.downs / runed.heroEncounters) * DEATH_SAVE),
      encounters: runed.encounters, wonDelves: runed.wins, byLevel: runed.byLevel,
    },
  };
}

const inB = (v, [lo, hi]) => v >= lo && v <= hi;
export function checkDelves(res, B) {
  const out = [], add = (id, value, lo, hi) => out.push({ id, value, lo, hi, ok: value >= lo && value <= hi });
  const W = res.winRate, tol = B.gear_order.tolerance, levels = B.delve_winrate.levels;
  for (const L of levels) for (const t of ['starter', 'fine', 'runed', 'heirloom']) add(`delve_winrate.L${L}.${t}`, W[L][t], ...B.delve_winrate[`L${L}`][t]);
  const order = ['none', 'starter', 'fine', 'runed', 'heirloom'];
  for (const L of levels) for (let i = 1; i < order.length; i++) add(`gear_order.L${L}.${order[i]}_vs_${order[i - 1]}`, r6(W[L][order[i]] - W[L][order[i - 1]]), -tol, 1);
  for (const L of levels) if (L >= B.naked_party.from_level) add(`naked_party.L${L}`, W[L].none, 0, B.naked_party.max_win);
  const gap = (L) => W[L].heirloom - W[L].starter;
  add('gear_gap.growth', r6(gap(B.gear_gap.high_level) - gap(B.gear_gap.low_level)), B.gear_gap.growth_min, 2);
  const p = res.runedPooled;
  add('encounter.median_rounds', p.medianRounds, ...B.encounter.median_rounds);
  add('encounter.timeout_rate', p.timeoutRate, 0, B.encounter.timeout_rate_max);
  add('injury.per_hero_per_won_delve', p.injuryPerHeroPerWonDelve, ...B.injury.per_hero_per_won_delve);
  add('injury.expedition_death_per_hero_per_won_encounter', p.deathProxyPerHeroPerWonEncounter, ...B.injury.expedition_death_per_hero_per_won_encounter);
  return out;
}
export { inB };
