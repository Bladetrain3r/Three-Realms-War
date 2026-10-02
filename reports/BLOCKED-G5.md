# BLOCKED-G5: expeditions are built; their balance needs your numbers

*2026-10-02. Everything GATES.md asks of G5 is built and tested except one thing: the reward-and-risk bounds I wrote into `checks/balance.yaml` before any expedition code existed are not met by DESIGN section 12 as written (49 of 76 in bounds). Every miss is lethality; the rewards are in bounds. The levers are DESIGN 12 numbers, which are yours (DESIGN 0.2 lets me tune only the enemy curve and the monster profiles). I have not moved a bound and have not changed a design number. Evidence: `evidence/G5.md`, `evidence/G5-balance.json`, `evidence/G5-options.txt`.*

## The finding

With the four starting classes at hero level = expedition level and 3-star Runed gear, the nearest site is wiped out 49% to 93% of the time (bound: 25% at most), and a wipe is permanent. The same party wins a level-20 delve 100% (Midgard), 93% (Asgard), 100% (Helheim). The difference is the shape of a site: five or six fights in a row at level E + idiv(dist, 3), with the boss last and hit points carried between floors, against a steep enemy curve (level +2 is 90% a delve, +4 is 60%, +6 is 24%).

What already works: rewards by depth, silver return on provisions (0.98 to 2.45), items per expedition, no starvation, deeper sites are more dangerous (death ratio 3.2, 2.5, 1.9).

## Options (each measured; pick one, or give me different numbers)

| | what changes | in bounds of 76 |
|---|---|---|
| 0 | nothing: keep section 12 as written and accept that expeditions are brutal (wipe 0.48 to 0.93) | 49 |
| **A (recommended)** | **site level offset `idiv(dist, 3)` to `idiv(dist, 6)`, and one fight per floor** (2 to 1) | **71**: Midgard and Helheim fully in bounds; only Asgard's death rates are over |
| B | A plus death save 4000 to 3000 bp | 72 |
| C | offset to `idiv(dist, 6)` only | 55 |
| D | one fight per floor only | 60 |
| E | death save to 2000 bp only | 57 |

With A, the remaining misses are Asgard alone (hero death per embarked hero 0.21, 0.24, 0.34 against 0.20). That is a realm-strength question that already shows in delves (0.93 against 1.00). **If you extend DESIGN 0.2's tuning permission to G5, I would trim the Asgard monster profiles until the delve table (148 of 148) and this table are both green, and log it as 0.8.** If not, say which bound you would rather I ask you to loosen, one by one, as in STOP-1.

Under option A the floors are also easier to read: "a floor is one fight; the last floor's fight is the boss".

## Other decisions I made while building (all in DESIGN 0.7; tell me if you disagree)

1. Walking home is **free from anywhere on the map** (the design only says running out of provisions sends you home safely). Leftover provisions are not refunded.
2. A site remembers its cleared floors, so retreating and coming back does not pay a floor twice.
3. **If every hero dies, the hall takes in one free level-1 hero**, so a save is never empty. (The design says a wipe never loses the save; it does not say how.)
4. A dead hero's gear returns to the stash; if the stash is full, the cheapest pieces are lost, no more than needed.
5. While an expedition is under way, the party, gear, runbooks, Threads, delves and rests are locked; recruiting and stash work are not.
6. Floors are capped at 6 (the design says "2 to 6" but the formula reaches 10).
7. You asked for debt rules on rest: in debt, expeditions' provisions are refused the same way (`in_debt`).

## What happens next

You choose. With A (or any numbers you give), I change `content/tables.json` only, rerun `node checks/balance-expedition.mjs` and `node checks/balance.mjs` (G3 must stay 148 of 148), regenerate the goldens on purpose, close G5, and go on to G6 (replay-file viewer, deploy, the stop rule, STOP-3). Until then I have not started G6.
