// Takes the G4 evidence screenshots from the BUILT page (file://), desktop and 390 px, on a mid-game save made by the seeded bot.
//   node checks/screenshots.mjs [outDir=evidence/G4]
import { mkdirSync } from 'node:fs';
import { content } from '../tests/helpers/content.mjs';
import { play } from '../tests/helpers/bot.mjs';
import { newGame, canonical, setParty, startExpedition, expeditionMap } from '../sim/index.js';
import { runedSave, pathTo } from './expedition-bot.mjs';
import { buildGame, launch, openGame, go, settle } from '../tests/browser/game-page.mjs';

// Full-page screenshots hung once in headless Chromium on the Forge with an item open (the page itself stayed responsive), so each shot
// resizes the viewport to the document height and takes an ordinary screenshot instead.
const shoot = async (page, path, width, height) => {
  const h = Math.min(7000, await page.evaluate(() => document.documentElement.scrollHeight));
  await page.setViewportSize({ width, height: Math.max(height, h) }); await page.waitForTimeout(100);
  await page.screenshot({ path, type: 'jpeg', quality: 82, timeout: 15000 }); await page.setViewportSize({ width, height });
};
const out = process.argv[2] || 'evidence/G4'; mkdirSync(out, { recursive: true });
const played = play(newGame(content, 20261002, { savedAt: '', build: 'screenshots' }), 160, 555).save;
// the bot's party can end up as one hero; send the four strongest healthy heroes so the pictures show a full party
const ids = played.heroes.filter((x) => x.injury === 0).sort((a, b) => b.level - a.level || a.id - b.id).slice(0, 4).map((x) => x.id);
const save = setParty(played, content, ids);
const g = buildGame('screenshots'), browser = await launch();
for (const [label, width, height] of [['desktop', 1280, 800], ['mobile', 390, 800]]) {
  const { page, problems } = await openGame(browser, g.url, { width, height });
  await go(page, '#/settings'); await page.fill('[data-testid=import-text]', canonical(save)); await page.click('[data-testid=import]');
  const hero = save.party[0];
  for (const [name, hash] of [['hall', '#/hall'], ['hero', `#/hero/${hero}`], ['forge', '#/forge'], ['delve', '#/delve'], ['settings', '#/settings']]) {
    await go(page, hash); await page.waitForTimeout(150);
    if (name === 'forge') { const first = await page.$('ul[data-testid=item-list] button'); if (first) { await first.click(); await settle(page); } }
    await shoot(page, `${out}/${label}-${name}.jpg`, width, height);
  }
  await go(page, '#/delve');
  for (const h of save.heroes.filter((x) => x.injury > 0 && save.party.includes(x.id))) await page.check(`[data-testid="force-${h.id}"]`);
  await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 30); await page.waitForTimeout(900);
  await shoot(page, `${out}/${label}-battle.jpg`, width, height);
  await page.click('[data-testid=skip]'); await page.waitForTimeout(200);
  await shoot(page, `${out}/${label}-battle-end.jpg`, width, height);
  // an expedition: set out, the fogged map, a site, a floor fight, the way home
  const xs = runedSave(content, 20, 777, true); for (const q of xs.heroes) q.level = 50; xs.currency.hacksilver = 100000;
  await go(page, '#/settings'); await page.fill('[data-testid=import-text]', canonical(xs)); await page.click('[data-testid=import]');
  await go(page, '#/expedition'); await page.waitForTimeout(150); await shoot(page, `${out}/${label}-expedition-start.jpg`, width, height);
  await page.selectOption('[data-testid=x-level]', '20'); await page.fill('[data-testid=x-provisions]', '60'); await page.dispatchEvent('[data-testid=x-provisions]', 'change'); await page.click('[data-testid=x-start]');
  const exs = startExpedition(xs, content, { realm: 'midgard', level: 20, provisions: 60 }).save.expedition, xmap = expeditionMap(exs, content);
  const near = xmap.sites.map((q) => ({ q, p: pathTo(xmap, content, exs.x, exs.y, q.x, q.y) })).sort((a, b) => a.p.cost - b.p.cost || a.q.id - b.q.id)[0];
  for (const [cx, cy] of near.p.steps) await page.click(`[data-testid="cell-${cx}-${cy}"]`);
  await page.waitForTimeout(200); await shoot(page, `${out}/${label}-expedition-map.jpg`, width, height);
  await page.click('[data-testid=x-floor]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 25); await page.waitForTimeout(700);
  await shoot(page, `${out}/${label}-expedition-floor.jpg`, width, height);
  await page.click('[data-testid=skip]'); await page.waitForTimeout(200); await shoot(page, `${out}/${label}-expedition-floor-end.jpg`, width, height);
  console.log(label, 'console problems:', problems.length ? problems : 'none');
}
await browser.close();
