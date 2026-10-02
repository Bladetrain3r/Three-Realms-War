// The mirror tournament: sampled four-class compositions fight every other composition from both sides.
import { createRng, deriveSeed } from '../sim/prng.js';
import { makeContext, resolveEncounter } from '../sim/combat.js';
import { makeParty, r6 } from './balance-lib.mjs';

function sampleCompositions(ctx, count) {
  const commons = ctx.content.heroes.filter((h) => h.rarity === 'common').map((h) => h.id);
  const rng = createRng(ctx.B.run.seed_base + 1), seen = {}, out = [];
  while (out.length < count) {
    const pool = commons.slice(), pick = [];
    for (let i = 0; i < 4; i++) pick.push(pool.splice(rng.range(pool.length), 1)[0]);
    pick.sort();
    const key = pick.join('+');
    if (!seen[key]) { seen[key] = true; out.push(pick); }
  }
  return out;
}

export function runMirror(ctx) {
  const { content, B } = ctx, R = B.run;
  const comps = sampleCompositions(ctx, R.mirror_compositions);
  const parties = comps.map((c) => makeParty(ctx, c, R.mirror_level, 'fine'));
  const wins = comps.map(() => 0), fights = comps.map(() => 0);
  let counter = 0, timeouts = 0, total = 0, sideWins = 0, sideDecided = 0;
  const fight = (a, b) => {
    const rng = createRng(deriveSeed(R.seed_base + 2, counter++));
    const r = resolveEncounter(makeContext(content, rng, []), { index: 0, heroes: parties[a], heroHp: null, enemies: parties[b] });
    total++;
    const timeout = r.outcome === 0 && r.heroHp.some((h) => h > 0);
    if (timeout) timeouts++;
    return { aWon: r.outcome === 1, bWon: r.outcome === 0 && !timeout };
  };
  for (let a = 0; a < comps.length; a++) {
    for (let b = 0; b < comps.length; b++) {
      for (let k = 0; k < R.mirror_fights_per_ordered_pair; k++) {
        const o = fight(a, b);
        if (a === b) { if (o.aWon || o.bWon) { sideDecided++; if (o.aWon) sideWins++; } continue; }
        fights[a]++; fights[b]++;
        if (o.aWon) wins[a]++;
        if (o.bWon) wins[b]++;
      }
    }
  }
  const compRates = comps.map((_, i) => wins[i] / fights[i]);
  const classRates = {};
  for (const h of content.heroes.filter((x) => x.rarity === 'common')) {
    const mine = comps.map((c, i) => (c.includes(h.id) ? compRates[i] : null)).filter((x) => x !== null);
    classRates[h.id] = r6(mine.reduce((x, y) => x + y, 0) / mine.length);
  }
  const realmRates = {};
  for (const r of content.realms) {
    const ids = content.heroes.filter((h) => h.rarity === 'common' && h.realm === r.id).map((h) => h.id);
    realmRates[r.id] = r6(ids.reduce((s, id) => s + classRates[id], 0) / ids.length);
  }
  return {
    compositions: comps.map((c, i) => ({ classes: c, winRate: r6(compRates[i]) })), classWinRate: classRates, realmWinRate: realmRates,
    sideBias: r6(sideWins / sideDecided), timeoutRate: r6(timeouts / total), fights: total,
  };
}

export function checkMirror(res, B) {
  const out = [], add = (id, value, [lo, hi]) => out.push({ id, value, lo, hi, ok: value >= lo && value <= hi });
  res.compositions.forEach((c) => add(`mirror.composition.${c.classes.join('+')}`, c.winRate, B.mirror.composition_winrate));
  for (const [k, v] of Object.entries(res.classWinRate)) add(`mirror.class.${k}`, v, B.mirror.class_winrate);
  for (const [k, v] of Object.entries(res.realmWinRate)) add(`mirror.realm.${k}`, v, B.mirror.realm_winrate);
  add('mirror.side_bias', res.sideBias, B.mirror.side_bias);
  add('mirror.timeout_rate', res.timeoutRate, [0, B.mirror.timeout_rate_max]);
  return out;
}
