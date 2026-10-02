// The expedition map (DESIGN.md 12.1): integer value noise thresholded into five terrains, sites placed with spacing, every site
// reachable. Pure and deterministic: the same seed and level give the same map on every machine.
import { idiv } from './arith.js';
import { createRng } from './prng.js';

export const PLAIN = 0;
export const FOREST = 1;
export const HILLS = 2;
export const WATER = 3;
export const PEAK = 4;
export const TERRAIN_NAMES = ['plain', 'forest', 'hills', 'water', 'peak'];

// Movement cost of entering a cell of this terrain; 0 means impassable.
export function moveCost(code, x) {
  return code === PLAIN ? x.moveCostPlain : code === FOREST ? x.moveCostForest : code === HILLS ? x.moveCostHills : 0;
}
const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

function noiseField(rng, x) {
  const { width: W, height: H, latticeW: LW, latticeH: LH, jitter } = x, lat = [];
  for (let i = 0; i < LW * LH; i++) lat.push(rng.range(256));
  const dx = W - 1, dy = H - 1, out = [];
  for (let y = 0; y < H; y++) {
    const py = y * (LH - 1), gy = Math.min(LH - 2, idiv(py, dy)), fy = py - gy * dy;
    for (let c = 0; c < W; c++) {
      const px = c * (LW - 1), gx = Math.min(LW - 2, idiv(px, dx)), fx = px - gx * dx;
      const v00 = lat[gy * LW + gx], v10 = lat[gy * LW + gx + 1], v01 = lat[(gy + 1) * LW + gx], v11 = lat[(gy + 1) * LW + gx + 1];
      const top = v00 * (dx - fx) + v10 * fx, bot = v01 * (dx - fx) + v11 * fx;
      let v = idiv(top * (dy - fy) + bot * fy, dx * dy) + rng.range(2 * jitter + 1) - jitter;
      out.push(v < 0 ? 0 : v > 255 ? 255 : v);
    }
  }
  return out;
}

function reachable(terrain, W, H, sx, sy) {
  const seen = new Array(W * H).fill(false), q = [[sx, sy]];
  seen[sy * W + sx] = true;
  for (let i = 0; i < q.length; i++) {
    const [cx, cy] = q[i];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
      if (terrain[ny * W + nx] === WATER || terrain[ny * W + nx] === PEAK) continue;
      seen[ny * W + nx] = true; q.push([nx, ny]);
    }
  }
  return seen;
}

// rng: a createRng stream. E: the expedition level. x: content.tables.expedition.
export function generateMap(rng, E, x) {
  const { width: W, height: H } = x, v = noiseField(rng, x);
  const terrain = v.map((n) => (n < x.waterBelow ? WATER : n >= x.peakFrom ? PEAK : n >= x.hillsFrom ? HILLS : n >= x.forestFrom ? FOREST : PLAIN));
  const sy = rng.range(H), sx = 0;
  terrain[sy * W + sx] = PLAIN;
  const passable = (cx, cy) => terrain[cy * W + cx] !== WATER && terrain[cy * W + cx] !== PEAK;
  const want = x.sitesMin + rng.range(x.sitesMax - x.sitesMin + 1), sites = [];
  const fits = (cx, cy) => passable(cx, cy) && dist(cx, cy, sx, sy) >= x.startSpacing && sites.every((s) => dist(cx, cy, s.x, s.y) >= x.siteSpacing);
  for (let tries = 0; tries < 400 && sites.length < want; tries++) {
    const cx = rng.range(W), cy = rng.range(H);
    if (fits(cx, cy)) sites.push({ x: cx, y: cy });
  }
  for (let cy = 0; cy < H && sites.length < x.sitesMin; cy++) for (let cx = 0; cx < W && sites.length < x.sitesMin; cx++) if (fits(cx, cy)) sites.push({ x: cx, y: cy });
  for (const s of sites) { // carve a straight L-shaped road to any site the flood fill cannot reach
    if (reachable(terrain, W, H, sx, sy)[s.y * W + s.x]) continue;
    const step = s.x >= sx ? 1 : -1;
    for (let cx = sx; cx !== s.x; cx += step) if (!passable(cx, sy)) terrain[sy * W + cx] = PLAIN;
    const vs = s.y >= sy ? 1 : -1;
    for (let cy = sy; cy !== s.y + vs; cy += vs) if (!passable(s.x, cy)) terrain[cy * W + s.x] = PLAIN;
  }
  return {
    width: W, height: H, terrain, start: { x: sx, y: sy },
    sites: sites.map((s, id) => { const d = dist(s.x, s.y, sx, sy); return { id, x: s.x, y: s.y, dist: d, level: E + idiv(d, x.siteLevelDiv), floors: Math.min(x.floorsMax, x.floorsBase + idiv(d, x.floorsDiv)) }; }),
  };
}

export const mapFromSeed = (seed, E, x) => generateMap(createRng(seed), E, x);

// Cells within `radius` (Manhattan) of (cx, cy), as flat indexes.
export function cellsWithin(cx, cy, radius, W, H) {
  const out = [];
  for (let y = Math.max(0, cy - radius); y <= Math.min(H - 1, cy + radius); y++) for (let xx = Math.max(0, cx - radius); xx <= Math.min(W - 1, cx + radius); xx++) if (dist(xx, y, cx, cy) <= radius) out.push(y * W + xx);
  return out;
}
