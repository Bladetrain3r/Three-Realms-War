// Generating and running a delve (DESIGN.md 10.5, 5.8, 5.9, 11.2).
import { mulbp } from './arith.js';
import { createRng } from './prng.js';
import { makeContext, resolveEncounter } from './combat.js';
import { buildMonster, rowOf } from './monster.js';
import { encounterRewards } from './progress.js';
import { generateItem } from './items.js';

function pickBand(rng, weights) {
  let r = rng.range(weights[0] + weights[1] + weights[2]);
  for (let b = 0; b < 3; b++) {
    if (r < weights[b]) return b + 1;
    r -= weights[b];
  }
  throw new Error('unreachable');
}

function rollAffixes(rng, level, content) {
  const a = content.tables.delve.affix, out = [];
  if (level < a.minDelve) return out;
  const eligible = content.affixes.filter((x) => x.minLevel <= level);
  const chance = level >= a.highFrom ? a.chanceHighBp : a.chanceBp;
  if (rng.range(10000) >= chance) return out;
  out.push(eligible[rng.range(eligible.length)]);
  if (level >= a.secondFrom && rng.range(10000) < a.secondBp) {
    const rest = eligible.filter((x) => x !== out[0]);
    out.push(rest[rng.range(rest.length)]);
  }
  return out;
}

// Preferred row first, spilling into the other row; returns the slot or -1.
function place(slots, row) {
  const order = row === 'front' ? [0, 1, 2, 3] : [2, 3, 0, 1];
  for (const s of order) if (!slots[s]) return s;
  return -1;
}

// The whole plan is drawn up front: encounter count, then each encounter's enemies.
export function generateDelve(rng, { realm, level }, content) {
  const d = content.tables.delve, n = d.minEncounters + rng.range(d.encounterSpan);
  const monsters = content.roster.filter((m) => m.realm === realm);
  const encounters = [];
  for (let k = 0; k < n; k++) {
    const isBoss = k === n - 1, kind = k === 0 ? 'first' : isBoss ? 'boss' : 'middle';
    const slots = [null, null, null, null];
    if (isBoss) {
      const boss = content.bossById[content.realmById[realm].boss];
      slots[place(slots, 'front')] = buildMonster(boss, level + content.tables.enemy.bossLevelBonus, content, { boss: true });
    }
    const count = isBoss ? d.bossAdds : k === 0 ? d.firstEnemies : d.otherEnemies;
    for (let i = 0; i < count; i++) {
      const band = pickBand(rng, d.bandWeights[kind]);
      const inBand = monsters.filter((m) => m.band === band);
      const row = inBand[rng.range(inBand.length)];
      const affixes = rollAffixes(rng, level, content);
      slots[place(slots, rowOf(row, content, false))] = buildMonster(row, level, content, { affixes });
    }
    const enemies = [];
    slots.forEach((def, slot) => { if (def) enemies.push({ ...def, slot }); });
    encounters.push(enemies);
  }
  return encounters;
}

export const planOf = (encounters) => encounters.map((es) => es.map((e) => ({ slot: e.slot, id: e.monsterId, name: e.name, level: e.level, maxHp: e.maxHp, boss: e.boss, affixes: e.affixes })));

// input: { realm, level, seed, party: [hero unit defs], setAllowed }. Returns { events, skills, plan, result }.
export function resolveDelve(input, content) {
  if (input.party.length < 1 || input.party.length > 4) throw new RangeError('a party has 1 to 4 heroes');
  const rng = createRng(input.seed), events = [], ctx = makeContext(content, rng, events);
  const D = input.level, p = content.tables.progress, realm = content.realmById[input.realm];
  const encounters = generateDelve(rng, input, content);
  let heroHp = null, cleared = 0, won = true;
  for (let k = 0; k < encounters.length; k++) {
    const r = resolveEncounter(ctx, { index: k, heroes: input.party, heroHp, enemies: encounters[k] });
    heroHp = r.heroHp;
    if (r.outcome === 0) { won = false; break; }
    cleared++;
    if (k < encounters.length - 1) {
      heroHp = heroHp.map((hp, i) => {
        if (hp === 0) return 0;
        const slot = input.party[i].slot === undefined ? i : input.party[i].slot;
        const up = Math.min(input.party[i].maxHp, hp + mulbp(input.party[i].maxHp, content.tables.combat.restHealBp));
        ctx.emit([12, slot, up]);
        return up;
      });
    }
  }
  ctx.emit([13, won ? 1 : 0, cleared]);
  const result = { outcome: won ? 1 : 0, encounters: encounters.length, cleared, injured: [], rewards: null };
  heroHp.forEach((hp, i) => { if (hp === 0) result.injured.push(i); });
  if (won) result.rewards = delveRewards(rng, input, encounters.length, content, p, realm);
  return { events, skills: ctx.skillTable, plan: planOf(encounters), result };
}

function delveRewards(rng, input, n, content, p, realm) {
  const D = input.level;
  let xp = 0, mat = 0, silver = 0;
  const items = [];
  for (let k = 0; k < n; k++) {
    const boss = k === n - 1, r = encounterRewards(D, boss, p);
    xp += r.xp; mat += r.materials; silver += r.hacksilver;
    if (boss) items.push(generateItem(rng, { ilvl: D, realm: input.realm, boss: true, setAllowed: input.setAllowed }, content));
    else if (rng.range(10000) < content.items.drops.encounterBp) items.push(generateItem(rng, { ilvl: D, realm: input.realm, boss: false, setAllowed: input.setAllowed }, content));
  }
  const thread = rng.range(10000) < p.threadBp ? 1 : 0;
  const materials = {};
  materials[realm.material] = mat;
  materials[realm.rareMaterial] = 1;
  return { xp, materials, hacksilver: silver, reputation: p.repWin + p.repBoss, items, threads: thread };
}
