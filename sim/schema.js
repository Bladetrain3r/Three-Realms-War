// A small JSON Schema subset validator (no dependencies). Supported: $ref (local $defs), type, enum, const, minimum, maximum,
// pattern, minLength, items, minItems, maxItems, uniqueItems, properties, required, additionalProperties (false or a schema).
// Errors are { key, message } where key is a path such as "[2].stats.VIG".

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeMatches = (v, t) => (t === 'number' ? typeof v === 'number' : typeOf(v) === t);

export function pathKey(segs) {
  let out = '';
  for (const s of segs) out += typeof s === 'number' ? `[${s}]` : out === '' ? s : `.${s}`;
  return out === '' ? '(root)' : out;
}

function distance(a, b) { // edit distance, used only to suggest a likely intended key
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}

function show(v) { return typeof v === 'string' ? JSON.stringify(v) : typeOf(v) === 'array' || typeOf(v) === 'object' ? typeOf(v) : String(v); }

export function validate(value, schema, defs, segs, errors) {
  if (schema.$ref) {
    const name = schema.$ref.slice('#/$defs/'.length);
    if (!defs || !defs[name]) throw new Error(`schema refers to missing definition ${schema.$ref}`);
    return validate(value, defs[name], defs, segs, errors);
  }
  const err = (message, extra = []) => errors.push({ key: pathKey([...segs, ...extra]), message });
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) return err(`expected ${types.join(' or ')}, got ${typeOf(value)}`);
  }
  if (schema.const !== undefined && value !== schema.const) err(`must be ${show(schema.const)} (got ${show(value)})`);
  if (schema.enum !== undefined && !schema.enum.includes(value)) err(`must be one of ${schema.enum.join(', ')} (got ${show(value)})`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) err(`must be at least ${schema.minimum} (got ${value})`);
    if (schema.maximum !== undefined && value > schema.maximum) err(`must be at most ${schema.maximum} (got ${value})`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) err('must not be empty');
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) err(`must match ${schema.pattern} (got ${show(value)})`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) err(`needs at least ${schema.minItems} items (has ${value.length})`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) err(`allows at most ${schema.maxItems} items (has ${value.length})`);
    if (schema.uniqueItems) {
      const seen = Object.create(null);
      value.forEach((v, i) => {
        const k = JSON.stringify(v);
        if (seen[k] !== undefined) err(`duplicates item [${seen[k]}]`, [i]); else seen[k] = i;
      });
    }
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, defs, [...segs, i], errors));
  } else if (typeOf(value) === 'object') {
    const props = schema.properties || {}, have = Object.keys(value), allowed = Object.keys(props);
    for (const r of schema.required || []) if (!(r in value)) err(`missing required key "${r}"`, [r]);
    for (const k of have) {
      if (props[k]) validate(value[k], props[k], defs, [...segs, k], errors);
      else if (schema.additionalProperties === false) {
        const near = allowed.find((a) => !(a in value) && distance(a, k) <= 2);
        err(`unknown key "${k}"${near ? ` (did you mean "${near}"?)` : ''}`, [k]);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(value[k], schema.additionalProperties, defs, [...segs, k], errors);
    }
  }
}

export function validateAgainst(value, schema) {
  const errors = [];
  validate(value, schema, schema.$defs || {}, [], errors);
  return errors;
}
