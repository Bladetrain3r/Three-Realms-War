// G0 evidence tool. Not game code: a throwaway reference for the arithmetic in DESIGN.md.
// The real sim (G1) is written independently and is cross-checked against these examples.
//   node evidence/G0-worked-examples.mjs          print every example's computed value
//   node evidence/G0-worked-examples.mjs --check  compare against the "=> ..." values written in DESIGN.md
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const idiv = (a, b) => (a - (a % b)) / b;
const mulbp = (x, bp) => idiv(x * bp, 10000);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---- PRNG: splitmix32 seeds sfc32 -------------------------------------------------------------
function splitmix32(a) {
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
function makeRng(seed) {
  const sm = splitmix32(seed | 0);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const next = () => {
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}
const rangeFrom = (draws, n) => { // rejection sampling over a list of raw draws
  const limit = 4294967296 - (4294967296 % n);
  const rejected = [];
  for (const x of draws) { if (x < limit) return { value: x % n, rejected }; rejected.push(x); }
  throw new Error('out of draws');
};
const deriveSeed = (master, n) => splitmix32((master + Math.imul(n + 1, 0x9e3779b1)) | 0)();

// ---- SHA-256 and canonical JSON ---------------------------------------------------------------
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(bytes) {
  const l = bytes.length, total = (((l + 9 + 63) >> 6) << 6);
  const m = new Uint8Array(total); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 8, Math.floor((l * 8) / 4294967296)); dv.setUint32(total - 4, (l * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function canon(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new Error('non-integer in canonical JSON'); return String(v); }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
const hashOf = (v) => sha256(new TextEncoder().encode(canon(v)));

// ---- design formulas --------------------------------------------------------------------------
const heroBase = (s1, L) => s1 + idiv(s1 * 9 * (L - 1), 49);
const enemyBase = (p, L, k = 30, q = 10) => p + idiv(p * (k * 49 * (L - 1) + q * (L - 1) * (L - 1)), 49 * 49);
const starMul = (star) => 10000 + 500 * star;
const gearMain = (coef, ilvl, tierBp, star) => mulbp(mulbp(coef * ilvl, tierBp), starMul(star));
const mitBp = (def, attackerLevel) => Math.min(8000, idiv(def * 10000, def + 40 + 12 * attackerLevel));
const xpToNext = (L) => 50 + 30 * L + idiv(L * L * L, 20);
const upgradeCost = (ilvl, star) => 3 + idiv(ilvl * (star + 1), 2);
const unitOrder = (units) => [...units].sort((a, b) => b.spd - a.spd || a.id - b.id).map((u) => u.id);

function damage({ atk, power, def, attackerLevel, affinity, elemRes, takenBp, variance, critRoll, critChance, critDmg }) {
  const steps = [];
  const raw = mulbp(atk, power); steps.push(raw);
  const mit = mitBp(def, attackerLevel); steps.push(mit);
  let d = mulbp(raw, 10000 - mit); steps.push(d);
  if (affinity) { d = mulbp(d, 11000); steps.push(d); }
  d = mulbp(d, 10000 - clamp(elemRes, -5000, 7500)); steps.push(d);
  d = mulbp(d, 10000 + takenBp); steps.push(d);
  d = mulbp(d, variance); steps.push(d);
  if (critRoll < critChance) { d = mulbp(d, critDmg); steps.push(d); }
  steps.push(Math.max(1, d));
  return steps;
}

// ---- the examples (ids match the [WE-nn] tags in DESIGN.md) -----------------------------------
const rng1 = makeRng(1);
const first3 = [rng1(), rng1(), rng1()];
const huscarlHit = { atk: 300, power: 16000, def: 250, attackerLevel: 26, affinity: true, elemRes: 2000, takenBp: 0, variance: 10500, critRoll: 9000, critChance: 500, critDmg: 15000 };
const brute171 = enemyBase(6, 26); // DESIGN 0.3/0.4: brute VIG profile 6, K=30 and a quadratic term Q=10 (originally linear K 22, VIG 14)
const brute = mulbp(brute171, 11000);
const sample = { schema: 1, kind: 'x', z: [3, 1, 2], a: { y: 2, b: 1 } };

export const EXAMPLES = [
  ['WE-01', 'mulbp(37, 11500); idiv(1000000007, 6)', () => [mulbp(37, 11500), idiv(1000000007, 6)]],
  ['WE-02', 'range(6) over draws 4294967293, 1000000007: limit, rejected draw, result', () => { const r = rangeFrom([4294967293, 1000000007], 6); return [4294967296 - (4294967296 % 6), r.rejected[0], r.value]; }],
  ['WE-03', 'sfc32 seed 1, first three raw draws after the 12-draw warm-up', () => first3],
  ['WE-04', 'deriveSeed(1,0), deriveSeed(1,1)', () => [deriveSeed(1, 0), deriveSeed(1, 1)]],
  ['WE-05', 'Shieldwarden VIG 22 at L1, L26, L50', () => [heroBase(22, 1), heroBase(22, 26), heroBase(22, 50)]],
  ['WE-06', 'realm affinity +1000bp on 123', () => [mulbp(123, 11000)]],
  ['WE-07', 'armour GRD, ilvl 26, Runed, star 2', () => [gearMain(4, 26, 13000, 2)]],
  ['WE-08', 'final VIG and max HP (see text)', () => { const v = mulbp(135 + 130, 10000 + 1000); return [v, 5 * v]; }],
  ['WE-09', 'mitigation: DEF 150 vs attacker level 26', () => [mitBp(150, 26)]],
  ['WE-10', 'physical-fire hit: raw, mit, after mit, after affinity, after resist, after mark, after variance, final', () => damage(huscarlHit)],
  ['WE-11', 'same hit with a critical roll', () => damage({ ...huscarlHit, critRoll: 100 })],
  ['WE-12', 'status chance 4000 vs SRES 2500; applies at roll 2999, not at 3000', () => [mulbp(4000, 10000 - 2500), 2999 < 3000 ? 1 : 0, 3000 < 3000 ? 1 : 0]],
  ['WE-13', 'heal: ARC 220 at 12000 bp, target missing 100 and missing 400', () => { const h = mulbp(220, 12000); return [h, Math.min(h, 100), Math.min(h, 400)]; }],
  ['WE-14', 'burn tick on max HP 1455 at 600 bp', () => [Math.max(1, mulbp(1455, 600))]],
  ['WE-15', 'injured early: MIT 300, VIG 291 halved, resulting max HP', () => [mulbp(300, 5000), mulbp(291, 5000), 5 * mulbp(291, 5000)]],
  ['WE-16', 'turn order: ids 0..5 with SPD 14, 9, 14, 12, 9, 12 (chill on id 3 = -3000bp)', () => unitOrder([{ id: 0, spd: 14 }, { id: 1, spd: 9 }, { id: 2, spd: 14 }, { id: 3, spd: mulbp(12, 7000) }, { id: 4, spd: 9 }, { id: 5, spd: 12 }])],
  ['WE-17', 'enemy brute VIG 6 at L26 (DESIGN 0.3): scaled, Midgard tilt, max HP, with Hardy (+4000bp)', () => [brute171, brute, 5 * brute, 5 * mulbp(brute, 14000)]],
  ['WE-18', 'upgrade cost in common materials: ilvl 26 at star 0 and star 3', () => [upgradeCost(26, 0), upgradeCost(26, 3)]],
  ['WE-19', 'bonus line raw 300 at star 3 and star 5', () => [mulbp(300, starMul(3)), mulbp(300, starMul(5))]],
  ['WE-20', 'new line: ten kinds available, draws 6 (CRIT, range 100..400) then 150', () => [6, 100 + 150]],
  ['WE-21', 'xp_to_next at L1, L20, L49', () => [xpToNext(1), xpToNext(20), xpToNext(49)]],
  ['WE-22', 'delve D=20, 3 encounters + boss: xp per hero, rest xp, common materials, hacksilver', () => { const e = 10 + 4 * 20; const xp = 3 * e + 2 * e; return [xp, idiv(xp, 2), 3 * (3 + idiv(20, 3)) + 2 * (3 + idiv(20, 3)), 3 * (5 + 20) + 3 * (5 + 20)]; }],
  ['WE-23', 'recruit level when the top hero is L26 and L1', () => [Math.max(1, idiv(26 * 3, 4)), Math.max(1, idiv(1 * 3, 4))]],
  ['WE-24', 'expedition: path cost (4 plain, 1 forest, 1 hills), site level at E=20 dist 11, distance multiplier', () => [4 + 2 + 2, 20 + idiv(11, 3), 10000 + 300 * 11]],
  ['WE-25', 'expedition reward: base 10 materials, dist 11, floor 3', () => [mulbp(mulbp(3 + idiv(23, 3), 10000 + 300 * 11), 10000 + 2500 * 2)]],
  ['WE-26', 'death save at 4000 bp: roll 3999 and roll 4000 (1 = dies)', () => [3999 < 4000 ? 1 : 0, 4000 < 4000 ? 1 : 0]],
  ['WE-27', 'encounter band draw: weights 3,4,3 and draw 6 -> band', () => { const w = [3, 4, 3]; let r = 6, b = 0; while (r >= w[b]) { r -= w[b]; b++; } return [b + 1]; }],
  ['WE-28', 'sha256("abc")', () => [sha256(new TextEncoder().encode('abc'))]],
  ['WE-29', 'canonical JSON of {schema,kind,z,a}', () => [canon(sample)]],
  ['WE-30', 'sha256 of that canonical string', () => [hashOf(sample)]],
  ['WE-31', 'lifesteal 5000 bp on a hit of 258', () => [mulbp(258, 5000)]],
  ['WE-32', 'mend tick on max HP 1455 at 500 bp', () => [Math.max(1, mulbp(1455, 500))]],
  ['WE-33', 'salvage a Runed (tier index 2) item level 26: idiv(26,2) x (2+1)', () => [idiv(26, 2) * (2 + 1)]],
];

// ---- runner -----------------------------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const designPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'DESIGN.md');
  const doc = check ? (existsSync(designPath) ? readFileSync(designPath, 'utf8') : null) : null;
  if (check && doc === null) { console.error('DESIGN.md not found'); process.exit(2); }
  let bad = 0;
  for (const [id, label, fn] of EXAMPLES) {
    const got = fn().join(', ');
    if (!check) { console.log(`[${id}] ${label}\n   => ${got}`); continue; }
    const m = doc.match(new RegExp(`\\[${id}\\][^\\n]*=> ([^\\n]*)`));
    const want = m ? m[1].trim().replace(/\.$/, '') : null;
    const ok = want === got;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} ${ok ? got : `doc says [${want}] computed [${got}]`}`);
  }
  if (check) console.log(bad === 0 ? `\nall ${EXAMPLES.length} worked examples match DESIGN.md` : `\n${bad} of ${EXAMPLES.length} DO NOT match`);
  process.exit(bad === 0 ? 0 : 1);
}
