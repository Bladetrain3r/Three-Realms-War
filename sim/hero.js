// Build a resolved hero unit (the form a replay carries) from a roster hero and the items they wear (DESIGN.md 4.4, 7, 8).
import { STATS, ELEMENTS } from './content.js';
import { heroBaseParagon, withAffinity, finalStat, maxHp } from './stats.js';
import { itemMain, lineValue } from './items.js';

const LINE_STAT = { VIG_PCT: 'VIG', MIT_PCT: 'MIT', ARC_PCT: 'ARC', GRD_PCT: 'GRD', WRD_PCT: 'WRD', SPD_PCT: 'SPD' };

// Every stat has `maxPerStat` paragon stars (6 x 3 = 18).
export function paragonStars(hero) {
  return STATS.reduce((n, s) => n + ((hero.paragon && hero.paragon[s]) || []).length, 0);
}
export function paragonComplete(hero, content) {
  return STATS.every((s) => ((hero.paragon && hero.paragon[s]) || []).length >= content.tables.paragon.maxPerStat);
}

export function canEquip(hero, item, content) {
  return item.ilvl <= hero.level + content.items.levelSlack;
}

// The skills a hero may put in a runbook: the class's own, plus the skill of any set worn in full (DESIGN.md 8.5).
export function kitOf(hero, itemsById, content) {
  const cls = content.heroById[hero.class], counts = Object.create(null), skills = cls.skills.slice();
  for (const slot of content.items.slotOrder) {
    const it = hero.slots[slot] === null || hero.slots[slot] === undefined ? null : itemsById[hero.slots[slot]];
    if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
  }
  for (const set of content.items.sets) if ((counts[set.id] || 0) >= 4) skills.push(set.four.skill);
  return skills;
}

// itemsById: plain object keyed by item id. opts.forced: an injured hero made to fight (stats halved).
export function buildHeroUnit(hero, itemsById, content, opts = {}) {
  const t = content.tables.stats, cls = content.heroById[hero.class], realm = content.realmById[cls.realm];
  const flat = { VIG: 0, MIT: 0, ARC: 0, GRD: 0, WRD: 0, SPD: 0 };
  const pct = { VIG: 0, MIT: 0, ARC: 0, GRD: 0, WRD: 0, SPD: 0 };
  const res = { fire: 0, frost: 0, lightning: 0 };
  let crit = t.baseCrit, critDmg = t.baseCritDmg, sres = t.heroSresBase;
  const setCounts = Object.create(null);
  const worn = [];

  for (const slot of content.items.slotOrder) {
    const id = hero.slots[slot];
    if (id === null || id === undefined) continue;
    const item = itemsById[id];
    if (!item || item.slot !== slot) throw new RangeError(`hero ${hero.id}: item ${id} does not fit slot ${slot}`);
    if (!canEquip(hero, item, content)) throw new RangeError(`hero ${hero.id}: item ${id} (level ${item.ilvl}) is above hero level ${hero.level} + ${content.items.levelSlack}`);
    const main = itemMain(item, content);
    for (const [stat, v] of main.flat) flat[stat] += v;
    res[content.realmById[item.realm].element] += main.resist;
    for (const [k, raw] of item.lines) {
      const def = content.items.lines[k], v = lineValue(raw, item.star, content.items);
      if (LINE_STAT[def.id]) pct[LINE_STAT[def.id]] += v;
      else if (def.id === 'CRIT') crit += v;
      else if (def.id === 'CRITDMG') critDmg += v;
      else if (def.id === 'SRES') sres += v;
      else res[content.realmById[item.realm].element] += v; // RES_REALM
    }
    if (item.set) { setCounts[item.set] = (setCounts[item.set] || 0) + 1; }
    worn.push(item.id);
  }

  const skills = cls.skills.slice();
  for (const set of content.items.sets) { // fixed order
    const n = setCounts[set.id] || 0;
    if (n >= 2) {
      const mods = set.two.mods || {};
      for (const s of STATS) if (mods[s]) pct[s] += mods[s];
      for (const e of ELEMENTS) if (set.two.res && set.two.res[e]) res[e] += set.two.res[e];
      if (set.two.sresBp) sres += set.two.sresBp;
    }
    if (n >= 4) skills.push(set.four.skill);
  }

  res[realm.element] += t.affinityResBp;
  // a hero with every paragon star (maxPerStat on all six stats) earns the class's single extra bonus (4.6)
  let healBp = 0, lifestealBp = 0;
  if (paragonComplete(hero, content)) {
    const b = cls.paragonBonus;
    if (b.kind === 'crit') crit += b.bp; else if (b.kind === 'critDmg') critDmg += b.bp; else if (b.kind === 'sres') sres += b.bp; else if (b.kind === 'heal') healBp = b.bp; else lifestealBp = b.bp;
  }
  const injured = Boolean(opts.forced);
  const stats = {};
  for (const s of STATS) {
    let base = heroBaseParagon(cls.stats[s], hero.level, (hero.paragon && hero.paragon[s]) || [], t, content.tables.paragon.starBp);
    if (realm.affinityStats.includes(s)) base = withAffinity(base, t);
    stats[s] = { base: base + flat[s], pct: pct[s] };
  }
  const vig = finalStat(stats.VIG.base, stats.VIG.pct, injured, t);
  return {
    kind: 'hero', heroId: hero.id, name: hero.name, class: cls.id, realm: cls.realm, level: hero.level,
    attack: cls.attack, row: cls.row, injured, maxHp: maxHp(vig, t), stats, crit, critDmg, sres, res,
    skills, runbook: hero.runbook, ...(healBp ? { healBp } : {}), ...(lifestealBp ? { lifestealBp } : {}),
  };
}
