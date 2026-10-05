# BLOCKED-G5, second version: two small things left, both yours

*2026-10-05. This replaces the first version (it is in git). With your word ("Go ahead with your suggested order") I re-baselined the expedition bounds in `checks/balance.yaml` (`expedition_v2`, committed before the runner changed): a **well-built** party should usually come home and deeper sites should pay for their danger; a **badly-built** party should often not. Result against the design as written: **76 of 79 in bounds**. Evidence: `evidence/G5-balance.json` (800 per cell, the cells of the old party; 267 per realm and level for the well-built party), `evidence/G5.md`.*

## What the design does for each kind of party

| | nearest site wipes | sites 12+ away wipe | expected silver per attempt, nearest / deep |
|---|---|---|---|
| well built (four level-50 heroes, Heirloom 5-star gear at item level E), E 20 | 0.0% | 0.1% | 392 / 833 |
| E 30 | 0.5% | 14.9% | 552 / 954 |
| E 40 | 9.4% | 57.8% | 614 / **556** |
| badly built (hero level = E, 3-star Runed), E 10 to 30 | 48% to 93% | not run | n/a |

The badly built party is the one I first measured; it is now in bounds as the "death pit" you described (bound 0.35 to 0.97). Everything about rewards by depth, silver return, items, starvation and floor steps, and "deeper is more dangerous", is in bounds unchanged.

## The three misses, as two decisions

1. **At E 40 a deep site does not pay for its risk** (0.91 of the nearest site's expected silver, 0.94 of its xp; the bound says at least 1.0). Wipes there are 58%, so the deeper floors' extra fights are not rewarded enough. Options, each measured by one content value, everything else as designed:
   - `distBp` (the reward multiplier per cell of distance, now 300): **700** gives 78 of 79 (only item 2 below remains); 600 gives 77 of 79 (silver ratio 0.98); 450 changes little; 800 and up break the silver-return ceiling (3.04 against 3.0). The window is narrow, so I would take **650 to 700** and say so. This changes WE-24 and WE-25 (their text), which is why it is yours.
   - Or leave it and accept that, at the top, the nearest site is the better trade (some players like that, and the legendary lairs you described would be the reason to go deep).
2. **At E 20 a well-built party never loses at deep sites** (0.1% against my lower bound of 5%). That is my bound being wrong, not the game: a level-50 party is thirty levels above E 20, and "danger scales with the E you pick" is the point. **I would set that one bound's floor to 0 for E 20, but a threshold I wrote does not move without your word.**

## Still to confirm (unchanged from the first version; DESIGN 0.7)

Walking home is free from anywhere on the map; a site remembers its cleared floors; if every hero dies the hall gives one free level-1 hero; a dead hero's gear returns to the stash (the cheapest lost if it is full); the party, gear, runbooks, Threads, delves and rests are locked while away; floors are capped at 6; in debt, provisions are refused.

## What happens next

Say yes to 1 (a number, or leave it) and 2 (floor to 0 for E 20), or give me others. I change `content/tables.json` and, if you agree, that one bound; rerun `node checks/balance-expedition.mjs` and `node checks/balance.mjs` (G3 must stay 148 of 148); regenerate the goldens on purpose; close G5. G6 is not started.
