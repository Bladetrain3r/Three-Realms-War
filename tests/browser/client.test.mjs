import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../helpers/content.mjs';
import { loadFixture } from '../helpers/fixture.mjs';
import { readFileSync } from 'node:fs';
import { newGame, playDelve, playDelves, rest, salvageMany, canonical } from '../../sim/index.js';
import { matching } from '../../client/forge-filter.js';
import { buildGame, launch, openGame, go, settle } from './game-page.mjs';

let browser = null, game = null;
before(async () => { browser = await launch(); if (browser) game = await buildGame('client-test'); });
after(async () => { if (browser) await browser.close(); });
const need = (t) => { if (!browser) { t.skip('no Chromium found'); return false; } return true; };
const text = (page, id) => page.textContent(`[data-testid="${id}"]`);
const importSave = async (page, saveObj) => { await go(page, '#/settings'); await page.fill('[data-testid=import-text]', canonical(saveObj)); await page.click('[data-testid=import]'); };
const withoutMeta = (txt) => { const o = JSON.parse(txt); delete o.meta; return canonical(o); };

test('client: every screen renders with no console error, at desktop and at 390 px, with no sideways scroll', async (t) => {
  if (!need(t)) return;
  for (const width of [1280, 390]) {
    const { page, problems, context } = await openGame(browser, game.url, { width, height: 900 });
    const heroId = await page.evaluate(() => window.ThreeRealms.save().heroes[0].id);
    const seen = {};
    for (const [hash, heading] of [['#/hall', /The Hall/], [`#/hero/${heroId}`, /\S/], ['#/forge', /The Forge/], ['#/delve', /The Delve Board/], ['#/expedition', /Expedition/], ['#/settings', /Settings/], ['#/replays', /Replays/], ['#/battle', /The Battle/]]) {
      await go(page, hash);
      seen[hash] = await page.textContent('#screen h1');
      assert.match(seen[hash], heading, `${hash} at ${width}px`);
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert.ok(sw <= iw, `${hash} at ${width}px scrolls sideways (${sw} > ${iw})`);
    }
    await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
    await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 5);
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert.ok(sw <= iw, `battle at ${width}px scrolls sideways`);
    assert.deepEqual(problems, [], `console problems at ${width}px`);
    await context.close();
  }
});

test('client: the replay a browser plays has the same hash as Node for the same save, and the saves after it agree', async (t) => {
  if (!need(t)) return;
  const start = newGame(content, 424242, { savedAt: '', build: 'client-test' });
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  const st = await page.evaluate(() => window.ThreeRealms.battleState());
  const node = playDelve(start, content, { realm: 'midgard', level: 1 });
  assert.equal(st.hash, node.replay.hash, 'browser and Node replay hashes differ');
  assert.equal(st.events, node.replay.events.length);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(node.save)));
  // a second delve on the result (a different counter, so a different seed) also agrees
  assert.ok(!node.save.heroes.some((h) => h.injury > 0), 'this seed is chosen so that nobody is injured after the first delve');
  await go(page, '#/delve'); await page.click('[data-testid=descend]');
  await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  const again = playDelve(node.save, content, { realm: 'midgard', level: 1 });
  assert.equal((await page.evaluate(() => window.ThreeRealms.battleState())).hash, again.replay.hash, 'the second delve differs');
  assert.notEqual(again.replay.hash, node.replay.hash);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: a skipped replay ends with the outcome and the log the replay carries; the summary names what was earned', async (t) => {
  if (!need(t)) return;
  const { page, context } = await openGame(browser, game.url);
  await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 0);
  await page.click('[data-testid=skip]');
  const st = await page.evaluate(() => window.ThreeRealms.battleState());
  assert.equal(st.done, true); assert.equal(st.over, true);
  assert.ok((await text(page, 'summary')).match(/Delve (won|lost)/));
  assert.ok((await page.locator('[data-testid=log] li').count()) === st.log);
  await context.close();
});

