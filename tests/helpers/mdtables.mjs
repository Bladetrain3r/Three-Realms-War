// Parse the tables and sentences of DESIGN.md so tests can compare content with the design.
import { readFileSync } from 'node:fs';
import { repoPath } from './design.mjs';

export const designText = readFileSync(repoPath('DESIGN.md'), 'utf8');
const lines = designText.split('\n');

function headingIndex(marker) {
  const i = lines.findIndex((l) => l.startsWith('#') && l.includes(marker));
  if (i < 0) throw new Error(`DESIGN.md has no heading containing "${marker}"`);
  return i;
}

// All tables under the heading, each as an array of rows of cell strings (header row first, separator dropped).
export function tablesIn(marker) {
  const i = headingIndex(marker), level = lines[i].length - lines[i].replace(/^#+/, '').length;
  const out = []; let cur = null;
  for (const l of lines.slice(i + 1)) {
    if (l.startsWith('#') && l.length - l.replace(/^#+/, '').length <= level) break;
    if (l.startsWith('|')) {
      const cells = l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/^`+|`+$/g, ''));
      if (cur === null) { cur = []; out.push(cur); }
      if (cells.every((c) => /^-+$/.test(c))) continue;
      cur.push(cells);
    } else cur = null;
  }
  return out;
}
export const rowsOf = (marker, n = 0) => tablesIn(marker)[n].slice(1);

export function sectionText(marker) {
  const i = headingIndex(marker), level = lines[i].length - lines[i].replace(/^#+/, '').length;
  const out = [];
  for (const l of lines.slice(i + 1)) {
    if (l.startsWith('#') && l.length - l.replace(/^#+/, '').length <= level) break;
    out.push(l);
  }
  return out.join('\n');
}

export const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const TYPE_NAME = { P: 'physical', M: 'magic', H: 'heal', U: 'utility', best: 'best' };

// "shock 2500/1", "bulwark 10000/3 self, mend 10000/3 self", "lifesteal 5000"
export function parseRiders(text) {
  const riders = []; let lifestealBp = 0;
  const t = text.replace(/\(no realm rider\)/, '').trim();
  for (const part of t.split(',').map((p) => p.trim()).filter((p) => p !== '' && p !== 'realm rider')) {
    let m = /^lifesteal (\d+)$/.exec(part);
    if (m) { lifestealBp = Number(m[1]); continue; }
    m = /^(\w+) (\d+)\/(\d+)( self)?$/.exec(part);
    if (!m) throw new Error(`cannot parse rider "${part}"`);
    riders.push({ status: m[1], chance: Number(m[2]), duration: Number(m[3]), on: m[4] ? 'self' : 'target' });
  }
  return { riders, lifestealBp };
}

// Pull numbers out of one sentence. Fails loudly if the sentence is no longer in the design.
export function prose(re, label) {
  const m = re.exec(designText);
  if (!m) throw new Error(`DESIGN.md no longer contains the sentence for "${label}" (${re})`);
  return m.slice(1).map((x) => Number(x.replace(/,/g, '')));
}

export function proseRaw(re, label) {
  const m = re.exec(designText);
  if (!m) throw new Error(`DESIGN.md no longer contains the sentence for "${label}" (${re})`);
  return m.slice(1);
}
export const clean = (s) => s.replace(/`/g, '');
