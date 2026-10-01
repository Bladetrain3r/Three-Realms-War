import { readFileSync } from 'node:fs';
import { repoPath } from './design.mjs';
import { loadContent, FILES } from '../../sim/contentcheck.js';

export const contentTexts = Object.fromEntries(FILES.map((f) => [f, readFileSync(repoPath('content', f + '.json'), 'utf8')]));
export const schemaTexts = Object.fromEntries(FILES.map((f) => [f, readFileSync(repoPath('content', 'schema', f + '.schema.json'), 'utf8')]));
// Every test now gets its content through the validator, so a content file that fails its schema stops the whole suite.
export const content = loadContent(contentTexts, schemaTexts);
export const rawContent = content.raw;

// A plain item for tests.
export function item(over = {}) {
  return { id: 1, slot: 'armour', kind: null, tier: 'plain', ilvl: 1, realm: 'midgard', set: null, star: 0, lines: [], held: null, mulligan: 1, ...over };
}
export function hero(over = {}) {
  return { id: 1, class: 'shieldwarden', name: 'Test', level: 1, xp: 0, injury: 0, slots: { weapon: null, armour: null, helm: null, charm: null }, thread: false, runbook: { v: 1, rules: [] }, ...over };
}
