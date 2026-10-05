// The battle as the viewer sees it: a pure reducer over a replay's events (no DOM, so Node tests can run it).
// Unit ids: heroes 0 to 3 by slot, enemies 4 to 7 by slot (DESIGN 5.1). The numbers shown are the replay's own, never recomputed.

export function initState(replay, content) {
  const units = [];
  for (let i = 0; i < 8; i++) units.push({ id: i, side: i < 4 ? 'hero' : 'foe', slot: i % 4, present: false, alive: false, name: '', maxHp: 0, hp: 0, statuses: {}, boss: false, def: null });
  replay.inputs.party.forEach((p, i) => {
    const slot = p.slot === undefined ? i : p.slot, u = units[slot];
    const start = replay.inputs.heroHp && replay.inputs.heroHp[i] !== null && replay.inputs.heroHp[i] !== undefined ? Math.min(p.maxHp, replay.inputs.heroHp[i]) : p.maxHp;
    Object.assign(u, { present: true, alive: true, name: p.name, maxHp: p.maxHp, hp: start, def: p });
  });
  return { units, enc: -1, encCount: replay.plan.length, round: 0, actor: -1, over: false, outcome: null, cleared: 0, cursor: 0, log: [] };
}

const nameOf = (st, id) => (id >= 0 && st.units[id] ? st.units[id].name : 'someone');