test('client: the runbook editor refuses invalid runbooks and says why; valid ones save and survive a reload', async (t) => {
  if (!need(t)) return;
  const { page, problems, context } = await openGame(browser, game.url);
  const hero = await page.evaluate(() => window.ThreeRealms.save().heroes[0]);
  await go(page, `#/hero/${hero.id}`);
  await page.click('[data-testid=runbook] summary');
  const refuse = async (json, expectText) => {
    await page.fill('[data-testid=runbook-json]', typeof json === 'string' ? json : JSON.stringify(json));
    await page.click('[data-testid=apply-json]');
    const msg = await text(page, 'runbook-msg');
    assert.match(msg, /Refused/); assert.match(msg, expectText, msg);
    assert.deepEqual(await page.evaluate((id) => window.ThreeRealms.save().heroes.find((h) => h.id === id).runbook, hero.id), hero.runbook, 'a refused runbook must not change the save');
  };
  await refuse('{not json', /not valid JSON/);
  await refuse({ v: 1, rules: [{ when: [{ c: 'always' }], do: { a: 'skill', skill: 'cleave' }, target: null }] }, /not in this hero's kit/); // cleave belongs to the Huscarl
  await refuse({ v: 1, rules: [{ when: [{ c: 'self_hp_below', pct: 55 }], do: { a: 'basic' }, target: 'lowest_hp' }] }, /integer from 10 to 90 in steps of 10/);
  await refuse({ v: 1, rules: Array.from({ length: 9 }, () => ({ when: [{ c: 'always' }], do: { a: 'basic' }, target: 'lowest_hp' })) }, /more than 8 rules/);
  await refuse({ v: 1, rules: [{ when: [{ c: 'always' }], do: { a: 'brace' }, target: 'lowest_hp' }] }, /takes no target selector/);
  // the form: change the first rule's threshold and save
  await go(page, `#/hero/${hero.id}`);
  await page.selectOption('[data-testid="arg-0-0-pct"]', '70');
  await page.click('[data-testid=save-runbook]');
  await page.waitForFunction((id) => window.ThreeRealms.save().heroes.find((h) => h.id === id).runbook.rules[0].when[0].pct === 70, hero.id);
  await page.waitForTimeout(500); // Chromium hands localStorage writes to its storage process asynchronously; a reload straight after can read the old value on a loaded machine (seen: 50 !== 70 with three browser suites running at once)
  await page.reload(); await page.waitForFunction(() => window.ThreeRealms && window.ThreeRealms.ready); await settle(page);
  assert.equal(await page.evaluate((id) => window.ThreeRealms.save().heroes.find((h) => h.id === id).runbook.rules[0].when[0].pct, hero.id), 70, 'the saved runbook did not survive a reload (browser storage)');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: export then import restores the same save; a damaged save is refused with the key and the reason, and nothing changes', async (t) => {
  if (!need(t)) return;
  const { page, context } = await openGame(browser, game.url);
  await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
  await go(page, '#/settings');
  await page.click('[data-testid=show-export]');
  const exported = await page.inputValue('[data-testid=export-text]');
  assert.equal(exported, await page.evaluate(() => window.ThreeRealms.exportText()));
  await page.click('[data-testid=reset]'); await page.click('[data-testid=confirm-reset]');
  assert.notEqual(await page.evaluate(() => window.ThreeRealms.exportText()), exported, 'reset should start a different game');
  await go(page, '#/settings');
  await page.fill('[data-testid=import-text]', exported); await page.click('[data-testid=import]');
  assert.equal(await page.evaluate(() => window.ThreeRealms.exportText()), exported, 'import did not restore the exported save byte for byte');
  const bad = JSON.parse(exported); bad.heroes[0].level = 999;
  await go(page, '#/settings');
  await page.fill('[data-testid=import-text]', JSON.stringify(bad)); await page.click('[data-testid=import]');
  assert.match(await text(page, 'import-msg'), /refused/);
  assert.match(await text(page, 'import-msg'), /heroes\.0\.level|level/);
  assert.equal(await page.evaluate(() => window.ThreeRealms.exportText()), exported, 'a refused import must leave the save alone');
  await page.fill('[data-testid=import-text]', 'nope'); await page.click('[data-testid=import]');
  assert.match(await text(page, 'import-msg'), /not valid JSON/);
  await context.close();
});

test('client: the hall refuses what the rules refuse and says why (cannot afford, locked, full party)', async (t) => {
  if (!need(t)) return;
  const { page, context } = await openGame(browser, game.url);
  await go(page, '#/hall');
  assert.equal(await page.isDisabled('[data-testid=do-recruit-hunter]'), true);
  assert.match(await page.getAttribute('[data-testid=do-recruit-hunter]', 'title'), /costs 120 hacksilver \(you have 0\)/);
  assert.match(await page.getAttribute('[data-testid=do-recruit-berserker]', 'title'), /needs 50 reputation in Midgard/);
  await go(page, '#/delve');
  // an injured hero blocks the descent until forced
  const bad = await page.evaluate(() => { const s = window.ThreeRealms.save(); s.heroes[0].injury = 2; return JSON.stringify(s); });
  await importSave(page, JSON.parse(bad));
  await go(page, '#/delve');
  assert.equal(await page.isDisabled('[data-testid=descend]'), true);
  await page.check(`[data-testid="force-${JSON.parse(bad).heroes[0].id}"]`);
  assert.equal(await page.isDisabled('[data-testid=descend]'), false);
  await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  const st = await page.evaluate(() => window.ThreeRealms.battleState());
  assert.deepEqual(st.injured, [true, false, false, false], 'the forced hero fights injured, the rest do not');
  assert.deepEqual([st.realm, st.level], ['midgard', 1]);
  await context.close();
});

test('client budgets: shipped bytes (game.js, index.html and style.css together) <= 1 MB, heap <= 256 MB after every screen and a replay, battle frame p95 <= 16.7 ms at 1920 x 1080 (DESIGN 15)', async (t) => {
  if (!need(t)) return;
  const total = Object.values(game.bytes).reduce((a, b) => a + b, 0);
  assert.ok(total <= 1024 * 1024, `shipped ${total} bytes`);
  const { page, context } = await openGame(browser, game.url, { width: 1920, height: 1080 });
  for (const h of ['#/hall', '#/forge', '#/delve', '#/settings']) await go(page, h);
  await go(page, '#/delve'); await page.click('[data-testid=descend]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 20); await page.click('[data-testid=skip]');
  const frames = await page.evaluate(() => window.ThreeRealms.timeFrames(200)), s = [...frames].sort((a, b) => a - b), p95 = s[Math.floor(s.length * 0.95)];
  const heap = await page.evaluate(() => performance.memory.usedJSHeapSize);
  assert.ok(p95 <= 16.7, `p95 frame ${p95.toFixed(2)} ms`);
  assert.ok(heap <= 256 * 1024 * 1024, `heap ${heap}`);
  await context.close();
});

test('client: the Forge upgrade flow in the browser gives exactly the save the rules layer gives (attempt, then keep or undo), and equipment changes go through the same rules', async (t) => {
  if (!need(t)) return;
  const { upgradeAttempt, acceptAttempt, undoAttempt, equip } = await import('../../sim/index.js');
  const start = newGame(content, 31337, { savedAt: '', build: 'client-test' });
  for (const k of Object.keys(start.materials)) start.materials[k] = 50;
  const itemId = start.items[0].id, { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/forge'); await page.click(`[data-testid="item-${itemId}"]`);
  await page.click('[data-testid=upgrade]');
  let want = upgradeAttempt(start, content, itemId);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(want)), 'attempt');
  assert.match(await text(page, 'pending'), /Success|No star gained/);
  assert.equal(await page.isDisabled('[data-testid=upgrade]'), true, 'a pending attempt blocks another');
  await page.click('[data-testid=undo]');
  want = undoAttempt(want, content, itemId);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(want)), 'undo');
  await page.click('[data-testid=upgrade]'); want = upgradeAttempt(want, content, itemId);
  const pend = await page.evaluate((id) => window.ThreeRealms.save().items.find((x) => x.id === id).mulligan, itemId);
  if (pend < 1) assert.equal(await page.isDisabled('[data-testid=undo]'), true, 'a spent mulligan cannot be used again');
  await page.click('[data-testid=accept]'); want = acceptAttempt(want, content, itemId);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(want)), 'accept');
  // equipment: take the helm off via the hero screen
  const hero = start.heroes[0];
  await go(page, `#/hero/${hero.id}`); await page.selectOption('[data-testid=slot-helm]', '');
  want = equip(want, content, hero.id, 'helm', null);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(want)), 'unequip');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: recruiting, benching, adding to the party and dismissing in the browser match the rules layer', async (t) => {
  if (!need(t)) return;
  const { recruit, setParty, dismiss } = await import('../../sim/index.js');
  const start = newGame(content, 555, { savedAt: '', build: 'client-test' });
  start.currency.hacksilver = 1000;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/hall'); await page.click('[data-testid=do-recruit-hunter]');
  let want = recruit(start, content, 'hunter');
  const same = async (what) => assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), withoutMeta(canonical(want)), what);
  await same('recruit');
  const newId = want.heroes[want.heroes.length - 1].id;
  await page.click(`[data-testid="bench-${start.party[3]}"]`); want = setParty(want, content, start.party.slice(0, 3)); await same('bench');
  await page.click(`[data-testid="add-${newId}"]`); want = setParty(want, content, [...start.party.slice(0, 3), newId]); await same('add to party');
  await page.click(`[data-testid="left-${newId}"]`); want = setParty(want, content, [start.party[0], start.party[1], newId, start.party[2]]); await same('reorder');
  await go(page, `#/hero/${newId}`); await page.click('[data-testid=dismiss]'); await same('dismiss asks first (nothing changes)');
  await page.click('[data-testid=confirm-dismiss]'); want = dismiss(want, content, newId); await same('dismiss');
  assert.equal(await page.evaluate(() => location.hash), '#/hall');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: portraits keep their aspect ratio in every card (they were stretched in the party cards), at desktop and at 390 px', async (t) => {
  if (!need(t)) return;
  for (const width of [1280, 390]) {
    const { page, context } = await openGame(browser, game.url, { width, height: 900 });
    await go(page, '#/hall');
    const bad = await page.evaluate(() => [...document.querySelectorAll('canvas.portrait')].map((c) => { const r = c.getBoundingClientRect(); return { want: c.height / c.width, got: r.height / r.width }; }).filter((x) => Math.abs(x.want - x.got) > 0.02));
    assert.deepEqual(bad, [], `stretched portraits at ${width}px`);
    assert.ok((await page.locator('canvas.portrait').count()) > 4);
    await context.close();
  }
});

