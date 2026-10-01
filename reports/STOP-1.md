# STOP-1: the balance picture, for Ziggy

*2026-10-02. G3 is **not green**: 124 of 148 checks are in bounds, 24 are not, and every one of the 24 needs a design decision. I have
changed nothing that is not mine to change. Evidence: `evidence/G3.md`. Answer in this file or on the PR; "defaults" accepts my
recommendation on every decision below.*

## 1. How this was run

- Thresholds (`checks/balance.yaml`, 47 bounds) were committed in `e71a3ba` **before any runner or result existed**; the file has had
  that one commit and no other. The runner came next (`4d4ad1a`), then the first run: **116 of 148**.
- Reruns are byte-identical (`cmp`); the runner has its own tests; the first run is reproducible from a git worktree at `4d4ad1a`.
- Under your DESIGN 0.2 permission I tuned the enemy curve constant and the monster profile tables (now DESIGN 0.3, K 22 → 34, profiles
  scaled): **116 → 124**, and the gear gap now widens with level (0.11 → 0.42, bound 0.35).

## 2. What is in bounds, and what is not

| Area | Result |
|---|---|
| Delve win rate, levels 1 to 30, all four gear tiers | **in bounds** (low levels playable: level-5 starter gear wins 0.82) |
| Delve win rate, levels 40 and 50 | **6 out**: too easy at the top (L50: starter 0.39, Fine 0.84, Runed 0.97, Heirloom 1.00 against ≤ 0.25 / 0.50 / 0.80 / 0.98) |
| Fight length, injury, death proxy, timeouts | in bounds (median 3 rounds; injury 0.087 per hero per won delve; death proxy 0.0094) |
| Pacing (first upgrade, items to 3 stars, levelling, hearts versus materials) | in bounds; the rare heart IS the bottleneck for the last two stars (ratio 1.22 to 1.33) |
| Upgrade-roll odds | match the design table to within 0.001 |
| Materials per won delve, level 50 over 1 | **out**: 9.0 against ≤ 8 |
| Mirror tournament | **17 out of 53**: 14 of 36 compositions, 2 of 12 classes (Shieldwarden 0.28, Stormcaller 0.76), 1 of 3 realms (Asgard 0.612 against ≤ 0.60) |

## 3. Decisions

### Decision 1: the shape of the enemy curve (the important one)

**Finding.** Hero base stats, gear and enemies all grow linearly with level, so the ratio of hero power to enemy power is almost
constant above level 5. Each gear tier wins the same share at every level (first run: starter 0.14 to 0.28, Fine 0.66, Runed 0.94,
Heirloom 1.00 at levels 5, 10, 20, 30, 40 and 50 alike). That contradicts the intent you approved, that gear becomes progressively more
necessary. I searched about 770 settings of the two knobs you gave me (K and the profiles); **the best reaches 23 of 29 delve checks
and no setting makes the better tiers decline with level.**

**Option A (recommended): give the curve one quadratic term.** `enemy(p, L) = p + idiv(p * (K*49*(L-1) + Q*(L-1)^2), 49^2)`; today's
curve is Q = 0. With **K = 30, Q = 10** and the current profiles, **129 of 148** are in bounds and the delve table comes out like this:

| Level | starter | Fine | Runed | Heirloom |
|---|---|---|---|---|
| 5 | 0.92 | 1.00 | 1.00 | 1.00 |
| 20 | 0.48 | 0.85 | 0.98 | 1.00 |
| 40 | 0.16 | 0.59 | 0.87 | 1.00 |
| 50 | 0.08 | 0.47 | 0.76 | 0.99 |

That is the story you described: starter gear is enough early, by the top only upgraded Runed and Heirloom keep a party on-level. One
delve check is still out (L50 Heirloom 0.99 against ≤ 0.98), see decision 4.
**Option B:** keep the linear curve and loosen the level-40 and level-50 bounds. I do not recommend it, because it writes the
scale-invariance into the thresholds.

> **Your answer:** A / B / other: ______

### Decision 2: hero balance in the mirror

