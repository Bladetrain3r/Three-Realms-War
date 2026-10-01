# Three Realms — the building session's card

You are building Three Realms (working title): a single-player, browser-only, turn-based team-tactics game in plain
HTML5 and JavaScript, with a deterministic simulation whose replay is the source of truth. Ziggy (the owner) checks in
at the STOP points. The conductor (Ziggy's coordinating Claude seat) wrote this card, `SPEC.md` and `GATES.md`.

This build is also an experiment in **how** an unattended session works: iterate, evaluate, proceed. `LOG.md` is a
deliverable, as important as the code.

## Read at start, every session
1. This file, then `SPEC.md`, then `GATES.md`, then `DESIGN.md` once it exists (it is the stone: code follows it).
2. `LOG.md` (the last rounds) and `reports/` (the latest STOP report and Ziggy's answers).
3. `git log --oneline -15`.

## The loop (one round)
1. **Plan:** the next unmet check in the current gate; one line in `LOG.md` saying what you will change and how you will
   know it worked, *before* changing anything.
2. **Iterate:** the smallest change that could pass that check.
3. **Evaluate:** run the check (a test, a headless run, a measurement). The evaluation is a command with output, never a
   reading of your own code.
4. **Decide:** proceed (green, commit), iterate (red, with a new idea: log why the last try failed), or stop (the third
   red in a row on the same check, or a STOP point). Log it.

`LOG.md` round format (one block per round, newest at the bottom):
```
### R<n> — <gate>/<check> — <UTC timestamp>
plan: <change> | eval: <command or check> | expect: <what green looks like>
result: <green|red> — <one line of evidence: numbers, test counts, the failing assertion>
decision: <proceed|iterate|stop> — <why, one line>
```
Once per gate, a **gate retrospective** (3 to 5 lines): rounds used, what the evaluation caught that reading would
not have, what you would specify differently next time.

## Boundaries
- Work only in this repository. Commit often, with messages that name the gate.
- Branches: the session's branch; at each STOP point open or update one PR to `main` linking the report. Never merge
  to `main` yourself; never force-push; never change repo settings.
- **Dependencies:** none at runtime. Dev dependencies only for tests (a test runner, a headless browser). Every
  addition is logged with the reason. No CDN scripts in the shipped page.
- **Determinism is a rule, not a feature:** no `Math.random`, no `Date.now()` inside the sim, no iteration-order
  dependence, no floating-point accumulation where a replay could drift. A test enforces it from G1 on.
- **Nothing from the commercial games this resembles**: no names, assets, copy or data. Norse mythology is public;
  anyone's game's version of it is not.
- Art: procedural or hand-written vector shapes in the style guide; no third-party assets of any kind.
- Never invent a measurement. A budget figure is a number from a run, with the command that produced it.
- Design questions are Ziggy's: if a formula will not balance or the vocabulary lacks a thing, STOP and ask; do not
  quietly edit `DESIGN.md`.

## Layout (create at G0; adjust with a logged reason)
```
DESIGN.md          the design, approved at STOP-0; versioned with a Changes section
sim/               the deterministic core (no DOM): prng, combat, delve, expedition, replay, save
content/           heroes, items, enemies, dungeons, runbook vocabulary, tables (JSON) + schema/
client/            index.html, canvas renderer, screens, runbook editor, replay viewer (plain JS modules)
checks/            balance.yaml (thresholds first), balance runner, budget measurements
tests/             unit (Node), determinism, content, headless-browser
evidence/          one file per gate, screenshots under evidence/G4/
reports/           STOP-0.md ... STOP-3.md, BLOCKED-*.md
.github/workflows/ ci.yml, pages.yml
```

## Style
Plain ES modules, no transpiler. Small files (under 400 lines). The sim never imports from the client. Content
is data. Tests name the system and the check. Plain, dated prose in the docs.

## When a STOP point arrives
Write the report as `GATES.md` says; open or update the PR; then stop. Do not start the next gate on assumptions.
