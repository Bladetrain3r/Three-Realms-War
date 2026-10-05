// Mutates every leaf of content/*.json one at a time (in scratch copies, 4 in parallel) and runs the schema, cross-reference and
// DESIGN.md comparison tests. A survivor is a content value nothing pins to the design. Run: node checks/mutate-content.mjs
// Takes about four minutes.
import { spawn } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FILES = ['realms','statuses','heroes','skills','monsters','items','tables','names','runbook','starter_runbooks'];
const leaves = (v, s, o) => { if (v !== null && typeof v === 'object') { if (Array.isArray(v)) v.forEach((x, i) => leaves(x, [...s, i], o)); else for (const k of Object.keys(v)) leaves(v[k], [...s, k], o); } else o.push(s); return o; };
const key = (segs) => segs.reduce((a, s) => (typeof s === 'number' ? `${a}[${s}]` : a === '' ? s : `${a}.${s}`), '');
const jobs = [];
for (const f of FILES) {
  const base = JSON.parse(readFileSync(`${REPO}/content/${f}.json`, 'utf8'));
  for (const segs of leaves(base, [], [])) {
    const parent = segs.slice(0, -1).reduce((o, s) => o[s], base), last = segs.at(-1), v = parent[last];
    const nv = typeof v === 'number' ? v + 1 : typeof v === 'string' ? v + 'x' : typeof v === 'boolean' ? !v : v === null ? 'x' : v;
    jobs.push({ f, segs, nv, orig: v });
  }
}
const W = 4, dirs = Array.from({ length: W }, () => { const d = mkdtempSync(`${tmpdir()}/cm-`); cpSync(`${REPO}/content`, d, { recursive: true }); return d; });
const survivors = []; let next = 0, done = 0;
const run = (dir) => new Promise((resolve) => {
  const p = spawn('node', ['--test', 'tests/unit/content-design-tables.test.mjs', 'tests/unit/content-design-prose.test.mjs'], { cwd: REPO, env: { ...process.env, CONTENT_DIR: dir }, stdio: 'ignore' });
  p.on('exit', (c) => resolve(c));
});
async function worker(w) {
  const dir = dirs[w];
  while (next < jobs.length) {
    const j = jobs[next++], file = `${dir}/${j.f}.json`, orig = readFileSync(file, 'utf8');
    const data = JSON.parse(orig);
    j.segs.slice(0, -1).reduce((o, s) => o[s], data)[j.segs.at(-1)] = j.nv;
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    const code = await run(dir);
    if (code === 0) survivors.push(`${j.f}.json ${key(j.segs)} (${JSON.stringify(j.orig)} -> ${JSON.stringify(j.nv)})`);
    writeFileSync(file, orig);
    if (++done % 200 === 0) console.error(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: W }, (_, w) => worker(w)));
console.log(`leaves mutated: ${jobs.length}; survivors: ${survivors.length}`);
console.log(survivors.join('\n'));
