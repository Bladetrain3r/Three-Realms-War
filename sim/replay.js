// The replay: inputs plus event log, canonical form and hash (DESIGN.md section 14).
import { canonical, hashOf } from './canon.js';
import { resolveDelve } from './delve.js';

export const FORMAT = 'three-realms-replay';
export const VERSION = 1;

export class ReplayFormatError extends Error {}

const contentHashes = new WeakMap();
export function contentHashOf(content) {
  let h = contentHashes.get(content);
  if (h === undefined) { h = hashOf(content.raw); contentHashes.set(content, h); }
  return h;
}

function withoutHash(doc) {
  const { hash, ...rest } = doc;
  return rest;
}

// input: { realm, level, seed, party, setAllowed }
export function createReplay(input, content) {
  const out = resolveDelve(input, content);
  const doc = {
    format: FORMAT, v: VERSION, kind: 'delve',
    contentHash: contentHashOf(content),
    seed: input.seed,
    inputs: { realm: input.realm, level: input.level, setAllowed: input.setAllowed, party: input.party },
    tables: { skills: out.skills, statuses: content.statuses.map((s) => s.id) },
    plan: out.plan, events: out.events, result: out.result,
  };
  doc.hash = hashOf(doc);
  return doc;
}

export const serializeReplay = (doc) => canonical(doc);

const REQUIRED = ['format', 'v', 'kind', 'contentHash', 'seed', 'inputs', 'tables', 'plan', 'events', 'result', 'hash'];

export function readReplay(text) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw new ReplayFormatError('not valid JSON'); }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) throw new ReplayFormatError('a replay is a JSON object');
  if (doc.format !== FORMAT) throw new ReplayFormatError(`format is "${doc.format}", expected "${FORMAT}"`);
  if (doc.v !== VERSION) throw new ReplayFormatError(`replay version ${doc.v} is not supported (this build reads ${VERSION})`);
  for (const k of REQUIRED) if (doc[k] === undefined) throw new ReplayFormatError(`missing key "${k}"`);
  return doc;
}

function firstDifference(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (canonical(a[i] === undefined ? null : a[i]) !== canonical(b[i] === undefined ? null : b[i])) return i;
  return -1;
}

// Checks the hash, the content version, and re-simulates the inputs; every reason found is reported.
export function verifyReplay(doc, content) {
  const reasons = [];
  if (hashOf(withoutHash(doc)) !== doc.hash) reasons.push('hash mismatch: the document was changed after it was written');
  if (doc.contentHash !== contentHashOf(content)) {
    reasons.push('content mismatch: this build\'s content differs from the content the replay was made with');
    return { ok: false, resimulated: false, reasons };
  }
  const out = resolveDelve({ ...doc.inputs, seed: doc.seed }, content);
  const at = firstDifference(out.events, doc.events);
  if (at >= 0) reasons.push(`events differ from a fresh simulation at index ${at}`);
  if (canonical(out.result) !== canonical(doc.result)) reasons.push('result differs from a fresh simulation');
  if (canonical(out.plan) !== canonical(doc.plan)) reasons.push('plan differs from a fresh simulation');
  if (canonical(out.skills) !== canonical(doc.tables.skills)) reasons.push('skill table differs from a fresh simulation');
  return { ok: reasons.length === 0, resimulated: true, reasons };
}
