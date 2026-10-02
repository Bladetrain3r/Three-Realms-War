// The 15 hero classes as part lists on a 200 x 260 sheet, facing right, feet on y = 238. Silhouette first: each class has its own
// head, build and prop, and wears its realm's cloth and trim.
import { e, c, pg, ln } from './parts.js';
import { hex } from './color.js';

const INK = hex('#14100c');
const legs = (r = 9, role = 'leather') => [c(92, 160, 88, 232, r, r - 2, role), c(110, 160, 114, 232, r, r - 2, role), e(86, 236, 11, 5, 'dark'), e(118, 236, 11, 5, 'dark')];
const robe = (w = 30, role = 'cloth') => [pg([[100 - w * 0.6, 98], [100 + w * 0.6, 98], [100 + w + 6, 234], [100 - w - 6, 234]], role, { flow: 'axis' })];
const body = (w, role) => pg([[100 - w - 5, 100], [100 + w + 5, 100], [100 + w, 140], [100 + w - 5, 172], [100 - w + 5, 172], [100 - w, 140]], role, { flow: 'axis' });
const torso = (w = 24, role = 'cloth') => [body(w, role), e(100, 101, w + 6, 11, role), ln([[100 - w + 4, 160], [100 + w - 4, 160]], INK, 3.5, 0.55)];
const face = (x, y) => [ln([[x + 3, y - 3], [x + 8, y - 4]], INK, 2, 0.7), ln([[x + 12, y - 3], [x + 16, y - 3]], INK, 2, 0.55), e(x + 6, y, 1.6, 1.3, 'dark'), e(x + 14, y, 1.4, 1.2, 'dark'), ln([[x + 8, y + 8], [x + 13, y + 8]], INK, 1.6, 0.5)];
const head = (x = 104, y = 74) => [c(x - 3, y + 8, x - 3, y + 26, 6.5, 8, 'skin'), e(x, y, 15, 17, 'skin'), ...face(x - 2, y + 1)];
const arms = (role = 'cloth', hand = [138, 142]) => [c(78, 102, 72, 148, 7, 6, role), c(124, 102, hand[0], hand[1], 7, 6, role), e(hand[0], hand[1], 6, 6, 'skin'), e(72, 150, 6, 6, 'skin')];
const helm = (x = 104, y = 64, role = 'steel') => [e(x, y - 2, 16, 13, role), pg([[x - 16, y - 2], [x + 16, y - 2], [x + 12, y + 8], [x - 12, y + 8]], role)];
const hood = (x = 104, y = 68, role = 'cloth') => [pg([[x - 20, y + 26], [x - 18, y - 8], [x, y - 24], [x + 18, y - 8], [x + 20, y + 26], [x + 6, y + 14], [x - 6, y + 14]], role), e(x + 4, y + 2, 9, 11, 'dark')];
const sword = (x, y, len = 78) => [c(x, y + 6, x + 6, y - len, 3.5, 1.6, 'steel'), c(x - 12, y - 4, x + 14, y - 8, 2.6, 2.6, 'wood'), c(x, y + 4, x, y + 20, 3, 3, 'leather')];
const spear = (x, y, len = 150) => [c(x - 6, y + 70, x + 5, y - len + 70, 2.4, 2.4, 'wood'), pg([[x + 5, y - len + 74], [x + 10, y - len + 50], [x + 5, y - len + 40], [x, y - len + 50]], 'steel')];
const staff = (x, y, glow = true) => [c(x - 4, y + 80, x + 6, y - 90, 3, 2.6, 'wood'), ...(glow ? [e(x + 6, y - 98, 9, 9, 'glow', 0, { density: 9, grain: 0.05 }), e(x + 6, y - 98, 15, 15, 'glow', 0, { density: 1.5, grain: 0.2 })] : [])];
const roundShield = (x, y, r = 24) => [e(x, y, r, r, 'cloth'), e(x, y, r * 0.55, r * 0.55, 'trim'), e(x, y, r * 0.2, r * 0.2, 'steel')];
const bow = (x, y) => [ln([[x + 6, y - 60], [x + 22, y - 30], [x + 24, y], [x + 22, y + 30], [x + 6, y + 60]], hex('#6b4425'), 4), ln([[x + 6, y - 60], [x + 2, y], [x + 6, y + 60]], hex('#e8e0c8'), 1, 0.8)];
const axe = (x, y, big = 1) => [c(x - 6, y + 40, x + 12, y - 70 * big, 2.8, 2.8, 'wood'), pg([[x + 8, y - 70 * big], [x + 38 * big, y - 82 * big], [x + 34 * big, y - 38 * big], [x + 10, y - 44 * big]], 'steel')];
const wing = (side) => { const s = side; return [pg([[100 + s * 14, 100], [100 + s * 70, 40], [100 + s * 88, 70], [100 + s * 70, 100], [100 + s * 78, 132], [100 + s * 20, 128]], 'white', { flow: 0.8 }), ln([[100 + s * 20, 104], [100 + s * 70, 50]], hex('#b8ad8c'), 2, 0.7)]; };
const cloak = () => [pg([[78, 100], [66, 232], [118, 236], [100, 100]], 'trim', { flow: 'axis' })];
const horns = (x = 104, y = 56, role = 'bone') => [c(x - 12, y + 2, x - 24, y - 16, 3.5, 1.5, role), c(x + 12, y + 2, x + 24, y - 16, 3.5, 1.5, role)];
const crest = () => [pg([[96, 50], [104, 30], [114, 34], [112, 52]], 'trim')];
const hair = () => [pg([[88, 66], [86, 90], [96, 80], [118, 84], [120, 62], [104, 50]], 'fur')];