test('client: an upgrade attempt shows the old and the new bonus lines in the same units, and the main stat at both stars', async (t) => {
  if (!need(t)) return;
  const start = newGame(content, 99, { savedAt: '', build: 'client-test' });
  for (const k of Object.keys(start.materials)) start.materials[k] = 999;
  const id = start.items[0].id; start.items = start.items.map((i) => (i.id === id ? { ...i, tier: 'fine', lines: [[0, 800]] } : i));
  const { page, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/forge'); await page.click(`[data-testid="item-${id}"]`); await page.click('[data-testid=upgrade]');
  const before = await text(page, 'lines-before'), now = await text(page, 'lines-now');
  for (const s of [before, now]) { assert.doesNotMatch(s, /_PCT|CRITDMG|CRIT\b/, s); assert.match(s, /\+\d+ MIT( \(no effective change from the star\))?; (\+[\d.]+% [A-Za-z ]+(, )?)+/, s); }
  assert.match(now, /no effective change/, 'a star on a level-1 weapon (+6 MIT) rounds away and the page says so');
  assert.match(before, /\+8% VIG/, 'the old line is shown at the old star: raw 800 at star 0');
  await context.close();
});

const playtest = loadFixture('playtest-2026-10-02.json');
const stateOf = (page) => page.evaluate(() => window.ThreeRealms.exportText());
const sameSave = async (page, want, what) => assert.equal(withoutMeta(await stateOf(page)), withoutMeta(canonical(want)), what);

test('client: resting the roster costs 10 per hero and 30 per injured hero, can go into debt, and then rest and recruiting are refused (Hall and Delve board)', async (t) => {
  if (!need(t)) return;
  const start = structuredClone(playtest); start.heroes[0].injury = 2; start.heroes[3].injury = 1; start.currency.hacksilver = 40;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/hall'); assert.match(await page.getAttribute('[data-testid=rest]', 'title') || '', /^$/); await page.click('[data-testid=rest]');
  let want = rest(start, content).save; await sameSave(page, want, 'rest from the Hall');
  assert.equal(want.currency.hacksilver, 40 - (2 * 30 + 6 * 10), 'two injured at 30, six fit at 10, from 40');
  assert.match(await text(page, 'purse'), /80 hacksilver in debt/);
  assert.equal(await page.isDisabled('[data-testid=rest]'), true);
  assert.match(await page.getAttribute('[data-testid=rest]', 'title'), /you owe 80 hacksilver/);
  assert.match(await page.getAttribute('[data-testid=do-recruit-hunter]', 'title'), /you owe 80 hacksilver/);
  await go(page, '#/delve'); assert.equal(await page.isDisabled('[data-testid=rest]'), true);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: "Delve N times" gives exactly the saves and replays of playDelves, stops where it says it stops, and every run can be watched', async (t) => {
  if (!need(t)) return;
  const start = newGame(content, 424242, { savedAt: '', build: 'client-test' });
  for (const h of start.heroes) h.level = 40;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/delve'); await page.selectOption('[data-testid=count]', '5'); await page.click('[data-testid=descend]');
  await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  const want = playDelves(start, content, { realm: 'midgard', level: 1 }, 5);
  await sameSave(page, want.save, 'five delves');
  const st = await page.evaluate(() => window.ThreeRealms.battleState());
  assert.equal(st.hash, want.runs.at(-1).replay.hash, 'the last run is shown first');
  assert.match(await text(page, 'batch-summary'), new RegExp(`${want.totals.wins} won`));
  assert.equal(await page.locator('[data-testid=run-select] option').count(), want.runs.length);
  await page.selectOption('[data-testid=run-select]', '0'); await settle(page);
  await page.waitForFunction((h) => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().hash === h, want.runs[0].replay.hash);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: the Forge filters, sorts, selects by rule and bulk-salvages exactly as the rules layer does, after a confirmation', async (t) => {
  if (!need(t)) return;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, playtest);
  await go(page, '#/forge');
  const shown = () => page.locator('ul[data-testid=item-list] li').count();
  assert.equal(await shown(), 68);
  const wornSet0 = new Set(playtest.heroes.flatMap((x) => Object.values(x.slots)));
  await page.selectOption('[data-testid=f-owner]', 'stash'); assert.equal(await shown(), playtest.items.filter((i) => !wornSet0.has(i.id)).length);
  const wornSet = new Set(playtest.heroes.flatMap((x) => Object.values(x.slots)));
  await page.selectOption('[data-testid=f-tier]', 'runed'); assert.equal(await shown(), playtest.items.filter((i) => i.tier === 'runed' && !wornSet.has(i.id)).length, 'runed items in the stash');
  await page.selectOption('[data-testid=f-tier]', 'any');
  await page.selectOption('[data-testid=f-sort]', 'ilvl'); await page.check('[data-testid=f-desc]');
  const firstLevel = await page.locator('ul[data-testid=item-list] li button').first().textContent();
  assert.match(firstLevel, / L18 /, 'highest level first');
  // select by rule: stash, up to Fine, level 10 or less, star 0, keep set pieces
  await page.click('[data-testid=bulk-preview]', { trial: true }).catch(() => {});
  await page.evaluate(() => { document.querySelector('details.bulk').open = true; });
  await page.fill('[data-testid=r-level]', '10'); await page.press('[data-testid=r-level]', 'Tab'); // commit the value and leave the field now: a blur later, during the click, re-renders and shuts the panel
  await settle(page); await page.evaluate(() => { document.querySelector('details.bulk').open = true; });
  await page.click('[data-testid=select-matching]');
  const ids = matching(playtest, { maxTier: 'fine', maxLevel: 10, maxStar: 0, noSet: true });
  assert.match(await text(page, 'bulk-preview'), new RegExp(`^${ids.length} selected`));
  await page.click('[data-testid=salvage-selected]');
  await sameSave(page, playtest, 'asking for confirmation changes nothing');
  await page.click('[data-testid=confirm-salvage]');
  await sameSave(page, salvageMany(playtest, content, ids).save, 'bulk salvage');
  assert.match(await text(page, 'notice'), new RegExp(`Salvaged ${ids.length} item`));
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: an expedition played through the page (set out, fog, walk, floors, bank) gives exactly the save the rules layer gives', async (t) => {
  if (!need(t)) return;
  const { startExpedition, move, enterFloor, returnHome, expeditionMap } = await import('../../sim/index.js');
  const { runedSave, pathTo } = await import('../../checks/expedition-bot.mjs');
  const start = runedSave(content, 20, 777, true); for (const h of start.heroes) h.level = 50; start.currency.hacksilver = 100000;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, '#/expedition');
  await page.selectOption('[data-testid=x-realm]', 'midgard'); await page.selectOption('[data-testid=x-level]', '20'); await page.fill('[data-testid=x-provisions]', '60'); await page.dispatchEvent('[data-testid=x-provisions]', 'change');
  await page.click('[data-testid=x-start]');
  let want = startExpedition(start, content, { realm: 'midgard', level: 20, provisions: 60 }).save;
  await sameSave(page, want, 'set out');
  const fogged = await page.locator('.cell.tx').count(); assert.ok(fogged > 150 && fogged < 280, `${fogged} unexplored cells`);
  const ex = want.expedition, map = expeditionMap(ex, content);
  const near = map.sites.map((s) => ({ s, p: pathTo(map, content, ex.x, ex.y, s.x, s.y) })).sort((a, b) => a.p.cost - b.p.cost || a.s.id - b.s.id)[0];
  for (const [x, y] of near.p.steps) { await page.click(`[data-testid="cell-${x}-${y}"]`); want = move(want, content, x, y).save; }
  await sameSave(page, want, 'walked to the site');
  assert.ok((await page.locator('.cell.tx').count()) < fogged, 'walking reveals the fog');
  for (let guard = 0; guard < 10; guard++) {
    await page.click('[data-testid=x-floor]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
    const r = enterFloor(want, content); want = r.save;
    await page.waitForFunction((h) => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().hash === h, r.replay.hash);
    await page.waitForFunction(() => window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
    assert.match(await text(page, 'summary'), /cleared|lost/);
    await sameSave(page, want, 'after a floor');
    await page.click('[data-testid=to-map]'); await settle(page);
    if (want.expedition.site === null) break;
  }
  await page.click('[data-testid=x-home]'); want = returnHome(want, content).save;
  await sameSave(page, want, 'banked');
  assert.match(await text(page, 'report'), /hacksilver/);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: a wiped expedition shows who did not come back, loses the pack and removes the dead from the roster', async (t) => {
  if (!need(t)) return;
  const { startExpedition, move, enterFloor, expeditionMap } = await import('../../sim/index.js');
  const { runedSave, pathTo } = await import('../../checks/expedition-bot.mjs');
  let chosen = null;
  for (let seed = 1; seed <= 30 && !chosen; seed++) {
    const s = runedSave(content, 3, seed, true); s.currency.hacksilver = 100000; s.unlocked.asgard = 50;
    let cur = startExpedition(s, content, { realm: 'asgard', level: 50, provisions: 60 }).save; const map = expeditionMap(cur.expedition, content);
    const near = map.sites.map((q) => ({ q, p: pathTo(map, content, cur.expedition.x, cur.expedition.y, q.x, q.y) })).sort((a, b) => a.p.cost - b.p.cost || a.q.id - b.q.id)[0];
    for (const [x, y] of near.p.steps) cur = move(cur, content, x, y).save;
    if (cur.expedition && enterFloor(cur, content).summary.outcome === 0) chosen = { s, near, map };
  }
  assert.ok(chosen, 'no wiping seed found');
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, chosen.s);
  await go(page, '#/expedition');
  await page.selectOption('[data-testid=x-realm]', 'asgard'); await page.selectOption('[data-testid=x-level]', '50'); await page.fill('[data-testid=x-provisions]', '60'); await page.dispatchEvent('[data-testid=x-provisions]', 'change');
  await page.click('[data-testid=x-start]');
  const ex = (await page.evaluate(() => window.ThreeRealms.save())).expedition, map = expeditionMap(ex, content);
  const near = map.sites.map((q) => ({ q, p: pathTo(map, content, ex.x, ex.y, q.x, q.y) })).sort((a, b) => a.p.cost - b.p.cost || a.q.id - b.q.id)[0];
  for (const [x, y] of near.p.steps) await page.click(`[data-testid="cell-${x}-${y}"]`);
  await page.click('[data-testid=x-floor]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
  assert.match(await text(page, 'summary'), /The party was lost/); assert.match(await text(page, 'x-died'), /Lost for good: /);
  const after = await page.evaluate(() => window.ThreeRealms.save());
  assert.equal(after.expedition, null); assert.ok(after.heroes.length < chosen.s.heroes.length || after.heroes.every((h) => h.level === 1 || h.injury > 0), 'the dead are gone');
  assert.equal(after.currency.hacksilver, chosen.s.currency.hacksilver - 600, 'the provisions are spent and nothing was banked');
  await page.click('[data-testid=to-map]'); await settle(page);
  assert.match(await text(page, 'report'), /did not come back/);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: the expedition map at 390 px scrolls inside its own box, not the page', async (t) => {
  if (!need(t)) return;
  const { startExpedition } = await import('../../sim/index.js'); const { runedSave } = await import('../../checks/expedition-bot.mjs');
  const s = runedSave(content, 20, 5, true); s.currency.hacksilver = 100000;
  const { page, problems, context } = await openGame(browser, game.url, { width: 390, height: 800 });
  await importSave(page, startExpedition(s, content, { realm: 'midgard', level: 20, provisions: 20 }).save);
  await go(page, '#/expedition');
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw <= iw, `page ${sw} > ${iw}`);
  const [mw, bw] = await page.evaluate(() => { const m = document.querySelector('.map-wrap'); return [m.scrollWidth, m.clientWidth]; }); assert.ok(mw > bw, 'the map is wider than its box and scrolls inside it');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: training buys levels exactly as the rules layer prices them, refuses with the reason, and stops at level 40', async (t) => {
  if (!need(t)) return;
  const { train } = await import('../../sim/index.js');
  const start = newGame(content, 88, { savedAt: '', build: 'client-test' }); start.currency.hacksilver = 1500; start.heroes[0].level = 10;
  const id = start.heroes[0].id;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start);
  await go(page, `#/hero/${id}`);
  assert.match(await page.textContent('[data-testid=train]'), /Train to level 11 \(1000 hacksilver\)/);
  await page.click('[data-testid=train]');
  await sameSave(page, train(start, content, id, 1), 'one level');
  assert.equal(await page.isDisabled('[data-testid=train]'), true);
  assert.match(await page.getAttribute('[data-testid=train]', 'title'), /costs 1100 \(you have 500\)/);
  const rich = structuredClone(start); rich.currency.hacksilver = 100000; rich.heroes[0].level = 38;
  await importSave(page, rich); await go(page, `#/hero/${id}`);
  await page.selectOption('[data-testid=train-levels]', '2'); await page.click('[data-testid=train]');
  await sameSave(page, train(rich, content, id, 2), 'to 40');
  assert.match(await text(page, 'notice') + await page.textContent('#screen'), /Training stops at level 40/);
  assert.equal(await page.locator('[data-testid=train]').count(), 0);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: with the activity timer on, a batch shows its progress, locks the party meanwhile, can be stopped after the current run, and equals the rules layer', async (t) => {
  if (!need(t)) return;
  const start = newGame(content, 424242, { savedAt: '', build: 'client-test' }); for (const h of start.heroes) h.level = 40;
  const { page, problems, context } = await openGame(browser, game.url, { timer: 1000 }); // 10 s for the batch: under load the page needs seconds to get to the Hall and back, and a batch that has already finished is a different test
  await importSave(page, start);
  await go(page, '#/delve'); await page.selectOption('[data-testid=count]', '10'); await page.click('[data-testid=descend]');
  await page.waitForSelector('[data-testid=busy]'); assert.match(await text(page, 'busy'), /Run \d+ of 10, 1 seconds each/);
  assert.equal(await page.isDisabled('[data-testid=descend]'), true);
  await go(page, '#/hall'); await page.click('[data-testid="bench-' + start.party[3] + '"]');
  assert.match(await text(page, 'notice'), /out on a delve run/);
  await go(page, '#/delve'); await page.waitForFunction(() => /Run [3-9] of 10/.test(((document.querySelector('[data-testid=busy]') || {}).textContent) || ''), null, { timeout: 15000 }); // at least two runs have landed
  await page.click('[data-testid=stop-batch]');
  await page.waitForFunction(() => location.hash === '#/battle', null, { timeout: 15000 }); await settle(page);
  assert.match(await text(page, 'batch-summary').catch(() => ''), /stopped|won/);
  const runs = await page.locator('[data-testid=run-select] option').count(); assert.ok(runs >= 1 && runs < 10, `${runs} runs`);
  const want = playDelves(start, content, { realm: 'midgard', level: 1 }, runs);
  await sameSave(page, want.save, 'the timed batch');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: a Legendary item shows seven stars and fixed lines, an attempt reports its result in words (no pending panel), and Salvage is switched off for it (the rules layer refuses it too, see legendary.test.mjs)', async (t) => {
  if (!need(t)) return;
  const { upgradeAttempt } = await import('../../sim/index.js');
  const start = newGame(content, 12, { savedAt: '', build: 'client-test' }); for (const k of Object.keys(start.materials)) start.materials[k] = 9999;
  const id = start.nextId++; start.items.push({ id, slot: 'weapon', kind: 'MIT', tier: 'legendary', ilvl: 30, realm: 'midgard', set: null, star: 5, lines: [[0, 900], [5, 600], [6, 300]], held: null, heldStar: null, mulligan: 1 });
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start); await go(page, '#/forge'); await page.click(`[data-testid="item-${id}"]`);
  assert.match(await text(page, 'item-detail'), /★★★★★☆☆ \(5 of 7\)/); assert.match(await text(page, 'item-detail'), /fixed: they never reroll/);
  await page.click('[data-testid=upgrade]');
  const want = upgradeAttempt(start, content, id);
  await sameSave(page, want, 'a legendary attempt');
  assert.match(await text(page, 'notice'), /Star 6 reached|No star gained/); assert.equal(await page.locator('[data-testid=pending]').count(), 0);
  assert.equal(await page.isDisabled('[data-testid=salvage]'), true); assert.equal(await page.getAttribute('[data-testid=salvage]', 'title'), 'a Legendary item is kept');
  await sameSave(page, want, 'salvage unavailable');
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: the paragon panel spends points and hearts exactly as the rules layer does, shows the gain at the level cap, refuses with the reason, and an older save without the keys loads', async (t) => {
  if (!need(t)) return;
  const { addParagonStar } = await import('../../sim/index.js');
  const start = newGame(content, 90, { savedAt: '', build: 'client-test' }); start.paragonPoints = 2; start.materials.ember_heart = 15; start.heroes[0].level = 10;
  const id = start.heroes[0].id, { page, problems, context } = await openGame(browser, game.url);
  // an old-format save: no paragon keys at all
  const old = JSON.parse(canonical(start)); delete old.paragonPoints; for (const h of old.heroes) delete h.paragon;
  await go(page, '#/settings'); await page.fill('[data-testid=import-text]', JSON.stringify(old)); await page.click('[data-testid=import]');
  assert.equal(await page.evaluate(() => window.ThreeRealms.save().paragonPoints), 0, 'the missing keys were filled in');
  await importSave(page, start); await go(page, `#/hero/${id}`);
  assert.match(await text(page, 'paragon-have'), /Paragon Points: 2 .* 0 of 18 stars/);
  assert.match(await page.textContent('[data-testid=pstar-VIG]').then(() => page.locator('tr', { hasText: 'VIG' }).last().textContent()), /\+\d+ at level 50/);
  await page.click('[data-testid=pstar-VIG]');
  let want = addParagonStar(start, content, id, 'VIG'); await sameSave(page, want, 'first star');
  assert.match(await text(page, 'pstars-VIG'), /●○○ 1 of 3/);
  await page.click('[data-testid=pstar-MIT]'); want = addParagonStar(want, content, id, 'MIT'); await sameSave(page, want, 'second star costs more');
  assert.equal(want.materials.ember_heart, 0, '5 hearts for the first star, 10 for the second');
  assert.equal(await page.isDisabled('[data-testid=pstar-GRD]'), true); assert.match(await page.getAttribute('[data-testid=pstar-GRD]', 'title'), /no Paragon Point/);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: a legendary lair through the page: the Hall lists the legends, the map shows the lair, the fight shows its phases, the prize is banked on the way home, and the saves equal the rules layer\'s', async (t) => {
  if (!need(t)) return;
  const { startExpedition, move, enterFloor, returnHome, expeditionMap } = await import('../../sim/index.js');
  const { builtSave, pathTo } = await import('../../checks/expedition-bot.mjs');
  const start = builtSave(content, { heroLevel: 50, tier: 'heirloom', star: 5, ilvl: 50, withLines: true }, 4242); start.currency.hacksilver = 100000;
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start); await go(page, '#/hall');
  assert.match(await text(page, 'legend-fenris'), /Fenris.*from expedition level 10/); assert.match(await text(page, 'legend-chaos'), /sleeps \(beat 4 legends first\)/); assert.match(await text(page, 'legend-progress'), /0 of 4/);
  await go(page, '#/expedition');
  await page.selectOption('[data-testid=x-realm]', 'asgard'); await page.selectOption('[data-testid=x-level]', '12'); await page.fill('[data-testid=x-provisions]', '60'); await page.dispatchEvent('[data-testid=x-provisions]', 'change');
  assert.match(await text(page, 'x-lairs'), /Fenris, the Unchained Wolf \(3 phases\)/);
  await page.click('[data-testid=x-start]');
  let want = startExpedition(start, content, { realm: 'asgard', level: 12, provisions: 60 }).save;
  const ex = want.expedition, map = expeditionMap(ex, content), lair = map.sites.find((s) => s.lair), p = pathTo(map, content, ex.x, ex.y, lair.x, lair.y);
  assert.equal(await page.locator('.cell.lair').count(), 0, 'a lair is not shown until it is seen');
  for (const [x, y] of p.steps) { await page.click(`[data-testid="cell-${x}-${y}"]`); want = move(want, content, x, y).save; }
  await sameSave(page, want, 'at the lair');
  assert.equal(await page.locator('.cell.lair').count(), 1); assert.match(await text(page, 'lair-box'), /fights alone, in 3 phases \(Bound Fury, Snapped Chain, Wolf of Ragnarok\).*Fang of Fenris, a Legendary weapon/);
  await page.click('[data-testid=x-floor]'); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  const r = enterFloor(want, content); want = r.save; assert.equal(r.summary.outcome, 1);
  await page.waitForFunction((h) => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().hash === h, r.replay.hash);
  await page.waitForFunction(() => window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
  assert.match(await text(page, 'summary'), /Fenris, the Unchained Wolf is beaten.*Fang of Fenris is in the pack/);
  const log = await text(page, 'log'); assert.match(log, /enters a new phase: Snapped Chain/); assert.match(log, /enters a new phase: Wolf of Ragnarok/);
  await sameSave(page, want, 'after the fight');
  await page.click('[data-testid=to-map]'); await settle(page);
  assert.match(await text(page, 'x-pack'), /Fenris, the Unchained Wolf beaten/);
  await page.click('[data-testid=x-home]'); want = returnHome(want, content).save;
  await sameSave(page, want, 'banked'); assert.match(await text(page, 'beaten-fenris'), /Fang of Fenris is in your stash/);
  await go(page, '#/hall'); assert.match(await text(page, 'legend-fenris'), /beaten \(Fang of Fenris is yours\)/); assert.match(await text(page, 'legend-progress'), /1 of 4/);
  assert.equal(await page.evaluate(() => window.ThreeRealms.save().items.filter((i) => i.legend === 'fenris').length), 1);
  assert.deepEqual(problems, []);
  await context.close();
});

