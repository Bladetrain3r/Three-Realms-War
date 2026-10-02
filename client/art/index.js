// The art engine's front door: every asset is made once from a constant seed and cached. Nothing here reads Math.random or the clock.
import { createRng } from '../../sim/prng.js';
import { heroSprite, monsterSprite, bossSprite, SHEET, BOSS_SHEET, clearArtCache } from './figures.js';
import { paintBackdrop, BACKDROP } from './backdrop.js';
import { vellumTile, vellumSheet } from './paper.js';
import { frameTile, hatchTile, inkTile, ruleStrip, dataURL } from './woodcut.js';
import { drawRune } from './runes.js';

const memo = new Map();
const once = (k, make) => { let v = memo.get(k); if (!v) { v = make(); memo.set(k, v); } return v; };

export const Art = {
  SHEET, BOSS_SHEET, BACKDROP,
  hero: (cls) => heroSprite(createRng, cls.id, cls.realm),
  monster: (m) => monsterSprite(createRng, m),
  boss: (b) => bossSprite(createRng, b),
  backdrop: (realm) => once(`bd:${realm}`, () => paintBackdrop(createRng, realm)),
  sheet: (w, h, seed = 3) => once(`sh:${w}x${h}:${seed}`, () => vellumSheet(createRng, seed, w, h)),
  vellumURL: () => once('u:vellum', () => dataURL(vellumTile(createRng, 11))),
  frameURL: () => once('u:frame', () => dataURL(frameTile(createRng, 21))),
  hatchURL: (dir = Math.PI / 4) => once(`u:hatch:${dir}`, () => dataURL(hatchTile(createRng, 31, 64, 5, dir))),
  inkURL: () => once('u:ink', () => dataURL(inkTile(createRng, 41))),
  ruleURL: () => once('u:rule', () => dataURL(ruleStrip(createRng, 51))),
  rune: drawRune,
  clear() { clearArtCache(); memo.clear(); },
};
