// Renders the art gallery to PNGs for looking at (and for the evidence). Usage: node tests/browser/shoot-gallery.mjs <outDir> [section...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle, contentModule } from '../../tools/bundle.mjs';
import { findChromium } from './chromium.mjs';

const out = process.argv[2] || '/tmp/gallery', sections = process.argv.slice(3);
mkdirSync(out, { recursive: true });
const code = bundle('tests/browser/gallery-main.js', { virtuals: { 'virtual:content': contentModule() }, globalName: 'GalleryBundle' });
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#e9dcb9"><div id="root"></div><script>${code}</script>`;
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const problems = [];
page.on('pageerror', (e) => problems.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
await page.setContent(html);
await page.waitForFunction(() => window.galleryReady, null, { timeout: 30000 });
const GALLERY = {
  heroes: () => {
    const { createRng, content, figures } = window.Art, root = document.getElementById('root'); root.innerHTML = '';
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 620; root.appendChild(cv); const ctx = cv.getContext('2d');
    ctx.drawImage(window.Art.paper.vellumSheet(createRng, 7, 1600, 620), 0, 0);
    content.heroes.forEach((h, i) => { const s = figures.heroSprite(createRng, h.id, h.realm); ctx.drawImage(s, (i % 8) * 200, Math.floor(i / 8) * 300 + 10, 200, 260); });
  },
  monsters: () => {
    const { createRng, content, figures } = window.Art, root = document.getElementById('root'); root.innerHTML = '';
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 1830; root.appendChild(cv); const ctx = cv.getContext('2d');
    ctx.drawImage(window.Art.paper.vellumSheet(createRng, 8, 1600, 1830), 0, 0);
    content.roster.forEach((m, i) => { const s = figures.monsterSprite(createRng, m); ctx.save(); ctx.translate((i % 8) * 200 + 200, Math.floor(i / 8) * 270 + 10); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0); ctx.restore(); });
    content.bosses.forEach((b, i) => { ctx.drawImage(figures.bossSprite(createRng, b), i * 340 + 20, 1400, 340, 400); });
  },
  backdrops: () => {
    const { createRng, backdrop } = window.Art, root = document.getElementById('root'); root.innerHTML = '';
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 1080; root.appendChild(cv); const ctx = cv.getContext('2d');
    ['midgard', 'asgard', 'helheim'].forEach((r, i) => ctx.drawImage(backdrop.paintBackdrop(createRng, r), (i % 2) * 720, Math.floor(i / 2) * 540, 720, 405));
    ctx.drawImage(backdrop.paintBackdrop(createRng, 'midgard'), 720, 405, 720, 405);
  },
  woodcut: () => {
    const { createRng, woodcut, paper } = window.Art, root = document.getElementById('root'); root.innerHTML = '';
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 420; root.appendChild(cv); const ctx = cv.getContext('2d');
    ctx.drawImage(paper.vellumSheet(createRng, 9, 1000, 420), 0, 0);
    const img = (c) => c; ctx.drawImage(woodcut.frameTile(createRng, 21), 20, 20); ctx.drawImage(woodcut.hatchTile(createRng, 31), 140, 20);
    ctx.drawImage(woodcut.inkTile(createRng, 41), 240, 20); ctx.drawImage(woodcut.ruleStrip(createRng, 51), 20, 150);
    for (const [i, id] of ['midgard', 'asgard', 'helheim', 'fire', 'lightning', 'frost', 'hearth', 'ward', 'blade', 'bow', 'star'].entries()) window.Art.runes.drawRune(ctx, id, 20 + i * 70, 190, 48, [42, 29, 18], 3);
  },
};
const names = sections.length ? sections : Object.keys(GALLERY);
for (const n of names) {
  if (!GALLERY[n]) { // sections added by later modules live on window.Gallery
    await page.evaluate((k) => window.Gallery && window.Gallery[k] && window.Gallery[k](), n);
  } else await page.evaluate(`(${GALLERY[n].toString()})()`);
  const buf = await page.locator('#root').screenshot();
  writeFileSync(join(out, `${n}.png`), buf); console.log('wrote', join(out, `${n}.png`));
}
await browser.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