export const HEROES = {
  shieldwarden: () => [...legs(10), ...cloak(), ...torso(28), ...head(), ...helm(), ...crest(), ...arms('cloth', [136, 144]), ...sword(142, 138, 60), pg([[112, 100], [148, 96], [146, 150], [128, 186], [112, 150]], 'cloth', { flow: 'form' }), e(130, 136, 8, 8, 'steel')],
  huscarl: () => [...legs(), ...torso(26), ...head(), ...helm(104, 64, 'steel'), ...arms('cloth', [136, 142]), ...sword(142, 138), c(78, 104, 66, 142, 8, 7, 'steel')],
  hunter: () => [...legs(8), ...torso(21), ...hood(), ...arms('leather', [132, 128]), ...bow(132, 126), pg([[70, 90], [60, 130], [70, 136], [80, 100]], 'leather')],
  hearthkeeper: () => [...robe(26), ...head(), e(104, 62, 17, 10, 'trim'), ...arms('cloth', [136, 138]), ...staff(142, 138), pg([[84, 112], [116, 112], [112, 126], [88, 126]], 'trim')],
  berserker: () => [...legs(10, 'fur'), body(28, 'skin'), e(100, 101, 34, 12, 'skin'), ...head(), ...hair(), ...horns(), ...arms('skin', [136, 140]), ...axe(142, 138, 1.25), ln([[88, 120], [96, 128], [90, 136]], hex('#9e2b25'), 2.5, 0.8)],
  einherjar: () => [...legs(), ...torso(26, 'trim'), ...head(), ...helm(104, 64, 'steel'), ...arms('trim', [136, 144]), ...spear(142, 140), ...roundShield(70, 134, 24)],
  stormcaller: () => [...robe(27), ...head(), pg([[86, 58], [104, 12], [124, 58]], 'cloth'), e(104, 58, 20, 6, 'cloth'), ...arms('cloth', [138, 132]), ...staff(144, 132), ln([[50, 70], [64, 82], [56, 90], [72, 104]], hex('#f6fbff'), 2.2, 0.85)],
  skald: () => [...robe(24, 'trim'), ...head(), e(104, 60, 17, 8, 'cloth'), ...arms('trim', [134, 134]), pg([[116, 120], [150, 100], [158, 126], [132, 150]], 'wood', { flow: 'form' }), ln([[122, 116], [150, 118]], hex('#e8e0c8'), 1.2), ln([[126, 126], [152, 108]], hex('#e8e0c8'), 1.2)],
  skyrider: () => [...legs(8), ...torso(20), ...hood(104, 70, 'trim'), pg([[70, 96], [30, 70], [26, 110], [58, 128]], 'trim', { flow: 'axis' }), ...arms('cloth', [136, 136]), ...sword(142, 136, 40), pg([[78, 100], [56, 150], [74, 156]], 'cloth')],
  valkyrie: () => [...wing(-1), ...wing(1).slice(0, 1), ...legs(), ...torso(22, 'trim'), ...head(), ...helm(104, 64, 'steel'), pg([[92, 56], [66, 36], [84, 62]], 'white'), pg([[116, 56], [142, 36], [124, 62]], 'white'), ...arms('trim', [136, 144]), ...spear(142, 140, 160), ...roundShield(70, 132, 20)],
  draugr_knight: () => [...legs(10, 'steel'), ...torso(30, 'steel'), e(100, 100, 40, 14, 'steel'), ...head(), e(104, 66, 17, 17, 'steel'), ...horns(104, 60, 'bone'), ...arms('steel', [136, 144]), ...sword(142, 138, 74), pg([[112, 110], [150, 106], [146, 170], [130, 190], [112, 160]], 'trim', { flow: 'form' }), pg([[84, 108], [60, 160], [72, 232], [100, 232]], 'cloth')],
  volva: () => [...robe(25, 'cloth'), ...head(), ...hood(), ...arms('cloth', [136, 132]), ...staff(144, 132, false), ln([[144, 40], [152, 54], [144, 66]], hex('#e3fbf6'), 2.5, 0.9), ln([[136, 46], [148, 46]], hex('#e3fbf6'), 2.5, 0.9), e(150, 96, 8, 8, 'glow', 0, { density: 9 })],
  ghoul_reaver: () => [...legs(10, 'fur'), body(30, 'skin'), e(100, 102, 36, 13, 'skin'), ...head(106, 78), ...horns(106, 62), c(78, 102, 62, 156, 10, 9, 'skin'), c(126, 102, 150, 150, 10, 9, 'skin'), pg([[150, 150], [172, 160], [166, 176], [146, 168]], 'bone'), pg([[62, 156], [44, 172], [58, 178], [70, 166]], 'bone'), ln([[90, 116], [110, 126]], hex('#9e2b25'), 2.5, 0.8)],
  rime_mender: () => [...robe(26), ...head(), ...hood(104, 68, 'trim'), ...arms('cloth', [136, 138]), ...staff(142, 138), e(98, 116, 7, 7, 'glow', 0, { density: 9 })],
  wraith_hunter: () => [...legs(7, 'dark'), ...torso(19, 'dark'), ...hood(104, 70, 'dark'), pg([[78, 100], [60, 232], [100, 236], [96, 110]], 'dark', { flow: 'axis' }), ...arms('dark', [134, 130]), ...bow(134, 128), e(108, 72, 3, 2.5, 'glow', 0, { density: 20 })],
};
export { INK };
