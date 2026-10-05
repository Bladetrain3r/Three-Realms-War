// Monsters: 8 archetype body plans x 3 realm skins, plus winged / wraith plans for signature creatures, and the three lords.
// Same 200 x 260 sheet, facing right (the renderer flips them to face left).
import { e, c, pg, ln } from './parts.js';
import { hex } from './color.js';

const GLOW = { midgard: hex('#ffd36a'), asgard: hex('#f6fbff'), helheim: hex('#e3fbf6') };
const eyes = (x, y) => [e(x, y, 2.6, 2, 'glow', 0, { density: 30 }), e(x + 9, y + 1, 2.6, 2, 'glow', 0, { density: 30 })];
// the realm's mark on the body: embers and cracks, sparks, or trailing mist
function mark(realm, cx, cy, w, h) {
  if (realm === 'midgard') return [ln([[cx - w * 0.4, cy - h * 0.3], [cx - w * 0.1, cy], [cx - w * 0.3, cy + h * 0.3]], GLOW.midgard, 2.4, 0.9), ln([[cx + w * 0.1, cy - h * 0.2], [cx + w * 0.35, cy + h * 0.1]], GLOW.midgard, 2, 0.8), e(cx + w * 0.5, cy - h * 0.7, 3, 3, 'glow', 0, { density: 12 })];
  if (realm === 'asgard') return [ln([[cx - w * 0.6, cy - h * 0.8], [cx - w * 0.3, cy - h * 0.5], [cx - w * 0.5, cy - h * 0.4], [cx - w * 0.1, cy]], GLOW.asgard, 2.2, 0.9), ln([[cx + w * 0.5, cy - h * 0.6], [cx + w * 0.7, cy - h * 0.3]], GLOW.asgard, 2, 0.8)];
  return [pg([[cx - w * 0.5, cy + h * 0.5], [cx - w * 0.8, cy + h * 0.9], [cx - w * 0.3, cy + h * 0.75], [cx, cy + h]], 'glow', { density: 1.2, grain: 0.25 })];
}
const horns = (x, y, s = 1) => [c(x - 10 * s, y, x - 22 * s, y - 22 * s, 4 * s, 1.5, 'bone'), c(x + 10 * s, y, x + 20 * s, y - 20 * s, 4 * s, 1.5, 'bone')];
const legs = (r = 10) => [c(90, 164, 84, 232, r, r - 2, 'mon'), c(112, 164, 118, 232, r, r - 2, 'mon'), e(82, 236, 12, 5, 'dark'), e(120, 236, 12, 5, 'dark')];

