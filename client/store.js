// The save in the browser: holds the current save, runs rules-layer actions (turning refusals into messages), autosaves to
// localStorage when it can, and exports / imports through the same validator the tests use.
import { newGame, playDelve, playDelves, rest, salvageMany, GameError, validateSave, canonical } from '../sim/index.js';

export const SAVE_KEY = 'three-realms.save.v1';

export function createStore({ content, saveSchema, build, storage = null, now = () => '', seed = () => 1 }) {
  let save = null, problem = null, lastBattle = null, lastBatch = null;
  const listeners = [];
  const persist = () => { if (!storage) return; try { storage.setItem(SAVE_KEY, canonical(save)); } catch (e) { problem = `could not write the save to browser storage (${e.name || 'error'}); export it to keep it`; } };
  const stamp = (s) => { s.meta = { savedAt: now(), build }; return s; };
  const set = (next, stampIt = true) => { save = stampIt ? stamp(next) : next; persist(); for (const f of listeners) f(); };

  function load() {
    let raw = null;
    try { raw = storage ? storage.getItem(SAVE_KEY) : null; } catch (e) { raw = null; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw), v = validateSave(parsed, content, saveSchema);
        if (v.ok) { save = parsed; return; }
        problem = `the stored save was refused (${v.errors[0].key}: ${v.errors[0].message}); a new game was started and the old text kept under ${SAVE_KEY}.bad`;
      } catch (e) { problem = 'the stored save was not valid JSON; a new game was started'; }
      try { storage.setItem(`${SAVE_KEY}.bad`, raw); } catch (e) { /* nothing more to do */ }
    }
    save = stamp(newGame(content, seed(), { savedAt: '', build }));
    persist();
  }
  load();

  const wrap = (fn) => {
    try { const r = fn(); return { ok: true, value: r }; }
    catch (e) { if (e instanceof GameError) return { ok: false, code: e.code, message: e.message, details: e.details }; throw e; }
  };
  return {
    get save() { return save; },
    get problem() { return problem; },
    get lastBattle() { return lastBattle; },
    get lastBatch() { return lastBatch; },
    clearProblem() { problem = null; },
    subscribe(f) { listeners.push(f); },
    // run a rules function (save, content, ...args) -> save'
    act(fn, ...args) { return wrap(() => { const next = fn(save, content, ...args); set(next); return next; }); },
    // run a delve; the result and its replay are kept for the battle screen
    delve(opts) {
      return wrap(() => {
        const before = save, out = playDelve(save, content, opts);
        lastBattle = { replay: out.replay, summary: out.summary, before }; lastBatch = null;
        set(out.save); return out;
      });
    },
    // run the same board up to n times; the batch's last run is shown first, any run can be chosen afterwards
    delves(opts, n) {
      return wrap(() => {
        const before = save, out = playDelves(save, content, opts, n), last = out.runs[out.runs.length - 1];
        lastBatch = { runs: out.runs, stopped: out.stopped, totals: out.totals, index: out.runs.length - 1, requested: n };
        lastBattle = { replay: last.replay, summary: last.summary, before };
        set(out.save); return out;
      });
    },
    selectRun(i) { if (lastBatch && i >= 0 && i < lastBatch.runs.length) { lastBatch.index = i; lastBattle = { ...lastBattle, replay: lastBatch.runs[i].replay, summary: lastBatch.runs[i].summary }; } },
    bulkSalvage(ids) { return wrap(() => { const out = salvageMany(save, content, ids); set(out.save); return out.summary; }); },
    rest() { return wrap(() => { const out = rest(save, content); set(out.save); return out.summary; }); },
    exportText() { return canonical(save); },
    importText(text) {
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: [{ key: '(file)', message: 'not valid JSON' }] }; }
      const v = validateSave(parsed, content, saveSchema);
      if (!v.ok) return v;
      lastBattle = null; lastBatch = null; set(parsed, false); return { ok: true };
    },
    reset() { lastBattle = null; lastBatch = null; set(newGame(content, seed(), { savedAt: '', build })); },
  };
}
