// Public surface of the deterministic core. No DOM, no Node-only imports.
export { idiv, mulbp, clamp } from './arith.js';
export { createRng, deriveSeed, splitmix32 } from './prng.js';
export { sha256Hex } from './sha256.js';
export { canonical, hashOf } from './canon.js';
export { indexContent, contentHash, STATS, ELEMENTS, REALMS } from './content.js';
export { heroBase, finalStat } from './stats.js';
export { buildHeroUnit, canEquip } from './hero.js';
export { buildMonster } from './monster.js';
export { itemMain, lineValue, rollLines, generateItem, upgradeCost, attemptUpgrade, acceptUpgrade, useMulligan, salvageValue } from './items.js';
export { xpToNext, recruitLevel, recruitCost, encounterRewards } from './progress.js';
export { validateRunbook } from './runbook.js';
export { resolveEncounter, makeContext } from './combat.js';
export { generateDelve, resolveDelve } from './delve.js';
export { createReplay, serializeReplay, readReplay, verifyReplay, contentHashOf, ReplayFormatError } from './replay.js';