const brute = (r) => [...legs(12), e(100, 130, 34, 40, 'mon', 0, { flow: 'form' }), e(102, 98, 42, 16, 'mon'), e(112, 74, 17, 16, 'mon'), ...horns(112, 64), ...eyes(110, 72), c(78, 100, 64, 152, 13, 11, 'mon'), c(128, 100, 150, 150, 13, 11, 'mon'), e(62, 156, 11, 11, 'mon'), c(150, 150, 168, 78, 6, 11, 'wood'), e(170, 70, 17, 15, 'wood'), ...mark(r, 100, 130, 60, 60)];
const guard = (r) => [...legs(12), e(98, 130, 32, 40, 'mon', 0, { flow: 'form' }), e(100, 100, 40, 14, 'mon'), e(106, 76, 16, 15, 'mon'), pg([[90, 66], [122, 66], [118, 84], [94, 84]], 'metal'), ...eyes(110, 74), c(124, 102, 142, 146, 12, 10, 'mon'), pg([[126, 70], [164, 66], [168, 170], [146, 204], [124, 170]], 'metal', { flow: 'form' }), e(146, 130, 10, 10, 'trim'), c(76, 100, 68, 144, 11, 9, 'mon'), ...mark(r, 98, 130, 56, 56)];
const skirmisher = (r) => [c(92, 168, 70, 232, 8, 6, 'mon'), c(112, 168, 130, 232, 8, 6, 'mon'), e(68, 236, 11, 5, 'dark'), e(134, 236, 11, 5, 'dark'), e(104, 134, 24, 32, 'mon', 0.25, { flow: 'form' }), e(116, 96, 14, 14, 'mon'), pg([[108, 90], [134, 98], [110, 112]], 'mon'), ...eyes(114, 92), c(124, 118, 160, 134, 6, 4, 'mon'), pg([[160, 134], [182, 132], [162, 142]], 'bone'), c(84, 116, 62, 150, 6, 4, 'mon'), pg([[62, 150], [50, 172], [70, 156]], 'bone'), ...mark(r, 102, 134, 44, 50)];
const archer = (r) => [...legs(8), e(100, 128, 24, 36, 'mon'), e(100, 100, 28, 11, 'mon'), e(106, 72, 14, 15, 'mon'), pg([[90, 66], [106, 40], [122, 66], [118, 82], [96, 82]], 'trim'), ...eyes(108, 72), c(124, 102, 134, 128, 7, 6, 'mon'), ln([[134, 66], [152, 96], [154, 128], [152, 160], [134, 190]], hex('#6b4425'), 4), ln([[134, 66], [130, 128], [134, 190]], hex('#e8e0c8'), 1, 0.8), ...mark(r, 100, 128, 44, 50)];
const caster = (r) => [pg([[84, 98], [116, 98], [128, 228], [72, 232]], 'mon', { flow: 'axis' }), e(100, 100, 30, 11, 'mon'), e(106, 72, 14, 15, 'mon'), pg([[88, 64], [106, 30], [126, 64]], 'trim'), ...eyes(108, 72), c(122, 104, 142, 122, 7, 6, 'mon'), e(150, 112, 14, 14, 'glow', 0, { density: 9, grain: 0.05 }), e(150, 112, 26, 26, 'glow', 0, { density: 1.5, grain: 0.2 }), ...mark(r, 100, 160, 40, 50)];
const healer = (r) => [pg([[84, 98], [116, 98], [128, 228], [72, 232]], 'trim', { flow: 'axis' }), e(100, 100, 28, 11, 'trim'), e(106, 72, 14, 15, 'mon'), pg([[88, 66], [106, 44], [124, 66], [122, 82], [90, 82]], 'trim'), ...eyes(108, 72), c(122, 104, 136, 130, 7, 6, 'mon'), c(134, 220, 142, 50, 3, 3, 'wood'), e(142, 44, 10, 10, 'glow', 0, { density: 9 }), pg([[130, 40], [142, 26], [154, 40], [142, 58]], 'glow', { density: 1.5, grain: 0.2 }), ...mark(r, 100, 160, 36, 40)];
const hexer = (r) => [pg([[80, 92], [120, 92], [134, 230], [68, 234]], 'mon', { flow: 'axis' }), e(106, 70, 17, 18, 'mon'), pg([[84, 80], [102, 38], [128, 76], [122, 96], [92, 96]], 'dark'), e(110, 76, 9, 10, 'dark'), ...eyes(106, 76), c(120, 104, 142, 90, 6, 5, 'mon'), e(154, 70, 10, 10, 'glow', 0, { density: 9 }), ln([[146, 54], [162, 60], [154, 76], [166, 84]], GLOW[r], 2.4, 0.9), ...mark(r, 100, 170, 40, 40)];
const striker = (r) => [...legs(8), e(100, 130, 26, 36, 'mon'), e(100, 102, 30, 11, 'mon'), e(108, 76, 14, 14, 'mon'), pg([[96, 62], [122, 62], [118, 78], [100, 78]], 'dark'), ...eyes(110, 74), c(124, 102, 140, 134, 8, 6, 'mon'), c(138, 134, 146, 84, 3.4, 1.2, 'steel'), c(80, 104, 66, 140, 8, 6, 'mon'), c(64, 140, 58, 104, 3, 1.2, 'steel'), ...mark(r, 100, 130, 46, 50)];
// signature plans
const winged = (r) => [e(96, 140, 38, 22, 'mon', -0.15, { flow: 'form' }), e(138, 112, 16, 13, 'mon'), pg([[148, 110], [180, 118], [150, 124]], 'bone'), ...eyes(138, 108), pg([[80, 124], [40, 56], [66, 44], [96, 82], [120, 120]], 'mon', { flow: 0.9 }), pg([[90, 132], [50, 96], [38, 128], [70, 150]], 'trim', { flow: 0.4 }), c(62, 148, 24, 186, 8, 2, 'mon'), c(100, 158, 96, 190, 4, 3, 'bone'), c(112, 158, 114, 190, 4, 3, 'bone'), ...mark(r, 96, 140, 60, 40)];
const wraith = (r) => [pg([[82, 90], [118, 90], [150, 200], [120, 240], [100, 214], [78, 244], [50, 196]], 'mon', { flow: 'axis' }), e(102, 70, 17, 19, 'mon'), e(106, 72, 9, 11, 'dark'), ...eyes(102, 70), e(118, 120, 20, 5, 'mon', 0.5), c(116, 112, 150, 94, 7, 6, 'mon'), e(158, 88, 12, 12, 'glow', 0, { density: 9 }), e(158, 88, 22, 22, 'glow', 0, { density: 1.5, grain: 0.2 }), ...mark(r, 100, 150, 50, 50)];
const banshee = (r) => [pg([[84, 88], [116, 88], [120, 160], [150, 210], [100, 250], [60, 216], [86, 160]], 'trim', { flow: 'axis' }), e(100, 68, 15, 18, 'bone'), e(104, 76, 5, 8, 'dark'), pg([[84, 56], [60, 100], [82, 80]], 'mon'), pg([[116, 56], [140, 100], [118, 80]], 'mon'), c(84, 100, 54, 130, 6, 3, 'bone'), c(116, 100, 150, 126, 6, 3, 'bone'), ...mark(r, 100, 150, 50, 50)];

