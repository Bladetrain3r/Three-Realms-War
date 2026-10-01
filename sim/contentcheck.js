// Validating a content bundle: every file present and valid against its schema, then ids unique and every reference resolved.
// Every error names the FILE and the KEY inside it.
import { validateAgainst, pathKey } from './schema.js';
import { indexContent } from './content.js';

export const FILES = ['realms', 'statuses', 'heroes', 'skills', 'monsters', 'items', 'tables', 'names', 'runbook'];
const MONSTER_OWNERS = ['archetype', 'special', 'boss'];
const RESERVED_OWNERS = ['basic', 'set', ...MONSTER_OWNERS];

export class ContentError extends Error {
  constructor(errors) {
    super(`content refused (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n` + errors.slice(0, 12).map((e) => `  ${e.file}: ${e.key}: ${e.message}`).join('\n') + (errors.length > 12 ? `\n  ... and ${errors.length - 12} more` : ''));
    this.errors = errors;
  }
}

function idMap(list) {
  const m = Object.create(null);
  for (const x of list) m[x.id] = x;
  return m;
}

function crossCheck(c, out) {
  const bad = (file, segs, message) => out.push({ file: `${file}.json`, key: pathKey(segs), message });
  const unique = (file, list, base) => {
    const seen = Object.create(null);
    list.forEach((x, i) => { if (seen[x.id] !== undefined) bad(file, [...base, i, 'id'], `duplicate id "${x.id}" (first at [${seen[x.id]}])`); else seen[x.id] = i; });
  };
  const realms = idMap(c.realms), statuses = idMap(c.statuses), skills = idMap(c.skills), heroes = idMap(c.heroes);
  const archetypes = idMap(c.monsters.archetypes), bosses = idMap(c.monsters.bosses), sets = idMap(c.items.sets);

  unique('realms', c.realms, []); unique('statuses', c.statuses, []); unique('heroes', c.heroes, []); unique('skills', c.skills, []);
  unique('monsters', c.monsters.archetypes, ['archetypes']); unique('monsters', c.monsters.roster, ['roster']);
  unique('monsters', c.monsters.bosses, ['bosses']); unique('monsters', c.monsters.affixes, ['affixes']);
  unique('items', c.items.sets, ['sets']); unique('runbook', c.runbook.conditions, ['conditions']);
  unique('runbook', c.runbook.actions, ['actions']); unique('runbook', c.runbook.selectors, ['selectors']);

  const needStatus = (file, segs, id) => { if (!statuses[id]) bad(file, segs, `unknown status "${id}"`); };
  const needSkill = (file, segs, id, owner) => {
    if (!skills[id]) return bad(file, segs, `unknown skill "${id}"`);
    if (owner && skills[id].owner !== owner) bad(file, segs, `skill "${id}" belongs to "${skills[id].owner}", expected "${owner}"`);
  };

  c.realms.forEach((r, i) => {
    if (r.weakTo === r.element) bad('realms', [i, 'weakTo'], 'a realm cannot be weak to its own element');
    if (!bosses[r.boss]) bad('realms', [i, 'boss'], `unknown boss "${r.boss}"`); else if (bosses[r.boss].realm !== r.id) bad('realms', [i, 'boss'], `boss "${r.boss}" belongs to realm "${bosses[r.boss].realm}"`);
    if (!sets[r.set]) bad('realms', [i, 'set'], `unknown set "${r.set}"`); else if (sets[r.set].realm !== r.id) bad('realms', [i, 'set'], `set "${r.set}" belongs to realm "${sets[r.set].realm}"`);
    needStatus('realms', [i, 'realmRider', 'status'], r.realmRider.status);
  });
  for (const [k, v] of [['material', 'materials'], ['rareMaterial', 'rare materials']]) {
    const seen = Object.create(null);
    c.realms.forEach((r, i) => { if (seen[r[k]]) bad('realms', [i, k], `${v} must differ between realms ("${r[k]}" is also used by "${seen[r[k]]}")`); else seen[r[k]] = r.id; });
  }
  for (const r of Object.keys(c.names)) if (!realms[r]) bad('names', [r], `"${r}" is not a realm`);
  for (const r of c.realms) if (!c.names[r.id]) bad('names', [r.id], 'no names for this realm');

  c.statuses.forEach((s, i) => { if (s.kind === 'debuff' && s.mods) for (const k of Object.keys(s.mods)) if (s.mods[k] > 0) bad('statuses', [i, 'mods', k], 'a debuff modifier must not be positive'); });

  c.heroes.forEach((h, i) => {
    if (!realms[h.realm]) bad('heroes', [i, 'realm'], `unknown realm "${h.realm}"`);
    h.skills.forEach((s, j) => needSkill('heroes', [i, 'skills', j], s, h.id));
    const want = h.rarity === 'common' ? 2 : h.rarity === 'rare' ? 3 : 0;
    if (want && h.skills.length !== want) bad('heroes', [i, 'skills'], `a ${h.rarity} class has ${want} skills (has ${h.skills.length})`);
  });
  for (const b of ['strike', 'shoot', 'bolt']) if (!skills[b]) bad('skills', [], `the basic attack "${b}" is missing`);

  c.skills.forEach((s, i) => {
    s.riders.forEach((r, j) => needStatus('skills', [i, 'riders', j, 'status'], r.status));
    const heroOwned = Boolean(heroes[s.owner]);
    if (!heroOwned && !RESERVED_OWNERS.includes(s.owner)) bad('skills', [i, 'owner'], `owner "${s.owner}" is neither a hero class nor one of ${RESERVED_OWNERS.join(', ')}`);
    if (s.element === 'realm' && !['archetype', 'special'].includes(s.owner)) bad('skills', [i, 'element'], '"realm" element is only for monster archetype and special skills');
    if (s.realmRider && !MONSTER_OWNERS.includes(s.owner)) bad('skills', [i, 'realmRider'], 'a realm rider is only for monster skills');
    const damaging = ['physical', 'magic', 'best'].includes(s.type);
    if (damaging && !['enemy', 'all_enemies'].includes(s.target)) bad('skills', [i, 'target'], 'a damaging skill targets enemies');
    if (s.type === 'heal' && !['ally', 'all_allies', 'self'].includes(s.target)) bad('skills', [i, 'target'], 'a heal targets allies');
    if (s.type === 'heal' && s.power === 0) bad('skills', [i, 'power'], 'a heal needs power');
    if (damaging && s.power === 0) bad('skills', [i, 'power'], 'a damaging skill needs power');
    if (s.range === 'self' && s.target !== 'self') bad('skills', [i, 'range'], 'range "self" goes with target "self"');
  });

  c.monsters.archetypes.forEach((a, i) => needSkill('monsters', ['archetypes', i, 'skill'], a.skill, 'archetype'));
  c.monsters.roster.forEach((m, i) => {
    if (!realms[m.realm]) bad('monsters', ['roster', i, 'realm'], `unknown realm "${m.realm}"`);
    if (!archetypes[m.archetype]) bad('monsters', ['roster', i, 'archetype'], `unknown archetype "${m.archetype}"`);
    if (m.signature && m.special === null) bad('monsters', ['roster', i, 'special'], 'a signature monster needs a special skill');
    if (!m.signature && m.special !== null) bad('monsters', ['roster', i, 'special'], 'only a signature monster has a special skill');
    if (m.special !== null) needSkill('monsters', ['roster', i, 'special'], m.special, 'special');
  });
  c.monsters.bosses.forEach((b, i) => {
    if (!realms[b.realm]) bad('monsters', ['bosses', i, 'realm'], `unknown realm "${b.realm}"`);
    b.skills.forEach((s, j) => needSkill('monsters', ['bosses', i, 'skills', j], s, 'boss'));
  });
  c.monsters.affixes.forEach((a, i) => (a.effect.riders || []).forEach((r, j) => needStatus('monsters', ['affixes', i, 'effect', 'riders', j, 'status'], r.status)));

  c.items.sets.forEach((s, i) => {
    if (!realms[s.realm]) bad('items', ['sets', i, 'realm'], `unknown realm "${s.realm}"`);
    needSkill('items', ['sets', i, 'four', 'skill'], s.four.skill, 'set');
  });
  c.items.tiers.forEach((t, i) => { if (t.maxStar > c.items.starSuccessBp.length) bad('items', ['tiers', i, 'maxStar'], `needs ${t.maxStar} entries in starSuccessBp (has ${c.items.starSuccessBp.length})`); });
  c.items.lines.forEach((l, i) => {
    if (l.index !== i) bad('items', ['lines', i, 'index'], `line indexes must run 0, 1, 2, ... (this is ${l.index})`);
    if (l.lo > l.hi) bad('items', ['lines', i, 'lo'], 'lo must not exceed hi');
  });
  c.items.slotOrder.forEach((s, i) => { if (!c.items.slots[s]) bad('items', ['slotOrder', i], `no such slot "${s}"`); });

  const t = c.tables;
  t.recruit.startingRoster.forEach((id, i) => {
    if (!heroes[id]) bad('tables', ['recruit', 'startingRoster', i], `unknown hero class "${id}"`);
    else if (heroes[id].rarity !== 'common') bad('tables', ['recruit', 'startingRoster', i], `"${id}" is not a common class`);
  });
  if (t.combat.resMin >= t.combat.resMax) bad('tables', ['combat', 'resMin'], 'resMin must be below resMax');
  for (const k of ['first', 'middle', 'boss']) if (t.delve.bandWeights[k].every((w) => w === 0)) bad('tables', ['delve', 'bandWeights', k], 'at least one weight must be above 0');
  if (t.progress.rep.known >= t.progress.rep.trusted || t.progress.rep.trusted >= t.progress.rep.honoured) bad('tables', ['progress', 'rep'], 'standings must rise: known < trusted < honoured');

  const argTypes = c.runbook.argTypes;
  for (const k of Object.keys(argTypes)) {
    const a = argTypes[k];
    if (a.of !== undefined && !['statuses', 'skills'].includes(a.of)) bad('runbook', ['argTypes', k, 'of'], `"of" must be statuses or skills (got ${a.of})`);
    if (a.of === undefined && a.values === undefined && (a.min === undefined || a.max === undefined)) bad('runbook', ['argTypes', k], 'needs values, of, or min and max');
  }
  for (const [list, name] of [[c.runbook.conditions, 'conditions'], [c.runbook.actions, 'actions']]) {
    list.forEach((x, i) => { for (const a of Object.keys(x.args)) if (!argTypes[x.args[a]]) bad('runbook', [name, i, 'args', a], `unknown argument type "${x.args[a]}"`); });
  }
}

