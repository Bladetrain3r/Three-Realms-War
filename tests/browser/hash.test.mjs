import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { repoPath } from '../helpers/design.mjs';
import { content } from '../helpers/content.mjs';
import { standardInput } from '../helpers/scenario.mjs';
import { startServer } from './serve.mjs';
import { createReplay, contentHashOf } from '../../sim/replay.js';
import { sha256Hex } from '../../sim/sha256.js';
import { canonical, hashOf } from '../../sim/canon.js';

function findChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(base)) return null;
  for (const d of readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
    const p = `${base}/${d}/chrome-linux/chrome`;
    if (existsSync(p)) return p;
  }
  return null;
}

test('browser: replay hashes in headless Chromium equal Node\'s and the committed golden hashes', async (t) => {
  const exe = findChromium();
  if (!exe) return t.skip('no Chromium found (set CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH); CI provisions one');
  const { chromium } = await import('playwright-core');
  const golden = JSON.parse(readFileSync(repoPath('tests', 'golden', 'replay-hashes.json'), 'utf8'));
  const inputs = golden.replays.map((g) => standardInput(g.seed));
  const srv = await startServer({ '/inputs.json': () => JSON.stringify(inputs) });
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(srv.url + '/tests/browser/page.html');
    await page.waitForFunction(() => window.__result || window.__error, null, { timeout: 60000 });
    const err = await page.evaluate(() => window.__error);
    assert.equal(err, undefined, `page error: ${err}`);
    assert.deepEqual(errors, []);
    const r = await page.evaluate(() => window.__result);

    assert.equal(r.contentHash, contentHashOf(content));
    assert.equal(r.contentHash, golden.contentHash);
    assert.equal(r.replays.length, 30);
    for (const b of r.replays) {
      const node = createReplay(standardInput(b.seed), content), g = golden.replays.find((x) => x.seed === b.seed);
      assert.equal(b.hash, node.hash, `seed ${b.seed}: browser and Node disagree`);
      assert.equal(b.hash, g.hash, `seed ${b.seed}: browser and golden disagree`);
      assert.equal(b.events, node.events.length);
      assert.equal(b.outcome, node.result.outcome);
    }
    const sample = { schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } };
    assert.equal(r.vectors.abc, sha256Hex(new TextEncoder().encode('abc')));
    assert.equal(r.vectors.canonical, canonical(sample));
    assert.equal(r.vectors.canonicalHash, hashOf(sample));
    t.diagnostic(`${r.userAgent}; 30 replay hashes identical to Node and to the golden file`);
  } finally { await browser.close(); await srv.close(); }
});
