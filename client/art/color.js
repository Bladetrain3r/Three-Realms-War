// Colour helpers. Colours are [r, g, b] with 0..255 channels; floats are fine here (this is presentation, not the simulation).
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c, d) => (d >= 0 ? mix(c, [255, 255, 255], d) : mix(c, [0, 0, 0], -d));
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
// dark -> mid -> light ramp, t in 0..1
export const ramp = (p, t) => (t < 0.5 ? mix(p.dark, p.mid, t * 2) : mix(p.mid, p.light, (t - 0.5) * 2));
// A seeded float generator on top of the sim's PRNG family: f() in [0, 1).
export function floats(createRng, seed) {
  const r = createRng(seed >>> 0);
  const f = () => r.next() / 4294967296;
  f.range = (a, b) => a + (b - a) * f();
  f.int = (n) => r.range(n);
  f.pick = (arr) => arr[r.range(arr.length)];
  return f;
}
export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function newCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
