// Content access for the simulation. The sim never reads files: it is handed the parsed content bundle.
import { hashOf } from './canon.js';

export const STATS = ['VIG', 'MIT', 'ARC', 'GRD', 'WRD', 'SPD'];
export const ELEMENTS = ['fire', 'frost', 'lightning'];
export const REALMS = ['midgard', 'asgard', 'helheim'];

function byId(list) {
  const o = Object.create(null);
  for (const x of list) o[x.id] = x;
  return o;
}

export function contentHash(raw) {
  return hashOf(raw);
}

// Lookup tables by id. Ordered lists stay arrays; nothing here is ever iterated as an object.
export function indexContent(raw) {
  const monsters = raw.monsters;
  return {
    raw,
    tables: raw.tables,
    statuses: raw.statuses,
    statusById: byId(raw.statuses),
    realms: raw.realms,
    realmById: byId(raw.realms),
    heroes: raw.heroes,
    heroById: byId(raw.heroes),
    skills: raw.skills,
    skillById: byId(raw.skills),
    archetypeById: byId(monsters.archetypes),
    roster: monsters.roster,
    bosses: monsters.bosses,
    bossById: byId(monsters.bosses),
    legends: monsters.legends,
    legendById: byId(monsters.legends),
    affixes: monsters.affixes,
    items: raw.items,
    tierById: byId(raw.items.tiers),
    setById: byId(raw.items.sets),
    names: raw.names,
    runbook: raw.runbook,
    starterRunbooks: raw.starter_runbooks,
  };
}
