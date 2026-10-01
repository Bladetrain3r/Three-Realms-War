# STOP-0: the design, for Ziggy's approval

*2026-10-01. `DESIGN.md` v0.1 is written; nothing is coded. Evidence: `evidence/G0.md` (33 of 33 worked examples
recomputed and matching). Answer by editing this file, or in a PR comment, and the next session starts G1.*

## A. Your answers as I read them (confirm or correct)

| # | Your answer | How `DESIGN.md` implements it |
|---|---|---|
| 1 | pacing is feed rate and consumption, casual to resume | no clocks, no decay; materials in vs upgrade/recruit/provision costs out (11.5); provisions pace expeditions (12.2) |
| 2 | 4v4, two rows | 5.1, 5.4: melee only reaches the front row while it stands |
| 3 | standard realm affinities, themes, reputation gates | 7.1, 10, 11.3 |
| 4 | delves injure; a rare insurance item saves one hero once | 5.9 (a hero at 0 HP at the end becomes injured), 11.4 (Thread of the Norns, assigned to one hero, consumed automatically) |
| 5 | form-based runbook editor, extensible | 9: 16 conditions, 8 rules max, up to 2 clauses ANDed |
| 6 | tens to low thousands, level cap 50, base cap 10x, gear a multiple | 4.2 to 4.4; level-50 geared HP is about 2,460 to 3,550 |
| 7 | safe failures, one mulligan, every attempt costs | 8.4 (my reading, see B1) |
| 8 | injury = unavailable for X delves; forced = halved stats | X = 2 (`INJURY_DELVES`), 5.9 |
| 9 | ignore pets | not in the build; SPEC.md unchanged |
| 10 | 12 to 15 monsters is half an hour | v1 raised to 36 monsters + 3 bosses + 8 affixes, 15 classes (section 2) |

## B. Decisions I made that you did not specify (approve or change)

1. **The mulligan.** Each attempt rerolls all bonus lines and may raise the star. You then keep the new lines or use your
   one mulligan to keep the old lines (the star result stands). One charge per item, refilled when the star rises; using
   it does not refund the attempt. I read "failure" as "the star roll did not succeed", since the item is never harmed.
2. **Content scale** (section 2): 15 classes, 36 monsters in 12 rows x 3 realms, 3 bosses, 8 affixes, 3 sets. Resize freely;
   it is data entry plus balance work, but the balance work grows with it.
3. **Combat core:** no mana. Skills have cooldowns (2 to 5 turns) and runbooks choose when to use them. Armour has
   diminishing returns capped at 80% (`def / (def + 40 + 12 x attacker level)`). No misses, 90 to 110% variance, 5% crit at 150%.
4. **Seven statuses** (burn, chill, shock, mark, bulwark, fury, mend). Shock skips one action then grants 2 turns of
   immunity; bosses cannot be shocked.
5. **Elements:** fire (Midgard), frost (Helheim), lightning (Asgard). Each dungeon's monsters resist their element and are
   weak to the next in the cycle (Helheim heroes shine in Midgard's dungeon, Midgard's in Asgard's, Asgard's in Helheim's).
6. **Realm lore:** fire-giants of Muspel break across Midgard, the storm-giants of Thrym assault Asgard, the dead stir
   behind Garm in Helheim; bosses Surtr, Thrym and Garm. All names are public Norse myth; none is copied from any game.
7. **Rewards and thresholds:** reputation Known 50 / Trusted 150 / Honoured 400; rare class at Known, set drops at
   Trusted, insurance purchasable at Honoured (5 hearts), 3% from delve bosses. Recruit cost `100 + 20 x level`, rare x3.
8. **Expeditions:** a 20 x 14 grid, provisions as the consumption limit (running out ends the expedition safely, it never
   kills), 2 to 6 floors per site, a death save of 40% per downed hero after a won encounter, total loss of that party
   after a lost one, gear returns to the stash, an unbanked pack is lost on a wipe. Individual deaths and wipes are the
   permadeath; the save and the rest of the roster survive.
9. **Technical:** SHA-256 in pure JavaScript for replay hashes (so Node and the browser run identical code); the PRNG is
   `sfc32` seeded by `splitmix32`; canonical JSON with sorted keys; delve seeds derived from a counter kept in the save.
10. **Budget ceilings** (section 15): encounter <= 5 ms median, ten thousand delves <= 60 s, tab <= 256 MB, p95 frame
    <= 16.7 ms, bundle <= 400 KB, save <= 512 KB. These are proposals, not measurements.
11. **Legendary and unique-lord rarities** exist in the schema and are unused in this build.

## C. Caveats you should weigh before approving

- **Balance risk, honestly.** A crude scratch fight (`evidence/G0-scratch-curves.mjs`, no monster skills or healing) says
  gear is decisive: from level 10, no gear loses every time and plain gear wins every time. The window between is
  narrow in that model. With monster skills, statuses and affixes it will move, but expect G3 to harden the monsters.
  The enemy curve constant (22, section 4.5) is a *design* constant, so changing it is a design change. **Question:**
  may G3 adjust that single constant (logged in Changes) without a new STOP, or do you want a STOP for it?
- **Mulligan and injury numbers** are the most "feel"-sensitive and the least tested.
- **Party synergy beyond sets** (e.g. a bonus for three heroes of one realm) is deliberately absent. Say if you want one.
- **Expedition state schema** is not written yet; it is specified as a `Changes` entry at the start of G5.
- The 892-line `DESIGN.md` is long. Sections 4 to 6 (the maths), 9 (runbooks) and 10 (monsters) are where a wrong number
  would hurt most; the rest is mostly tables.

## D. What happens on approval

G1 starts: `sim/` with the PRNG, SHA-256, combat resolver, delve runner and replay writer/reader; the 1,000-seed
determinism test; the banned-call test; and the `[WE-nn]` examples reimplemented in the sim and cross-checked against
`evidence/G0-check-output.txt`. First measured sim budgets arrive there.

## Your answers

*Ziggy, 2026-10-01, in chat:* "Read through it and it looks good to go with unless gate pauses or stops happen. On balance in
section C in particular, yea gear should become more necessary over time."

Recorded as: **approved as written**; later gates proceed until a STOP point or a blocked gate. On the enemy-curve
question, G3 may tune the constant and the monster profiles (each change logged in `DESIGN.md` Changes with its
measurement), with the intent that gear becomes progressively more necessary as level rises (`DESIGN.md` 0.2).
