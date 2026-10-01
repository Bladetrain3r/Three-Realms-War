// Measures the simulation budgets of DESIGN.md section 15. Run: node checks/measure-sim.mjs
// Prints the numbers with the environment they came from. These are measurements; the ceilings live in the budget test.
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { content } from '../tests/helpers/content.mjs';
import { gearedParty } from '../tests/helpers/delve.mjs';
import { standardInput } from '../tests/helpers/scenario.mjs';
import { createRng } from '../sim/prng.js';
import { makeContext, resolveEncounter } from '../sim/combat.js';
import { generateDelve, resolveDelve } from '../sim/delve.js';

export function measureEncounter(runs = 300) {
  // A level-50 4v4: a geared party against the generated enemies of a level-50 Helheim delve (first encounter of each seed).
  const party = gearedParty(50, { ilvl: 50, tier: 'runed', star: 3 });
  const times = [];
  for (let i = 0; i < runs; i++) {
    const rng = createRng(1000 + i);
    const enemies = generateDelve(rng, { realm: 'helheim', level: 50 }, content)[1]; // a 4-enemy middle-or-boss-adjacent encounter
    const ctx = makeContext(content, rng, []);
    const t0 = performance.now();
    resolveEncounter(ctx, { index: 0, heroes: party, heroHp: null, enemies });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return { runs, medianMs: times[times.length >> 1], p95Ms: times[Math.floor(runs * 0.95)], maxMs: times[runs - 1] };
}

export function measureDelves(count = 10000) {
  const inputs = Array.from({ length: 30 }, (_, i) => standardInput(i + 1));
  let wins = 0, events = 0;
  const t0 = performance.now();
  for (let i = 0; i < count; i++) {
    const inp = inputs[i % 30];
    const r = resolveDelve({ ...inp, seed: 1 + i }, content);
    wins += r.result.outcome; events += r.events.length;
  }
  const ms = performance.now() - t0;
  return { count, totalMs: ms, perDelveMs: ms / count, wins, events };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cpu = os.cpus();
  const enc = measureEncounter(), del = measureDelves();
  console.log(JSON.stringify({
    command: 'node checks/measure-sim.mjs',
    environment: { node: process.version, cpu: cpu[0].model, cores: cpu.length, platform: `${os.platform()} ${os.release()}` },
    encounter: { description: 'one 4v4 encounter, level-50 geared party vs a level-50 Helheim encounter', ...enc },
    tenThousandDelves: { description: '10,000 full delves over 30 fixed parties, realms and levels 1..50', ...del },
  }, null, 2));
}