test('client: the replay viewer loads a replay file (a delve and a legend fight), verifies it, plays it, refuses damaged files with the reason, and never touches the save', async (t) => {
  if (!need(t)) return;
  const { createReplay, createFloorReplay, serializeReplay, buildHeroUnit, itemsById, indexContent } = await import('../../sim/index.js');
  const { builtSave } = await import('../../checks/expedition-bot.mjs');
  const partyOf = (s) => { const by = itemsById(s); return s.party.map((id) => buildHeroUnit(s.heroes.find((h) => h.id === id), by, content)); };
  const delve = createReplay({ realm: 'helheim', level: 6, seed: 31, party: partyOf(builtSave(content, { heroLevel: 9, tier: 'runed', star: 3, ilvl: 9, withLines: true }, 3)), setAllowed: false }, content);
  const fenris = createFloorReplay({ realm: 'asgard', level: 12, seed: 8, boss: true, legend: 'fenris', party: partyOf(builtSave(content, { heroLevel: 20, tier: 'runed', star: 3, ilvl: 15, withLines: true }, 5)), heroHp: null }, content);
  assert.ok(fenris.events.some((e) => e[0] === 15), 'the chosen fight reaches a second phase');
  const start = newGame(content, 31, { savedAt: '', build: 'client-test' });
  const { page, problems, context } = await openGame(browser, game.url);
  await importSave(page, start); const saved = withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText()));
  const load = async (text) => { await go(page, '#/replays'); await page.setInputFiles('[data-testid=replay-file]', { name: 'r.json', mimeType: 'application/json', buffer: Buffer.from(text) }); };
  await load(serializeReplay(delve)); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  assert.match(await text(page, 'verdict'), /^Verified/);
  await page.waitForFunction((h) => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().hash === h, delve.hash);
  await page.waitForFunction(() => window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
  assert.match(await text(page, 'summary'), /(Delve won|The party was lost)[\s\S]*encounters cleared \(as the file records it\)/); assert.match(await text(page, 'replay-hash'), new RegExp(delve.hash));
  assert.equal((await page.evaluate(() => window.ThreeRealms.battleState())).events, delve.events.length);
  await load(serializeReplay(fenris)); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  await page.waitForFunction(() => window.ThreeRealms.battleState() && window.ThreeRealms.battleState().cursor > 0); await page.click('[data-testid=skip]');
  assert.match(await text(page, 'verdict'), /^Verified/); assert.match(await text(page, 'log'), /enters a new phase: Snapped Chain/); assert.match(await text(page, 'summary'), /Fight won|The party was lost/); assert.match(await text(page, 'log'), /Floor (won|lost)/);
  // a damaged file: refused with the reason in one case, "not verified" but playable in another
  await load('{"format": "three-realms-replay"'); assert.match(await text(page, 'replay-msg'), /refused[\s\S]*not valid JSON/);
  const doc = JSON.parse(serializeReplay(delve)); doc.events.find((e) => e[0] === 4)[3] += 1;
  await load(JSON.stringify(doc)); await page.waitForFunction(() => location.hash === '#/battle'); await settle(page);
  assert.match(await text(page, 'verdict'), /Not verified[\s\S]*hash mismatch/); await page.click('[data-testid=skip]'); assert.match(await text(page, 'summary'), /Load another replay/);
  const raw = structuredClone(content.raw); raw.tables.legend.rewardMul = 7;
  await load(serializeReplay(createReplay({ realm: 'helheim', level: 6, seed: 31, party: delve.inputs.party, setAllowed: false }, indexContent(raw))));
  await page.waitForFunction(() => location.hash === '#/battle'); await settle(page); assert.match(await text(page, 'verdict'), /content mismatch[\s\S]*still plays/);
  assert.equal(withoutMeta(await page.evaluate(() => window.ThreeRealms.exportText())), saved, 'watching replays does not change the save');
  assert.deepEqual(problems, []);
  await context.close();
});
