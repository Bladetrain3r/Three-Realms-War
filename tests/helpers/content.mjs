import { readFileSync } from 'node:fs';
import { repoPath } from './design.mjs';
import { indexContent } from '../../sim/content.js';

const FILES = ['realms', 'statuses', 'heroes', 'skills', 'monsters', 'items', 'tables', 'names', 'runbook'];
export const rawContent = Object.fromEntries(FILES.map((f) => [f, JSON.parse(readFileSync(repoPath('content', f + '.json'), 'utf8'))]));
export const content = indexContent(rawContent);

// A plain item for tests.
export function item(over = {}) {
  return { id: 1, slot: 'armour', kind: null, tier: 'plain', ilvl: 1, realm: 'midgard', set: null, star: 0, lines: [], held: null, mulligan: 1, ...over };
}
export function hero(over = {}) {
  return { id: 1, class: 'shieldwarden', name: 'Test', level: 1, xp: 0, injury: 0, slots: { weapon: null, armour: null, helm: null, charm: null }, thread: false, runbook: { v: 1, rules: [] }, ...over };
}
