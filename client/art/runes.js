// Rune-like marks drawn as polylines in a unit box (0..1). They are used as realm, element and class badges; shapes differ so colour is never the only signal.
import { rgba } from './color.js';

export const RUNES = {
  midgard: [[[0.7, 0.1], [0.3, 0.5], [0.7, 0.9]]],                                   // kaun-like: the torch
  asgard: [[[0.3, 0.05], [0.3, 0.95]], [[0.3, 0.2], [0.75, 0.4]], [[0.3, 0.5], [0.75, 0.7]]], // ansuz-like
  helheim: [[[0.25, 0.05], [0.25, 0.95]], [[0.75, 0.05], [0.75, 0.95]], [[0.25, 0.35], [0.75, 0.65]]], // hagal-like
  fire: [[[0.5, 0.05], [0.9, 0.9], [0.1, 0.9], [0.5, 0.05]]],                       // triangle
  lightning: [[[0.65, 0.05], [0.3, 0.5], [0.7, 0.5], [0.35, 0.95]]],                 // zigzag
  frost: [[[0.5, 0.05], [0.9, 0.5], [0.5, 0.95], [0.1, 0.5], [0.5, 0.05]]],         // diamond
  hearth: [[[0.5, 0.1], [0.5, 0.9]], [[0.2, 0.4], [0.8, 0.4]]],
  ward: [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.6], [0.5, 0.92], [0.2, 0.6], [0.2, 0.2]]],
  blade: [[[0.5, 0.05], [0.5, 0.75]], [[0.25, 0.6], [0.75, 0.6]]],
  bow: [[[0.7, 0.05], [0.3, 0.5], [0.7, 0.95]], [[0.7, 0.05], [0.7, 0.95]]],
  star: [[[0.5, 0.05], [0.5, 0.95]], [[0.1, 0.5], [0.9, 0.5]], [[0.2, 0.2], [0.8, 0.8]], [[0.8, 0.2], [0.2, 0.8]]],
};
export function drawRune(ctx, id, x, y, size, col, width = 2) {
  const g = RUNES[id]; if (!g) throw new Error(`no rune ${id}`);
  ctx.save(); ctx.strokeStyle = rgba(col); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const line of g) { ctx.beginPath(); line.forEach(([u, v], i) => (i ? ctx.lineTo(x + u * size, y + v * size) : ctx.moveTo(x + u * size, y + v * size))); ctx.stroke(); }
  ctx.restore();
}
