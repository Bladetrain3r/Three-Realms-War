// Measures the design options put to Ziggy at STOP-1, against the SAME committed thresholds (checks/balance.yaml).
// Each option is applied to a scratch copy of the repository; the repository itself is never changed.
//   node checks/options.mjs        about five minutes
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(import.meta.url), '..', '..');
const scratch = () => { const d = mkdtempSync(join(tmpdir(), 'opt-')); for (const p of ['sim', 'content', 'checks', 'package.json']) cpSync(join(REPO, p), join(d, p), { recursive: true }); return d; };
const edit = (d, file, fn) => { const p = join(d, file); writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
const editJson = (d, file, fn) => edit(d, file, (t) => JSON.stringify((() => { const j = JSON.parse(t); fn(j); return j; })(), null, 2));
const run = (d, code) => execFileSync('node', ['--input-type=module', '-e', code], { cwd: d, encoding: 'utf8', maxBuffer: 1 << 26 });

// A: the enemy curve gets a quadratic term: p + idiv(p * (K*(L-1)*49 + Q*(L-1)^2), 49*49). Q = 0 is today's curve exactly.
function quadratic(K, Q) {
  const d = scratch();
  edit(d, 'sim/stats.js', (s) => s.replace('return p + idiv(p * e.curveK * (level - 1), e.curveDiv);', 'return p + idiv(p * (e.curveK * (level - 1) * e.curveDiv + (e.curveQ || 0) * (level - 1) * (level - 1)), e.curveDiv * e.curveDiv);'));
  editJson(d, 'content/schema/tables.schema.json', (j) => { j.properties.enemy.properties.curveQ = { type: 'integer', minimum: 0, maximum: 2000 }; });
  editJson(d, 'content/tables.json', (j) => { j.enemy.curveK = K; j.enemy.curveQ = Q; });
  const out = run(d, "import { runBalance } from './checks/balance.mjs'; const r = runBalance(); console.log(JSON.stringify({ n: r.checks.length, bad: r.checks.filter(c=>!c.ok).map(c=>c.id), win: r.delves.winRate }));");
  rmSync(d, { recursive: true, force: true });
  return JSON.parse(out);
}

// B: hero and mechanic variants, mirror tournament only.
function mirrorVariant(label, patch) {
  const d = scratch();
  edit(d, 'sim/combat.js', (s) => s.replace('  const dealt = Math.min(r.damage, t.hp);', '  const dealt = Math.min(r.damage, t.hp);').replace('ctx.emit([4, u.id, t.id, r.damage, r.crit ? 1 : 0, t.hp]);', 'ctx.emit([4, u.id, t.id, r.damage, r.crit ? 1 : 0, t.hp]);'));
  const code = `import { loadAll } from './checks/balance-lib.mjs'; import { runMirror, checkMirror } from './checks/balance-mirror.mjs';
    const ctx = loadAll(); const c = ctx.content;
    const aoe = (f) => { for (const s of c.skills) if (c.heroById[s.owner] && s.target === 'all_enemies' && s.power > 0) s.power = Math.floor(s.power * f); };
    const tank = (f) => { for (const id of ['shield_bash','cold_grip']) c.skillById[id].power = Math.floor(c.skillById[id].power * f); };
    const heal = (f) => { for (const id of ['hearth_light','mending_verse','frostmend']) c.skillById[id].power = Math.floor(c.skillById[id].power * f); };
    ${patch}
    const res = runMirror(ctx), checks = checkMirror(res, ctx.B), cr = res.classWinRate;
    console.log(JSON.stringify({ bad: checks.filter(x=>!x.ok).length, total: checks.length, shieldwarden: cr.shieldwarden, draugr: cr.draugr_knight, stormcaller: cr.stormcaller, lo: Math.min(...res.compositions.map(x=>x.winRate)), hi: Math.max(...res.compositions.map(x=>x.winRate)) }));`;
  const o = JSON.parse(run(d, code));
  rmSync(d, { recursive: true, force: true });
  return { label, ...o };
}

console.log('OPTION A: add a quadratic term Q to the enemy curve (full size, 900 delves per cell). Current content, linear curve K=34: 124 of 148 in bounds.');
for (const [K, Q] of [[34, 0], [30, 10], [32, 8], [34, 6]]) {
  const r = quadratic(K, Q), delve = r.bad.filter((id) => /^(delve_winrate|gear_|naked)/.test(id));
  console.log(`  K=${K} Q=${Q}: ${r.n - r.bad.length}/${r.n} in bounds; delve-table failures: ${delve.length ? delve.join(', ') : 'none'}`);
  if (K === 30 && Q === 10) for (const L of Object.keys(r.win)) console.log(`      L${String(L).padEnd(3)} starter ${r.win[L].starter.toFixed(2)}  fine ${r.win[L].fine.toFixed(2)}  runed ${r.win[L].runed.toFixed(2)}  heirloom ${r.win[L].heirloom.toFixed(2)}`);
}

console.log('\nOPTION B: hero and mechanic variants, mirror tournament (53 checks; today 17 out of bounds).');
for (const [label, patch] of [
  ['today', ''],
  ['tank skills (Shield Bash, Cold Grip) x1.5', 'tank(1.5);'],
  ['tank skills x2', 'tank(2);'],
  ['hero AoE skills x0.7', 'aoe(0.7);'],
  ['hero AoE x0.7 + tank skills x1.5', 'aoe(0.7); tank(1.5);'],
  ['hero AoE x0.7 + tank skills x2', 'aoe(0.7); tank(2);'],
  ['hero AoE x0.7 + tank x1.5 + heals x1.5', 'aoe(0.7); tank(1.5); heal(1.5);'],
  ['mitigation constant 12 -> 4 per level', 'ctx.content.tables.combat.mitPerLevel = 4;'],
]) {
  const r = mirrorVariant(label, patch);
  console.log(`  ${label.padEnd(42)} ${String(r.bad).padStart(2)}/${r.total} out | shieldwarden ${r.shieldwarden.toFixed(2)} draugr ${r.draugr.toFixed(2)} stormcaller ${r.stormcaller.toFixed(2)} | compositions ${r.lo.toFixed(2)}..${r.hi.toFixed(2)}`);
}

console.log('\nOPTION C: materials per won delve grow 9x from level 1 to 50 (bound 3..8) because the formula is 2 + floor(D/3).');
for (const base of [2, 3, 4]) console.log(`  matBase ${base}: growth ${((5 * (base + Math.floor(50 / 3))) / (5 * (base + 0))).toFixed(2)}x`);
