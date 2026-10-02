# Three Realms (working title): design

*Version 0.1, written 2026-10-01 for STOP-0. This is the stone: code follows it, and a change to it is a logged entry in
"Changes" at the end, approved by Ziggy. Every worked example is tagged `[WE-nn]` and ends in `=> values`; the script
`evidence/G0-worked-examples.mjs --check` recomputes each one and compares it to the line here.*

## 1. Pre-G0 decisions (Ziggy, 2026-10-01, in chat before this document)

1. **Pacing is feed rate against consumption.** Casual and easy to resume after an absence: no clock, no decay, no
   penalty for being away. Progress is limited only by how fast materials come in and how fast upgrades, provisions and
   recruiting use them up.
2. **Teams are 4 against 4, in two rows** (two front, two back).
3. **Realms are standard**: hero stat affinities, dungeon themes, and reputation that gates faction-specific rewards.
4. **Permadeath exists, but** (a) an ordinary single delve only ever produces injuries; (b) a rare insurance item saves one
   named hero once and is consumed automatically.
5. **The runbook editor is form based**, built so the vocabulary can be extended later by small bounded steps.
6. **Number scale:** stats start in the tens and end in the low thousands; level cap about 50; base stat cap about 10x the
   level-1 value. Derived stats run a bit higher and gear adds multiples of the base at the high end (section 4).
7. **Upgrade failures are safe.** Each attempt rerolls the bonus lines; the player gets one mulligan; every attempt costs
   its materials.
8. **Injury** means unavailable for N delves; forcing an injured hero into a fight halves all their stats.
9. **Spirit pets are not in this build** (SPEC.md's out-of-scope list stands).
10. **Content scale.** Ziggy's figures (about 60 hero classes: 40 common, 10 rare, 7 legendary, 3 unique lords; about 100
    monsters) are the post-live target. For this build the design sets its own figures (section 2). Ziggy added that
    12 to 15 monsters is a half-hour game; the v1 target was raised accordingly.

## 2. Content scale for this build (a proposal, STOP-0 decision)

| Content | This build | Post-live target (Ziggy) | How it scales |
|---|---|---|---|
| Hero classes | 15 (12 common, 3 rare) | about 60 (40 / 10 / 7 / 3 lords) | rows in `content/heroes.json` |
| Hero skills | 33 | grows with classes | rows in `content/skills.json` |
| Regular monsters | 36 (12 per realm) | about 100 | archetype x realm skin x signature rows |
| Bosses | 3 (one per realm) | more per realm and tier | rows |
| Monster affixes | 8 | open | rows, stackable at high delve levels |
| Item sets | 3 (one per realm) | open | rows |
| Dungeons | 3 (one per realm), levels 1 to 50 | more per realm | rows |

Variety comes from combination, not from a long hand-written list: 36 monsters, 8 affixes, 3 threat bands, weighted
encounter composition, 15 classes, 4 rows of gear with random lines, and runbooks the player writes. Everything in the
table is data (`content/`), so growing it is data entry and a re-run of the balance checks, never new engine code.

## 3. Arithmetic and randomness

**Integers only.** Every value in the simulation is a non-negative integer, except resistances, which may be negative
(a weakness) and are held as integers too. Rates are **basis points** (bp): 10000 is 100%.

- `idiv(a, b) = (a - (a % b)) / b`: floor division, exact for integers below 2^53.
- `mulbp(x, bp) = idiv(x * bp, 10000)`. Every product in this document stays below 10^12, far under 2^53.
- No floating-point arithmetic, no `Math.round`, no `Math.floor` on a quotient, anywhere in `sim/`.
- Every formula states its order of operations; a flooring step after each multiplication is part of the formula.

[WE-01] `mulbp(37, 11500)` is 425500 / 10000 floored; `idiv(1000000007, 6)` => 42, 166666667

**PRNG.** `splitmix32` expands a 32-bit seed into the four 32-bit words of an `sfc32` generator, which is then run for 12
throwaway draws. Both are integer-only (`Math.imul`, shifts, `|0`, `>>>0`). The code is the reference in
`evidence/G0-worked-examples.mjs` and is reproduced in the replay spec.

`range(n)` returns an unbiased integer in `[0, n)` by rejection: `limit = 2^32 - (2^32 mod n)`; draw until `x < limit`;
return `x mod n`. It never calls any other source of randomness.

[WE-02] `range(6)`: limit, the rejected first draw 4294967293, the accepted 1000000007 mod 6 => 4294967292, 4294967293, 5

[WE-03] `sfc32` seeded with 1, the first three raw draws after warm-up => 1689047798, 3678829038, 1136791837

**Seeds are derived, never ambient.** The save holds a `masterSeed` and a `counter`. A delve's seed is
`deriveSeed(masterSeed, counter)`, then the counter increments and the save is written. `deriveSeed(m, n) =
splitmix32((m + imul(n + 1, 0x9e3779b1)) | 0)()`.

[WE-04] `deriveSeed(1, 0)` and `deriveSeed(1, 1)` => 3675335440, 414504250

**Rolls are always drawn in a fixed order** (stated per rule below), and a roll that a rule needs is drawn even when its
outcome is certain by the numbers (a 0 bp crit chance still draws), so the stream position never depends on content
values. The one exception is stated in 5.6: a status chance of 10000 bp or more applies without a draw.

**Banned in `sim/`:** `Math.random`, `Date`, `performance.now`, `Object.keys` order as a source of order (loops run over
arrays in a defined order), `Map`/`Set` iteration as a source of order, `sort` without a total-order comparator,
`localStorage`, any DOM.

## 4. Stat model

### 4.1 Primary stats (all integers)

| Stat | Meaning |
|---|---|
| VIG | vigour: maximum HP is `5 x VIG` (the first derived stat: a bit higher than the base) |
| MIT | might: physical attack power |
| ARC | arcana: magic attack power and healing power |
| GRD | guard: physical defence |
| WRD | ward: magic resistance |
| SPD | speed: turn order |

Secondary values: `CRIT` (crit chance, bp, base 500), `CRITDMG` (crit multiplier, bp, base 15000), `SRES` (status
resistance, bp, base 500 for heroes), and elemental resistances `RES_fire`, `RES_frost`, `RES_lightning` (bp, base 0,
clamped when used to `[-5000, 7500]`).

### 4.2 Hero stat curve

A class has a level-1 profile `s1` for each primary stat. At level `L` (1 to 50):

`base(s1, L) = s1 + idiv(s1 * 9 * (L - 1), 49)`

so level 50 is exactly 10x level 1 (the stat cap), and the growth is linear.

[WE-05] Shieldwarden VIG 22 at L1, L26 and L50 => 22, 123, 220

### 4.3 Realm affinity

Each class belongs to one realm. A hero's base stats for that realm's two affinity stats are multiplied by `+1000 bp`
after the level curve (section 7.1 names them), and the hero gains `RES` of the realm's element of `+2000 bp`.

[WE-06] Midgard affinity on VIG 123: `mulbp(123, 11000)` => 135

### 4.4 Final stat

Order, for each primary stat: **(1)** level curve, **(2)** realm affinity (if it applies to that stat), **(3)** add flat
gear values, **(4)** multiply by `10000 + sum(percent lines) + sum(status modifiers)` bp, **(5)** if the hero is injured
and forced to fight, halve it (`mulbp(x, 5000)`), **(6)** floor at 1. Max HP is `5 x` the final VIG.

Gear's main stat for an item of item level `i`, slot coefficient `c`, tier multiplier `t` (bp) and star `s`:

`main = mulbp(mulbp(c * i, t), 10000 + 500 * s)`

[WE-07] armour GRD (coefficient 4), item level 26, Runed (13000 bp), star 2 => 148

[WE-08] Shieldwarden L26 VIG 135 after affinity, plus armour VIG 78 and helm VIG 52 (flat 130), plus a 1000 bp VIG line: final VIG, then max HP => 291, 1455

**The scale this produces** (computed with the formulas above for a level-50 Shieldwarden, item level 50 gear): base VIG
is 220, 242 after affinity. Plain armour and helm add 250 VIG, so max HP is 2,460; a five-star Heirloom pair adds about
470, so max HP is about 3,550, before any lines. Per stat, plain item level 50 gear adds 1.0x to 2.3x of the base (VIG
1.03x, GRD 1.00x, WRD 1.25x, MIT 2.27x) and a five-star Heirloom set adds 1.9x to 4.3x. That is the "gear adds multiples of
the base at the high end" decision: geared HP lands in the low thousands, and gear is the progression story.

### 4.5 Enemy stat curve

Enemies are not built from equipment. An archetype has a level-1 profile `p`; at level `L`:

