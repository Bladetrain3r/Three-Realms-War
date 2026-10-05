// The on-device engine check: replay one fixed delve and compare its hash with the value recorded when the content last changed.
// A player (or a CI job on another browser) runs it to confirm that this device computes exactly the same game as everyone else.
import { newGame, playDelve } from '../sim/index.js';

export const ENGINE_CHECK = { masterSeed: 20261002, realm: 'midgard', level: 1, expectedHash: '887276d312ef8100c7a069bdb3638f558ae92b965c1c0fcd526eb8c27ec37bec' };

export function engineCheck(content, expected = ENGINE_CHECK.expectedHash) {
  const save = newGame(content, ENGINE_CHECK.masterSeed, { savedAt: '', build: 'engine-check' });
  const r = playDelve(save, content, { realm: ENGINE_CHECK.realm, level: ENGINE_CHECK.level });
  return { ok: r.replay.hash === expected, actual: r.replay.hash, expected, events: r.replay.events.length, outcome: r.replay.result.outcome };
}
