// Applying, ticking and expiring statuses (DESIGN.md 5.3 and 5.6).
import { mulbp } from './arith.js';
import { hasStatus } from './unit.js';

const BP = 10000;

export function down(ctx, u) {
  u.alive = false;
  ctx.emit([9, u.id]);
}

export function addStatus(ctx, src, tgt, id, duration) {
  const idx = ctx.statusIdx[id];
  for (const s of tgt.statuses) {
    if (s.id === id) { s.dur = duration; s.at = tgt.turn; ctx.emit([6, src.id, tgt.id, idx, duration]); return; }
  }
  tgt.statuses.push({ id, dur: duration, at: tgt.turn });
  ctx.emit([6, src.id, tgt.id, idx, duration]);
}

// A rider that targets someone else: the roll is drawn first whenever the effective chance is below 100%.
export function tryRider(ctx, src, tgt, rider) {
  const st = ctx.content.statusById[rider.status];
  let eff = rider.chance;
  if (st.kind === 'debuff') eff = mulbp(rider.chance, Math.max(0, BP - tgt.def.sres));
  if (eff < BP && ctx.rng.range(BP) >= eff) return false;
  if (st.id === 'shock' && (tgt.def.boss || tgt.shockImmune > 0)) return false;
  addStatus(ctx, src, tgt, rider.status, rider.duration);
  return true;
}

function healBy(ctx, u, amount, statusIdx) {
  const actual = Math.min(amount, u.maxHp - u.hp);
  u.hp += actual;
  ctx.emit([7, u.id, statusIdx, actual]);
}

// Start of the bearer's turn: burn damage, mend healing, permanent regeneration. May down the unit.
export function tickStatuses(ctx, u) {
  for (const s of u.statuses.slice()) {
    const def = ctx.content.statusById[s.id], idx = ctx.statusIdx[s.id];
    if (def.tickDamageBp) {
      const dmg = Math.max(1, mulbp(u.maxHp, def.tickDamageBp)), actual = Math.min(dmg, u.hp);
      u.hp -= actual;
      ctx.emit([7, u.id, idx, actual]);
      if (u.hp === 0) { down(ctx, u); return; }
    } else if (def.tickHealBp) {
      healBy(ctx, u, mulbp(u.maxHp, def.tickHealBp), idx);
    }
  }
  if (u.def.regenBp) healBy(ctx, u, mulbp(u.maxHp, u.def.regenBp), ctx.statusIdx.mend);
}

// End of the bearer's turn: durations fall by one, except for statuses applied during this very turn.
export function endTurn(ctx, u) {
  if (!u.alive) return;
  let shockExpired = false;
  const kept = [];
  for (const s of u.statuses) {
    if (s.at !== u.turn) s.dur--;
    if (s.dur <= 0) {
      ctx.emit([8, u.id, ctx.statusIdx[s.id]]);
      if (s.id === 'shock') shockExpired = true;
    } else kept.push(s);
  }
  u.statuses = kept;
  if (shockExpired) u.shockImmune = ctx.content.statusById.shock.immuneTurns;
  else if (u.shockImmune > 0) u.shockImmune--;
}

export { hasStatus };
