// Woodcut register for menus: ink frames with knotwork corners, hatching, carved rules and inked-block textures.
// Everything is a small canvas turned into a data URL, so the page ships no image files.
import { hex, rgba, floats, newCanvas } from './color.js';
import { WALNUT } from './paper.js';

const INK = WALNUT;
export const dataURL = (cv) => (cv.toDataURL ? cv.toDataURL('image/png') : null);

function knot(ctx, cx, cy, r, f) { // an interlaced pair of loops, cut with a slightly uneven hand
  ctx.strokeStyle = rgba(INK); ctx.lineCap = 'round'; ctx.lineWidth = 2;
  for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, Math.PI / 4 + k * Math.PI / 2 + (f() - 0.5) * 0.06, 0, 7); ctx.stroke(); }
  ctx.fillStyle = rgba(INK); ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, 7); ctx.fill();
  ctx.strokeStyle = rgba(hex('#e9dcb9')); ctx.lineWidth = 1.2; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, Math.PI / 4 + k * Math.PI / 2, 0.2, 0.9); ctx.stroke(); }
}

// A square tile for `border-image` (slice = edge): outer heavy rule, inner thin rule, notch ticks, a knot in each corner.
export function frameTile(createRng, seed, size = 96, edge = 30) {
  const cv = newCanvas(size, size), ctx = cv.getContext('2d'), f = floats(createRng, seed);
  const wob = (v) => v + (f() - 0.5) * 0.8;
  ctx.strokeStyle = rgba(INK); ctx.lineCap = 'round';
  ctx.lineWidth = 4.2; ctx.beginPath(); ctx.rect(wob(3), wob(3), size - 6, size - 6); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.rect(wob(11), wob(11), size - 22, size - 22); ctx.stroke();
  ctx.lineWidth = 1.4; for (let i = edge; i < size - edge; i += 5) { const l = 3 + f() * 4; // carved ticks between the rules
    ctx.beginPath(); ctx.moveTo(i, 14); ctx.lineTo(i + 1, 14 + l); ctx.moveTo(i, size - 14); ctx.lineTo(i + 1, size - 14 - l); ctx.moveTo(14, i); ctx.lineTo(14 + l, i + 1); ctx.moveTo(size - 14, i); ctx.lineTo(size - 14 - l, i + 1); ctx.stroke(); }
  ctx.fillStyle = rgba(hex('#e9dcb9')); for (const [x, y] of [[edge / 2, edge / 2], [size - edge / 2, edge / 2], [edge / 2, size - edge / 2], [size - edge / 2, size - edge / 2]]) { ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); knot(ctx, x, y, 8.5, f); }
  return cv;
}

// Parallel hatching on a transparent tile (panel shading). `dir` in radians; spacing in px.
export function hatchTile(createRng, seed, size = 64, spacing = 5, dir = Math.PI / 4, alpha = 0.22) {
  const cv = newCanvas(size, size), ctx = cv.getContext('2d'), f = floats(createRng, seed), c = Math.cos(dir), s = Math.sin(dir);
  ctx.strokeStyle = rgba(INK, alpha); ctx.lineCap = 'round';
  for (let o = -size; o < size * 2; o += spacing) for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
    const j = (f() - 0.5) * 1.4; ctx.lineWidth = 0.8 + f() * 0.7;
    ctx.beginPath(); ctx.moveTo(ox + o * -s + c * -size + j, oy + o * c + s * -size); ctx.lineTo(ox + o * -s + c * size + j, oy + o * c + s * size); ctx.stroke();
  }
  return cv;
}

// Ink block for buttons: walnut with pale gouge marks, as if printed from a carved block.
export function inkTile(createRng, seed, size = 96) {
  const cv = newCanvas(size, size), ctx = cv.getContext('2d'), f = floats(createRng, seed);
  ctx.fillStyle = rgba(INK); ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const x = f() * size, y = f() * size, l = 3 + f() * 10, a = (f() < 0.7 ? 0.1 : 0.9) * Math.PI / 6 + (f() - 0.5) * 0.3;
    ctx.strokeStyle = rgba(hex('#7a5a38'), 0.12 + f() * 0.22); ctx.lineWidth = 0.6 + f() * 0.9;
    for (const ox of [-size, 0, size]) { ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.lineTo(x + ox + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  }
  return cv;
}

// A carved divider: a rule with a diamond in the middle and cut ends.
export function ruleStrip(createRng, seed, w = 480, h = 18) {
  const cv = newCanvas(w, h), ctx = cv.getContext('2d'), f = floats(createRng, seed), m = h / 2;
  ctx.strokeStyle = rgba(INK); ctx.fillStyle = rgba(INK); ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(4, m); ctx.lineTo(w / 2 - 14, m + (f() - 0.5)); ctx.moveTo(w / 2 + 14, m); ctx.lineTo(w - 4, m + (f() - 0.5)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, m - 7); ctx.lineTo(w / 2 + 8, m); ctx.lineTo(w / 2, m + 7); ctx.lineTo(w / 2 - 8, m); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const x = 14 + i * 7; ctx.beginPath(); ctx.moveTo(x, m - 4); ctx.lineTo(x + 2, m + 4); ctx.moveTo(w - x, m - 4); ctx.lineTo(w - x - 2, m + 4); ctx.stroke(); }
  return cv;
}