**Findings.** Tank-heavy teams lose and damage-heavy teams win: the worst composition is `draugr_knight + hunter + rime_mender +
shieldwarden` at 0.04, the best `einherjar + hearthkeeper + huscarl + stormcaller` at 0.93. Two things appear to drive it: a tank's
base attack is 60% of a damage dealer's (Shieldwarden MIT 12 against Huscarl 20) and their extra guard buys little, and the four-target
skills (Chain Lightning, Volley, Pinion Volley, Cleave, Storm Rend) deal roughly double the total damage of the same class's single-target
skill when four enemies stand. Raising tank damage and cutting four-target damage moves the numbers the right way (table below). I tested
and **refuted** two other explanations: the mitigation constant (12 → 4
per level changes nothing useful) and a front-row damage reduction (makes it worse).

Measured against the same bounds (`node checks/options.mjs`):

| Variant (hero numbers are yours to change) | Mirror checks out of 53 |
|---|---|
| today | 17 |
| tank skills (Shield Bash, Cold Grip) ×1.5 | 11 |
| hero four-target skills ×0.7 | 17 |
| **four-target skills ×0.7 and tank skills ×2** | **10**: realms all in; classes all in except Skyrider (0.30); the 9 left are extreme compositions (0.06 to 0.24 and 0.79 to 0.87) |
| ... plus heals ×1.5 | 15 (worse) |

**The bound itself is also a question.** "Any random four-class team must win between 25% and 75%" is strict for a game whose point is
loadouts and synergy; a team of two healers and a ranged unit *should* be weak. With the variant above, loosening only the composition
bound to [0.10, 0.90] would leave 1 composition (0.056) and, with the class bound unchanged, Skyrider (0.30) out; widening the class bound
to [0.30, 0.70] as well would leave only that one composition.

**Recommendation.** Apply "four-target skills ×0.7 and Shield Bash / Cold Grip ×2" (a change to eight skill rows in DESIGN 7.4), and
set the composition bound to [0.10, 0.90] and the class bound to [0.30, 0.70]. If you would rather keep the classes as designed, say so
and I will leave the mirror red and mark it as a known, accepted result, but then the thresholds need your word to loosen.

> **Your answer:** apply the recommendation / keep heroes and loosen bounds / other: ______

### Decision 3: materials growth (9.0 against ≤ 8)

The formula `2 + floor(D / 3)` pays 10 at level 1 and 90 at level 50. `matBase` 3 gives 6.3×, 4 gives 5.0×. A change to DESIGN 11.2 (the
level-1 number rises from 2 to 3 per encounter). **Recommendation: matBase 3.** The alternative is to loosen the bound to 9.

> **Your answer:** matBase 3 / loosen to 9 / other: ______

### Decision 4: level-50 Heirloom at 0.99 against ≤ 0.98

Marginal, and only under option A. A five-star Heirloom party on-level winning 99% is arguably the right end state. **Recommendation:
loosen that one bound to [0.65, 1.00].**

> **Your answer:** loosen / tune Q or the boss multiplier instead: ______

## 4. What to weigh

- **The gear ladder carries no bonus lines**, so real gear is stronger than the table; the mirror uses my per-class runbooks
  (`checks/balance-runbooks.json`), so class results say something about those runbooks. Neither is a threshold.
- The injury and death figures are proxies. G5 re-checks the death rate with real expeditions.
- Decisions 1 to 4 are all small edits (one formula term, eight skill rows, one number, three bounds), but 1 and 2 change what the
  game *feels* like. If you want to look at either before committing, `node checks/options.mjs` reproduces every table above.

## 5. What happens on your answer

I apply the approved changes as DESIGN 0.4 (formula, tables, worked examples, content, schema, tests, golden hashes), rerun the balance
runner until every bound you have not changed is green (the thresholds you loosen are edited in `checks/balance.yaml` with your
answer quoted in the commit), write the G3 retrospective, and carry on to G4, the client. Nothing in G4 depends on the answers except
the content numbers.

## Your answers

*(write here, or reply on the PR)*