// Applies event `ev` (index st.cursor) and returns a cue the renderer animates: { kind, ... } (kind is the opcode's name).
export function applyEvent(st, ev, replay, content) {
  const u = st.units, T = replay.tables, log = (t) => st.log.push({ i: st.cursor, text: t });
  const op = ev[0];
  st.cursor++;
  switch (op) {
    case 0: {
      st.enc = ev[1]; st.round = 0; st.actor = -1;
      for (let i = 4; i < 8; i++) Object.assign(u[i], { present: false, alive: false, statuses: {}, name: '', hp: 0, maxHp: 0, boss: false, def: null });
      for (const e of replay.plan[ev[1]]) {
        const x = u[4 + e.slot], pre = e.affixes && e.affixes.length ? `${e.affixes.map((a) => ((content.affixes.find((x) => x.id === a) || { name: a }).name)).join(' ')} ` : '';
        Object.assign(x, { present: true, alive: true, name: `${pre}${e.name}`, baseName: e.name, id2: e.id, maxHp: e.maxHp, hp: e.maxHp, boss: e.boss, level: e.level, affixes: e.affixes || [] });
      }
      for (let i = 0; i < 4; i++) u[i].statuses = {};
      log(`Encounter ${ev[1] + 1} of ${st.encCount}: ${ev[2]} foe${ev[2] === 1 ? '' : 's'}.`);
      return { kind: 'enc_start', index: ev[1] };
    }
    case 1: st.round = ev[1]; log(`Round ${ev[1]}.`); return { kind: 'round', round: ev[1] };
    case 2: st.actor = ev[1]; return { kind: 'turn', unit: ev[1] };
    case 3: {
      const sk = T.skills[ev[2]], def = content.skillById[sk], label = sk === 'brace' ? 'Brace' : def ? def.name : sk;
      log(ev[3] >= 0 ? `${nameOf(st, ev[1])} uses ${label} on ${nameOf(st, ev[3])}.` : `${nameOf(st, ev[1])} uses ${label}.`);
      return { kind: 'skill', unit: ev[1], skill: sk, target: ev[3] };
    }
    case 4: {
      u[ev[2]].hp = ev[5];
      log(`${nameOf(st, ev[1])} hits ${nameOf(st, ev[2])} for ${ev[3]}${ev[4] ? ' (critical)' : ''}.`);
      return { kind: 'hit', src: ev[1], dst: ev[2], amount: ev[3], crit: ev[4] === 1 };
    }
    case 5: {
      u[ev[2]].hp = ev[4];
      log(`${nameOf(st, ev[1])} heals ${nameOf(st, ev[2])} for ${ev[3]}.`);
      return { kind: 'heal', src: ev[1], dst: ev[2], amount: ev[3] };
    }
    case 6: {
      const s = T.statuses[ev[3]]; u[ev[2]].statuses[s] = ev[4];
      log(`${nameOf(st, ev[2])} gains ${s} (${ev[4]}).`);
      return { kind: 'status', src: ev[1], dst: ev[2], status: s, duration: ev[4] };
    }
    case 7: {
      const s = T.statuses[ev[2]], def = content.statusById[s], x = u[ev[1]];
      if (def.tickDamageBp) x.hp = Math.max(0, x.hp - ev[3]); else x.hp = Math.min(x.maxHp, x.hp + ev[3]);
      log(`${nameOf(st, ev[1])} ${def.tickDamageBp ? 'takes' : 'recovers'} ${ev[3]} from ${s}.`);
      return { kind: 'tick', unit: ev[1], status: s, amount: ev[3], heal: !def.tickDamageBp };
    }
    case 8: { const s = T.statuses[ev[2]]; delete u[ev[1]].statuses[s]; return { kind: 'expire', unit: ev[1], status: s }; }
    case 9: { u[ev[1]].alive = false; u[ev[1]].hp = 0; u[ev[1]].statuses = {}; log(`${nameOf(st, ev[1])} falls.`); return { kind: 'down', unit: ev[1] }; }
    case 10: log(`${nameOf(st, ev[1])} ${ev[2] === 0 ? 'is shocked and loses the turn' : 'has nothing to do'}.`); return { kind: 'skip', unit: ev[1] };
    case 11: log(ev[1] === 1 ? `Encounter won in ${ev[2]} rounds.` : `The party is defeated after ${ev[2]} rounds.`); return { kind: 'enc_end', outcome: ev[1], rounds: ev[2] };
    case 12: u[ev[1]].hp = ev[2]; log(`${nameOf(st, ev[1])} rests to ${ev[2]} HP.`); return { kind: 'rest', unit: ev[1], hp: ev[2] };
    case 13: st.over = true; st.outcome = ev[1]; st.cleared = ev[2]; log(ev[1] === 1 ? `${replay.kind === 'floor' ? 'Floor' : 'Delve'} won: ${ev[2]} encounters cleared.` : `${replay.kind === 'floor' ? 'Floor' : 'Delve'} lost after ${ev[2]} encounters cleared.`); return { kind: 'end', outcome: ev[1], cleared: ev[2] };
    case 14: { // DEATH_SAVE: 0 revived at 1 HP, 1 died for good, 2 saved by a Thread
      const x = u[ev[1]];
      if (ev[2] === 1) { x.alive = false; x.hp = 0; x.statuses = {}; x.lost = true; log(`${nameOf(st, ev[1])} is lost for good.`); } else { x.hp = 1; x.alive = true; log(ev[2] === 2 ? `${nameOf(st, ev[1])} is held back from death by a Thread of the Norns.` : `${nameOf(st, ev[1])} wakes at 1 HP, injured.`); }
      return { kind: 'death_save', unit: ev[1], result: ev[2] };
    }
    case 15: { // PHASE: a legendary boss's HP has fallen through a threshold
      const L = content.legendById[u[ev[1]].id2], p = L ? L.phases[ev[2]] : null;
      log(`${nameOf(st, ev[1])} enters a new phase${p ? `: ${p.name}` : ''}.`);
      return { kind: 'phase', unit: ev[1], phase: ev[2], name: p ? p.name : '' };
    }
    default: throw new RangeError(`unknown event opcode ${op}`);
  }
}

// Applies every remaining event at once (the "skip" button, reduced motion, and tests).
export function applyAll(st, replay, content) { while (st.cursor < replay.events.length) applyEvent(st, replay.events[st.cursor], replay, content); return st; }