export const ARCHETYPE = { brute, guard, skirmisher, archer, caster, healer, hexer, striker };
export const SIGNATURE = { midgard_drake_whelp: winged, asgard_storm_raven: winged, helheim_banshee: banshee, midgard_forge_wraith: wraith, asgard_jotunn_stormcaller: wraith, helheim_frost_wight: wraith };
// relative size on the sheet (scale about the feet)
export const SIZE = { brute: 1.0, guard: 1.0, skirmisher: 0.85, archer: 0.9, caster: 0.95, healer: 0.9, hexer: 0.95, striker: 0.9 };

// the lords: bigger sheet 300 x 340 (see figures.js)
export const BOSS = {
  surtr: (r) => [...legs(15), e(100, 130, 42, 50, 'mon', 0, { flow: 'form' }), e(102, 92, 54, 20, 'mon'), e(108, 62, 22, 20, 'mon'), ...horns(108, 50, 1.7), pg([[88, 34], [96, 6], [108, 24], [118, 2], [128, 34]], 'glow', { density: 2 }), ...eyes(106, 60), c(70, 96, 56, 156, 16, 13, 'mon'), c(138, 96, 160, 140, 16, 13, 'mon'), c(158, 146, 196, 30, 5, 8, 'steel'), pg([[190, 30], [214, 56], [200, 150], [170, 154]], 'glow', { density: 2, grain: 0.1 }), ...mark('midgard', 100, 130, 80, 80), ...mark('midgard', 100, 170, 60, 60)],
  thrym: (r) => [...legs(15), e(100, 132, 42, 50, 'mon', 0, { flow: 'form' }), e(102, 92, 54, 20, 'trim'), e(108, 62, 22, 20, 'mon'), pg([[84, 56], [112, 22], [140, 56], [132, 76], [90, 76]], 'trim'), ...horns(108, 40, 1.4), ...eyes(106, 60), c(70, 96, 56, 156, 16, 13, 'mon'), c(138, 96, 162, 130, 16, 13, 'mon'), c(160, 130, 190, 20, 4, 6, 'wood'), pg([[168, 8], [226, 4], [226, 52], [168, 56]], 'steel'), ...mark('asgard', 100, 130, 90, 90)],
  garm: (r) => [c(60, 170, 56, 236, 11, 8, 'mon'), c(86, 170, 90, 236, 11, 8, 'mon'), c(130, 170, 138, 236, 11, 8, 'mon'), c(152, 168, 164, 236, 11, 8, 'mon'), e(110, 140, 58, 32, 'mon', -0.05, { flow: 'form' }), c(150, 124, 172, 86, 22, 17, 'mon'), e(184, 76, 24, 20, 'mon'), pg([[196, 74], [226, 84], [200, 100], [186, 94]], 'mon'), pg([[196, 98], [214, 108], [196, 108]], 'bone'), pg([[172, 56], [178, 28], [190, 56]], 'mon'), pg([[154, 62], [150, 34], [168, 54]], 'mon'), ...eyes(186, 70), c(56, 130, 22, 94, 9, 4, 'mon'), ...mark('helheim', 110, 140, 90, 50), e(206, 122, 14, 14, 'glow', 0, { density: 3, grain: 0.2 })],
};

