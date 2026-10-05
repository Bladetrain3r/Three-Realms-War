# STOP-3: a core run, start to end, for Ziggy to play

*2026-10-05. G0 to G6 are done. 583 tests pass (`npm test`); G3 148 of 148, G5 79 of 79, legends 34 of 34 (`evidence/G3-balance.json`, `G5-balance.json`, `legends-balance.json`). Evidence: `evidence/G6.md`, `legends.md`.
Going public and any announcement are yours; I have done neither. Answer here or on the PR; "defaults" accepts everything marked *mine*.*

## 1. What is playable

- **Play it:** the Pages build of this branch (https://bladetrain3r.github.io/Three-Realms-War/), or locally `node tools/bundle.mjs --out dist` and open `dist/index.html` (runs from `file://`, no server, no account).
- **The loop:** a roster of 15 classes in three realms; a party of four in two rows with a runbook each (menu editor); delves at levels 1 to 50 in three realms (single or "Delve N times" with an activity timer);
  loot with five tiers (Plain to Legendary), the Forge (stars, the mulligan, filter/sort/bulk salvage), Threads of the Norns, rest with a gold cost and debt, training, paragon stars (18 per hero, costing Paragon Points and hearts).
- **Expeditions:** a fogged 20 by 14 map from a seed, provisions, sites of 2 to 6 floors, death saves, wipes that kill; free walk home; the pack counts only if you get home.
- **The end:** five legendary bosses (Fenris, Jormungandr, Ymir, Beowulf, Odin) lair on expeditions (a star on the map), each fighting alone in 3 phases and guarding one fixed Legendary item; beating any four opens **Chaos**, a level-60 boss in 4 phases on level-50
  expeditions. Banking Chaos' kill shows the victory line and sets `won`; the game goes on.
- **Replays:** every battle is a replay (seed + events + hash). "Save replay file" on the Battle screen; the Replays screen loads one, verifies it by re-simulating, and plays it (a changed file is flagged and still plays).

## 2. Decisions for you (everything here is mine unless it says otherwise)

1. **The numbers of the six legends**: HP and stat multipliers, skill powers, phase thresholds (66/33 percent; 75/50/25 for Chaos), and the bounds I tuned them against. A level E+5 party in Runed 3-star gear wins about half of the time against its legend;
   a level-50 party in Heirloom 5-star gear nearly always; Chaos is about 30 percent for "level 50, Heirloom 5-star, one paragon star per stat" and 85 percent with everything. These came from my model parties, not from play. **Please fight them and tell me which feel wrong.**
2. **Which legend drops which item** (Fenris: weapon MIT, Jormungandr: armour, Ymir: helm, Beowulf: charm, Odin: weapon ARC) and the three fixed lines of each. Mine.
3. **"Depth 5 or more"** became "a lair at least 10 cells from home, one floor, one fight". The lowest legend you have not beaten whose level the expedition has reached is the one that lairs; Chaos lairs on level-50 expeditions once four have fallen. Mine.
4. **Reward of a lair**: a boss reward times 6 at the deepest-floor multiplier, 3 hearts, 1 Paragon Point (3 for Chaos). Mine. Chaos gives no item.
5. **The 400 KB page ceiling** is no longer a comfortable fit for features: it is 378,011 bytes of 409,600 after I made the shipping build drop comments and indentation (and stopped shipping the content schemas). I would raise the ceiling to 512 KB rather than squeeze further; your call.

## 3. Known gaps (what I did not do or cannot claim)

- **Never played end to end.** No bot or person has played from a new game to Chaos. The economy to get there (delves to 50, four legend hunts with their deaths) is measured in pieces (G3 pacing, G5 expeditions, the legend fights) and never as one run.
- **Browsers:** all browser evidence is headless Chromium with software rendering. Firefox, Safari, phones and a real GPU were not tested (a 390 px layout is tested in Chromium).
- **Art** is procedural and serviceable: the six new figures are first drafts (`evidence/legends-art.jpg`); there is no sprite animation beyond lunge/shake/fall; no sound or music (BACKLOG: SFX in a polish pass, procedural skaldic music after).
- **Tactics** (runbooks) have barely been exercised by a human; the bot plays the starter runbooks.
- **Not built, by your decision (BACKLOG):** class passives every 10 levels, consumables in runbooks, weapon classes with ranks, unique ultimate skills, NG+.
- **Tests that lean on timing**: one browser test flaked twice (LOG R35); I fixed what I found in it and it passed 3 of 3, but a flake is a flake until it has gone a month.
- The Pages and CI runs I cite are from the GitHub API for earlier commits; the final push of this report is checked in the PR.

## 4. Budgets as measured (`evidence/G6.md`)

Page 378,011 bytes (ceiling 409,600); JS heap 5.46 MB (256 MB); battle frame p95 6.0 ms at 1920 x 1080, software rendering (16.7 ms); one level-50 encounter median 0.078 ms (5 ms); ten thousand delves 1.21 s (60 s).

## 5. Cost and iteration summary (from `LOG.md`)

36 rounds (R0 to R35) over 3 days of calendar time, 38 commits before this one. By gate: G0 2 rounds, G1 6, G2 2, G3 4 (one STOP for your answers), G4 7 plus 2 playtest rounds, G5 5 plus 2 (two STOPs: the lethality bounds were mine and wrong, re-baselined with your word),
the post-STOP-2 features (R27 to R30) and the legends (R31 to R34), G6 1. Tests grew from 0 to 583; the code is about 2,500 lines of sim, 2,000 of client and 5,500 of tests. No round was stopped by "the same check red three times".
**Dollar cost:** I have no figure; I cannot see the usage meter. The session's usage page is the source.
What the evaluation caught that reading would not (the point of the experiment): a stash-overfill bug found by a random player, a bundler that turned a wrong import into `undefined`, a frame-time measurement that measured nothing, my own wrong lethality bounds, a budget test that
undercounted, two surviving mutations in the viewer and the lairs, a flaky test. What it did not catch: anything about whether the game is fun.

## 6. What the next build would do

1. **PvP's replay submission first** (GATES): a player submits a replay of their party winning a fixed scenario; the server (or a static verifier) re-simulates it with this same sim and the content hash, so cheating is impossible without a server fight
   engine. The pieces exist: canonical replays, content hash, `verifyReplay`, a pure-JS SHA-256.
2. A balance pass from your play of the legends and Chaos (decision 1), then the polish list: SFX, the art tweaks you wanted, class passives.
