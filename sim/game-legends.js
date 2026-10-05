// The rules layer, part 6: the legendary bosses and the final boss (DESIGN.md 12.6). Which lairs an expedition carries, and what a
// lair's map entry looks like; the fight and the pack are in game-expedition.js.

// Map specs for lairs by legend id (see mapgen.placeLairs): the final boss fights at a fixed level.
export function lairSpecs(ids, content) {
  return ids.map((id) => ({ legend: id, level: content.legendById[id].final ? content.tables.legend.chaosLevel : 0 }));
}

export const beatenCount = (save, content) => save.legendsBeaten.filter((id) => !content.legendById[id].final).length;
export const chaosOpen = (save, content) => beatenCount(save, content) >= content.tables.legend.unlockCount;

// 12.6: the lairs a new expedition at `level` carries: the lowest unbeaten legend the level has reached, and the final boss once enough
// legends have fallen and the level has reached its own. Never a legend already beaten (banked) in this save.
export function lairsFor(save, content, level) {
  const out = [], L = content.tables.legend;
  const next = content.legends.find((l) => !l.final && !save.legendsBeaten.includes(l.id) && l.from <= level);
  if (next) out.push(next.id);
  const fin = content.legends.find((l) => l.final);
  if (!save.legendsBeaten.includes(fin.id) && chaosOpen(save, content) && level >= L.chaosFrom) out.push(fin.id);
  return out;
}

// What the Hall shows: each legend, whether it has fallen, and how near the final boss is.
export function legendStatus(save, content) {
  return {
    legends: content.legends.map((l) => ({ id: l.id, name: l.name, from: l.from, final: l.final, beaten: save.legendsBeaten.includes(l.id) })),
    beaten: beatenCount(save, content), needed: content.tables.legend.unlockCount, chaosOpen: chaosOpen(save, content), won: save.won,
  };
}

// An item level for a legend's fixed item: the lair's level, within 1 to 50.
export const legendIlvl = (level) => Math.max(1, Math.min(50, level));