`enemy(p, L) = p + idiv(p * (30 * 49 * (L - 1) + 10 * (L - 1) * (L - 1)), 49 * 49)`

(the multiplier is 41 at level 50: 30 from the linear term, 10 from the quadratic term, plus 1). Order, flooring after each step: the curve, then the signature (`x11500`) or boss multiplier
(10.3, 10.4), then the realm tilt (+1000 bp on two stats, section 10.2), then affixes. The constants (K = 30, Q = 10) and the level-1 profiles of section 10.2 were tuned in G3 against `checks/balance.yaml` (Changes 0.3 and 0.4); the quadratic term is what makes the better gear tiers lose ground as level rises.

[WE-17] brute VIG 6 at L26: scaled, Midgard tilt, max HP, and max HP with the Hardy affix (+4000 bp) => 113, 124, 620, 865

Enemy `SRES = 500 + 80 x level`, `CRIT = 500`, `CRITDMG = 15000`. Enemy elemental resistances: the realm's own element
`+5000`, and the element the realm is weak to `-2500` (section 10.1).

## 5. Combat

### 5.1 Setup

Each side has up to four units in slots 0 to 3 (slots 0 and 1 are the **front row**, slots 2 and 3 the **back row**).
Unit ids: heroes 0 to 3 by slot; enemies 4 to 7 by slot. Cooldowns start at 0, statuses empty, HP full for the first
encounter of a delve (section 5.8 for later ones).

### 5.2 Rounds and turn order

A round begins by sorting the living units by `SPD` descending, ties broken by lower id (a total order, computed once at
the start of the round; chill and haste apply from the next round). Each unit in that order takes a turn if it is still
alive. A fight ends the moment one side has no living units. After **30 rounds** with both sides alive the encounter is
a loss for the player.

[WE-16] SPD 14, 9, 14, 12, 9, 12 for ids 0 to 5, with id 3 chilled (-3000 bp, so 8): the order => 0, 2, 5, 1, 4, 3

### 5.3 A unit's turn

1. Every cooldown on the unit decreases by 1 (to a floor of 0).
2. Tick effects fire: burn deals damage, mend heals (5.6). If burn downs the unit, the turn ends.
3. If the unit has **shock**, it skips its action (event `SKIP`).
4. Otherwise the action is chosen (the hero's runbook, section 9; a monster's fixed priority, section 10.4) and resolved.
5. End of turn: every status on the unit loses 1 duration and expires at 0, **except statuses applied to it during this
   same turn**, which start counting from its next turn.

A skill with cooldown `c` is set to `c` when used, so it is next usable on the unit's `c`-th following turn. Cooldowns of
1 therefore mean "every turn" and are not used; skills have cooldowns of 2 to 5.

### 5.4 Targeting and rows

- A **melee** skill may only target the front row of the opposing side while any unit there is alive; with an empty front
  row it targets the back row. **Ranged** and **magic** skills may target any living unit.
- Skill targets: `enemy` (one), `all_enemies` (every *legal* target for the skill's range), `ally` (one living ally,
  including the user), `all_allies`, `self`.
- Multi-target skills resolve target by target in ascending id order, each with its own rolls.
- Ties in any "lowest"/"highest" selection go to the lower id.

### 5.5 Damage formula (the order is the rule)

For one damaging hit, with attacker `A` and defender `D`:

1. `atk` = the attacker's final MIT (physical) or ARC (magic). A set skill of type `best` uses whichever of MIT and ARC
   is higher and the matching defence.
2. `raw = mulbp(atk, power)` where `power` is the skill's bp.
3. `def` = the defender's final GRD (physical) or WRD (magic). `mit = min(8000, idiv(def * 10000, def + 40 + 12 * LA))`
   where `LA` is the attacker's level. The cap of 80% is a rule, not an accident.
4. `d = mulbp(raw, 10000 - mit)`.
5. If the skill's element equals the attacker's realm element (heroes: their realm; monsters: their dungeon), `d =
   mulbp(d, 11000)` (affinity).
6. If the skill has an element, `d = mulbp(d, 10000 - clamp(RES_element, -5000, 7500))`.
7. `d = mulbp(d, 10000 + T)` where `T` is the sum of the defender's "damage taken" status modifiers (mark: +2500).
8. Draw `v = 9000 + range(2001)` (variance 90% to 110%) and `d = mulbp(d, v)`.
9. Draw `c = range(10000)`. If `c < CRIT` (attacker's final crit chance), `d = mulbp(d, CRITDMG)` and the hit is critical.
10. `damage = max(1, d)`. The defender's HP drops by it (to a floor of 0).

There is no miss and no dodge. Basic attacks are skills with power 10000, no element, no cooldown, and no status.

[WE-09] DEF 150 against an attacker of level 26: `K = 40 + 12 x 26 = 352`, `idiv(150 x 10000, 150 + 352)` => 2988

[WE-10] a level-26 Midgard Huscarl (MIT 300) casts Hearth Strike (16000 bp, fire) on a target with GRD 250 and fire resist 2000; draws v = 10500, c = 9000 (not critical). Steps: raw, mit, after mit, affinity, resist, mark, variance, final => 480, 4152, 280, 308, 246, 246, 258, 258

[WE-11] the same hit with a critical draw (c = 100 under a crit chance of 500): the crit step multiplies 258 by 15000 bp => 480, 4152, 280, 308, 246, 246, 258, 387, 387

### 5.6 Statuses

Seven statuses; a unit holds at most one of each (reapplying refreshes the duration, never stacks). Durations count the
bearer's own turns (5.3).

| Status | Kind | Effect | Default duration |
|---|---|---|---|
| burn | debuff | at the start of the bearer's turn, damage `max(1, mulbp(maxHP, 600))`, ignoring defence | 3 |
| chill | debuff | SPD -3000 bp | 2 |
| shock | debuff | skips the bearer's next action; the bearer is then immune to shock for 2 turns; bosses are immune | 1 |
| mark | debuff | the bearer takes +2500 bp damage (step 7) | 3 |
| bulwark | buff | GRD and WRD +3000 bp | 3 |
| fury | buff | MIT and ARC +2500 bp | 3 |
| mend | buff | at the start of the bearer's turn, heal `mulbp(maxHP, 500)` | 3 |

**Application.** A skill lists `(status, chance, duration, on)` riders. After a damaging hit lands and the target is
still alive, each rider on the target rolls: `eff = mulbp(chance, 10000 - SRES)` for debuffs (buffs ignore SRES); draw
`range(10000)`; it applies when the draw is `< eff`. A chance of 10000 bp or more applies without a draw. Riders with
`on: self` always use chance 10000. A non-damaging skill applies its riders to its targets directly.

[WE-12] chill chance 4000 bp on a target with SRES 2500: effective chance; the draw 2999 applies (1), the draw 3000 does not (0) => 3000, 1, 0

[WE-14] burn on a unit with max HP 1455 deals `mulbp(1455, 600)` at the start of its turn => 87

### 5.7 Healing

`heal = mulbp(ARC, power)`, capped at the target's missing HP. No variance, no crit, no draw. `lifesteal` (a skill
property in bp) heals the attacker by `mulbp(damage dealt, lifesteal)` after the hit.

[WE-31] Carrion Feast (lifesteal 5000 bp) after a hit of 258 damage heals => 129

[WE-32] a mend tick at the start of the turn for a bearer with max HP 1455 (500 bp) heals => 72

[WE-13] ARC 220, power 12000: the heal, then applied to a target missing 100 and to a target missing 400 => 264, 100, 264

### 5.8 Encounters in a delve

HP and downed state carry from one encounter to the next within a delve. Between encounters every living hero recovers
`mulbp(maxHP, 2000)` HP, all statuses are cleared and cooldowns reset. A downed hero stays down until the delve ends.
Heroes always start a delve at full HP.

### 5.9 Injury and forcing

A hero at 0 HP when a delve ends (won or lost) becomes **injured** with a counter of `INJURY_DELVES = 2`. Every delve
completed without that hero in the party reduces the counter by 1 (to 0, which cures). An injured hero cannot be picked
unless the player forces them: they then fight with all final primary stats halved (4.4 step 5; max HP follows VIG),
and the counter does not drop that delve.

[WE-15] injured, forced: final MIT 300 halves, final VIG 291 halves, the resulting max HP => 150, 145, 725

## 6. Elements and the realm cycle

Three elements, one per realm. Monsters resist their own element and are weak to the next in the cycle.

| Realm | Element | Dungeon monsters resist | Dungeon monsters are weak to |
|---|---|---|---|
| Midgard | fire | fire +5000 | frost -2500 |
| Helheim | frost | frost +5000 | lightning -2500 |
| Asgard | lightning | lightning +5000 | fire -2500 |

