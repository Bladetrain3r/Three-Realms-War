// Deterministic value noise (integer lattice hash), optionally periodic so a tile repeats without a seam.
const hash2 = (x, y, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
export function noise2(x, y, seed, period = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const w = (v) => (period ? ((v % period) + period) % period : v);
  const a = hash2(w(x0), w(y0), seed), b = hash2(w(x0 + 1), w(y0), seed), c = hash2(w(x0), w(y0 + 1), seed), d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
// Fractal sum; `period` is the lattice period of the first octave (it doubles with each octave, keeping the tile seamless).
export function fbm(x, y, seed, octaves = 4, period = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise2(x * f, y * f, seed + o * 101, period ? period * f : 0); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
