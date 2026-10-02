// Palettes and the part vocabulary shared by hero and monster figures. A part is a recipe (e/c/pg) or a line (ln).
import { hex } from './color.js';
import { ell, cap, poly } from './brush.js';

const P = (d, m, l) => ({ dark: hex(d), mid: hex(m), light: hex(l) });
export const REALM = {
  midgard: { cloth: P('#4a1a12', '#b8442a', '#e07a52'), trim: P('#2f4a37', '#4f7a5a', '#8fb592'), glow: P('#7a2410', '#e0682a', '#ffd36a'), skin: P('#4a2e22', '#a8714f', '#d9a57e'), mon: P('#2a1612', '#6b3a2c', '#b0705a'), metal: P('#2e2622', '#7a6a60', '#c9b9a8') },
  asgard: { cloth: P('#1b2f5a', '#2f5d9e', '#6f9ad6'), trim: P('#6b4c12', '#c8962e', '#f0d37a'), glow: P('#2a4a8a', '#7fb0ff', '#f6fbff'), skin: P('#5a3c2c', '#c79872', '#ecc8a4'), mon: P('#2a3347', '#6b7b99', '#b9c6dc'), metal: P('#4a4430', '#a79a62', '#efe3a8') },
  helheim: { cloth: P('#173433', '#4d8c88', '#8fc9c3'), trim: P('#3a3c3f', '#8a8c8f', '#c9cacb'), glow: P('#1e4a48', '#6fc2bb', '#e3fbf6'), skin: P('#3a4642', '#8a9a90', '#c4d2c6'), mon: P('#202a2a', '#56706c', '#a9c4bd'), metal: P('#2c3436', '#6f7a7c', '#b9c4c4') },
};
export const COMMON = {
  steel: P('#2c3036', '#7d838b', '#d4d8da'), wood: P('#2d1a0c', '#6b4425', '#a9774a'), leather: P('#2a1a10', '#5b3a1e', '#93613a'),
  bone: P('#5a5240', '#b8ad8c', '#efe8d0'), dark: P('#0f0c09', '#2a1d12', '#4a3826'), fur: P('#2a1d12', '#5a4128', '#8a6a44'), white: P('#8a8472', '#e8e0c8', '#fffaf0'),
};
export const palOf = (realm, role) => (REALM[realm][role] || COMMON[role]);

// Parts are recipes (kind + args) so a figure can be rebuilt at any scale and offset.
const mkPart = (kind, args, role, o) => ({ kind, args, role, o });
export function build(p, s, cx, cy, dx = 0, dy = 0) {
  const t = (x, y) => [cx + (x - cx) * s + dx, cy + (y - cy) * s + dy];
  if (p.line) return { line: p.line.map(([x, y]) => t(x, y)), col: p.col, w: p.w * s, alpha: p.alpha };
  const a = p.args;
  if (p.kind === 'ell') { const [x, y] = t(a[0], a[1]); return { shape: ell(x, y, a[2] * s, a[3] * s, a[4] || 0), role: p.role, o: p.o }; }
  if (p.kind === 'cap') { const [x, y] = t(a[0], a[1]), [u, v] = t(a[2], a[3]); return { shape: cap(x, y, u, v, a[4] * s, a[5] * s), role: p.role, o: p.o }; }
  return { shape: poly(a.map(([x, y]) => t(x, y))), role: p.role, o: p.o };
}
export const e = (cx, cy, rx, ry, role, rot = 0, o) => mkPart('ell', [cx, cy, rx, ry, rot], role, o);
export const c = (ax, ay, bx, by, r0, r1, role, o) => mkPart('cap', [ax, ay, bx, by, r0, r1], role, o);
export const pg = (pts, role, o) => mkPart('poly', pts, role, o);
export const ln = (pts, col, w, alpha = 1) => ({ line: pts, col, w, alpha });