So a Helheim hero (frost) is strong in Midgard's dungeon, a Midgard hero (fire) in Asgard's, an Asgard hero (lightning)
in Helheim's. Heroes of a realm also resist that element, so each dungeon pays to mix realms.

## 7. Heroes

### 7.1 Realm affinity stats

| Realm | Affinity stats (+1000 bp) | Element and resist (+2000 bp) | Flavour |
|---|---|---|---|
| Midgard | VIG, MIT | fire | the hearth-worlds of people: sturdy, direct |
| Asgard | ARC, SPD | lightning | the high halls: quick, bright |
| Helheim | GRD, WRD | frost | the realm of the dead: patient, resilient |

### 7.2 Rarity

Rarity is a label with these effects: **common** classes are always recruitable; **rare** classes need the realm's
reputation to reach *Known* (50) and cost three times as much; a rare class has three skills, a common class two.
Legendary and unique lords exist in the schema (`rarity`: common, rare, legendary, unique) and are not used in this build.

### 7.3 Classes (the v1 roster of 15)

`F` = front-row melee, `B` = back-row. Attack type: `melee` (MIT), `ranged` (MIT), `magic` (ARC). Level-1 profile, before affinity.

| id | Name | Realm | Rarity | Role | Atk | VIG | MIT | ARC | GRD | WRD | SPD |
|---|---|---|---|---|---|---|---|---|---|---|---|
| shieldwarden | Shieldwarden | Midgard | common | tank F | melee | 22 | 12 | 4 | 20 | 12 | 8 |
| huscarl | Huscarl | Midgard | common | striker F | melee | 18 | 20 | 4 | 12 | 8 | 10 |
| hunter | Hunter | Midgard | common | archer B | ranged | 14 | 20 | 4 | 8 | 8 | 12 |
| hearthkeeper | Hearthkeeper | Midgard | common | healer B | magic | 15 | 4 | 21 | 9 | 16 | 9 |
| berserker | Berserker | Midgard | rare | burst F | melee | 20 | 26 | 4 | 10 | 8 | 12 |
| einherjar | Einherjar | Asgard | common | fighter F | melee | 19 | 18 | 6 | 14 | 10 | 11 |
| stormcaller | Stormcaller | Asgard | common | mage B | magic | 13 | 4 | 22 | 7 | 14 | 11 |
| skald | Skald | Asgard | common | support B | magic | 14 | 6 | 18 | 9 | 16 | 12 |
| skyrider | Skyrider | Asgard | common | skirmisher B | ranged | 13 | 19 | 4 | 8 | 8 | 15 |
| valkyrie | Valkyrie | Asgard | rare | duelist F | melee | 19 | 24 | 8 | 12 | 12 | 15 |
| draugr_knight | Draugr Knight | Helheim | common | tank F | melee | 21 | 11 | 4 | 18 | 16 | 7 |
| volva | Volva | Helheim | common | hexer B | magic | 12 | 3 | 21 | 7 | 17 | 10 |
| ghoul_reaver | Ghoul Reaver | Helheim | common | bruiser F | melee | 18 | 19 | 4 | 11 | 9 | 11 |
| rime_mender | Rime-Mender | Helheim | common | healer B | magic | 14 | 3 | 19 | 9 | 18 | 9 |
| wraith_hunter | Wraith-Hunter | Helheim | rare | assassin B | ranged | 13 | 24 | 6 | 8 | 10 | 14 |

Every class also has a basic attack by type: **Strike** (melee, physical, power 10000), **Shoot** (ranged, physical,
10000), **Bolt** (magic, ranged, 10000). Level-1 HP is `5 x VIG` after affinity: a Shieldwarden has 120.

### 7.4 Skills

Skill rows: `id | name | class | type | range | target | power | element | cooldown | riders`. `P` physical (MIT vs GRD), `M`
magic (ARC vs WRD), `H` heal, `U` utility (no damage). Riders are `status chance/duration`; a `self` rider is on the
user. All melee skills follow the front-row rule (5.4).

| id | Name | Class | Type | Range | Target | Power | Element | CD | Riders |
|---|---|---|---|---|---|---|---|---|---|
| hold_the_line | Hold the Line | shieldwarden | U | self | self | 0 | none | 4 | bulwark 10000/3 self |
| shield_bash | Shield Bash | shieldwarden | P | melee | enemy | 24000 | none | 3 | shock 2500/1 |
| cleave | Cleave | huscarl | P | melee | all_enemies | 5250 | none | 4 | |
| hearth_strike | Hearth Strike | huscarl | P | melee | enemy | 16000 | fire | 3 | burn 4000/3 |
| pinning_shot | Pinning Shot | hunter | P | ranged | enemy | 13000 | none | 3 | chill 5000/2 |
| volley | Volley | hunter | P | ranged | all_enemies | 4550 | none | 4 | |
| hearth_light | Hearth Light | hearthkeeper | H | ranged | ally | 12000 | none | 2 | |
| warm_embers | Warm Embers | hearthkeeper | U | ranged | all_allies | 0 | none | 5 | mend 10000/3 |
| frenzy | Frenzy | berserker | U | self | self | 0 | none | 4 | fury 10000/3 self |
| rend | Rend | berserker | P | melee | enemy | 18000 | none | 3 | mark 6000/3 |
| maul | Maul | berserker | P | melee | enemy | 26000 | none | 5 | |
| valhalla_strike | Valhalla Strike | einherjar | P | melee | enemy | 14000 | lightning | 3 | shock 2000/1 |
| rally | Rally | einherjar | U | ranged | all_allies | 0 | none | 5 | fury 10000/2 |
| chain_lightning | Chain Lightning | stormcaller | M | ranged | all_enemies | 5250 | lightning | 4 | |
| thunderclap | Thunderclap | stormcaller | M | ranged | enemy | 15000 | lightning | 3 | shock 3500/1 |
| battle_hymn | Battle Hymn | skald | U | ranged | all_allies | 0 | none | 5 | fury 10000/3 |
| mending_verse | Mending Verse | skald | H | ranged | all_allies | 7000 | none | 4 | |
| dive | Dive | skyrider | P | ranged | enemy | 16000 | none | 3 | |
| pinion_volley | Pinion Volley | skyrider | P | ranged | all_enemies | 4550 | none | 4 | |
| choose_the_slain | Choose the Slain | valkyrie | P | melee | enemy | 22000 | none | 3 | |
| wings_shield | Wings' Shield | valkyrie | U | ranged | all_allies | 0 | none | 5 | bulwark 10000/3 |
| storm_rend | Storm Rend | valkyrie | P | melee | all_enemies | 5950 | lightning | 4 | |
| cold_grip | Cold Grip | draugr_knight | P | melee | enemy | 20000 | frost | 3 | chill 6000/2 |
| undying_will | Undying Will | draugr_knight | U | self | self | 0 | none | 5 | bulwark 10000/3 self, mend 10000/3 self |
| hex | Hex | volva | M | ranged | enemy | 8000 | none | 3 | mark 9000/3 |
| frostbite | Frostbite | volva | M | ranged | enemy | 14000 | frost | 3 | chill 6000/2 |
| gnaw | Gnaw | ghoul_reaver | P | melee | enemy | 13000 | none | 3 | mark 5000/3 |
| carrion_feast | Carrion Feast | ghoul_reaver | P | melee | enemy | 18000 | none | 4 | lifesteal 5000 |
| frostmend | Frostmend | rime_mender | H | ranged | ally | 11000 | frost | 3 | bulwark 10000/2 |
| mist_veil | Mist Veil | rime_mender | U | ranged | all_allies | 0 | none | 5 | bulwark 10000/3 |
| soul_arrow | Soul Arrow | wraith_hunter | P | ranged | enemy | 20000 | none | 3 | |
| deaths_chill | Death's Chill | wraith_hunter | P | ranged | all_enemies | 3850 | frost | 5 | chill 4000/2 |
| gravecall | Gravecall | wraith_hunter | M | ranged | enemy | 8000 | none | 4 | shock 6000/1 |

(The element on a heal, as for Frostmend, is cosmetic: heals take no element step.)

### 7.5 Starting roster and recruiting

The new game begins with four heroes at level 1: **Shieldwarden, Huscarl** and **Hearthkeeper** (Midgard) and
**Stormcaller** (Asgard), each with Plain (item level 1, star 0) gear for every slot, and all realms at delve level 1.
Heroes get a name from `content/names.json` (a list per realm) chosen by a seeded draw when recruited.

- **Recruit level** `max(1, idiv(topLevel * 3, 4))` where `topLevel` is the highest hero level on the roster.
- **Recruit cost** (hacksilver): `100 + 20 x recruit level` for a common class, three times that for a rare class.
- The roster holds at most 24 heroes. A hero can be dismissed (their gear returns to the stash).

