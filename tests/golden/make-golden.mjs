// Regenerates tests/golden/replay-hashes.json. Run deliberately, and log why in LOG.md:
//   node tests/golden/make-golden.mjs > tests/golden/replay-hashes.json
import { content } from '../helpers/content.mjs';
import { standardInput } from '../helpers/scenario.mjs';
import { createReplay, contentHashOf } from '../../sim/replay.js';

const out = { contentHash: contentHashOf(content), replays: [] };
for (let seed = 1; seed <= 30; seed++) {
  const r = createReplay(standardInput(seed), content);
  out.replays.push({ seed, hash: r.hash, events: r.events.length, outcome: r.result.outcome });
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
