import { readFileSync } from 'node:fs';
import { repoPath } from './design.mjs';
import { loadContent, FILES } from '../../sim/contentcheck.js';

// CONTENT_DIR lets a mutation experiment point the suite at a scratch copy of content/ (never set in normal runs).
const DIR = process.env.CONTENT_DIR || repoPath('content');
export const contentTexts = Object.fromEntries(FILES.map((f) => [f, readFileSync(`${DIR}/${f}.json`, 'utf8')]));
export const schemaTexts = Object.fromEntries(FILES.map((f) => [f, readFileSync(`${DIR}/schema/${f}.schema.json`, 'utf8')]));
// Every test now gets its content through the validator, so a content file that fails its schema stops the whole suite.
export const content = loadContent(contentTexts, schemaTexts);
export const rawContent = content.raw;
export const saveSchema = JSON.parse(readFileSync(`${DIR}/schema/save.schema.json`, 'utf8'));

// A plain item for tests.
export function item(over = {}) {
  return { id: 1, slot: 'armour', kind: null, tier: 'plain', ilvl: 1, realm: 'midgard', set: null, star: 0, lines: [], held: null, heldStar: null, mulligan: 1, ...over };
}
export function hero(over = {}) {
  return { id: 1, class: 'shieldwarden', name: 'Test', level: 1, xp: 0, injury: 0, slots: { weapon: null, armour: null, helm: null, charm: null }, thread: false, runbook: { v: 1, rules: [] }, ...over };
}
