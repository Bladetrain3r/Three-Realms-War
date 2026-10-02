// Regenerates tests/golden/playthrough.json: the final save of a seeded 300-action random playthrough.
//   node tests/golden/make-playthrough.mjs > tests/golden/playthrough.json      (a deliberate act: log why in LOG.md)
import { content } from '../helpers/content.mjs';
import { play } from '../helpers/bot.mjs';
import { newGame, hashOf } from '../../sim/index.js';

const { save, log } = play(newGame(content, 20261002, { savedAt: '', build: 'golden' }), 300, 555);
process.stdout.write(JSON.stringify({ steps: 300, botSeed: 555, masterSeed: 20261002, finalSaveHash: hashOf(save), counter: save.rng.counter, heroes: save.heroes.length, items: save.items.length, wins: log.wins, losses: log.losses, ok: log.ok }, null, 2) + '\n');