// the legendary bosses (DESIGN.md 10.7): same 340 x 400 sheet as the lords, each in a palette of its own realm
export const LEGEND_REALM = { fenris: 'helheim', jormungandr: 'midgard', ymir: 'helheim', beowulf: 'midgard', odin: 'asgard', chaos: 'helheim' };
const links = (x0, y0, x1, y1, n) => { const out = []; for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n + (i % 2 ? 4 : -4), y0 + ((y1 - y0) * i) / n]); return ln(out, hex('#8a8c8f'), 3.4, 0.95); };
Object.assign(BOSS, {
  // a great wolf with the broken chain still on his neck, jaws open
  fenris: (r) => [c(52, 170, 44, 238, 12, 8, 'mon'), c(84, 172, 88, 238, 12, 8, 'mon'), c(128, 172, 138, 238, 12, 8, 'mon'), c(156, 168, 170, 238, 12, 8, 'mon'),
    pg([[36, 120], [14, 84], [44, 100], [60, 126]], 'mon'), e(108, 142, 66, 34, 'mon', -0.05, { flow: 'form' }),
    pg([[70, 110], [78, 92], [88, 108], [98, 88], [108, 106], [120, 86], [128, 106]], 'dark'),
    c(150, 128, 178, 88, 26, 19, 'mon'), e(188, 78, 27, 21, 'mon'), pg([[200, 70], [236, 78], [204, 90]], 'mon'), pg([[200, 94], [232, 112], [204, 104]], 'mon'),
    pg([[206, 90], [210, 100], [214, 90]], 'bone'), pg([[218, 90], [222, 100], [226, 90]], 'bone'), pg([[212, 74], [216, 66], [220, 74]], 'bone'),
    pg([[174, 62], [180, 30], [194, 58]], 'mon'), pg([[160, 70], [150, 40], [172, 64]], 'mon'), ...eyes(190, 74),
    links(178, 100, 150, 150, 6), links(150, 150, 120, 226, 6), e(118, 232, 9, 5, 'steel'),
    ...mark(r, 108, 142, 80, 44), e(236, 124, 8, 8, 'glow', 0, { density: 3, grain: 0.2 })],
  // the world-serpent: stacked coils, the head high with fangs bared
  jormungandr: (r) => [e(104, 226, 82, 20, 'mon', 0, { flow: 'form' }), e(96, 198, 68, 18, 'mon', 0.04), e(110, 172, 58, 17, 'mon', -0.05), e(98, 148, 46, 15, 'mon'),
    c(100, 140, 132, 104, 20, 15, 'mon'), c(132, 104, 150, 70, 15, 13, 'mon'), e(160, 56, 27, 19, 'mon', -0.15), pg([[174, 50], [212, 62], [176, 72]], 'mon'),
    pg([[184, 66], [190, 90], [196, 66]], 'bone'), pg([[170, 68], [174, 88], [182, 68]], 'bone'), ...eyes(166, 50),
    ln([[210, 62], [226, 58], [218, 70], [236, 70]], hex('#b0332a'), 2.4, 0.95),
    ln([[40, 220], [60, 206], [40, 196], [64, 184]], hex('#2a1d12'), 2, 0.5), ln([[150, 226], [168, 214], [150, 200]], hex('#2a1d12'), 2, 0.5),
    ...mark(r, 104, 198, 90, 40), ...mark(r, 110, 160, 60, 40)],
  // the first giant, rimed over, an ice-club in one hand and a crown of icicles
  ymir: (r) => [...legs(17), e(100, 128, 50, 56, 'mon', 0, { flow: 'form' }), e(102, 90, 62, 22, 'mon'), e(108, 56, 25, 22, 'mon'),
    pg([[84, 40], [90, 4], [100, 32], [110, -2], [118, 30], [130, 4], [132, 40]], 'glow', { density: 2, grain: 0.1 }),
    pg([[88, 66], [96, 98], [104, 70], [112, 104], [120, 70], [128, 94], [130, 62]], 'bone'), ...eyes(106, 54),
    c(64, 96, 40, 20, 18, 14, 'mon'), c(144, 96, 168, 150, 18, 14, 'mon'), c(164, 150, 210, 36, 7, 12, 'steel'), pg([[196, 36], [226, 14], [240, 60], [208, 82]], 'glow', { density: 2, grain: 0.1 }),
    ...mark(r, 100, 128, 90, 80), ...mark(r, 100, 176, 70, 60)],
  // the Geat-king: a mailed man with a round shield and a long sword, cloak streaming
  beowulf: (r) => [pg([[66, 96], [150, 96], [160, 200], [120, 236], [56, 224]], 'trim', { flow: 'axis' }), ...legs(12),
    e(100, 132, 36, 42, 'metal', 0, { flow: 'form' }), e(100, 100, 44, 15, 'metal'), e(108, 72, 17, 16, 'skin'), pg([[90, 66], [108, 44], [128, 66], [124, 78], [92, 78]], 'metal'), pg([[104, 66], [110, 66], [110, 86], [104, 86]], 'metal'),
    ...eyes(111, 72), ln([[94, 80], [100, 98], [108, 100], [116, 98], [122, 80]], hex('#efe8d0'), 3, 0.8),
    c(76, 100, 60, 150, 12, 10, 'metal'), e(56, 146, 36, 40, 'metal', 0, { flow: 'form' }), e(56, 146, 12, 12, 'trim'), c(128, 100, 156, 90, 12, 10, 'metal'), c(154, 92, 176, 6, 4, 6, 'steel'), pg([[168, 8], [184, 0], [186, 14], [176, 20]], 'steel'),
    ...mark(r, 100, 130, 50, 50)],
  // the Allfather: broad hat, grey beard, one eye aglow, a spear, ravens at the shoulder
  odin: (r) => [pg([[62, 92], [138, 92], [158, 232], [110, 246], [52, 234]], 'cloth', { flow: 'axis' }), pg([[60, 98], [26, 150], [48, 180], [74, 130]], 'cloth'),
    e(100, 98, 40, 14, 'cloth'), e(104, 72, 16, 17, 'skin'), pg([[84, 62], [100, 56], [126, 62], [140, 74], [60, 74]], 'dark'), pg([[92, 62], [104, 28], [118, 62]], 'dark'),
    pg([[88, 80], [98, 150], [108, 164], [118, 150], [124, 80]], 'white', { flow: 'axis' }), e(112, 70, 3.4, 3, 'glow', 0, { density: 20 }), e(100, 70, 4, 3, 'dark'),
    c(126, 102, 146, 120, 8, 7, 'cloth'), c(154, 250, 150, 6, 3.6, 3.6, 'wood'), pg([[142, 14], [150, -14], [158, 14], [150, 24]], 'steel'),
    pg([[56, 80], [38, 62], [60, 68], [74, 86]], 'dark'), pg([[150, 62], [166, 44], [158, 70]], 'dark'), e(150, 92, 5, 4, 'glow', 0, { density: 9 }),
    ...mark(r, 100, 170, 60, 80)],
  // Chaos: no body, only a void with a rim of light, too many eyes and a mouth that is a tear
  chaos: (r) => [e(100, 140, 92, 100, 'glow', 0, { density: 1.2, grain: 0.3 }), e(100, 140, 78, 86, 'dark', 0, { flow: 'form' }), e(100, 140, 52, 60, 'mon', 0.2, { density: 1.4, grain: 0.2 }),
    pg([[30, 140], [8, 90], [40, 110], [56, 60], [70, 100]], 'dark'), pg([[170, 140], [196, 80], [160, 108], [146, 56], [136, 100]], 'dark'),
    pg([[60, 220], [40, 250], [76, 232], [86, 258], [100, 232], [116, 258], [126, 232], [160, 250], [140, 220]], 'dark'),
    e(100, 120, 30, 8, 'glow', 0, { density: 30 }), e(70, 96, 6, 5, 'glow', 0, { density: 30 }), e(130, 96, 6, 5, 'glow', 0, { density: 30 }), e(84, 150, 5, 4, 'glow', 0, { density: 30 }), e(120, 150, 5, 4, 'glow', 0, { density: 30 }), e(100, 78, 5, 4, 'glow', 0, { density: 30 }),
    pg([[56, 168], [100, 150], [146, 168], [100, 200]], 'dark'), pg([[70, 170], [100, 162], [130, 170], [100, 188]], 'glow', { density: 2, grain: 0.1 }),
    ln([[8, 150], [40, 160], [30, 190], [60, 200]], GLOW[r], 2.4, 0.8), ln([[192, 150], [160, 164], [172, 192], [140, 204]], GLOW[r], 2.4, 0.8),
    ln([[100, 36], [90, 10], [104, 0]], GLOW[r], 2.4, 0.8), ln([[100, 36], [116, 12], [108, -4]], GLOW[r], 2.4, 0.8)],
});
