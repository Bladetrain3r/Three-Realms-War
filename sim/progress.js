// Experience, recruiting and delve rewards (DESIGN.md sections 7.5 and 11).
import { idiv } from './arith.js';

export function xpToNext(level, p) {
  return p.xpBase + p.xpPerLevel * level + idiv(level * level * level, p.xpCubeDiv);
}

export function recruitLevel(topLevel, r) {
  return Math.max(1, idiv(topLevel * r.levelNum, r.levelDen));
}

// A recruit's starting kit is built at half the hero's level (at least 1): a recruit can arrive above the dungeon level.
export function recruitKitLevel(level, r) {
  return Math.max(1, idiv(level, r.kitLevelDen));
}

export function recruitCost(level, rare, r) {
  const base = r.costBase + r.costPerLevel * level;
  return rare ? base * r.rareMul : base;
}

// Rewards for one cleared encounter at delve level D; `boss` doubles xp and materials and triples silver.
export function encounterRewards(D, boss, p) {
  const xp = p.encXpBase + p.encXpPerD * D;
  const mat = p.matBase + idiv(D, p.matDiv);
  const silver = p.silverBase + D;
  return boss
    ? { xp: xp * p.bossMul, materials: mat * p.bossMatMul, hacksilver: silver * p.bossSilverMul }
    : { xp, materials: mat, hacksilver: silver };
}
