// Reads the "[WE-nn] ... => values" lines of DESIGN.md so tests can check the sim against the document.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repoPath = (...p) => join(root, ...p);

const doc = readFileSync(repoPath('DESIGN.md'), 'utf8');

export function documentedExamples() {
  const out = new Map();
  for (const m of doc.matchAll(/\[(WE-\d+)\][^\n]*=> ([^\n]*)/g)) out.set(m[1], m[2].trim());
  return out;
}
