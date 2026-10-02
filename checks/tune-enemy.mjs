// Searches the knobs DESIGN.md 0.2 allows (the enemy curve constant K and scales on the monster profile tables) for the setting
// that puts the most delve bounds of checks/balance.yaml in bounds. It scales the profiles recorded at BASE_COMMIT (before the G3
// tuning), so the result does not depend on what content/ holds now. Four worker processes; about two minutes.
//   node checks/tune-enemy.mjs                 grid search, prints the leaders
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadAll } from './balance-lib.mjs';
import { runDelves, checkDelves } from './balance-delves.mjs';

const BASE_COMMIT = '4d4ad1a';
const GRID = [];
for (const K of [16, 24, 34, 48]) for (const fh of [0.4, 0.5, 0.7, 1.0]) for (const fa of [0.5, 0.7, 1.0]) for (const fd of [0.5, 0.7, 1.0]) GRID.push({ K, fh, fa, fd });

if (process.argv[2] === 'worker') {
  const [, , , part, parts, n] = process.argv;
  const base = JSON.parse(execFileSync('git', ['show', `${BASE_COMMIT}:content/monsters.json`], { encoding: 'utf8' })).archetypes;
  const out = [];
  for (const g of GRID.filter((_, i) => i % Number(parts) === Number(part))) {
    const ctx = loadAll({ delves_per_cell: Number(n) });
    ctx.content.tables.enemy.curveK = g.K;
    ctx.content.raw.monsters.archetypes.forEach((a, i) => {
      a.stats.VIG = Math.max(1, Math.round(base[i].stats.VIG * g.fh));
      for (const s of ['MIT', 'ARC']) a.stats[s] = Math.max(1, Math.round(base[i].stats[s] * g.fa));
      for (const s of ['GRD', 'WRD']) a.stats[s] = Math.max(1, Math.round(base[i].stats[s] * g.fd));
    });
    const checks = checkDelves(runDelves(ctx), ctx.B).filter((c) => c.id.startsWith('delve_winrate') || c.id === 'gear_gap.growth');
    out.push({ ...g, ok: checks.filter((c) => c.ok).length, total: checks.length, gap: checks.find((c) => c.id === 'gear_gap.growth').value });
  }
  process.stdout.write(JSON.stringify(out));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const W = 4, n = 150, chunks = [];
  await Promise.all(Array.from({ length: W }, (_, p) => new Promise((resolve) => {
    let buf = ''; const c = spawn('node', [process.argv[1], 'worker', String(p), String(W), String(n)]);
    c.stdout.on('data', (d) => { buf += d; }); c.on('exit', () => { chunks.push(...JSON.parse(buf)); resolve(); });
  })));
  chunks.sort((a, b) => b.ok - a.ok || b.gap - a.gap || a.K - b.K);
  console.log(`${chunks.length} settings, ${n} delves per cell; score = delve_winrate cells plus gear_gap.growth in bounds, out of ${chunks[0].total}`);
  for (const g of chunks.slice(0, 12)) console.log(`K=${String(g.K).padEnd(2)} HP x${g.fh}  attack x${g.fa}  defence x${g.fd}   ${g.ok}/${g.total}   gap growth ${g.gap.toFixed(2)}`);
  const dist = {}; for (const g of chunks) dist[g.ok] = (dist[g.ok] || 0) + 1;
  console.log('settings by score:', Object.entries(dist).map(([k, v]) => `${k}:${v}`).join(' '));
}
