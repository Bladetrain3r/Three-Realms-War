# Backlog: Ziggy's notes from the STOP-2 playtest (2026-10-02)

Not a plan. Nothing here is built unless a gate or Ziggy says so. Ziggy's own words are quoted where they carry the intent.

## Decided by Ziggy on 2026-10-05, not yet built (the order I proposed: items and drops, then bosses)
- **Delves drop at most Runed items; Heirloom only from expeditions** ("otherwise there's no reason to risk an expedition when you can just 50x delve"). This is item quality only, not silver, xp or materials. Re-run the G3 pacing checks when built.
- **Legendary encounters**: five single-monster multi-phase bosses (Jormungandr, Fenris, Ymir, Odin, Beowulf), one per 10 levels, found only in expedition encounters at depth 5 or more. Each boss has **one fixed item** and a **special icon on the expedition map** for the encounter; items are unique per save, a mid and late game goal. Legendary items: 1.5 x the Heirloom main stats, a fixed secondary list, 7 stars (the 7th very low odds and very expensive). Needs a Legendary tier, star odds for stars 6 and 7, boss phases in the combat engine (a PHASE event in the replay), and a rule for placing the icon. The five items are to be designed with the bosses (two weapons, armour, helm, charm across the five).
- **Paragon stars**: three per stat (18 per hero); each star multiplies the **level-up increment** of that stat by about +11%, only for levels gained after the star was bought (not retroactive: three stars at level 10 give +33% on all 40 later level-ups, at level 40 only the last ten, at 50 nothing). Costs realm-specific rare resources as well as being a drop; drops only in expeditions, rare. A hero with all 18 stars gets one class bonus (an assassin +5% crit, a healer +5% healing strength, ...). Needs per-stat bookkeeping of the level each star was bought at.
- **The late game question** (Ziggy: "we've got no real late game just numbers go up, which is a question we probably want to answer now"): open. Legendary bosses, the 7th star, paragon stars and class passives are the candidate answers; none is a loop yet.

## Ziggy's endgame note, 2026-10-05 (after the legendary tier data landed)
A **level-60 end boss** that needs **four legendary weapons** and "a reasonably well maxed level-50 party otherwise" to beat; past that, "NG+ later or something". That is the core game run end to end. Questions this raises (not decided): five legendary bosses with one fixed item each cannot give four weapons unless four of the five are weapons (earlier note: two weapons, armour, helm, charm), so how are four weapons obtained, and are they worn by the four party members? Enemy levels above 50 need the curve extended (it is defined by formula, so level 60 is computable; the G3 bounds stop at 50). The unlock is likely "own four Legendary weapons". The late-game question is then answered by a destination, with the legendary hunt as the road.

## Done on 2026-10-05
Delves drop at most Runed, Heirloom only from expeditions; the Legendary tier (data and rules); expedition distance reward 700 and G5 closed (79 of 79).

Every recruit level 1; rest xp only within 10 levels of the party's best; paid training (100 x level, up to 40); the activity timer; expedition bounds re-baselined (well built / badly built).

## Open from the G5 build
- `reports/BLOCKED-G5.md`: expedition lethality against the bounds written first; seven build-time decisions to confirm.

## Done in the G4 playtest round (build after `d1e7a4d`)
Rest action with gold cost and debt; recruit kit level = half the hero's level; "Delve N times"; Forge filter, sort and bulk salvage;
"no effective change" where a star rounds away; portraits no longer stretched.

## Parked until STOP-3 is final (Ziggy: "only to be planned/decided after STOP-3 is finalised")
- **Weapon classes.** Club / Axe / Sword / Staff / Spear, and Bow / Sling / Staff. Not hard requirements; weapons have class matches that
  complement their stats. Players invest training points or resource per hero to train a weapon type. Ranks: Untrained (-20%), Competent (0%),
  Proficient (+5%), Skilled (+10%), Expert (+15%), Apex (+20%). Every class starts with 1 to 3 random weapon proficiencies. (The note ends
  mid-sentence: "with some ...".)
- **One unique ultimate skill per class**, and for bosses and minibosses. "Limited charge items?"

## Candidates for the next rounds (my read; Ziggy's call)
- **SFX around abilities.** Synthesised in the browser with Web Audio (no files), muted until the player turns sound on. Fits G6 polish.
- **Simple music system.** Ziggy: "ABC/MID in the browser? Procedural skaldic is the thought." A small seeded generator (modal drone plus a
  sparse melody, tuned to the realm) fits the no-assets rule; a separate piece of work, after STOP-3 unless asked sooner.
- **Art tweaks.** "Serviceable and the theme fits, some small areas I'd tweak": waiting for the list.

## Playtest observations (data for balance, not requests)
- Early levels are grind with little tactics needed ("which is fine"); different heroes clearly affect outcomes; levelling and delve
  progression pace is fair for a coffee-break crawler.
- "It's a numbers game still": character level grinding has not yet stopped working. The interesting balance question starts when heroes
  are at the level cap and cannot push through; loadout tuning matters then. (G3's level-40/50 bounds are where that is checked.)
- Tactics (runbooks) barely used yet.
- Weapon upgrades visibly improve stats (the low-level rounding of star gains on small values is now stated rather than hidden).
