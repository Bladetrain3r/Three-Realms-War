// The balance runner. Evaluates every bound in checks/balance.yaml. Usage:
//   node checks/balance.mjs            run, print the table, exit 1 if any bound fails
//   node checks/balance.mjs --write    also write evidence/G3-balance.json (deterministic: no times, no dates)
// The report contains no timing or date, so two runs produce byte-identical files.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadAll } from './balance-lib.mjs';
import { runDelves, checkDelves } from './balance-delves.mjs';
import { runMirror, checkMirror } from './balance-mirror.mjs';
import { econ, checkEcon } from './balance-econ.mjs';

export function runBalance(overrides = {}) {
  const ctx = loadAll(overrides);
  const delves = runDelves(ctx), mirror = runMirror(ctx), e = econ(ctx);
  const checks = [...checkDelves(delves, ctx.B), ...checkMirror(mirror, ctx.B), ...checkEcon(e, ctx.B)];
  return { thresholds: { file: 'checks/balance.yaml', version: ctx.B.version, written: ctx.B.written }, run: ctx.B.run, delves, mirror, econ: e, checks, failed: checks.filter((c) => !c.ok).map((c) => c.id) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runBalance();
  const text = JSON.stringify(report, null, 2) + '\n';
  if (process.argv.includes('--write')) writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'evidence', 'G3-balance.json'), text);
  const bad = report.checks.filter((c) => !c.ok);
  console.log(`${report.checks.length} checks, ${report.checks.length - bad.length} in bounds, ${bad.length} out of bounds`);
  for (const c of bad) console.log(`  OUT  ${c.id}: ${c.value}  (bound ${c.lo} .. ${c.hi})`);
  process.exit(bad.length ? 1 : 0);
}
