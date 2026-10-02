// A seeded random player. It tries a mix of actions; refused actions are counted, anything but a GameError is a bug.
import { content, saveSchema } from './content.mjs';
import { createRng } from '../../sim/prng.js';
import { GameError, recruit, equip, setParty, setRunbook, upgradeAttempt, acceptAttempt, undoAttempt, salvage, playDelve, validateSave, itemsById, canonical } from '../../sim/index.js';
import { REALMS } from '../../sim/content.js';

export function play(save, steps, seed, { check = true } = {}) {
  const dice = createRng(seed), log = { ok: {}, refused: {}, wins: 0, losses: 0 };
  const count = (b, k) => { b[k] = (b[k] || 0) + 1; };
  const tryDo = (name, f) => {
    try { const r = f(); count(log.ok, name); return r; } catch (e) { if (!(e instanceof GameError)) throw e; count(log.refused, `${name}:${e.code}`); return null; }
  };
  for (let i = 0; i < steps; i++) {
    const roll = dice.range(100);
    let next = null, name = '';
    if (roll < 38) {
      name = 'delve';
      const realm = REALMS[dice.range(3)], level = 1 + dice.range(save.unlocked[realm]);
      // a sensible player sends the healthy: the strongest four heroes who are not injured (else the least injured one)
      const order = save.heroes.slice().sort((a, b) => a.injury - b.injury || b.level - a.level || a.id - b.id);
      const healthy = order.filter((h) => h.injury === 0).slice(0, 4);
      if (dice.range(10) < 8) { try { save = setParty(save, content, (healthy.length ? healthy : order.slice(0, 1)).map((h) => h.id)); } catch (e) { if (!(e instanceof GameError)) throw e; } }
      const force = save.party.filter((id) => save.heroes.find((h) => h.id === id).injury > 0);
      const r = tryDo(name, () => playDelve(save, content, { realm, level, force }));
      if (r) { next = r.save; if (r.summary.outcome) log.wins++; else log.losses++; }
    } else if (roll < 48) {
      name = 'recruit';
      const classes = content.heroes.filter((h) => h.rarity !== 'legendary');
      next = tryDo(name, () => recruit(save, content, classes[dice.range(classes.length)].id));
    } else if (roll < 63) {
      name = 'equip';
      const it = save.items[dice.range(save.items.length)], h = save.heroes[dice.range(save.heroes.length)];
      next = tryDo(name, () => equip(save, content, h.id, it.slot, dice.range(5) === 0 ? null : it.id));
    } else if (roll < 80) {
      name = 'upgrade';
      const it = save.items[dice.range(save.items.length)];
      next = tryDo(name, () => {
        let s = upgradeAttempt(save, content, it.id);
        s = dice.range(2) === 0 ? acceptAttempt(s, content, it.id) : (() => { try { return undoAttempt(s, content, it.id); } catch (e) { return acceptAttempt(s, content, it.id); } })();
        return s;
      });
    } else if (roll < 86) {
      name = 'salvage';
      next = tryDo(name, () => salvage(save, content, save.items[dice.range(save.items.length)].id));
    } else if (roll < 94) {
      name = 'party';
      const pool = save.heroes.map((h) => h.id), ids = [];
      for (let k = 0, n = 1 + dice.range(4); k < n && pool.length; k++) ids.push(pool.splice(dice.range(pool.length), 1)[0]);
      next = tryDo(name, () => setParty(save, content, ids));
    } else {
      name = 'runbook';
      const h = save.heroes[dice.range(save.heroes.length)];
      next = tryDo(name, () => setRunbook(save, content, h.id, content.starterRunbooks[h.class]));
    }
    if (next) {
      save = next;
      if (check) { const v = validateSave(save, content, saveSchema); if (!v.ok) throw new Error(`after step ${i} (${name}): ${v.errors.map((e) => `${e.key} ${e.message}`).join('; ')}`); }
    }
  }
  return { save, log };
}
export { canonical, itemsById };
