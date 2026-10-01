// Monster and boss definitions in the resolved form a fight uses (DESIGN.md 4.5, 10.2 to 10.5).
import { STATS } from './content.js';
import { enemyBase, finalStat, maxHp } from './stats.js';

// opts: { boss: bool, affixes: [affix objects] }. `row` is a roster entry or a boss entry.
export function buildMonster(row, level, content, opts = {}) {
  const e = content.tables.enemy, t = content.tables.stats, realm = content.realmById[row.realm];
  const boss = Boolean(opts.boss), affixes = opts.affixes || [];
  const arche = content.archetypeById[boss ? 'brute' : row.archetype];
  const stats = {};
  for (const s of STATS) {
    let multiplierBp = 0;
    if (boss) multiplierBp = s === 'VIG' ? e.bossVigBp : e.bossOtherBp;
    else if (row.signature) multiplierBp = e.signatureBp;
    const base = enemyBase(arche.stats[s], level, e, { multiplierBp, tilt: realm.affinityStats.includes(s) });
    let pct = 0;
    for (const a of affixes) if (a.effect.mods && a.effect.mods[s]) pct += a.effect.mods[s];
    stats[s] = { base, pct };
  }
  let sres = e.sresBase + e.sresPerLevel * level, lifestealBp = 0, regenBp = 0;
  const extraRiders = [];
  for (const a of affixes) {
    sres += a.effect.sresBp || 0;
    lifestealBp += a.effect.lifestealBp || 0;
    regenBp += a.effect.regenBp || 0;
    for (const r of a.effect.riders || []) extraRiders.push(r);
  }
  const res = { fire: 0, frost: 0, lightning: 0 };
  res[realm.element] += e.ownResistBp;
  res[realm.weakTo] += e.weakResistBp;
  const skills = boss ? row.skills.slice() : (row.special ? [row.special, arche.skill] : [arche.skill]);
  const def = {
    kind: 'enemy', monsterId: row.id, name: row.name, realm: row.realm, level, attack: boss ? 'melee' : arche.attack, boss,
    injured: false, stats, crit: t.baseCrit, critDmg: t.baseCritDmg, sres, res, skills,
    affixes: affixes.map((a) => a.id), runbook: { v: 1, rules: [] },
  };
  def.maxHp = maxHp(finalStat(stats.VIG.base, stats.VIG.pct, false, t), t);
  if (lifestealBp) def.lifestealBp = lifestealBp;
  if (regenBp) def.regenBp = regenBp;
  if (extraRiders.length) def.extraRiders = extraRiders;
  return def;
}

export const rowOf = (row, content, boss) => (boss ? 'front' : content.archetypeById[row.archetype].position);
