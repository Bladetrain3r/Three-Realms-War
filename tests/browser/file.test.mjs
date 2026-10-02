import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../../tools/bundle.mjs';
import { findChromium } from './chromium.mjs';

test('browser: the built game runs from file:// with no server, no console error, and its engine check passes', async (t) => {
  const exe = findChromium();
  if (!exe) return t.skip('no Chromium found');
  const out = mkdtempSync(join(tmpdir(), 'dist-'));
  build({ out, build: 'test' });
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), problems = [];
    page.on('pageerror', (e) => problems.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    await page.goto(pathToFileURL(join(out, 'index.html')).href);
    await page.waitForFunction(() => window.ThreeRealms && window.ThreeRealms.ready, null, { timeout: 30000 });
    assert.deepEqual(problems, []);
    const tr = await page.evaluate(() => window.ThreeRealms);
    assert.equal(tr.error, undefined);
    assert.equal(tr.engineCheck.ok, true, JSON.stringify(tr.engineCheck));
    assert.match(await page.textContent('#status'), /15 classes, 36 monsters loaded\. Engine check passed/);
    assert.equal(new URL(page.url()).protocol, 'file:');
  } finally { await browser.close(); }
});
