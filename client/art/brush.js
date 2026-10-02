// Oil-paint strokes. A shape is painted as an underpainting, a mid layer of short bristle strokes that follow the form, a light
// layer, and a few thick impasto dabs. Lighting comes from a fixed upper-left light and a sphere/cylinder normal per shape.
import { ramp, rgba, mix, clamp01 } from './color.js';

const LIGHT = (() => { const l = [-0.45, -0.6, 0.66], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();

// ---- shapes: { path(ctx), box:[x0,y0,x1,y1], normal(x,y)->[nx,ny] (in -1..1, length<=1), dir (angle of the long axis) }
export function ell(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), ext = Math.max(rx, ry);
  return {
    kind: 'ell', dir: rx >= ry ? rot : rot + Math.PI / 2,
    box: [cx - ext, cy - ext, cx + ext, cy + ext],
    path(ctx) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); },
    normal(x, y) { const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry; return [u * c - v * s, u * s + v * c]; },
  };
}
export function cap(ax, ay, bx, by, r0, r1 = r0) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux, rm = Math.max(r0, r1);
  return {
    kind: 'cap', dir: Math.atan2(dy, dx),
    box: [Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm],
    path(ctx) {
      ctx.beginPath(); const a = Math.atan2(py, px);
      ctx.arc(ax, ay, r0, a, a + Math.PI); ctx.arc(bx, by, r1, a + Math.PI, a + Math.PI * 2); ctx.closePath();
    },
    normal(x, y) { const t = clamp01(((x - ax) * ux + (y - ay) * uy) / len), r = r0 + (r1 - r0) * t, qx = ax + dx * t, qy = ay + dy * t; return [(x - qx) / r, (y - qy) / r]; },
  };
}
export function poly(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 || 1, ry = (y1 - y0) / 2 || 1;
  return {
    kind: 'poly', dir: rx > ry ? 0 : Math.PI / 2, box: [x0, y0, x1, y1],
    path(ctx) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); },
    normal(x, y) { return [(x - cx) / rx * 0.9, (y - cy) / ry * 0.9]; },
  };
}

// One bristle stroke: a handful of parallel hairs with their own alpha, slightly bowed.
export function bristle(ctx, x, y, len, wid, ang, col, alpha, f) {
  const ca = Math.cos(ang), sa = Math.sin(ang), n = Math.max(2, Math.round(wid / 1.4));
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const o = (i / (n - 1) - 0.5) * wid, ox = -sa * o, oy = ca * o, l = len * (0.75 + f() * 0.25), bow = (f() - 0.5) * 2;
    ctx.strokeStyle = rgba(col, alpha * (0.45 + f() * 0.55)); ctx.lineWidth = 1 + f() * 1.4;
    ctx.beginPath(); ctx.moveTo(x + ox - ca * l / 2, y + oy - sa * l / 2);
    ctx.quadraticCurveTo(x + ox - sa * bow, y + oy + ca * bow, x + ox + ca * l / 2, y + oy + sa * l / 2); ctx.stroke();
  }
}

function lit(shape, x, y) {
  const [nx, ny] = shape.normal(x, y), r2 = nx * nx + ny * ny;
  if (r2 > 1.2) return -1;
  const nz = Math.sqrt(Math.max(0, 1 - r2)), d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return clamp01(0.12 + 0.88 * Math.max(0, d) + (nz < 0.3 ? -0.08 : 0));
}

