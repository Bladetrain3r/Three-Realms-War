import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { bundle } from '../../tools/bundle.mjs';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-'));
  for (const [p, src] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), src); }
  return root;
}
const runBundle = (root, entry) => { const sb = { structuredClone, TextEncoder }; vm.createContext(sb); vm.runInContext(bundle(entry, { root, globalName: 'OUT' }), sb); return sb.OUT; };
const runNative = async (root, entry) => import(pathToFileURL(join(root, entry)).href);

const FILES = {
  'a/util.js': "export const K = 7;\nexport function double(x) { return x * 2; }\nexport class Box { constructor(v) { this.v = v; } get twice() { return double(this.v); } }\nlet hidden = 1;\nexport { hidden as renamed };\n",
  'a/more.js': "import { K, double as dbl } from './util.js';\nexport const sum = (a, b) => a + b + K;\nexport function useDbl(x) { return dbl(x); }\nexport async function later() { return 'later'; }\nexport function* gen() { yield 1; yield 2; }\n",
  'b/reexport.js': "export { sum, useDbl as dbl2 } from '../a/more.js';\nexport { K } from '../a/util.js';\n",
  'main.js': "import * as ns from './a/util.js';\nimport { sum, dbl2, K } from './b/reexport.js';\nimport { Box } from './a/util.js';\nimport './a/side.js';\nexport const answer = sum(1, 2) + dbl2(10) + ns.K + K;\nexport const box = new Box(21).twice;\nexport const renamed = ns.renamed;\nexport const side = globalThis.__side || 'none';\nexport const strings = \"import { x } from 'y'; export const z = 1;\";\n",
  'a/side.js': "globalThis.__side = 'ran';\n",
};

test('bundle: a module graph with every supported syntax behaves exactly like the native modules', async () => {
  const root = fixture(FILES), b = runBundle(root, 'main.js'), n = await runNative(root, 'main.js');
  for (const k of ['answer', 'box', 'renamed', 'side', 'strings']) assert.equal(b[k], n[k], k);
  assert.equal(b.answer, 10 + 20 + 7 + 7, 'sum(1,2)=10, dbl2(10)=20, ns.K=7, K=7');
});

test('bundle: async functions, generators, classes and lets survive; exports are the same names', async () => {
  const root = fixture({ ...FILES, 'e.js': "export { later, gen, sum } from './a/more.js';\nexport { Box, renamed } from './a/util.js';\n" });
  const b = runBundle(root, 'e.js'), n = await runNative(root, 'e.js');
  assert.deepEqual(Object.keys(b).sort(), Object.keys(n).sort());
  assert.equal(await b.later(), 'later');
  assert.deepEqual([...b.gen()], [1, 2]);
  assert.equal(new b.Box(4).twice, 8);
});

test('bundle: the same module is evaluated once even when many modules import it', () => {
  const root = fixture({ 'c.js': "globalThis.__n = (globalThis.__n || 0) + 1;\nexport const v = 1;\n", 'p.js': "import { v } from './c.js';\nexport const a = v;\n", 'q.js': "import { v } from './c.js';\nexport const b = v;\n", 'm.js': "import { a } from './p.js';\nimport { b } from './q.js';\nexport const n = () => globalThis.__n;\nexport const s = a + b;\n" });
  const sb = { }; vm.createContext(sb); vm.runInContext(bundle('m.js', { root, globalName: 'OUT' }), sb);
  assert.equal(vm.runInContext('OUT.n()', sb), 1);
  assert.equal(vm.runInContext('OUT.s', sb), 2);
});

test('bundle: refuses, naming the file, what it cannot do', () => {
  const bad = (src) => assert.throws(() => bundle('m.js', { root: fixture({ 'm.js': src }) }), /m\.js/);
  bad("export default 1;\n"); bad("export * from './x.js';\n"); bad("import x from './x.js';\n"); bad("export const u = import.meta.url;\n"); bad("export const d = () => import('./x.js');\n");
  assert.throws(() => bundle('m.js', { root: fixture({ 'm.js': "import { a } from './n.js';\nexport const x = a;\n", 'n.js': "import { x } from './m.js';\nexport const a = x;\n" }) }), /import cycle: m\.js -> n\.js -> m\.js/);
});

test('bundle: a virtual module is available under its own name', () => {
  const root = fixture({ 'm.js': "import { texts } from 'virtual:t';\nexport const n = texts.length;\n" });
  const sb = {}; vm.createContext(sb); vm.runInContext(bundle('m.js', { root, virtuals: { 'virtual:t': "export const texts = 'abcd';\n" }, globalName: 'OUT' }), sb);
  assert.equal(vm.runInContext('OUT.n', sb), 4);
});

test('bundle: the real sim, bundled, gives the same replay hashes as the native modules (the golden hashes)', async () => {
  const { readFileSync } = await import('node:fs');
  const { repoPath } = await import('../helpers/design.mjs');
  const { standardInput } = await import('../helpers/scenario.mjs');
  const { contentTexts } = await import('../helpers/content.mjs');
  const golden = JSON.parse(readFileSync(repoPath('tests', 'golden', 'replay-hashes.json'), 'utf8'));
  const sb = { structuredClone, TextEncoder, console };
  vm.createContext(sb);
  vm.runInContext(bundle('sim/index.js', { globalName: 'SIM' }), sb);
  const FILES2 = Object.keys(contentTexts);
  sb.__texts = contentTexts; sb.__inputs = golden.replays.slice(0, 8).map((g) => JSON.parse(JSON.stringify(standardInput(g.seed))));
  const hashes = vm.runInContext(`
    const raw = {}; for (const k of ${JSON.stringify(FILES2)}) raw[k] = JSON.parse(__texts[k]);
    const content = SIM.indexContent(raw);
    __inputs.map((i) => SIM.createReplay(i, content).hash);`, sb);
  assert.deepEqual(hashes, golden.replays.slice(0, 8).map((g) => g.hash));
});

test('bundle: importing a name the other module does not export is an error naming both, not a silent undefined (found when a client screen imported wornIds from the wrong module)', () => {
  const root = fixture({ 'x.js': 'export const a = 1;\n', 'main.js': "import { a, b } from './x.js';\nexport const v = a;\n" });
  assert.throws(() => runBundle(root, 'main.js'), /main\.js.*does not export "b"/);
});

test('bundle: the shipped page carries only the save schema (content is validated at build time), and a build refuses invalid content', async () => {
  const { contentModule, validateContentFiles, build } = await import('../../tools/bundle.mjs');
  const shipped = contentModule(undefined, { withSchemas: false }), full = contentModule();
  const keys = (src) => Object.keys(JSON.parse(src.split('\n')[1].replace('export const schemaTexts = ', '').replace(/;$/, '')));
  assert.deepEqual(keys(shipped), ['save']); assert.ok(keys(full).length === 11);
  const content = await validateContentFiles(); assert.equal(content.legends.length, 6);
  const { mkdtempSync, cpSync, writeFileSync, readFileSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'bad-')); cpSync('content', join(root, 'content'), { recursive: true }); cpSync('client', join(root, 'client'), { recursive: true });
  const p = join(root, 'content', 'tables.json'), t = JSON.parse(readFileSync(p, 'utf8')); t.legend.unlockCount = 99; writeFileSync(p, JSON.stringify(t));
  await assert.rejects(() => build({ out: join(root, 'out'), root }), /content refused.*tables.json: legend.unlockCount/s);
});
