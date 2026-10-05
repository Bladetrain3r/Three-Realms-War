// Helpers shared by the browser tests and the screenshot script: build the page once, open it from file://, collect console errors.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '../../tools/bundle.mjs';
import { findChromium } from './chromium.mjs';

export function buildGame(label = 'test') {
  const out = mkdtempSync(join(tmpdir(), 'dist-')); const r = build({ out, build: label });
  return { out, url: pathToFileURL(join(out, 'index.html')).href, bytes: r.bytes };
}
export async function launch() {
  const exe = findChromium(); if (!exe) return null;
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--enable-precise-memory-info'] });
}
// Opens the game in a fresh browser context (own localStorage). Returns { page, problems }.
// timer: false (default) switches the activity timer off; a number of milliseconds turns it on at that speed.
export async function openGame(browser, url, { width = 1280, height = 800, reducedMotion = 'no-preference', timer = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion }), page = await context.newPage(), problems = [];
  await page.addInitScript((prefs) => { try { if (!localStorage.getItem('three-realms.prefs.v1')) localStorage.setItem('three-realms.prefs.v1', JSON.stringify(prefs)); } catch (e) { /* no storage */ } }, timer ? { timerMs: timer } : { noTimer: true });
  page.on('pageerror', (e) => problems.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.ThreeRealms && window.ThreeRealms.ready, null, { timeout: 30000 });
  await settle(page);
  return { page, problems, context };
}
export const settle = (page) => page.evaluate(() => window.ThreeRealms.idle && window.ThreeRealms.idle());
export async function go(page, hash) { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForFunction((h) => location.hash === h, hash); await settle(page); }
