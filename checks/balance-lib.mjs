// Shared pieces of the balance runner: loading, parties with a gear ladder, hero HP rebuilt from a replay's events.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadContent, FILES } from '../sim/contentcheck.js';
import { buildHeroUnit } from '../sim/hero.js';
import { parseYaml } from './yaml.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
// CONTENT_DIR points a tuning experiment at a scratch copy of content/ (never set in a real run).
const readContent = (...p) => (process.env.CONTENT_DIR ? readFileSync(join(process.env.CONTENT_DIR, ...p), 'utf8') : read('content', ...p));

export function loadAll(overrides = {}) {
  const texts = Object.fromEntries(FILES.map((f) => [f, readContent(f + '.json')]));
  const schemas = Object.fromEntries(FILES.map((f) => [f, readContent('schema', f + '.schema.json')]));
  const B = parseYaml(read('checks', 'balance.yaml'));
  Object.assign(B.run, overrides);
  const content = loadContent(texts, schemas);
  return { content, B, runbooks: content.starterRunbooks }; // the harness plays every class with its starter runbook
}

// A hero wearing a full set at item level = hero level; ladder[tierName] = [tier, star]; 'none' wears nothing.
export function makeHero(ctx, classId, level, tierName, id = 1) {
  const { content, B, runbooks } = ctx;
  const cls = content.heroById[classId], slots = { weapon: null, armour: null, helm: null, charm: null }, items = {};
  if (tierName !== 'none') {
    const [tier, star] = B.ladder[tierName];
    const kind = cls.attack === 'magic' ? 'ARC' : 'MIT';
    let n = 100 * id;
    for (const slot of content.items.slotOrder) {
      n++;
      items[n] = { id: n, slot, kind: slot === 'weapon' ? kind : null, tier, ilvl: level, realm: cls.realm, set: null, star, lines: [], held: null, mulligan: 1 };
      slots[slot] = n;
    }
  }
  const hero = { id, class: classId, name: classId, level, xp: 0, injury: 0, slots, thread: false, runbook: runbooks[classId] };
  return buildHeroUnit(hero, items, content);
}

export const makeParty = (ctx, classes, level, tierName) => classes.map((c, i) => makeHero(ctx, c, level, tierName, i + 1));

// Rebuild hero HP and count events from a delve's event log (the log alone is enough; DESIGN.md 14).
export function summarizeDelve(events, party) {
  const hp = party.map((p) => p.maxHp), rounds = [];
  let downsInWon = 0, wonEncounters = 0, downsThisEnc = 0, timeouts = 0;
  for (const e of events) {
    switch (e[0]) {
      case 0: downsThisEnc = 0; break;
      case 4: if (e[2] < 4) hp[e[2]] = e[5]; break;
      case 5: if (e[2] < 4) hp[e[2]] = e[4]; break;
      case 7: if (e[1] < 4) hp[e[1]] += e[2] === 0 ? -e[3] : e[3]; break;
      case 9: if (e[1] < 4) downsThisEnc++; break;
      case 12: hp[e[1]] = e[2]; break;
      case 11:
        rounds.push(e[2]);
        if (e[1] === 1) { wonEncounters++; downsInWon += downsThisEnc; }
        else if (e[2] >= 30 && hp.some((h) => h > 0)) timeouts++;
        break;
      default: break;
    }
  }
  return { finalHp: hp, rounds, downsInWon, wonEncounters, timeouts };
}

export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2; };
// Rates are rounded to six decimals so a report is stable text.
export const r6 = (x) => Math.round(x * 1e6) / 1e6;
