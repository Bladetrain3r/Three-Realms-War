// Measures the procedural art engine in headless Chromium: time to paint each kind of asset (cold, from an empty cache) and the
// total for the whole set. Usage: node checks/measure-art.mjs [--write evidence/budgets/art.json]
import { writeFileSync } from 'node:fs';
import { bundle, contentModule } from '../tools/bundle.mjs';
import { findChromium } from '../tests/browser/chromium.mjs';

const code = bundle('tests/browser/gallery-main.js', { virtuals: { 'virtual:content': contentModule() }, globalName: 'GalleryBundle' });
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(`<!doctype html><meta charset="utf-8"><body><script>${code}</script>`);
await page.waitForFunction(() => window.galleryReady);
const result = await page.evaluate(() => {
  const { createRng, content, index: Art } = window.Art, t = () => performance.now(), stat = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, min: +s[0].toFixed(1), median: +s[s.length >> 1].toFixed(1), max: +s[s.length - 1].toFixed(1), total: +s.reduce((x, y) => x + y, 0).toFixed(1) }; };
  Art.clear();
  const out = {}, time = (list, fn) => list.map((x) => { const a = t(); fn(x); return t() - a; });
  out.heroSprites = stat(time(content.heroes, (h) => Art.hero(h)));
  out.monsterSprites = stat(time(content.roster, (m) => Art.monster(m)));
  out.bossSprites = stat(time(content.bosses, (b) => Art.boss(b)));
  out.backdrops = stat(time(['midgard', 'asgard', 'helheim'], (r) => Art.backdrop(r)));
  out.vellumSheet1920x1080 = stat(time([1], () => Art.sheet(1920, 1080)));
  out.woodcutTiles = stat(time([0], () => { Art.vellumURL(); Art.frameURL(); Art.hatchURL(); Art.inkURL(); Art.ruleURL(); }));
  return out;
});
await browser.close();
const total = Object.values(result).reduce((s, v) => s + v.total, 0);
const report = { command: 'node checks/measure-art.mjs', chromium: findChromium(), unit: 'ms, cold cache, headless Chromium (software rendering)', ...result, allAssetsTotalMs: +total.toFixed(0) };
console.log(JSON.stringify(report, null, 1));
const i = process.argv.indexOf('--write'); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(report, null, 1) + '\n');
