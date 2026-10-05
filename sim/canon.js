// Canonical JSON and the document hash (DESIGN.md section 14). Integers only; keys sorted by code unit.
import { sha256Hex } from './sha256.js';

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function canonical(v) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'boolean': return v ? 'true' : 'false';
    case 'number':
      if (!Number.isSafeInteger(v)) throw new TypeError(`canonical JSON allows safe integers only, got ${v}`);
      return String(v);
    case 'string': return JSON.stringify(v);
    case 'object': {
      if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
      const keys = Object.keys(v).sort(byCodeUnit);
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    }
    default: throw new TypeError(`canonical JSON cannot hold a ${typeof v}`);
  }
}

export function hashOf(v) {
  return sha256Hex(new TextEncoder().encode(canonical(v)));
}