// files: { realms: <parsed JSON or undefined>, ... }; schemas: { realms: <schema>, ... }
export function validateContent(files, schemas) {
  const errors = [];
  for (const f of FILES) {
    if (files[f] === undefined) { errors.push({ file: `${f}.json`, key: '(file)', message: 'file is missing' }); continue; }
    for (const e of validateAgainst(files[f], schemas[f])) errors.push({ file: `${f}.json`, ...e });
  }
  if (errors.length === 0) crossCheck(files, errors);
  return { ok: errors.length === 0, errors };
}

// texts: { realms: "<file text>", ... } as read from disk or fetched. Returns the indexed content or throws ContentError.
export function loadContent(texts, schemaTexts) {
  const files = {}, schemas = {}, errors = [];
  for (const f of FILES) {
    schemas[f] = JSON.parse(schemaTexts[f]);
    if (texts[f] === undefined) continue;
    try { files[f] = JSON.parse(texts[f]); } catch (e) { errors.push({ file: `${f}.json`, key: '(file)', message: `not valid JSON: ${e.message}` }); }
  }
  const r = validateContent(files, schemas);
  const all = errors.concat(r.errors.filter((e) => !(e.key === '(file)' && errors.some((x) => x.file === e.file))));
  if (all.length) throw new ContentError(all);
  return indexContent(files);
}
