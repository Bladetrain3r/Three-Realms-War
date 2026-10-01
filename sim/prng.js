// splitmix32 seeds sfc32 (DESIGN.md section 3). Integer-only; the only source of randomness in the simulation.

const TWO32 = 4294967296;

export function splitmix32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

// A new seed derived from a master seed and a counter. Pure function of its two arguments.
export function deriveSeed(master, n) {
  return splitmix32((master + Math.imul(n + 1, 0x9e3779b1)) | 0)();
}

export function createRng(seed) {
  const sm = splitmix32(seed);
  let a = sm(), b = sm(), c = sm(), d = sm();
  let draws = 0;
  const next = () => {
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    draws++;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next();
  draws = 0;
  return {
    next,
    // Unbiased integer in [0, n) by rejection sampling.
    range(n) {
      if (!Number.isInteger(n) || n < 1 || n > TWO32) throw new RangeError(`range needs an integer in 1..2^32, got ${n}`);
      const limit = TWO32 - (TWO32 % n);
      for (;;) {
        const x = next();
        if (x < limit) return x % n;
      }
    },
    get draws() { return draws; },
  };
}
