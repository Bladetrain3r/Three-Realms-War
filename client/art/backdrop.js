// Three painted realm backdrops (landscape, painted at 960 x 540 and scaled up by the renderer, which suits the soft look).
import { hex, mix, rgba, floats, newCanvas, clamp01 } from './color.js';
import { bristle } from './brush.js';
import { fbm } from './noise.js';
import { vellumSheet } from './paper.js';

export const BACKDROP = { w: 960, h: 540, ground: 330 };

const SKY = {
  midgard: [hex('#2a1210'), hex('#8a2e1c'), hex('#e8803a'), hex('#f6c46a')],
  asgard: [hex('#1d3566'), hex('#4b7cc4'), hex('#a9c6ea'), hex('#f3e2a8')],
  helheim: [hex('#141f22'), hex('#3a5a5e'), hex('#86aaa6'), hex('#cfe0d8')],
};
const stops = (cols, t) => { const x = clamp01(t) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(x)); return mix(cols[i], cols[i + 1], x - i); };

function sky(ctx, f, realm, w, hz) {
  const cols = SKY[realm];
  const g = ctx.createLinearGradient(0, 0, 0, hz); [0, 0.45, 0.8, 1].forEach((s, i) => g.addColorStop(s, rgba(cols[i]))); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 2);
  for (let i = 0; i < 520; i++) { // broad horizontal washes
    const y = f() * hz, c = stops(cols, y / hz + (f() - 0.5) * 0.18);
    bristle(ctx, f() * w, y, 90 + f() * 160, 10 + f() * 18, (f() - 0.5) * 0.12, c, 0.1 + f() * 0.1, f);
  }
}
function ridge(x, seed, amp, base, rough) { return base - amp * (fbm(x / rough, seed, seed, 4) - 0.2); }
function massif(ctx, f, w, y0, amp, seed, rough, far, near, haze) {
  const pts = []; for (let x = -10; x <= w + 10; x += 6) pts.push([x, ridge(x, seed * 0.37, amp, y0, rough)]);
  ctx.beginPath(); ctx.moveTo(-10, y0 + 120); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(w + 10, y0 + 120); ctx.closePath(); ctx.fillStyle = rgba(far); ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 900; i++) {
    const x = f() * w, k = Math.max(0, Math.min(pts.length - 2, Math.floor((x + 10) / 6))), ry = pts[k][1], slope = (pts[k + 1][1] - pts[k][1]) / 6;
    const y = ry + f() * (y0 + 120 - ry), lit = clamp01(0.5 - slope * 0.7 + (ry - y) / amp * 0.3), depth = clamp01((y - ry) / amp);
    const c = mix(mix(far, near, lit), haze, clamp01(0.5 - depth * 0.4));
    bristle(ctx, x, y, 10 + f() * 16, 4 + f() * 5, 1.2 + slope * 0.6 + (f() - 0.5) * 0.7, c, 0.28 + f() * 0.2, f);
  }
  ctx.restore(); return pts;
}
function ground(ctx, f, realm, w, h, hz, cols) {
  const g = ctx.createLinearGradient(0, hz, 0, h); g.addColorStop(0, rgba(cols[0])); g.addColorStop(1, rgba(cols[2])); ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
  for (let i = 0; i < 1100; i++) {
    const y = hz + Math.pow(f(), 0.8) * (h - hz), t = (y - hz) / (h - hz), c = mix(cols[1], cols[3], f() * 0.7 + t * 0.3);
    bristle(ctx, f() * w, y, 14 + t * 50 + f() * 20, 3 + t * 8, (f() - 0.5) * 0.18, c, 0.2 + f() * 0.25, f);
  }
  for (let i = 0; i < 26; i++) { // stones and tufts, bigger toward the viewer
    const y = hz + 20 + f() * (h - hz - 30), t = (y - hz) / (h - hz), r = 3 + t * 12 * (0.5 + f()), x = f() * w;
    ctx.fillStyle = rgba(cols[0], 0.5); ctx.beginPath(); ctx.ellipse(x + 2, y + 2, r * 1.3, r * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = rgba(mix(cols[1], cols[3], 0.4), 0.85); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, 7); ctx.fill();
  }
}
const glowSpot = (ctx, x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
const haze = (ctx, f, w, y, col, n = 80) => { for (let i = 0; i < n; i++) bristle(ctx, f() * w, y + (f() - 0.5) * 30, 100 + f() * 160, 8 + f() * 14, (f() - 0.5) * 0.06, col, 0.05 + f() * 0.07, f); };

const SCENES = {
  midgard(ctx, f, w, h, hz) {
    glowSpot(ctx, w * 0.62, hz - 10, 360, hex('#ffb04a'), 0.6);
    massif(ctx, f, w, hz - 60, 130, 11, 160, hex('#6b2a1c'), hex('#c4623a'), hex('#e8803a'));
    for (let i = 0; i < 5; i++) { const x = 120 + i * 180 + f() * 50; for (let k = 0; k < 40; k++) bristle(ctx, x + (f() - 0.5) * 30, hz - 100 - k * 5, 14, 14 + k * 0.6, 1.5, hex('#4a3a34'), 0.05 + f() * 0.04, f); }
    const m2 = massif(ctx, f, w, hz + 6, 100, 29, 90, hex('#2e1a14'), hex('#8a4630'), hex('#a84a2a'));
    for (let i = 0; i < 6; i++) { const k = 8 + i * 22 + f.int(6), [x, y] = m2[k] || [100, hz]; ctx.strokeStyle = rgba(hex('#ffd36a'), 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 6 * (f() - 0.5), y + 22); ctx.lineTo(x - 5, y + 40); ctx.stroke(); }
    ground(ctx, f, 'midgard', w, h, hz, [hex('#4a2418'), hex('#8a4a38'), hex('#2a140e'), hex('#c87450')]);
    for (let i = 0; i < 70; i++) glowSpot(ctx, f() * w, hz + f() * (h - hz), 5 + f() * 6, hex('#ffd36a'), 0.55);
    for (let i = 0; i < 6; i++) { const x = f() * w, y = hz + 40 + f() * 160; ctx.strokeStyle = rgba(hex('#ff9a3c'), 0.8); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30 + f() * 40, y + 6 - f() * 12); ctx.lineTo(x + 70 + f() * 40, y + 2); ctx.stroke(); }
  },
  asgard(ctx, f, w, h, hz) {
    glowSpot(ctx, w * 0.3, hz - 90, 380, hex('#fff2b8'), 0.55);
    for (let i = 0; i < 90; i++) bristle(ctx, f() * w, 40 + f() * (hz - 80), 40 + f() * 90, 10 + f() * 12, (f() - 0.5) * 0.1, hex('#ffffff'), 0.06 + f() * 0.1, f);
    for (const [ix, iy, ir] of [[200, 130, 60], [610, 90, 80], [800, 190, 46]]) { // floating islands
      ctx.fillStyle = rgba(hex('#3a4a66')); ctx.beginPath(); ctx.moveTo(ix - ir, iy); ctx.lineTo(ix + ir, iy); ctx.lineTo(ix + ir * 0.2, iy + ir * 0.9); ctx.lineTo(ix - ir * 0.3, iy + ir * 0.6); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 80; i++) { const x = ix + (f() - 0.5) * ir * 1.8, y = iy + f() * ir * 0.5; bristle(ctx, x, y, 10, 5, 1.3 + (f() - 0.5) * 0.4, mix(hex('#243049'), hex('#8aa0c4'), f() * 0.6), 0.45, f); }
      ctx.fillStyle = rgba(hex('#7aa05a')); ctx.beginPath(); ctx.ellipse(ix, iy - 2, ir, ir * 0.16, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 40; i++) bristle(ctx, ix + (f() - 0.5) * ir * 1.8, iy - 4 + f() * 6, 12, 4, (f() - 0.5) * 0.4, mix(hex('#4a7a3c'), hex('#b9d27a'), f()), 0.6, f);
      const hw = ir * 0.28; ctx.fillStyle = rgba(hex('#e8d9a8')); ctx.fillRect(ix - hw, iy - ir * 0.34, hw * 2, ir * 0.32); ctx.fillStyle = rgba(hex('#c8962e')); ctx.beginPath(); ctx.moveTo(ix - hw - 4, iy - ir * 0.34); ctx.lineTo(ix, iy - ir * 0.6); ctx.lineTo(ix + hw + 4, iy - ir * 0.34); ctx.fill();
    }
    const bow = ['#c8562a', '#e8a63a', '#8fb06a', '#4b7cc4', '#6a4aa0']; // the bridge
    bow.forEach((c, i) => { ctx.strokeStyle = rgba(hex(c), 0.38); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(w * 0.55, hz + 160, 330 - i * 9, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); });
    massif(ctx, f, w, hz - 10, 60, 41, 200, hex('#6f8fc0'), hex('#d8e4f4'), hex('#e8eefa'));
    haze(ctx, f, w, hz - 10, hex('#ffffff'));
    ground(ctx, f, 'asgard', w, h, hz, [hex('#7a8a52'), hex('#a4a868'), hex('#56633a'), hex('#dccf8e')]);
    ctx.strokeStyle = rgba(hex('#f6fbff'), 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(430, 0); ctx.lineTo(405, 60); ctx.lineTo(430, 78); ctx.lineTo(392, 150); ctx.stroke();
    ctx.strokeStyle = rgba(hex('#7fb0ff'), 0.4); ctx.lineWidth = 9; ctx.stroke();
  },
  helheim(ctx, f, w, h, hz) {
    glowSpot(ctx, w * 0.5, hz - 30, 420, hex('#cfe0d8'), 0.4);
    massif(ctx, f, w, hz - 40, 150, 53, 110, hex('#2a3f44'), hex('#7da0a0'), hex('#a7c4be'));
    for (let i = 0; i < 9; i++) { const x = 40 + i * 110 + f() * 40, ht = 60 + f() * 120; // ice spires
      ctx.fillStyle = rgba(mix(hex('#3a5a5e'), hex('#cfe0d8'), f() * 0.6), 0.85); ctx.beginPath(); ctx.moveTo(x - 16, hz - 20); ctx.lineTo(x + 2, hz - 20 - ht); ctx.lineTo(x + 18, hz - 20); ctx.fill(); }
    haze(ctx, f, w, hz - 30, hex('#cfe0d8'), 70);
    massif(ctx, f, w, hz + 8, 60, 67, 70, hex('#1c2a2c'), hex('#5a7c7a'), hex('#86aaa6'));
    const tree = (x, y, s, d) => { if (d > 5) return; const a = -Math.PI / 2 + (f() - 0.5) * 1.2; for (const side of [-1, 1]) { const x2 = x + Math.cos(a + side * 0.5) * s * 0.6 * 30, y2 = y + Math.sin(a + side * 0.5) * s * 0.6 * 30; ctx.strokeStyle = rgba(hex('#161c1c'), 0.9); ctx.lineWidth = Math.max(1, 6 - d); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); tree(x2, y2, s * 0.78, d + 1); } };
    for (let i = 0; i < 6; i++) { const x = 60 + i * 170 + f() * 60; ctx.strokeStyle = rgba(hex('#161c1c')); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, hz + 14); ctx.lineTo(x + 3, hz - 40); ctx.stroke(); tree(x + 3, hz - 40, 1.4, 0); }
    ground(ctx, f, 'helheim', w, h, hz, [hex('#223034'), hex('#4a6664'), hex('#121a1c'), hex('#9ab8b2')]);
    for (let i = 0; i < 5; i++) { const x = 90 + i * 190 + f() * 40, y = hz + 30 + f() * 40; ctx.strokeStyle = rgba(hex('#d8d0b4'), 0.8); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y + 50, 50, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    haze(ctx, f, w, hz + 20, hex('#cfe0d8'), 60);
  },
};

export function paintBackdrop(createRng, realm, seed = 1) {
  const { w, h, ground: hz } = BACKDROP, cv = newCanvas(w, h), ctx = cv.getContext('2d'), f = floats(createRng, 1000 + seed * 7 + realm.length * 13 + realm.charCodeAt(0));
  sky(ctx, f, realm, w, hz); SCENES[realm](ctx, f, w, h, hz);
  // lay it on the vellum: multiply the paper grain over the paint, then a soft vignette
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5; ctx.drawImage(vellumSheet(createRng, 5 + seed, w, h), 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 1.05); g.addColorStop(0, 'rgba(40,24,10,0)'); g.addColorStop(1, 'rgba(40,24,10,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return cv;
}
