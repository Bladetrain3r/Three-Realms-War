# Build log

*One block per round (format in `CLAUDE.md`), newest at the bottom, plus a retrospective per gate.*

### R0: prep, 2026-10-01 (conductor, local)
plan: SPEC, GATES, card, README before any code; design before any code (STOP-0) | eval: Ziggy reads them before the first push | expect: his decisions (single player, local, no energy limits, plain JS, art made as needed) reflected verbatim
result: see the first commit
decision: proceed to G0 in the cloud session once the repo is pushed

### R1 — G0/design — 2026-10-01T18:20Z
plan: pre-G0 chat with Ziggy settled the inputs (recorded verbatim in DESIGN.md "Pre-G0 decisions"); write DESIGN.md from SPEC.md with those decisions, v1 content targets raised after Ziggy's note that ~12-15 monsters is a half-hour game (now ~36 regular monsters + 3 bosses + an affix layer, ~15 hero classes) | eval: a Node script that recomputes every worked example in DESIGN.md and prints expected vs computed (committed under evidence/), plus a section-by-section check against the G0 list in GATES.md | expect: every worked example matches to the integer, every G0 bullet has a DESIGN.md section
result: red first, then green — first `--check` run: 29 of 30 examples matched (WE-27 had prose where the value belongs); a command-line recompute of claims the examples did not cover found two errors in my own prose (level-1 Shieldwarden HP written 121, computed 120; gear scale written "1.1x to 1.7x" and "2x to 3x", computed 1.0x to 2.3x and 1.9x to 4.3x); fixed, added WE-31 to WE-33 for formulas that had no example; final run 33 of 33, exit 0 (evidence/G0-check-output.txt)
decision: proceed — every G0 bullet has a DESIGN.md section (evidence/G0.md section 1); STOP-0 report written; nothing coded; no further rounds in this gate

### G0 retrospective — 2026-10-01
rounds used: 1 (one design round, two evaluation passes). What evaluation caught that reading would not: the HP and gear-ratio figures I had written confidently from memory were wrong, and three formulas had no worked example until the gate's "each formula has an example" rule was applied mechanically. The scratch fight showed gear is decisive (0% to 100% win from level 10), a balance fact I had not predicted from the formulas, so it goes to Ziggy as a caveat, not a result. What I would specify differently: the design should state each balance-relevant constant (here the enemy curve constant 22) with the rule for who may change it in G3, because GATES forbids loosening thresholds but is silent on design constants; also a monster-skill model in the scratch check would have made it less crude. Ziggy's mid-session note (12 to 15 monsters is half an hour) changed the content scale before it was written down, which is the cheapest time for it to change.

### R2 — G0/approval + G1/scaffold — 2026-10-01T18:50Z
plan: record Ziggy's approval and the design intent in DESIGN.md (0.2) and STOP-0.md; then G1 round 1: package.json (no dependencies; tests use Node's built-in runner), `sim/arith.js`, `sim/prng.js`, `sim/sha256.js`, `sim/canon.js`, with unit tests including SHA-256 published vectors and design examples WE-01..04 and WE-28..30 checked against the *sim* (not the G0 reference script) | eval: `node --test "tests/**/*.test.mjs"` | expect: all pass; the sim reproduces the doc's PRNG, seed, hash and canonical-JSON values independently of the G0 script
result: green — `node --test "tests/**/*.test.mjs"`: 28 tests, 28 pass, 0 fail; sim reproduces WE-01..04 and WE-28..30 from DESIGN.md; SHA-256 matches the published vectors including a million-"a" input and agrees with Node's crypto at every length 0..130
decision: proceed — foundation is sound; next R3 content data

G1 round map (each a logged round; the gate has no STOP): R3 content JSON in the G2 shape (the sim needs rosters to run a delve; G2 adds schemas and the table cross-check), R4 stats + items + hero units, R5 combat + statuses + runbook, R6 delve generation/runner/rewards, R7 replay writer/reader + 1,000-seed determinism + banned-call guards, R8 budgets measured + browser hash check + evidence/G1.md.

### R3 — G1/content-data — 2026-10-01T19:05Z
plan: author `content/*.json` (realms, statuses, heroes, skills, monsters, items, tables, names, runbook vocabulary) so the sim can run a delve. Generated once from the tables in DESIGN.md by a throwaway script (not committed), so the numbers cannot be mis-typed; constants the sim needs (including the tunable enemy curve constant) live in `content/tables.json`. G2 adds schemas and the permanent DESIGN-to-content cross-check test | eval: counts from the generated files (15 classes, 33 hero skills, 3 set skills, 36 monsters, 3 bosses, 8 affixes) plus a spot-check of rows against DESIGN.md | expect: counts exact; every skill/monster reference resolves
result: red then green — first generation produced the right counts (15 classes, 62 skills = 33+3+8+12+6, 36 monsters, 3 bosses, 8 affixes) but a spot-check of `helheim_banshee` returned undefined: the parser missed backticks around special-skill names, so all 12 signature monsters had silently lost their specials (counts alone would not show it). Fixed the parser, added assertions (signature iff special; exactly 12), regenerated; reference check: every hero/monster/boss/set skill and every rider status resolves. Ambiguity found in DESIGN 10.2/10.3 (element of monster skills with their own riders) resolved as a logged clarification, DESIGN 0.2.1
decision: proceed — content in the G2 shape exists; G2 adds schemas and the permanent cross-check
