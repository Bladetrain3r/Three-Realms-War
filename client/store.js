// The save in the browser: holds the current save, runs rules-layer actions (turning refusals into messages), autosaves to
// localStorage when it can, and exports / imports through the same validator the tests use.
import { newGame, playDelve, playDelves, batchStop, batchTotals, MAX_BATCH, rest, salvageMany, startExpedition, move as moveExp, enterFloor, retreat as retreatExp, returnHome, GameError, validateSave, canonical } from '../sim/index.js';

export const SAVE_KEY = 'three-realms.save.v1';

export function createStore({ content, saveSchema, build, storage = null, now = () => '', seed = () => 1 }) {
  let save = null, problem = null, lastBattle = null, lastBatch = null, lastReturn = null, busy = null;
  const busyResult = () => ({ ok: false, code: 'busy', message: 'The party is out on a delve run; wait for it to finish (or stop it after the current run).' });
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
    if (busy) return busyResult();
    try { const r = fn(); return { ok: true, value: r }; }
    catch (e) { if (e instanceof GameError) return { ok: false, code: e.code, message: e.message, details: e.details }; throw e; }
  };
  return {
    get save() { return save; },
    get problem() { return problem; },
    get lastBattle() { return lastBattle; },
    get lastBatch() { return lastBatch; },
    get lastReturn() { return lastReturn; },
    get busy() { return busy; },
    stopBatch() { if (busy) { busy.stop = true; for (const f of listeners) f(); } },
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
    // A batch with the activity timer: the same delves one by one, `ms` apart; each is applied and autosaved when it lands, so a reload mid-batch
    // leaves a valid save. The party and the rest of the game are locked meanwhile. The result equals playDelves (tested).
    async delvesTimed(opts, n, ms) {
      if (busy) return busyResult();
      if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH) return { ok: false, code: 'bad_count', message: `a batch is 1 to ${MAX_BATCH} delves` };
      const before = save, runs = [];
      let stopped = 'done', out;
      try { out = playDelve(save, content, opts); } catch (e) { if (e instanceof GameError) return { ok: false, code: e.code, message: e.message, details: e.details }; throw e; }
      busy = { i: 0, n, ms, stop: false }; for (const f of listeners) f();
      try {
        for (let i = 0; i < n; i++) {
          busy.i = i; for (const f of listeners) f();
          if (ms > 0) await new Promise((r) => setTimeout(r, ms));
          if (i > 0) out = playDelve(save, content, { ...opts, force: [] });
          set(out.save); runs.push({ replay: out.replay, summary: out.summary });
          const why = batchStop(save, out.summary);
          if (why) { stopped = why; break; }
          if (busy.stop) { stopped = 'stopped'; break; }
        }
      } finally { busy = null; }
      const last = runs[runs.length - 1];
      lastBatch = { runs, stopped, totals: batchTotals(runs), index: runs.length - 1, requested: n };
      lastBattle = { replay: last.replay, summary: last.summary, before };
      for (const f of listeners) f();
      return { ok: true, value: { runs, stopped, totals: lastBatch.totals } };
    },
    selectRun(i) { if (lastBatch && i >= 0 && i < lastBatch.runs.length) { lastBatch.index = i; lastBattle = { ...lastBattle, replay: lastBatch.runs[i].replay, summary: lastBatch.runs[i].summary }; } },
    // expedition actions: each returns the rules layer's summary; a floor also keeps its replay for the battle screen
    startExpedition(opts) { return wrap(() => { const out = startExpedition(save, content, opts); lastReturn = null; set(out.save); return out.summary; }); },
    expMove(x, y) { return wrap(() => { const out = moveExp(save, content, x, y); if (out.summary.ended) lastReturn = { ...out.summary }; set(out.save); return out.summary; }); },
    expRetreat() { return wrap(() => { const out = retreatExp(save, content); set(out.save); return out.summary; }); },
    expHome() { return wrap(() => { const out = returnHome(save, content); lastReturn = { ...out.summary }; set(out.save); return out.summary; }); },
    expFloor() {
      return wrap(() => {
        const before = save, out = enterFloor(save, content);
        lastBatch = null; lastBattle = { replay: out.replay, summary: out.summary, before, kind: 'floor' };
        if (out.summary.ended) lastReturn = { ...out.summary };
        set(out.save); return out.summary;
      });
    },
    bulkSalvage(ids) { return wrap(() => { const out = salvageMany(save, content, ids); set(out.save); return out.summary; }); },
    rest() { return wrap(() => { const out = rest(save, content); set(out.save); return out.summary; }); },
    exportText() { return canonical(save); },
    importText(text) {
      if (busy) return { ok: false, errors: [{ key: '(game)', message: busyResult().message }] };
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: [{ key: '(file)', message: 'not valid JSON' }] }; }
      const v = validateSave(parsed, content, saveSchema);
      if (!v.ok) return v;
      lastBattle = null; lastBatch = null; lastReturn = null; set(parsed, false); return { ok: true };
    },
    reset() { if (busy) return; lastBattle = null; lastBatch = null; lastReturn = null; set(newGame(content, seed(), { savedAt: '', build })); },
  };
}
