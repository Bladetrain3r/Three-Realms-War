// Paints a figure into an offscreen canvas from its part list, and caches it. Deterministic: seeded by the id.
import { floats, hashString, newCanvas } from './color.js';
import { paint, groundShadow, inkLine } from './brush.js';
import { build, palOf } from './parts.js';
import { HEROES } from './heroes.js';
import { ARCHETYPE, SIGNATURE, SIZE, BOSS } from './monsters.js';

export const SHEET = { w: 200, h: 260 };
export const BOSS_SHEET = { w: 340, h: 400 };

function render(parts, realm, key, createRng, scale, sheet, quality) {
  const w = sheet.w * quality, h = sheet.h * quality, cv = newCanvas(w, h), ctx = cv.getContext('2d');
  ctx.scale(quality, quality);
  const f = floats(createRng, hashString(key));
  groundShadow(ctx, sheet.w / 2 + 4, 240 + sheet.h - 260, 50 * scale, f);
  const cx = 100, fy = 238;
  for (const raw of parts) {
    const p = build(raw, scale, cx, fy, sheet.w / 2 - 100, sheet.h - 260);
    if (p.line) { inkLine(ctx, p.line, p.col, Math.max(1, p.w), p.alpha); continue; }
    const pal = palOf(realm, p.role);
    paint(ctx, p.shape, pal, f, p.o || {});
  }
  return cv;
}

const cache = new Map();
function cached(key, make) { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; }
export function clearArtCache() { cache.clear(); }

// quality = 1 gives 200 x 260 pixels per figure; higher for large displays.
export function heroSprite(createRng, classId, realm, quality = 1) {
  return cached(`h:${classId}:${realm}:${quality}`, () => {
    const mk = HEROES[classId]; if (!mk) throw new Error(`no figure for hero class ${classId}`);
    return render(mk(), realm, classId, createRng, 1, SHEET, quality);
  });
}
export function monsterSprite(createRng, monster, quality = 1) {
  return cached(`m:${monster.id}:${quality}`, () => {
    const sig = SIGNATURE[monster.id], mk = sig || ARCHETYPE[monster.archetype]; if (!mk) throw new Error(`no figure for monster ${monster.id}`);
    const size = (SIZE[monster.archetype] || 1) * (monster.signature ? 1.18 : 1);
    return render(mk(monster.realm), monster.realm, monster.id, createRng, size, SHEET, quality);
  });
}
export function bossSprite(createRng, boss, quality = 1) {
  return cached(`b:${boss.id}:${quality}`, () => {
    const mk = BOSS[boss.id]; if (!mk) throw new Error(`no figure for boss ${boss.id}`);
    return render(mk(boss.realm), boss.realm, boss.id, createRng, 1.4, BOSS_SHEET, quality);
  });
}
