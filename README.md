# Three Realms (working title)

A single-player, browser-only, turn-based team-tactics game: build a roster, equip and upgrade it, write runbooks, send
the team on dungeon delves and expeditions, and watch the replay. Plain HTML5 and JavaScript, no runtime
dependencies, a deterministic simulation whose replay is the source of truth. Norse setting: Asgard, Midgard and
Helheim as Ragnarök nears. Open source, MIT, not monetised.

Status: design approved; the deterministic core (`sim/`), content as validated data (G2) and the balance runner (G3) are built and tested. At STOP-1: balance needs four design decisions (`reports/STOP-1.md`). No client yet. Not playable.

Run the tests: `npm install` (one dev dependency, for the browser test) then `npm test`. Measure the sim budgets: `node checks/measure-sim.mjs`.

- `SPEC.md`: what is built and the decisions behind it
- `GATES.md`: the build order and each gate's pass/fail (design first, at STOP-0)
- `DESIGN.md`: the design (formulas with worked examples, content, runbook vocabulary, formats, budgets)
- `reports/STOP-0.md`: the design decisions and Ziggy's answers; `reports/STOP-1.md`: the balance picture and four decisions
- `sim/`: the deterministic core (no DOM, no dependencies); `content/`: game data as JSON; `tests/`, `checks/`, `evidence/`
- `CLAUDE.md`: the working card for the building session
- `LOG.md`: the build log, one block per iterate-evaluate-decide round
