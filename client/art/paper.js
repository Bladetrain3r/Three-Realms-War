// Rough vellum. `vellumTile` repeats without a seam (for CSS backgrounds); `vellumSheet` is a full page with a darker deckled edge.
import { hex, mix, rgb, rgba, floats, newCanvas, clamp01 } from './color.js';
import { fbm, noise2 } from './noise.js';

export const VELLUM = hex('#e9dcb9');
export const VELLUM_SHADE = hex('#cdb98a');
export const WALNUT = hex('#2a1d12');
export const UMBER = hex('#5b3a1e');

function pixels(w, h, fn) {
  const c = newCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, p = fn(x, y); d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = p[3] === undefined ? 255 : p[3]; }
  ctx.putImageData(img, 0, 0); return c;
}

export function vellumTile(createRng, seed, size = 256) {
  const per = 4; // stain lattice period across the tile
  const c = pixels(size, size, (x, y) => {
    const u = x / size * per, v = y / size * per;
    const stain = fbm(u, v, seed, 4, per), mott = fbm(u * 3, v * 3, seed + 7, 3, per * 3);
    const grain = noise2(x / 1.3, y / 1.3, seed + 31, size / 1.3 | 0) - 0.5, fine = noise2(x / 5, y / 2.2, seed + 53, 0) - 0.5;
    let t = clamp01((stain - 0.5) * 1.6 + 0.35 + (mott - 0.5) * 0.5);
    const base = mix(VELLUM, VELLUM_SHADE, t * 0.85), k = grain * 16 + fine * 9;
    return [base[0] + k, base[1] + k, base[2] + k * 1.1];
  });
  const ctx = c.getContext('2d'), f = floats(createRng, seed + 3);
  for (let i = 0; i < 26; i++) { // fibres, wrapped so the tile stays seamless
    const x = f() * size, y = f() * size, a = f() * 6.283, l = 6 + f() * 16, al = 0.05 + f() * 0.1;
    ctx.strokeStyle = rgba(f() < 0.5 ? UMBER : [255, 250, 232], al); ctx.lineWidth = 0.6 + f() * 0.6;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.quadraticCurveTo(x + ox + Math.cos(a) * l / 2 + 2, y + oy + Math.sin(a) * l / 2 - 2, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); ctx.stroke();
    }
  }
  for (let i = 0; i < 10; i++) { // small flecks
    const x = f() * size, y = f() * size, r = 0.6 + f() * 1.4;
    ctx.fillStyle = rgba(UMBER, 0.08 + f() * 0.12); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  return c;
}

// The full page: the tile for grain, a slow stain layer at low resolution (scaled up soft), and a deckled darker edge.
export function vellumSheet(createRng, seed, w, h) {
  const tile = vellumTile(createRng, seed), c = newCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, w, h);
  const lw = Math.max(8, w >> 3), lh = Math.max(8, h >> 3);
  const low = pixels(lw, lh, (x, y) => {
    const s = fbm(x / lw * 3.2, y / lh * 3.2, seed + 91, 5), edge = Math.min(x, y, lw - 1 - x, lh - 1 - y) / Math.min(lw, lh);
    const dk = clamp01((s - 0.45) * 1.4) * 0.35 + clamp01(1 - edge * 7 + (noise2(x / 2, y / 2, seed + 5) - 0.5) * 0.9) * 0.5;
    return [110, 70, 30, dk * 90];
  });
  ctx.imageSmoothingEnabled = true; ctx.drawImage(low, 0, 0, w, h);
  const f = floats(createRng, seed + 17); // deckle: a ragged darker rim
  ctx.strokeStyle = rgba(UMBER, 0.35);
  for (let i = 0; i < Math.round((w + h) / 6); i++) {
    const side = f.int(4), t = f(), len = 4 + f() * 14; let x, y, dx, dy;
    if (side === 0) { x = t * w; y = 0; dx = 0; dy = 1; } else if (side === 1) { x = t * w; y = h; dx = 0; dy = -1; } else if (side === 2) { x = 0; y = t * h; dx = 1; dy = 0; } else { x = w; y = t * h; dx = -1; dy = 0; }
    ctx.lineWidth = 1 + f() * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
  }
  return c;
}