[WE-23] recruit level when the top hero is level 26, and when it is level 1 => 19, 1

## 8. Equipment

### 8.1 Slots and main stats

Four slots, each hero wears one item per slot. Item level `i` is 1 to 50; a hero may wear an item of item level up to
`hero level + 5`.

| Slot | Main stats per item level (before tier and star) |
|---|---|
| weapon | 6 MIT or 6 ARC (set at creation) |
| armour | 4 GRD and 3 VIG |
| helm | 3 WRD and 2 VIG |
| charm | 1 SPD, and `20 bp x i` of the item's realm element resistance |

### 8.2 Tiers

| Tier | Multiplier | Bonus lines | Max star | May carry a set tag |
|---|---|---|---|---|
| Plain | 10000 | 0 | 3 | no |
| Fine | 11500 | 1 | 4 | no |
| Runed | 13000 | 2 | 5 | yes |
| Heirloom | 15000 | 3 | 5 | yes |

### 8.3 Bonus lines

A line is `(kind, raw)`. Lines on one item are distinct kinds, drawn without replacement from the ten kinds; for each
line draw `range(remaining kinds)` for the kind, then `lo + range(hi - lo + 1)` for the raw value.

| # | Kind | Range (raw bp) |
|---|---|---|
| 0 | VIG % | 400 to 1200 |
| 1 | MIT % | 400 to 1200 |
| 2 | ARC % | 400 to 1200 |
| 3 | GRD % | 400 to 1200 |
| 4 | WRD % | 400 to 1200 |
| 5 | SPD % | 300 to 900 |
| 6 | CRIT (chance, bp) | 100 to 400 |
| 7 | CRITDMG (bp) | 1000 to 3000 |
| 8 | SRES (bp) | 300 to 1000 |
| 9 | resist of the item's realm element (bp) | 400 to 1200 |

The value in effect is `mulbp(raw, 10000 + 500 x star)`: the raw roll is stored; the star scales it when read.

[WE-19] a line with raw 300 at star 3, and at star 5 => 345, 375

[WE-20] a new line on an item with all ten kinds still available: draws 6 (CRIT) then 150 with the range 100 to 400 gives a raw => 6, 250

### 8.4 Upgrading (reforging)

An **attempt** costs materials and does two things, in this order:

