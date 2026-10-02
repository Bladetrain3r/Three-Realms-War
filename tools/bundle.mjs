// A dependency-free bundler for this repository's plain ES modules. It exists because browsers do not load module scripts
// from file:// (SPEC requires the game to run from there). It supports exactly the module syntax this codebase uses and refuses
// anything else, loudly:
//   import { a, b as c } from './x.js';   import * as ns from './x.js';   import './x.js';
//   export function f / async function / const / let / class;   export { a, b as c };   export { a, b as c } from './y.js';
// Not supported (build error): export default, export *, default imports, import.meta, dynamic import, import cycles.
//   node tools/bundle.mjs [--out dist] [--build <label>]
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMED = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const NS = /^import\s*\*\s*as\s+(\w+)\s+from\s*'([^']+)';?[ \t]*$/gm;
const SIDE = /^import\s*'([^']+)';?[ \t]*$/gm;
const REEXPORT = /^export\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\};?[ \t]*$/gm;
const EXPORT_DECL = /^export\s+(?:async\s+function\s*\*?|function\s*\*?|const|let|var|class)\s+(\w+)/gm;
const UNSUPPORTED = [[/^export\s+default\b/m, 'export default'], [/^export\s*\*/m, 'export *'], [/^import\s+\w+\s+from\b/m, 'a default import'], [/\bimport\.meta\b/, 'import.meta'], [/\bimport\s*\(/, 'dynamic import()']];

const pairs = (list) => list.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(x); if (!m) throw new Error(`cannot read "${x}"`); return [m[1], m[2] || m[1]]; });

function transform(id, src) {
  for (const [re, what] of UNSUPPORTED) if (re.test(src)) throw new Error(`${id}: ${what} is not supported by tools/bundle.mjs`);
  const deps = [], tail = [];
  const spec = (s) => { deps.push(s); return JSON.stringify(s); };
  let out = src;
  out = out.replace(REEXPORT, (_, list, s) => { const q = spec(s); for (const [from, to] of pairs(list)) tail.push(`exports.${to} = __req(__resolve(${JSON.stringify(id)}, ${q})).${from};`); return ''; });
  out = out.replace(NAMED, (_, list, s) => `const { ${pairs(list).map(([a, b]) => (a === b ? a : `${a}: ${b}`)).join(', ')} } = __named(__req(__resolve(${JSON.stringify(id)}, ${spec(s)})), ${JSON.stringify(pairs(list).map(([a]) => a))}, ${JSON.stringify(id)});`);
  out = out.replace(NS, (_, name, s) => `const ${name} = __req(__resolve(${JSON.stringify(id)}, ${spec(s)}));`);
  out = out.replace(SIDE, (_, s) => `__req(__resolve(${JSON.stringify(id)}, ${spec(s)}));`);
  out = out.replace(EXPORT_LIST, (_, list) => { for (const [a, b] of pairs(list)) tail.push(`exports.${b} = ${a};`); return ''; });
  out = out.replace(EXPORT_DECL, (m, name) => { tail.push(`exports.${name} = ${name};`); return m.replace(/^export\s+/, ''); });
  if (/^(import|export)\b/m.test(out)) throw new Error(`${id}: an import or export statement was not understood`);
  return { code: out + '\n' + tail.join('\n'), deps };
}

const idOf = (from, s) => (s.startsWith('.') ? posix.normalize(posix.join(posix.dirname(from), s)) : s);

// entry: path relative to root. virtuals: { 'virtual:name': 'module source' }. Returns the script text.
export function bundle(entry, { root = ROOT, virtuals = {}, globalName = null } = {}) {
  const mods = {}, order = [], visiting = [];
  const load = (id) => {
    if (mods[id]) return;
    if (visiting.includes(id)) throw new Error(`import cycle: ${[...visiting, id].join(' -> ')}`);
    visiting.push(id);
    const src = virtuals[id] !== undefined ? virtuals[id] : readFileSync(join(root, ...id.split('/')), 'utf8');
    const t = transform(id, src);
    for (const d of t.deps) load(idOf(id, d));
    mods[id] = t.code; order.push(id);
    visiting.pop();
  };
  load(entry);
  const defs = order.map((id) => `__defs[${JSON.stringify(id)}] = function (exports, __req, __resolve) {\n${mods[id]}\n};`).join('\n');
  return `(function () {
'use strict';
const __defs = Object.create(null), __cache = Object.create(null);
const __resolve = (from, s) => { if (!s.startsWith('.')) return s; const out = []; for (const p of (from.split('/').slice(0, -1).join('/') + '/' + s).split('/')) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); } return out.join('/'); };
const __named = (o, names, where) => { for (const n of names) if (!(n in o)) throw new SyntaxError(where + ': the module it imports from does not export "' + n + '"'); return o; };
function __req(id) { if (__cache[id]) return __cache[id].exports; const m = { exports: {} }; __cache[id] = m; __defs[id](m.exports, __req, __resolve); return m.exports; }
${defs}
const __main = __req(${JSON.stringify(entry)});
${globalName ? `globalThis[${JSON.stringify(globalName)}] = __main;` : ''}
})();
`;
}

// The content and the schemas, embedded as JSON text (parsed and re-serialised without indentation to save bytes).
export function contentModule(root = ROOT) {
  const min = (p) => JSON.stringify(JSON.parse(readFileSync(p, 'utf8')));
  const names = ['realms', 'statuses', 'heroes', 'skills', 'monsters', 'items', 'tables', 'names', 'runbook', 'starter_runbooks'];
  const texts = Object.fromEntries(names.map((n) => [n, min(join(root, 'content', `${n}.json`))]));
  const schemas = Object.fromEntries([...names, 'save'].map((n) => [n, min(join(root, 'content', 'schema', `${n}.schema.json`))]));
  return `export const contentTexts = ${JSON.stringify(texts)};\nexport const schemaTexts = ${JSON.stringify(schemas)};\n`;
}

export function build({ out = join(ROOT, 'dist'), build: label = 'dev', root = ROOT } = {}) {
  mkdirSync(out, { recursive: true });
  const js = bundle('client/main.js', { root, virtuals: { 'virtual:content': contentModule(root) } });
  writeFileSync(join(out, 'game.js'), js);
  const html = readFileSync(join(root, 'client', 'index.html'), 'utf8').replace(/__BUILD__/g, label);
  writeFileSync(join(out, 'index.html'), html);
  for (const f of ['style.css']) if (existsSync(join(root, 'client', f))) copyFileSync(join(root, 'client', f), join(out, f));
  return { out, bytes: { 'game.js': Buffer.byteLength(js), 'index.html': Buffer.byteLength(html) } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const r = build({ out: resolve(arg('--out', join(ROOT, 'dist'))), build: arg('--build', 'dev') });
  console.log(`built ${r.out}: ${Object.entries(r.bytes).map(([k, v]) => `${k} ${v} bytes`).join(', ')}`);
}
