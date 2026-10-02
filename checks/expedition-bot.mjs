// The expedition bot: the policy the G5 balance bounds are written against (checks/balance.yaml, "expedition:") and a test driver.
// It uses only the public rules layer, exactly as the client does.
import { newGame, startExpedition, move, enterFloor, retreat, returnHome, expeditionMap, moveCost } from '../sim/index.js';

// A save with the four starting classes at hero level E, wearing Runed gear at item level E, 3 stars, no bonus lines (the ladder's "runed" row).
// withLines: give each item the two bonus lines a Runed item must carry to be a valid save (the balance runs leave them off).
export function runedSave(content, E, seed, withLines = false) {
  const s = newGame(content, seed, { savedAt: '', build: 'bot' });
  for (const h of s.heroes) h.level = E;
  const worn = new Set(s.heroes.flatMap((h) => Object.values(h.slots)));
  for (const it of s.items) if (worn.has(it.id)) { it.tier = 'runed'; it.ilvl = E; it.star = 3; if (withLines) it.lines = [[0, 500], [1, 500]]; }
  for (const r of content.realms) s.unlocked[r.id] = Math.max(s.unlocked[r.id], E);
  s.currency.hacksilver = 1000000;
  return s;
}

// Cheapest path (Dijkstra over move costs, ties broken by cell index) from (sx, sy) to (tx, ty): array of [x, y] steps, and its cost.
export function pathTo(map, content, sx, sy, tx, ty) {
  const X = content.tables.expedition, W = map.width, H = map.height, INF = 1e9, dist = new Array(W * H).fill(INF), prev = new Array(W * H).fill(-1), done = new Array(W * H).fill(false);
  dist[sy * W + sx] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < W * H; i++) if (!done[i] && dist[i] < INF && (best < 0 || dist[i] < dist[best])) best = i;
    if (best < 0) break;
    done[best] = true;
    const cx = best % W, cy = (best - cx) / W;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = moveCost(map.terrain[ny * W + nx], X);
      if (c === 0) continue;
      if (dist[best] + c < dist[ny * W + nx]) { dist[ny * W + nx] = dist[best] + c; prev[ny * W + nx] = best; }
    }
  }
  const t = ty * W + tx;
  if (dist[t] >= INF) return null;
  const steps = [];
  for (let c = t; c !== sy * W + sx; c = prev[c]) steps.unshift([c % W, (c - (c % W)) / W]);
  return { steps, cost: dist[t] };
}

// Runs one expedition. opts: { realm, level, choose: (sites with path costs) -> site | null, retreatBelow (share, default 0.4), margin }.
// Returns { save, record }.
export function runExpedition(save, content, opts) {
  const X = content.tables.expedition, rec = { embarked: save.party.length, died: 0, wiped: false, starved: false, banked: false, bought: 0, floorsFought: 0, encountersWon: 0, saveDeaths: 0, saveHeroEncounters: 0, wipeDeaths: 0, heroEncounters: 0, encountersCleared: 0,
    pack: null, site: null, noSite: false };
  const probe = startExpedition(save, content, { realm: opts.realm, level: opts.level, provisions: 0 });
  const map = expeditionMap(probe.save.expedition, content), st = map.start;
  const cands = map.sites.map((s) => ({ site: s, path: pathTo(map, content, st.x, st.y, s.x, s.y) })).filter((c) => c.path);
  const pick = opts.choose(cands);
  if (!pick) { rec.noSite = true; return { save, record: rec }; }
  const need = pick.path.cost + pick.site.floors * X.floorCost, buy = Math.min(X.provisionMax, need + (opts.margin ?? 2));
  const started = startExpedition(save, content, { realm: opts.realm, level: opts.level, provisions: buy });
  let cur = started.save; rec.bought = buy; rec.site = { dist: pick.site.dist, level: pick.site.level, floors: pick.site.floors };
  const track = (res) => { // fold a floor replay into the record
    const ev = res.replay.events; let alive = res.replay.inputs.party.length, last = -1;
    for (const e of ev) {
      if (e[0] === 0) { rec.encStartAlive = alive; rec.heroEncounters += alive; }
      else if (e[0] === 11) { last = e[1]; if (e[1] === 1) { rec.encountersWon++; rec.encountersCleared++; rec.saveHeroEncounters += rec.encStartAlive; } }
      else if (e[0] === 14 && e[2] === 1) { rec.died++; alive--; if (last === 1) rec.saveDeaths++; else rec.wipeDeaths++; }
    }
  };
  for (const [x, y] of pick.path.steps) {
    const r = move(cur, content, x, y); cur = r.save;
    if (r.summary.ended === 'starved') { rec.starved = true; rec.banked = true; return { save: cur, record: rec }; }
  }
  for (let guard = 0; guard < 20; guard++) {
    const r = enterFloor(cur, content); cur = r.save;
    if (r.summary.ended === 'starved') { rec.starved = true; rec.banked = true; return { save: cur, record: rec }; }
    rec.floorsFought++; track(r);
    if (r.summary.ended === 'wiped') { rec.wiped = true; return { save: cur, record: rec }; }
    if (r.summary.cleared) break;
    const ex = cur.expedition; let num = 0, den = 0;
    ex.party.forEach((id, i) => {
      const unit = r.replay.inputs.party.find((p) => p.heroId === id);
      num += ex.hp[i] < 0 ? unit.maxHp : ex.hp[i]; den += unit.maxHp;
    });
    if (den && num / den < (opts.retreatBelow ?? 0.4)) { cur = retreat(cur, content).save; break; }
  }
  const home = returnHome(cur, content); rec.banked = true; rec.pack = home.summary;
  return { save: home.save, record: rec };
}
