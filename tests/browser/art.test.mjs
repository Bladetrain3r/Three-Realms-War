import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundle, contentModule } from '../../tools/bundle.mjs';
import { findChromium } from './chromium.mjs';

const code = bundle('tests/browser/gallery-main.js', { virtuals: { 'virtual:content': contentModule() }, globalName: 'GalleryBundle' });
async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), problems = [];
  page.on('pageerror', (e) => problems.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await page.setContent(`<!doctype html><meta charset="utf-8"><body><script>${code}</script>`);
  await page.waitForFunction(() => window.galleryReady, null, { timeout: 30000 });
  return { page, problems };
}
// FNV-1a over the pixels, computed inside the page
const HASH = `(cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }`;
const ALL = `(() => {
  const hash = ${HASH}, { content, index: Art } = window.Art, out = {};
  for (const h of content.heroes) out['hero:' + h.id] = hash(Art.hero(h));
  for (const m of content.roster) out['mon:' + m.id] = hash(Art.monster(m));
  for (const b of content.bosses) out['boss:' + b.id] = hash(Art.boss(b));
  for (const r of ['midgard', 'asgard', 'helheim']) out['bd:' + r] = hash(Art.backdrop(r));
  out.sheet = hash(Art.sheet(400, 300)); out.frame = Art.frameURL().length; out.ink = Art.inkURL().length;
  return out;
})()`;

test('art (browser): every asset is reproducible: same seed, identical pixels, across a cache clear and across two page loads', async (t) => {
  const exe = findChromium(); if (!exe) return t.skip('no Chromium found');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    const a = await open(browser), first = await a.page.evaluate(ALL);
    await a.page.evaluate(() => window.Art.index.clear());
    const again = await a.page.evaluate(ALL);
    assert.deepEqual(again, first, 'a cleared cache must repaint identical pixels');
    const b = await open(browser), second = await b.page.evaluate(ALL);
    assert.deepEqual(second, first, 'a second page load must paint identical pixels');
    assert.deepEqual([...a.problems, ...b.problems], []);
    assert.equal(Object.keys(first).length, 15 + 36 + 3 + 3 + 3);
  } finally { await browser.close(); }
});

test('art (browser): figures are not blank, are told apart (no two hero classes share pixels), and the three realms look different', async (t) => {
  const exe = findChromium(); if (!exe) return t.skip('no Chromium found');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    const { page } = await open(browser);
    const r = await page.evaluate(`(() => {
      const { content, index: Art } = window.Art, hash = ${HASH}, res = { coverage: {}, hashes: [], bd: [] };
      for (const h of content.heroes) {
        const cv = Art.hero(h), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let solid = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 200) solid++;
        res.coverage[h.id] = solid / (cv.width * cv.height); res.hashes.push(hash(cv));
      }
      for (const m of content.roster) { const cv = Art.monster(m), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let solid = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) solid++; res.coverage[m.id] = solid / (cv.width * cv.height); }
      for (const r of ['midgard', 'asgard', 'helheim']) { const cv = Art.backdrop(r), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let R = 0, G = 0, B = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; } const n = d.length / 4; res.bd.push([R / n, G / n, B / n]); }
      return res;
    })()`);
    for (const [id, cov] of Object.entries(r.coverage)) assert.ok(cov > 0.04 && cov < 0.6, `${id} covers ${(cov * 100).toFixed(1)}% of its sheet`);
    assert.equal(new Set(r.hashes).size, 15);
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) assert.ok(dist(r.bd[i], r.bd[j]) > 25, `realms ${i} and ${j} have mean colours ${JSON.stringify(r.bd[i])} / ${JSON.stringify(r.bd[j])}`);
  } finally { await browser.close(); }
});

test('art (browser): painting a battle (four heroes, four monsters, a backdrop) from a cold cache finishes inside the measured budget', async (t) => {
  const exe = findChromium(); if (!exe) return t.skip('no Chromium found');
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  try {
    const { page } = await open(browser);
    const ms = await page.evaluate(() => { const { content, index: Art } = window.Art; Art.clear(); const t0 = performance.now(); content.heroes.slice(0, 4).forEach((h) => Art.hero(h)); content.roster.slice(0, 4).forEach((m) => Art.monster(m)); Art.backdrop('midgard'); return performance.now() - t0; });
    assert.ok(ms < 3000, `cold battle assets took ${ms.toFixed(0)} ms`);
  } finally { await browser.close(); }
});
