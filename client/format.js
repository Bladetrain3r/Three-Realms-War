// Text for stats, items and costs. Pure (no DOM): the numbers come from the sim's own functions.
import { itemMain, lineValue } from '../sim/items.js';
import { buildHeroUnit } from '../sim/hero.js';
import { finalStat } from '../sim/stats.js';
import { STATS } from '../sim/content.js';

export const pct = (bp) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`;
export const stars = (n, max) => '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
const LINE_NAME = { VIG_PCT: 'VIG', MIT_PCT: 'MIT', ARC_PCT: 'ARC', GRD_PCT: 'GRD', WRD_PCT: 'WRD', SPD_PCT: 'SPD', CRIT: 'Crit chance', CRITDMG: 'Crit damage', SRES: 'Status resist', RES_REALM: 'Realm resist' };

export function itemTitle(it, content) {
  const tier = content.tierById[it.tier], realm = content.realmById[it.realm];
  return `${tier.name} ${realm.name} ${it.slot}${it.kind ? ` (${it.kind})` : ''}`;
}
export function itemMainText(it, content) {
  const m = itemMain(it, content), parts = m.flat.map(([s, v]) => `+${v} ${s}`);
  if (m.resist) parts.push(`+${pct(m.resist)} ${content.realmById[it.realm].element} resist`);
  return parts.join(', ');
}
// Bonus lines as the player reads them: the value in effect at `star` (the stored raw roll scaled by the star, DESIGN 8.3).
export function linesTextAt(lines, star, content) {
  return lines.map(([k, raw]) => `+${pct(lineValue(raw, star, content.items))} ${LINE_NAME[content.items.lines[k].id]}`);
}
export const itemLineTexts = (it, content) => linesTextAt(it.lines, it.star, content);
// The main stats of the item as it stood at `star`.
export const itemMainTextAt = (it, star, content) => itemMainText({ ...it, star }, content);
export function itemSetText(it, content) { return it.set ? content.setById[it.set].name : ''; }
export function itemLine(it, content) {
  const tier = content.tierById[it.tier];
  return `${itemTitle(it, content)} L${it.ilvl} ${stars(it.star, tier.maxStar)}`;
}

// Final stats of a hero as the sim would use them (the same function the delve calls).
export function heroSheet(hero, save, content) {
  const byId = Object.create(null); for (const it of save.items) byId[it.id] = it;
  const u = buildHeroUnit(hero, byId, content, { forced: hero.injury > 0 }), t = content.tables.stats, st = {};
  for (const s of STATS) st[s] = finalStat(u.stats[s].base, u.stats[s].pct, u.injured, t);
  return { unit: u, stats: st, maxHp: u.maxHp, crit: u.crit, critDmg: u.critDmg, sres: u.sres, res: u.res };
}
export function injuryText(h) { return h.injury > 0 ? `injured, ${h.injury} more delve${h.injury === 1 ? '' : 's'}` : 'fit'; }
export const matName = (id) => id.replace(/_/g, ' ');