// Paint a shape with a palette {dark, mid, light}. `o`: {density (strokes per 100 px^2, default 5), grain (0..1 colour jitter), flow ('form'|'axis'|angle)}.
export function paint(ctx, shape, pal, f, o = {}) {
  const [x0, y0, x1, y1] = shape.box, w = x1 - x0, h = y1 - y0, area = Math.max(1, w * h), dens = o.density || 5;
  const n = Math.min(1400, Math.max(24, Math.round(area / 100 * dens)));
  const flow = o.flow || 'axis';
  const ang = (x, y) => {
    if (typeof flow === 'number') return flow + (f() - 0.5) * 0.6;
    const [nx, ny] = shape.normal(x, y);
    if (flow === 'axis') return shape.dir + (f() - 0.5) * 0.5;
    return Math.atan2(nx, -ny) + (f() - 0.5) * 0.5; // around the form
  };
  ctx.save();
  shape.path(ctx); ctx.fillStyle = rgba(pal.dark, 1); ctx.fill();
  ctx.clip();
  const sz = Math.sqrt(area), len0 = Math.min(26, Math.max(7, sz * 0.32)), wid0 = Math.min(9, Math.max(3, sz * 0.09));
  const ox = (f() - 0.5) * 1.6, oy = (f() - 0.5) * 1.6;
  const layer = (count, tLo, tBoost, aMul, lMul, regis) => {
    for (let i = 0; i < count; i++) {
      const x = x0 + f() * w, y = y0 + f() * h, t = lit(shape, x, y);
      if (t < 0 || t < tLo) continue;
      const g = (f() - 0.5) * (o.grain ?? 0.14), col = ramp(pal, clamp01(t + tBoost + g));
      bristle(ctx, x + (regis ? ox : 0), y + (regis ? oy : 0), len0 * lMul * (0.7 + f() * 0.6), wid0 * (0.7 + f() * 0.7), ang(x, y), col, (0.4 + f() * 0.3) * aMul, f);
    }
  };
  layer(n * 2, 0, 0, 1, 1, true);                    // mid layer, covers everything
  layer(n, 0.45, 0.14, 0.9, 0.8, false);             // light layer
  // rim: darker strokes hugging the edge give the form its weight
  for (let i = 0; i < n; i++) {
    const x = x0 + f() * w, y = y0 + f() * h, t = lit(shape, x, y);
    if (t < 0) continue;
    const [nx, ny] = shape.normal(x, y), r2 = nx * nx + ny * ny;
    if (r2 > 0.62) bristle(ctx, x, y, len0 * 0.6, wid0 * 0.8, Math.atan2(nx, -ny) + (f() - 0.5) * 0.4, pal.dark, 0.5, f);
  }
  // impasto: small thick light dabs on the lit side, each with a dark edge underneath
  const dabs = Math.min(26, Math.round(n / 14));
  for (let i = 0; i < dabs; i++) {
    const x = x0 + f() * w, y = y0 + f() * h, t = lit(shape, x, y);
    if (t < 0.62) continue;
    const r = 0.9 + f() * 1.5;
    const a = ang(x, y);
    ctx.fillStyle = rgba(pal.dark, 0.3); ctx.beginPath(); ctx.ellipse(x + 0.7, y + 0.9, r * 2 + 0.4, r * 0.7 + 0.3, a, 0, 7); ctx.fill();
    ctx.fillStyle = rgba(mix(pal.light, pal.mid, 0.25), 0.7); ctx.beginPath(); ctx.ellipse(x, y, r * 2, r * 0.7, a, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// A soft contact shadow under a figure: a few wide translucent strokes.
export function groundShadow(ctx, cx, cy, rx, f) {
  for (let i = 0; i < 26; i++) {
    const a = 0.05 + f() * 0.06;
    ctx.fillStyle = `rgba(30,20,10,${a})`; ctx.beginPath();
    ctx.ellipse(cx + (f() - 0.5) * rx * 0.2, cy + (f() - 0.5) * 3, rx * (0.55 + f() * 0.45), rx * 0.16 * (0.6 + f() * 0.5), 0, 0, 7); ctx.fill();
  }
}

// A free line stroke (props, hair, bowstrings): width tapers by drawing a few offset passes.
export function inkLine(ctx, pts, col, wid, alpha = 1) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(col, alpha); ctx.lineWidth = wid;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