1. **Star roll.** From star `s` (below the tier's max), success has probability `[9000, 7500, 6000, 4500, 3000][s]` bp
   (draw `range(10000)`, success when `< p`). Success raises the star by 1.
2. **Reroll.** *Every* attempt, success or failure, rerolls **all** the item's bonus lines (8.3). The item keeps its
   old lines in a hold.

The player then sees the result and **accepts it** (default) or **uses the mulligan**: keep the old lines instead
(the star result stands). Each item has one mulligan charge; it refills when the item's star rises. Using the mulligan
does not refund the attempt. Failure never destroys, lowers or removes anything.

**Cost** of an attempt at star `s` on an item of level `i`: common materials `3 + idiv(i x (s + 1), 2)` of the item's
realm; and from star 3 upward also rare materials (the realm's *heart*): `s - 2` (1 for 3 to 4; 2 for 4 to 5).

[WE-18] common material cost of an attempt on an item level 26, at star 0 and at star 3 => 16, 55

### 8.5 Sets

Three sets, four pieces each (one per slot), carried by Runed and Heirloom items only. Bonuses are cumulative.

| Set | Realm | 2 pieces | 4 pieces |
|---|---|---|---|
| Hearthforged | Midgard | VIG +1000 bp | grants the skill `hearthfire_surge` |
| Stormbound | Asgard | SPD +1000 bp | grants the skill `skyfall` |
| Grave-Shroud | Helheim | frost resist +1500, SRES +1000 | grants the skill `rimebind` |

| id | Name | Type | Range | Target | Power | Element | CD | Riders |
|---|---|---|---|---|---|---|---|---|
| hearthfire_surge | Hearthfire Surge | best | ranged | all_enemies | 8000 | fire | 5 | burn 4000/3 |
| skyfall | Skyfall | best | ranged | enemy | 20000 | lightning | 5 | shock 4000/1 |
| rimebind | Rimebind | best | ranged | all_enemies | 7000 | frost | 5 | chill 7000/2 |

A granted skill appears in the runbook editor for that hero while the bonus holds.

### 8.6 Drops, salvage, stash

- Every cleared non-boss encounter drops an item with probability 2500 bp: tier by weights Plain 7000, Fine 2500, Runed
  500. A boss drops one item: Fine 4000, Runed 5000, Heirloom 1000. Item level equals the delve level. Slot, weapon kind
  and charm element are uniform draws. A Runed or Heirloom item carries its realm's set tag with probability 5000 bp, but
  only once the realm's reputation has reached *Trusted* (150).
- **Salvage** turns an item into common materials of its realm: `idiv(i, 2) x (tier index + 1)` (Plain 0 to Heirloom 3).

[WE-33] salvaging a Runed item (tier index 2) of item level 26 returns common materials => 39
- The stash holds 100 items; a full stash refuses new drops with a clear message and salvages nothing automatically.

## 9. Runbooks

A runbook is an ordered list of at most **8 rules** per hero. Each rule is
`{ "when": [clause, ...], "do": action, "target": selector }` with 1 or 2 clauses (all must hold). Rules are tried in
order; the **first rule whose clauses all hold, whose skill is off cooldown, and which has at least one legal target**
fires. If none fires, the hero uses the fixed final rule: **basic attack on `lowest_hp_pct` enemy**. The editor shows this
last rule greyed and read-only.

### 9.1 Conditions

| id | Arguments | True when |
|---|---|---|
| always | none | always |
| self_hp_below | `pct` 10 to 90, step 10 | the hero's HP is below pct% of max |
| self_hp_above | `pct` | at or above |
| ally_hp_below | `pct` | some living ally is below pct% |
| enemy_hp_below | `pct` | some living enemy is below pct% |
| enemies_at_least | `n` 1 to 4 | at least n enemies alive |
| allies_alive_at_most | `n` 1 to 3 | at most n allies alive (including self) |
| self_has | `status` | the hero has the status |
| self_lacks | `status` | the hero lacks it |
| ally_lacks | `status` | some living ally lacks it |
| enemy_has | `status` | some living enemy has it |
| enemy_lacks | `status` | some living enemy lacks it |
| skill_ready | `skill` | the named skill of the hero is off cooldown |
| round_at_least | `n` 1 to 10 | the current round number is at least n |
| enemy_row_alive | `row` front, back | some living enemy in that row |
| enemy_weak_to | `element` | some living enemy has a negative resist to that element |

### 9.2 Actions

| id | Arguments | Meaning |
|---|---|---|
| skill | `skill` (must be in the hero's kit or granted by a worn set) | use that skill |
| basic | none | the class's basic attack |
| brace | none | the hero skips the attack and gains bulwark for 1 turn |

### 9.3 Target selectors

| Selector | Valid for targets | Picks |
|---|---|---|
| lowest_hp_pct | enemy, ally | lowest HP as a share of max |
| lowest_hp | enemy, ally | lowest absolute HP |
| highest_hp | enemy | highest absolute HP |
| fastest | enemy, ally | highest SPD |
| strongest | enemy, ally | highest of MIT and ARC |
| back_first | enemy | the first living unit in the back row, else the front row |
| self | self, ally | the hero |

A selector's pick is always restricted to *legal* targets (5.4) and, for a single-target skill, to one that exists. A
skill whose target type is `all_*` or `self` ignores the selector (the field is `null`).

### 9.4 Validation (the editor refuses with the reason)

A runbook is data, validated against `content/schema/runbook.schema.json`, with these named refusals (each message names
the rule number, from 1):

`E01` not valid JSON or wrong format version; `E02` more than 8 rules; `E03` a rule with no clause or more than 2; `E04`
unknown condition id; `E05` missing or out-of-range argument; `E06` unknown status, element, row or skill id; `E07`
action skill not in the hero's kit or granted skills; `E08` selector not valid for the skill's target type; `E09` an
unknown field (extra keys are refused, not ignored).

### 9.5 Example

```json
{ "v": 1, "rules": [
  { "when": [{ "c": "self_hp_below", "pct": 40 }], "do": { "a": "skill", "skill": "hold_the_line" }, "target": null },
  { "when": [{ "c": "enemy_lacks", "status": "mark" }, { "c": "enemies_at_least", "n": 2 }],
    "do": { "a": "skill", "skill": "shield_bash" }, "target": "highest_hp" }
] }
```

The editor builds rules from dropdowns and number steppers, so most refusals cannot be reached from the form; they are
reached by importing or pasting JSON, and by the validator tests. Extensions are new rows in the tables above, plus (later)
a third clause or a `skill_cooldown_at_most` condition, each a logged design change.

## 10. Realms, monsters and delves

### 10.1 The three dungeons

| Realm | Dungeon | Element | Weak to | Material (common) | Rare material | Boss |
|---|---|---|---|---|---|---|
| Midgard | Muspel Breach | fire | frost | Forge-iron | Ember-heart | Surtr, Lord of Muspel |
| Asgard | Storm-Hall of Thrym | lightning | fire | Sky-silver | Storm-heart | Thrym, Storm-Jarl |
| Helheim | Gnipahellir | frost | lightning | Grave-rime | Rime-heart | Garm, Hound of Hel |

Lore in two lines. As Ragnarok nears, Muspel's fire-giants break across Midgard, the storm-giants of Thrym assault the
high halls of Asgard, and the dead of Helheim stir behind Garm. The player is a warband-keeper of no realm in particular,
and takes heroes of all three.

### 10.2 Monster archetypes (level-1 profiles, before tilt)

Realm tilt: `+1000 bp` on the two affinity stats of the realm (7.1). A *signature* monster multiplies all its stats by
`11500` bp and adds a special skill. Position: front (F) or back (B). Threat 1 to 3.

| Archetype | Pos | Atk | VIG | MIT | ARC | GRD | WRD | SPD | Threat | Skill |
|---|---|---|---|---|---|---|---|---|---|---|
| brute | F | melee | 6 | 11 | 1 | 6 | 3 | 9 | 2 | smash |
| guard | F | melee | 7 | 7 | 1 | 10 | 6 | 6 | 2 | shieldbash |
| skirmisher | F | melee | 4 | 10 | 1 | 4 | 3 | 14 | 1 | lunge |
| archer | B | ranged | 4 | 11 | 1 | 4 | 4 | 11 | 1 | piercing_shot |
| caster | B | magic | 4 | 1 | 12 | 3 | 7 | 10 | 2 | bolt_storm |
| healer | B | magic | 4 | 1 | 11 | 4 | 7 | 9 | 1 | mend |
| hexer | B | magic | 4 | 1 | 10 | 3 | 6 | 10 | 2 | curse |
| striker | F | melee | 3 | 13 | 1 | 3 | 3 | 15 | 3 | assassinate |

Archetype skills (monster skills use the same fields as hero skills). Damage skills carry the **realm rider**: Midgard
`burn 3000/3`, Asgard `shock 2500/1`, Helheim `chill 4000/2`; and the **realm element**.

| id | Type | Range | Target | Power | CD | Other |
|---|---|---|---|---|---|---|
| smash | P | melee | enemy | 13000 | 3 | realm rider |
| shieldbash | P | melee | enemy | 9000 | 3 | realm rider, bulwark 10000/3 self |
| lunge | P | melee | enemy | 15000 | 3 | realm rider |
| piercing_shot | P | ranged | enemy | 14000 | 3 | realm rider |
| bolt_storm | M | ranged | all_enemies | 6500 | 4 | realm rider |
| mend | H | ranged | ally | 12000 | 2 | only if an ally is below 8000 bp |
| curse | M | ranged | enemy | 7000 | 3 | mark 10000/3 (no realm rider) |
| assassinate | P | melee | enemy | 18000 | 4 | realm rider |

### 10.3 The 36 monsters

| # | Role | Midgard (Muspel) | Asgard (storm-giants) | Helheim (the dead) | Band |
|---|---|---|---|---|---|
| 1 | brute | Ember Raider | Storm-Thane | Draugr Brute | 2 |
| 2 | guard | Cinder Shieldbearer | Cloud-Warden | Bone Shield | 2 |
| 3 | skirmisher | Ash-Runner | Gale-Runner | Ghoul Runner | 1 |
| 4 | archer | Spark-Slinger | Bolt-Archer | Wight Archer | 1 |
| 5 | caster | Flame Seer | Thunder Seer | Grave Seer | 2 |
| 6 | healer | Pyre Mender | Sky Mender | Corpse Mender | 1 |
| 7 | hexer | Smoke Hexer | Static Hexer | Hel-Hexer | 2 |
| 8 | striker | Brand-Knife | Spark-Knife | Shade-Knife | 3 |
| 9 | signature brute | Warband-Chief (`war_cry`) | Thrym's Huscarl (`hammer_throw`) | Garm's Pup (`howl`) | 3 |
| 10 | signature guard | Magma Hulk (`molten_slam`) | Storm-Titan (`thunder_stomp`) | Revenant Knight (`grave_slam`) | 3 |
| 11 | signature caster | Forge-Wraith (`meltdown`) | Jotunn Stormcaller (`tempest`) | Frost Wight (`death_chill`) | 3 |
| 12 | signature skirmisher/hexer | Drake Whelp (`flame_breath`) | Storm-Raven (`swoop`) | Banshee (`wail`) | 2 |

Special skills (the realm rider and element apply where a rider is not listed):

| id | Type | Range | Target | Power | CD | Riders |
|---|---|---|---|---|---|---|
| war_cry | U | ranged | all_allies | 0 | 5 | fury 10000/2 |
| howl | U | ranged | all_allies | 0 | 5 | fury 10000/2 |
| molten_slam | P | melee | all_enemies | 7000 | 4 | realm rider |
| thunder_stomp | P | melee | all_enemies | 7000 | 4 | realm rider |
| grave_slam | P | melee | enemy | 18000 | 5 | realm rider |
| meltdown | M | ranged | enemy | 20000 | 5 | realm rider |
| tempest | M | ranged | all_enemies | 6500 | 5 | shock 3000/1 |
| death_chill | M | ranged | all_enemies | 6500 | 4 | chill 5000/2 |
| flame_breath | M | ranged | all_enemies | 6500 | 4 | burn 5000/3 |
| hammer_throw | P | ranged | enemy | 20000 | 5 | realm rider |
| swoop | P | ranged | enemy | 15000 | 3 | realm rider |
| wail | M | ranged | all_enemies | 6000 | 5 | shock 3000/1 |

Each monster in rows 9 to 12 uses the archetype named by its role (the Drake Whelp and Storm-Raven are skirmishers, the
Banshee a hexer). Bands (threat, loosely coupled to strength) are used by encounter generation (10.5).

### 10.4 Bosses and monster behaviour

A boss uses the brute profile with VIG `x3` and every other stat `x1.5` (applied to the scaled stat before tilt), is
level `delve level + 2`, is immune to shock, never carries affixes, and has two skills:

| Boss | Skill 1 (CD 2) | Skill 2 (CD 4) |
|---|---|---|
| Surtr | Sword of Flame: P melee enemy 15000 fire, burn 3000/3 | Ragnarok Blaze: M ranged all_enemies 8000 fire, burn 5000/3 |
| Thrym | Storm Hammer: P melee enemy 16000 lightning, shock 3000/1 | Thunder Roar: M ranged all_enemies 7500 lightning |
| Garm | Rending Bite: P melee enemy 16000 frost, mark 6000/3 | Hel-Howl: M ranged all_enemies 7000 frost, chill 6000/2 |

**Monster behaviour (fixed, no runbook).** Each turn: the first *ready* skill of `[special, archetype skill]` for which a
legal target exists is used on `lowest_hp_pct`; heals target the lowest-HP ally; `all_*` and `self` skills ignore the
selector. Otherwise the basic attack (Strike, Shoot or Bolt by attack type) on `lowest_hp_pct`.

### 10.5 Delve generation

A delve at realm `R` and delve level `D` (1 to 50) has `n = 3 + range(3)` encounters; the last is the boss.

- **Enemy level** is `D` for non-boss enemies and `D + 2` for the boss. The boss encounter is the boss plus 2 monsters;
  the first encounter has 3 monsters; the rest have 4.
- **Composition** is a weighted draw per enemy slot over the threat bands (1 weak, 2 normal, 3 strong), by position in the
  delve: first encounter weights (6, 3, 1), middle encounters (3, 4, 3), the monsters beside the boss (2, 4, 4). Draw
  `range(sum of weights)` to pick the band, then `range(monsters in the band)` for the monster. Rows follow the monster's
  position (front before back, in draw order, spilling over if a row is full).
- **Affixes** (non-boss only): none below `D = 10`. At `D` from 10, each enemy gets one affix with probability 3000 bp
  (5000 bp from `D = 25`), and from `D = 25` a second, different one with probability 1500 bp. An affix is a uniform
  draw among those whose minimum `D` has been reached.

[WE-27] band draw with weights 3, 4, 3 and `range(10)` giving 6 (cumulative cut-offs 3, 7, 10), the band chosen => 2

| Affix | Min D | Effect |
|---|---|---|
| Hardy | 10 | VIG +4000 bp |
| Swift | 10 | SPD +3000 bp |
| Brutal | 15 | MIT and ARC +3000 bp |
| Armoured | 15 | GRD and WRD +4000 bp |
| Resolute | 20 | SRES +5000 bp |
| Vampiric | 20 | lifesteal 2000 bp on its damage |
| Regenerating | 25 | permanent mend (5% max HP at the start of each own turn) |
| Marking | 25 | its damage skills add mark 2500/2 |

### 10.6 Delve levels and unlocking

The player picks any delve level `1 .. unlocked(R)`. `unlocked(R)` starts at 1 and rises by 1 each time a delve at level
`unlocked(R)` is won in realm `R`, to a cap of 50. Nothing else gates a delve.

## 11. Progression and the economy

### 11.1 Experience

`xp_to_next(L) = 50 + 30 L + idiv(L^3, 20)`, for L = 1 to 49 (no experience at the cap).

[WE-21] experience to the next level at L1, L20, L49 => 80, 1050, 7402

Each cleared encounter gives every participating hero `10 + 4 D` xp (the boss encounter `2x`); a lost delve gives none.
Benched healthy heroes receive 50% of the delve's xp ("rest xp"), so a roster is not punished for rotation. Leftover xp
carries over; several levels may be gained at once.

### 11.2 Rewards per cleared delve (win only)

Per cleared encounter: **common materials** `3 + idiv(D, 3)`, **hacksilver** `5 + D`; a boss encounter pays 2x
materials and 3x hacksilver. **Reputation** in the realm: `+5` per won delve, `+5` more for the boss. A boss also drops
one rare material (the realm's *heart*) and has a 300 bp chance to drop a **Thread of the Norns** (the insurance item).

[WE-22] a level-20 delve of 3 monster encounters and a boss: xp per hero, the rest xp, common materials, hacksilver => 450, 225, 45, 150

### 11.3 Reputation

| Standing | Reputation | Unlocks in that realm |
|---|---|---|
| Known | 50 | the realm's rare class may be recruited |
| Trusted | 150 | set-tagged items can drop |
| Honoured | 400 | Thread of the Norns can be bought for 5 hearts of that realm |

### 11.4 The Thread of the Norns (insurance)

An item that is **assigned to one hero** and consumed automatically if that hero would die permanently: the hero
survives at 1 HP, becomes injured (counter 2), and the thread is gone. It does nothing for injuries. A hero holds at most one.

### 11.5 Pacing by feed rate

There is no clock. What limits progress is the ratio of what a delve brings to what upgrades, recruits and provisions
use. The intended shape (the balance gate measures it, G3): a first upgrade within a couple of delves, a full tier of
upgrades costing many delves' worth of one realm's materials, and a rare-heart bottleneck on the last two stars so that
boss clearing is the long-run pace. Absence costs nothing: no decay, no events that expire.

## 12. Expeditions (built in G5; specified now)

An expedition is a longer, riskier outing with permanent stakes.

### 12.1 The map

A **20 x 14** grid generated from `deriveSeed(masterSeed, counter)` for a chosen realm and expedition level `E`
(1 to `unlocked(R)`). Terrain: plain (move cost 1), forest (2), hills (2), water and peaks (impassable). The generator
makes integer value noise from the seed, thresholds it into the five terrains, places the party start on column 0,
places 5 to 8 **sites** (each at least 4 cells from the others and the start), and checks every site is reachable by flood
fill; if not, the offending cells are carved into plains along a straight path (deterministic). Fog of war: the party
reveals cells within 2 of it.

### 12.2 Provisions (consumption)

Provisions bought with hacksilver (10 each, at most 60 carried). Each step costs the cell's move cost; entering a dungeon
floor costs 3. With too few provisions to take a step or enter a floor, the expedition **ends and the party returns
safely** with everything carried: starvation never kills.

[WE-24] a path of 4 plain, 1 forest and 1 hills cells costs; the site level for `E = 20` at distance 11 (`E + idiv(dist, 3)`); the distance multiplier `10000 + 300 x dist` => 8, 23, 13300

### 12.3 Sites and floors

A site at distance `dist` (Manhattan, from the start) has level `E + idiv(dist, 3)` and `2 + idiv(dist, 4)` floors (2 to 6).
Each floor has 2 encounters; the last floor has the boss. Between floors the player **descends or retreats**. Rewards
(materials, hacksilver, xp) use the delve formulas at the site level, multiplied by `mulbp(mulbp(x, dist multiplier),
10000 + 2500 x (floor - 1))`. All loot is carried in the **pack** and is banked only on a safe return.

[WE-25] base 10 common materials (site level 23), distance 11, floor 3 => 19

### 12.4 Death and loss

Heroes are healed `mulbp(maxHP, 2000)` between encounters as in delves. After an encounter that the party *wins*, each
hero at 0 HP rolls a **death save**: `range(10000) < 4000` means the hero dies permanently, otherwise they revive at 1 HP
and are injured. After an encounter the party *loses*, every hero in it dies. A hero with a Thread of the Norns survives
instead (11.4). Dead heroes are removed from the roster for good; their equipment returns to the stash; a wiped
expedition's pack is lost. A wipe loses that party only, never the save.

[WE-26] a death save at 4000 bp: the draw 3999, and the draw 4000 (1 means the hero dies) => 1, 0

## 13. Save schema (version 1)

One JSON document under one browser-storage key (`three-realms-save`); exported and imported as the same JSON in a file
named `three-realms-save.json`. All numbers are integers. The sim never reads the save directly; the client builds sim
inputs from it. Import validates against `content/schema/save.schema.json` and refuses with the key path and the reason;
a save with a higher `version` than the build is refused, a lower one is migrated by a function per version step.

```json
{
  "format": "three-realms-save",
  "version": 1,
  "meta": { "savedAt": "2026-10-01T18:00:00Z", "build": "0.1.0" },
  "rng": { "masterSeed": 1234567, "counter": 0 },
  "nextId": 20,
  "currency": { "hacksilver": 0 },
  "materials": { "forge_iron": 0, "sky_silver": 0, "grave_rime": 0, "ember_heart": 0, "storm_heart": 0, "rime_heart": 0 },
  "reputation": { "midgard": 0, "asgard": 0, "helheim": 0 },
  "unlocked": { "midgard": 1, "asgard": 1, "helheim": 1 },
  "heroes": [
    { "id": 1, "class": "shieldwarden", "name": "Sigrid", "level": 1, "xp": 0, "injury": 0,
      "slots": { "weapon": 5, "armour": 6, "helm": 7, "charm": 8 }, "thread": false, "runbook": { "v": 1, "rules": [] } }
  ],
  "party": [1, 2, 3, 4],
  "items": [
    { "id": 5, "slot": "weapon", "kind": "MIT", "tier": "plain", "ilvl": 1, "realm": "midgard", "set": null,
      "star": 0, "lines": [], "held": null, "mulligan": 1 }
  ],
  "threads": 0,
  "expedition": null
}
```

`party` is slot order (0 to 3). `lines` are `[kindIndex, raw]` pairs; `held` is the pre-attempt `lines` kept for the
mulligan until the player accepts or reverts. `expedition` is `null` or the expedition state (G5 specifies its keys in
`DESIGN.md` Changes before use). Unknown keys are refused. Export then import must restore a byte-identical canonical save.

## 14. Replay format (version 1)

A replay is the oracle: it carries the inputs and the event log, so it can be played back without re-simulating and
verified by re-simulating.

```json
{ "format": "three-realms-replay", "v": 1, "kind": "delve",
  "contentHash": "<sha256 of canonical content bundle>",
  "seed": 3675335440,
  "inputs": { "realm": "midgard", "level": 12, "party": [ /* four fully resolved units: stats, skills, runbook */ ] },
  "tables": { "skills": ["smash", "..."], "statuses": ["burn","chill","shock","mark","bulwark","fury","mend"] },
  "events": [ [0, 0, 3], [1, 1], [2, 0], [3, 0, 4, 4] ],
  "result": { "outcome": 1, "encounters": 4, "cleared": 4, "injured": [1], "rewards": { "xp": 450, "materials": 40, "hacksilver": 150 } },
  "hash": "<sha256 of the canonical JSON of this document without the hash key>" }
```

**Events** are integer arrays, `[opcode, ...]`. Unit ids as in 5.1; skill and status values index `tables`.

| Op | Name | Fields |
|---|---|---|
| 0 | ENC_START | encounter index, enemy count |
| 1 | ROUND | round number |
| 2 | TURN | unit |
| 3 | SKILL | unit, skill index, target unit (or -1) |
| 4 | HIT | source, target, damage, crit (0/1), target HP after |
| 5 | HEAL | source, target, amount, target HP after |
| 6 | STATUS | source, target, status index, duration |
| 7 | TICK | unit, status index, amount |
| 8 | EXPIRE | unit, status index |
| 9 | DOWN | unit |
| 10 | SKIP | unit, reason (0 shock, 1 no legal action) |
| 11 | ENC_END | outcome (1 win, 0 loss), rounds |
| 12 | REST | unit, HP after |
| 13 | DELVE_END | outcome, encounters cleared |

**Canonical form and the hash.** Canonical JSON: object keys sorted by code unit order, arrays in order, integers only (a
non-integer or `NaN` is an error), strings escaped with `JSON.stringify`, no whitespace. The hash is **SHA-256**, hex,
over the UTF-8 bytes of the canonical JSON, computed by a pure-JavaScript implementation shipped in `sim/` (no
`crypto`, so Node and the browser run the same code). The `contentHash` is the same over the canonical bundle of every
content file; a replay whose content hash differs from the running build is marked "content mismatch" and still plays
from its own logged numbers.

[WE-28] sha256 of the three characters `abc` (the published test vector) => ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad

[WE-29] canonical JSON of `{schema:1, kind:"x", z:[3,1,2], a:{y:2, b:1}}` => {"a":{"b":1,"y":2},"kind":"x","schema":1,"z":[3,1,2]}

[WE-30] sha256 of the canonical string above => fa551ade1828c1a98375f021087c1c581d2459e69107783d9464fa3145f86cd6

**Verification.** `resolve(inputs, seed)` reproduces `events` and `result` exactly; a verifier compares `canonical(resolve(...))`
with the stored document. A replay read back gives the same final state.

## 15. Budgets (ceilings, to be measured; nothing here is a measurement)

These are the ceilings the build commits to and tests enforce. Each is proposed here and becomes a *measured* figure only
when a run produces it (G1 for the sim, G4 for the client), with the command that produced it.

| Budget | Ceiling | Enforced by |
|---|---|---|
| One encounter (4 v 4, level 50) resolves, headless Node | median <= 5 ms | G1 timing test |
| Ten thousand delves, headless Node | <= 60 s on the CI runner | G1/G3 test |
| Client tab memory (JS heap, after a replay and every screen) | <= 256 MB | G4 headless-browser test |
| Frame time drawing an encounter at 1920 x 1080 | p95 <= 16.7 ms (60 fps) on a software-rendered CI browser; target laptop GPU | G4 test |
| Shipped bundle (everything the page loads, uncompressed) | <= 400 KB | G4/G6 test |
| Save document | <= 512 KB | schema test |

## 16. Art style guide (replaced in 0.5; direction from Ziggy, 2026-10-02)

**Two registers, both made at run time, from code and a seed: no image, font or file is shipped or fetched.**

- **Scenes, portraits and the battle: oil paint on rough vellum.** A warm, uneven vellum ground (low-frequency stains, fine grain,
  a few fibres, a darker deckled edge). Figures and backdrops are painted as many short, translucent, slightly mis-registered
  brush strokes that follow the form, with a darker underpainting, a mid layer and a few thick lighter dabs for impasto highlights.
  Edges are soft and imperfect; nothing is a hard vector line. Heroes are built from simple volumes (head, shoulders, torso, arms
  and the class's prop) so that 15 hero classes and 36 monsters can be told apart by silhouette and a colour accent, not by detail.
- **Menus and information screens: woodcut.** Near-black walnut ink on the same vellum: heavy outlines, parallel hatching for
  shade, carved-edge borders with a knotwork corner, bold serif capitals with a cut-out feel. Buttons are inked blocks that
  invert on hover and focus. Numbers stay in a plain monospace for legibility.
- **Procedural and deterministic.** Textures and sprites come from the sim's PRNG family (`splitmix32`/`sfc32`) seeded by a constant
  per thing (a class id, a monster id, a screen name), never `Math.random`, so a screenshot is reproducible and a test can compare.
  Each is painted once into an offscreen canvas and then reused, so a frame is a handful of `drawImage` calls.
- **Palette tokens** (text on vellum must reach WCAG contrast 4.5:1, tested):

| Token | Hex | Use |
|---|---|---|
| vellum | `#e9dcb9` | the ground |
| vellum-shade | `#cdb98a` | stains, panel fills |
| walnut | `#2a1d12` | ink, text, woodcut lines |
| umber | `#5b3a1e` | secondary text, underpainting |
| midgard | `#b8442a` with verdigris `#4f7a5a` | Midgard pigments |
| asgard | `#c8962e` with ultramarine `#2f5d9e` | Asgard pigments |
| helheim | `#4d8c88` with ash `#8a8c8f` | Helheim pigments |
| hp / hurt / heal | `#9e2b25` / `#fff6e0` / `#3f7a46` | combat feedback |

- **Layout.** The DOM carries menus, forms and tables (accessible, selectable, testable) and works at 390 px width in one column; the
  canvas carries the battle and later the map, at a logical 1920 x 1080 scaled to its box.
- **Type.** System font stacks only (a serif stack for woodcut headings, monospace for numbers). Numbers tabular and right-aligned.
- **Motion.** A hit is a short flash and a floating number; replays play at 1x, 4x or skip to the end; `prefers-reduced-motion`
  turns animation off and shows the log.
- **Colour is never the only signal.** Statuses carry a letter badge; elements carry a shape.

## 17. Screens (scope for G4)

Hall (roster, party formation, recruiting), Hero (stats, equipment, runbook form editor with raw JSON import), Forge (upgrade with the
mulligan, salvage), Delve board (realm, level, forced injured, start), Battle (the replay player and a text log), Settings (export,
import, reset, about). The Expedition map and the replay-file viewer arrive in G5 and G6.

## 18. Tests this design requires

Determinism over 1,000 seeds; no banned calls in `sim/`; every `[WE-nn]` example reproduced by the sim; every table in
this file cross-checked against `content/`; runbook validator against `E01` to `E09`; save export/import round trip;
replay round trip; replay hash equal in Node and the browser; every screen renders in a headless browser; the page runs from
`file://`; the rules layer keeps the save invariants over long random play.

## 19. The rules layer (`sim/game.js`)

Every change to a save is a pure function `(save, content, ...) -> save'` or throws `GameError(code, message)`; the client holds no rule.
Random choices use `deriveSeed(masterSeed, counter)` and then increment `counter`, so a save plus the same actions replays identically.

- **New game.** `masterSeed` from the caller (the client takes it from `crypto.getRandomValues`; tests pass one). Four heroes at level 1
  (7.5) in slots Shieldwarden, Huscarl, Hearthkeeper, Stormcaller; names drawn from `names.json` without repeats; each wears a full
  Plain item-level-1 kit of its realm; party = those four; `hacksilver` 0; every realm unlocked at 1. Every new hero (also a recruit)
  begins with the class's **starter runbook** from `content/starter_runbooks.json`, which the player edits freely.
- **Recruit.** The class must exist; a rare class needs its realm's reputation at *Known*; the roster holds at most 24; the cost is
  `recruitCost(recruitLevel(topLevel))` hacksilver (7.5); the recruit arrives with a full Plain kit at item level equal to its level.
- **Dismiss.** Gear returns to the stash; an assigned Thread of the Norns returns to the count; the party closes over the gap; the last
  hero cannot be dismissed.
- **Equip.** The item must fit the slot and be at most `hero level + 5`; an item worn by another hero moves; `null` unequips.
- **Party.** One to four distinct heroes, in slot order. An injured hero may be placed but a delve refuses to start unless the player
  names them in `force` (then they fight at half stats and the counter does not drop that delve).
- **Runbook.** Saved only if `validateRunbook` accepts it against the hero's kit (class skills plus skills granted by worn sets).
- **Delve.** Level `1 .. unlocked[realm]`. The seed is derived from the counter. `setAllowed` is true at *Trusted* reputation. The
  result is applied as below, win or loss.
  - *Heroes.* Participants gain the delve's xp; every benched hero who is not injured gains `restXpBp` of it; levels rise while xp
    reaches `xp_to_next` (xp stays 0 at the cap). Heroes at 0 HP at the end become injured for `injury.delves`; an injured hero who
    sat the delve out loses 1 from the counter (never below 0); a forced hero's counter is unchanged unless they went down again.
  - *Stores.* Materials, hacksilver and reputation are added; the unlock rises by 1 on a win at the highest unlocked level (cap 50);
    dropped items join the stash with new ids; a full stash (100) loses the extra drops and says how many; Threads join the count.
- **Upgrade.** One attempt costs the materials of `upgradeCost` (common of the item's realm; a heart of that realm from star 3). It
  needs no pending attempt, a star below the tier's maximum and enough stock. The result is held until the player accepts it or uses the
  single mulligan (8.4). Each attempt consumes one counter step.
- **Salvage.** An item not worn by anyone returns `salvageValue` common materials of its realm.
- **Threads.** A Thread is assigned to one hero at a time (at most one each) or unassigned; at *Honoured* a Thread can be bought for
  `threadHearts` hearts of that realm.
- **Save validity.** `validateSave(save, content)` checks the schema (`content/schema/save.schema.json`) and these invariants with named
  refusals: unique ids, worn items exist and fit and are worn once, party members exist, stock never negative, thread count equals assigned
  plus unassigned, injury within bounds, level within the cap. Import refuses with the key path and the reason.

## 20. The client

- **No runtime dependency; modules, then one file.** The client is plain ES modules under `client/`, sharing `sim/`. Browsers do not load
  module scripts from `file://`, which SPEC requires, so `tools/bundle.mjs` (dependency-free) inlines the module graph, the content
  and the schemas into one classic script, `dist/game.js`, beside `dist/index.html`. The same `dist/` is what Pages publishes.
- **State.** One store holds the save; every action calls the rules layer, validates, then writes the save to `localStorage` under
  `three-realms-save` (a failing or full storage degrades to in-memory with a visible warning). Export is a file download of the canonical
  JSON; import accepts a file or pasted text.
- **Battle.** The player never re-simulates: it plays the replay's event log. HP, statuses, floating numbers and the text log are all
  derived from the events alone (G1 test), so a replay file from another machine plays the same.
- **Tests.** Browser tests drive the real page through its DOM (`data-testid` attributes); a read-only `window.ThreeRealms` exposes the
  current save and last replay for assertions, and nothing else.

## Changes

- **0.1 (2026-10-01):** first version, for STOP-0. Nothing earlier.
- **0.2 (2026-10-01, approved by Ziggy in chat after STOP-0):** (a) the design as written is approved; later gates run on
  until a STOP or a blocked gate. (b) **Design intent for balance:** gear becomes progressively *more necessary* as level
  rises: at low levels starter gear is enough, and by the upper levels only upgraded Runed and Heirloom gear keeps a party
  on-level. (c) **Permission:** G3 may tune the enemy curve constant (22, section 4.5) and the monster profile tables to
  meet that intent, without a new STOP, provided each change is logged here with the measurement that prompted it. The
  thresholds in `checks/balance.yaml` are still never loosened.
- **0.2.1 (2026-10-01, clarification found while authoring `content/`; no number changed):** every *damaging* monster
  skill (archetype, special or affix-modified) uses its dungeon's realm element. The realm rider is added only where a
  skill's row says "realm rider"; a skill that lists its own riders (Tempest, Death Chill, Flame Breath, Wail, Curse) uses
  those instead and still deals the realm element. Sections 10.2 and 10.3 are to be read this way.
- **0.2.2 (2026-10-01, clarifications decided while writing the combat resolver; no number changed):**
  (a) 5.6: "a chance of 10000 bp or more applies without a draw" is tested on the *effective* chance, after status
  resist for a debuff; a 10000 bp debuff against any status resist above 0 therefore still draws. (b) The status roll is
  drawn first and immunity (a boss, or shock immunity) is checked after it, so the stream does not depend on immunity.
  (c) Conditions that speak of "some living ally" (`ally_hp_below`, `ally_lacks`) include the hero. (d) Lifesteal heals a
  share of the HP actually removed, not of overkill. (e) A heal's riders apply to the healed target after the heal.
  (f) A `best`-type skill uses MIT when final MIT is at least final ARC, otherwise ARC. (g) Ticks fire in the order the
  statuses were applied, then a regeneration affix. (h) `brace` appears in the event log as a skill named `brace`. (i) Runbook
  refusals: E04 covers an unknown *action* id as well as a condition id; E08 covers any selector problem (missing,
  unknown, or wrong for the target); a skill refused as E06 or E07 is not also refused for its selector. (j) The three
  basic attacks (`strike`, `shoot`, `bolt`) are rows in `content/skills.json`. (k) A unit may not start a fight with HP
  outside 0 to max HP.
- **0.3 (2026-10-02, a G3 tuning permitted by 0.2):** the enemy curve constant changes from 22 to **34**, and the level-1
  monster profiles of section 10.2 are scaled: VIG x0.4, MIT and ARC x0.7, GRD and WRD x0.5 (rounded, minimum 1; SPD
  unchanged), with section 4.5 and the worked example WE-17 updated to match (brute VIG 14 becomes 6; WE-17 is now 110, 121,
  605, 845). **Measurement that prompted it:** the first balance run (commit 4d4ad1a, `evidence/G3-balance-baseline.json`)
  had 116 of 148 checks in bounds and showed the delve win rate for each gear tier was the same at every level from 5 to 50
  (starter 0.14 to 0.28, Fine about 0.66, Runed about 0.94, Heirloom 1.00), against the intent of 0.2. A search of 144
  settings (`node checks/tune-enemy.mjs`, `evidence/G3-tuning.txt`) and confirmation at 900 delves per cell chose K=34 with
  those scales: **124 of 148** in bounds, the gear-gap growth bound met (0.42 against 0.35), and low levels playable
  (level 5 starter gear wins 0.82). The six delve checks still out of bounds are at levels 40 and 50 and are structural:
  with hero base stats, gear and enemies all linear in level, no setting of these knobs makes the better tiers decline with
  level (see STOP-1, decision 1). The golden replay hashes were regenerated because the content changed.
- **0.4 (2026-10-02, approved by Ziggy in chat after STOP-1: "good to go with your recommendations"):** (1) **the enemy curve gains a
  quadratic term**, `enemy(p, L) = p + idiv(p * (30 * 49 * (L - 1) + 10 * (L - 1) * (L - 1)), 49 * 49)` (K = 30, Q = 10; the
  multiplier at level 50 is 41), because the linear curve made every gear tier win the same share at every level (STOP-1,
  decision 1); WE-17 is now 113, 124, 620, 865. (2) **Hero skill powers** (section 7.4): the six four-target skills x0.7
  (Cleave 7500 to 5250, Volley 6500 to 4550, Chain Lightning 7500 to 5250, Pinion Volley 6500 to 4550, Storm Rend 8500 to 5950,
  Death's Chill 5500 to 3850) and the two tank skills x2 (Shield Bash 12000 to 24000, Cold Grip 10000 to 20000), because tank
  teams lost and four-target skills out-damaged single-target ones (decision 2). (3) **Materials per encounter** `3 + idiv(D, 3)`
  (was 2): the level-50 over level-1 growth of materials falls from 9.0 to 6.3 (decision 3); WE-22 is now 450, 225, 45, 150 and
  WE-25 is 19. (4) **Thresholds loosened with Ziggy's word** in `checks/balance.yaml`: mirror composition win rate [0.25, 0.75]
  to [0.10, 0.90], class win rate [0.35, 0.65] to [0.30, 0.70], level-50 Heirloom delve win rate [0.65, 0.98] to [0.65, 1.00]
  (decisions 2 and 4). Offered and not built: a timed crit-immunity buff for tanks (measured as worth about 0.01 of tank win
  rate even when permanent) and multitarget variants for rare classes; Ziggy has no objection to either if wanted for feel.
- **0.4.1 (2026-10-02, Ziggy, in answer to the last open balance check):** the mirror composition floor is loosened again, to
  [0.05, 0.90] (it was [0.25, 0.75] as first committed and [0.10, 0.90] in 0.4). One composition (`rime_mender + shieldwarden +
  skyrider + volva`, 0.056) is accepted as a weak team by design; Ziggy: "I don't mind some weak and strong combos, that's half the
  fun of meta". The alternative offered, raising Hex, Frostbite and Dive by 25%, was measured (mirror 0 of 53 out) and not taken.
  No hero number changed. Net change to `checks/balance.yaml` since its first commit: three bounds (composition [0.05, 0.90], class
  [0.30, 0.70], level-50 Heirloom [0.65, 1.00]), each with Ziggy's word.
- **0.5 (2026-10-02, G4 design; the art direction is Ziggy's, the rest follows from SPEC and the card):** section 16 is replaced (oil
  paint on rough vellum for scenes and portraits, woodcut for menus and information screens, all procedural and seeded, new palette);
  section 17 gains recruiting, salvage and a raw-JSON runbook import; new section 19 specifies the rules layer (`sim/game.js`) and the
  save invariants; new section 20 specifies the client, including the dependency-free bundler that makes `file://` work. A starter
  runbook per class becomes content (`content/starter_runbooks.json`, the runbooks the G3 harness already used), so a new hero is not
  limited to basic attacks. Details decided here and not in the earlier sections: the new-game kit and party order, recruits arrive with
  a free Plain kit, a full stash drops extra loot visibly, `hacksilver` starts at 0.
