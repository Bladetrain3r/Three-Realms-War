// Integer arithmetic for the simulation (DESIGN.md section 3). No floating-point result is ever kept:
// every product is checked to be an exactly representable integer before it is divided.

export const BP = 10000;

export function idiv(a, b) {
  if (!(a >= 0) || !(b > 0)) throw new RangeError(`idiv needs a >= 0 and b > 0, got ${a} / ${b}`);
  return (a - (a % b)) / b;
}

export function mulbp(x, bp) {
  const p = x * bp;
  if (!Number.isSafeInteger(p) || p < 0) throw new RangeError(`mulbp needs a non-negative safe product, got ${x} * ${bp}`);
  return (p - (p % BP)) / BP;
}

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}
