// A unit in a fight: the resolved definition (what a replay carries) plus mutable fight state.
import { finalStat } from './stats.js';

// A skill as it behaves for one unit: monster skills take their dungeon's element and realm rider.
export function effectiveSkill(raw, def, content) {
  const realm = content.realmById[def.realm];
  const damaging = raw.type === 'physical' || raw.type === 'magic' || raw.type === 'best';
  const riders = [];
  if (raw.realmRider) riders.push({ status: realm.realmRider.status, chance: realm.realmRider.chance, duration: realm.realmRider.duration, on: 'target' });
  for (const r of raw.riders) riders.push(r);
  if (damaging && def.extraRiders) for (const r of def.extraRiders) riders.push(r);
  return { ...raw, element: raw.element === 'realm' ? realm.element : raw.element, riders };
}

const BASIC_BY_ATTACK = { melee: 'strike', ranged: 'shoot', magic: 'bolt' };

export function makeUnit(def, id, side, slot, startHp, content) {
  const skills = def.skills.map((sid) => effectiveSkill(content.skillById[sid], def, content));
  const hp = startHp === null ? def.maxHp : startHp;
  if (!Number.isInteger(hp) || hp < 0 || hp > def.maxHp) throw new RangeError(`unit ${id}: starting HP ${hp} is outside 0..${def.maxHp}`);
  return {
    id, side, slot, def, hp, maxHp: def.maxHp, alive: hp > 0,
    skills, skillIds: def.skills.slice(), cd: skills.map(() => 0),
    basic: effectiveSkill(content.skillById[BASIC_BY_ATTACK[def.attack]], def, content),
    statuses: [], turn: 0, shockImmune: 0,
  };
}

export function statOf(u, stat, content) {
  let pct = u.def.stats[stat].pct;
  for (const s of u.statuses) {
    const m = content.statusById[s.id].mods;
    if (m && m[stat]) pct += m[stat];
  }
  return finalStat(u.def.stats[stat].base, pct, u.def.injured, content.tables.stats);
}

export function hasStatus(u, id) {
  for (const s of u.statuses) if (s.id === id) return true;
  return false;
}

export function takenBp(u, content) {
  let t = 0;
  for (const s of u.statuses) t += content.statusById[s.id].damageTakenBp || 0;
  return t;
}
