# Gates

*Fixed before any code (2026-10-01). A gate passes only when every check is green and its evidence file exists under
`evidence/`. The builder never works past a red gate; checks may be tightened, never loosened without Ziggy's word.
**STOP** means write the named report, open or update the PR, and wait.*

## G0 — Design, then STOP-0 (the design is stone; code is soil)
- `DESIGN.md` written from `SPEC.md`: the stat model and the damage/resist formulas with worked examples; hero classes
  and the starting roster; equipment slots, tiers, item levels, roll tables and set bonuses; the runbook vocabulary
  (every condition and action, with its arguments); the three realms and their dungeon rosters; the expedition map
  rules; the save-file schema; the art style guide; the budgets as numbers; the replay format.
- Each formula has a worked example a reader can check by hand.
- Evidence: `evidence/G0.md`. **STOP-0:** `reports/STOP-0.md` lists the decisions Ziggy must approve or change
  (formulas, vocabulary, roster, budgets, the realm lore). Nothing is coded until he answers.

## G1 — The deterministic core
- `sim/` with no DOM and no browser dependency: seeded PRNG, the combat resolver, the encounter and delve runners, the
  replay writer and reader. Runs under Node for tests and in the browser unchanged.
- **Determinism:** the same inputs give byte-identical replays over 1,000 random seeds; a test that injects
  `Math.random` or a wall-clock read fails loudly; replay hashes match between Node and the browser (G4 re-checks).
- Replay round trip: a replay read back resolves to the same final state.
- Evidence: `evidence/G1.md`.

## G2 — Content as data
- Heroes, items, enemies, dungeons, runbook vocabulary and tables as JSON validated against schemas; a corrupted file
  (a renamed key, a bad tier) is refused naming the file and the key.
- The content matches `DESIGN.md` exactly (a test cross-checks every number in the design's tables).
- Evidence: `evidence/G2.md`.

## G3 — Balance, with the thresholds written first
- `checks/balance.yaml` committed before any balance run: win-rate bounds in a mirror tournament, expected delve
  rewards by tier, upgrade-roll odds, hero death rates on expeditions, time-to-first-upgrade.
- Headless runs (ten thousand delves, a round-robin of starting rosters) produce the numbers; each is in bounds or the
  content changes (never the thresholds). Reruns are byte-identical (G1).
- Evidence: `evidence/G3.md` with the tables. **STOP-1:** `reports/STOP-1.md`, the balance picture for Ziggy.

## G4 — The client, first dungeon playable
- Canvas 2D client with no runtime dependency: roster, equipment and upgrade screens, runbook editor, a delve that
  resolves and plays back, the save in browser storage with export and import.
- Headless-browser tests: every screen renders; the replay hash in the browser equals Node's for the same inputs; the
  runbook editor refuses an invalid runbook with the reason; export then import restores the same save.
- Budgets measured and in bounds: memory, frame time, bundle size. Screenshots at desktop and 390 px in
  `evidence/G4/`.
- Evidence: `evidence/G4.md`. **STOP-2:** `reports/STOP-2.md`, with a link to the deployed preview; Ziggy plays it.

## G5 — Expeditions and permadeath
- The generated regional map, grid exploration, procedural dungeons, permanent loss of a team; rewards by depth.
- Tests: map generation deterministic by seed; a lost team is gone from the save; reward curves in the bounds set in
  `checks/balance.yaml` before the run.
- Evidence: `evidence/G5.md`.

## G6 — Replay viewer, deploy, the stop rule
- A replay file loads and plays back in the client; the Pages workflow builds and deploys; a CI run proves tests,
  determinism, budgets and the deploy on every push.
- Evidence: `evidence/G6.md`. **STOP-3 (the stop rule):** `reports/STOP-3.md`: what is playable, known gaps, the
  budgets as measured, the cost and iteration summary from `LOG.md`, what the next build would do (PvP's replay
  submission first). Going public and any announcement are Ziggy's acts.

## Iteration limits
- The same check red three rounds in a row: stop, write `reports/BLOCKED-<gate>.md`, wait.
- A design question that surfaces mid-gate (a formula that cannot be balanced, a vocabulary gap) is a STOP, not a
  silent change to `DESIGN.md`.
