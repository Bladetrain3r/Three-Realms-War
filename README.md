# Three Realms (working title)

A single-player, browser-only, turn-based team-tactics game: build a roster, equip and upgrade it, write runbooks, send
the team on dungeon delves and expeditions, and watch the replay. Plain HTML5 and JavaScript, no runtime
dependencies, a deterministic simulation whose replay is the source of truth. Norse setting: Asgard, Midgard and
Helheim as Ragnarök nears. Open source, MIT, not monetised.

Status: the first dungeon is playable (G4): roster, forge, runbook editor, delves with a replay player, saves in the browser with export and import. Balance is green (148 of 148, `evidence/G3.md`). Expeditions (G5) are built and tested, but their balance needs Ziggy's numbers first (`reports/BLOCKED-G5.md`); the replay-file viewer and the deploy gate (G6) follow.

Play it: `node tools/bundle.mjs --out dist` then open `dist/index.html` in a browser (it works from `file://`), or use the Pages preview once enabled. Nothing is sent anywhere; the game saves in your browser.

Run the tests: `npm install` (one dev dependency, for the browser test) then `npm test`. Measure the sim budgets: `node checks/measure-sim.mjs`.

- `SPEC.md`: what is built and the decisions behind it
- `GATES.md`: the build order and each gate's pass/fail (design first, at STOP-0)
- `DESIGN.md`: the design (formulas with worked examples, content, runbook vocabulary, formats, budgets)
- `reports/STOP-0.md`: the design decisions and Ziggy's answers; `reports/STOP-1.md`: the balance picture, four decisions, and Ziggy's answers
- `client/`: the game page (screens, battle player, procedural art); `tools/bundle.mjs` builds it into one script
- `sim/`: the deterministic core (no DOM, no dependencies); `content/`: game data as JSON; `tests/`, `checks/`, `evidence/`
- `CLAUDE.md`: the working card for the building session
- `LOG.md`: the build log, one block per iterate-evaluate-decide round
