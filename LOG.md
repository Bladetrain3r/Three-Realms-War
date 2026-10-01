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
