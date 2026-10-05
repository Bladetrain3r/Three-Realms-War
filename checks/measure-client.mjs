// Measures the client's budgets (DESIGN 15) in headless Chromium: shipped bytes, JS heap after every screen and a full replay,
// and the time to draw one battle frame at 1920 x 1080. Usage: node checks/measure-client.mjs [--write evidence/budgets/client.json]
import { writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGame, launch, openGame, go, settle } from '../tests/browser/game-page.mjs';

const g = await buildGame('measure'), browser = await launch();
const bytes = Object.fromEntries(readdirSync(g.out).map((f) => [f, statSync(join(g.out, f)).size]));
const { page, problems } = await openGame(browser, g.url, { width: 1920, height: 1080 });
const heap = async () => page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
for (const h of ['#/hall', '#/hero/5', '#/forge', '#/delve', '#/settings']) await go(page, h);
await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 20);
await page.click('[data-testid=skip]');
const frames = await page.evaluate(() => window.ThreeRealms.timeFrames(300));
const heapAfter = await heap();
const sorted = [...frames].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
// a live-animation sample too: frames drawn by the page's own requestAnimationFrame loop while a replay plays at 4x
await page.click('[data-testid=again]'); await page.click('[data-testid=speed-4]');
const raf = await page.evaluate(() => new Promise((res) => { const t = []; let last = performance.now(), n = 0; const f = (now) => { t.push(now - last); last = now; if (++n < 120) requestAnimationFrame(f); else res(t); }; requestAnimationFrame(f); }));
const rs = [...raf].sort((a, b) => a - b);
await browser.close();
const report = {
  command: 'node checks/measure-client.mjs', chromium: 'headless, software rendering, viewport 1920x1080', problems,
  bundleBytes: bytes, bundleTotalBytes: Object.values(bytes).reduce((a, b) => a + b, 0),
  jsHeapBytesAfterAllScreensAndAReplay: heapAfter,
  drawMsPerBattleFrame: { n: frames.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2) },
  rafIntervalMsWhilePlaying4x: { n: raf.length, median: +rs[rs.length >> 1].toFixed(2), p95: +rs[Math.floor(rs.length * 0.95)].toFixed(2), max: +rs[rs.length - 1].toFixed(2) },
};
console.log(JSON.stringify(report, null, 1));
const i = process.argv.indexOf('--write'); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(report, null, 1) + '\n');
