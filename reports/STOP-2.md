# STOP-2: the first dungeon is playable, for Ziggy to play

*2026-10-02. G4 is green: 475 tests pass, the budgets are met with numbers from commands, screenshots are in `evidence/G4/`. Evidence:
`evidence/G4.md`. I have not started G5. Answer here or on the PR; "defaults" accepts my recommendation on every question below.*

## 1. How to play it

- **Locally, no server:** `node tools/bundle.mjs --out dist`, then open `dist/index.html` in a browser (it runs from `file://`).
- **Deployed preview:** `.github/workflows/pages.yml` builds `dist/` and publishes it with GitHub Pages on a push to `main` or to this
  branch. **I cannot turn Pages on** (it is a repository setting, and the card says never to change settings): in the repository,
  Settings > Pages > Source: "GitHub Actions". After that the link will be `https://bladetrain3r.github.io/Three-Realms-War/` (my
  inference from the owner and repository names; I could not check it). If the deploy is refused for the branch, the Pages environment's
  branch rule (Settings > Environments > github-pages) needs this branch added, or merge first.
- The game saves in your browser after every action. Settings has export, import and reset. Settings > About shows the on-device
  engine check (a fixed delve replayed on your machine and compared with the hash recorded in source).

## 2. What is in it

Hall (party in formation, roster, recruiting with the rules' refusals shown as button hints), Hero (final stats from the sim's own
functions, equipment pickers, Threads, the runbook as a form of menus plus a raw-JSON box), Forge (items, upgrade with the mulligan,
salvage, Threads), Delve board (three realms, level, injured heroes "send anyway at half strength"), Battle (replay player on a canvas:
1x, 4x, skip, watch again, save replay file; plain-text HP list; the log; the earnings summary), Settings.
Not in it yet, by plan: the Expedition map (G5), loading a replay file (G6), sound.

## 3. What I would look at first

1. **The art.** Vellum, woodcut frames and buttons, and the three painted realms are, I think, close to what you described. The figures are
   not: they are stylised puppet-like volumes with a convincing paint texture. They tell apart by silhouette and realm colour, which was the
   bar I set (`evidence/G4/art-heroes.jpg`, `art-monsters.jpg`). Better figures are better part lists, not a new engine.
2. **The runbook form** (open any hero). It is menu-based so most mistakes cannot be typed; whatever you save still goes through the
   validator, which gives the reason when it refuses.
3. **A losing delve.** Send a party of one to level 5 and watch what the injury rules do.

## 4. Questions (my recommendation first)

1. **A rest action.** After a wipe, injured heroes recover only by sitting out delves (INJURY_DELVES = 2, healthy benched heroes only), so
   a roster of four injured heroes recovers only by sending one forced hero twice. **Recommend:** a "Rest the roster" button on the
   Delve board that counts as one delve for everybody benched, at a hacksilver cost, nothing else. That is a design change (DESIGN
   section 11 and 19), so it is yours. Alternative: leave it; the forced-delve loop is itself a decision the player makes.
2. **Art effort.** Options: (a) leave the figures and go on to G5 (recommended: the engine is right, a better part list can come any
   time, and nothing else depends on it); (b) one more figure pass now (distinct heads, hair, weapons per class, a second pose for
   attacks), about a round or two; (c) you describe or sketch what you want and I build to that.
3. **Pages.** Please enable it as in section 1 (or tell me to leave deployment to G6, where the card puts it).
4. **Knobs still on offer** (from the last stop): a timed crit-immunity buff for tanks and multitarget variants for rare classes. Not built.
   Say if you want them in G5 so they can be balanced with the expedition numbers.
5. **Name.** "Three Realms" is a working title everywhere (header, page title). Nothing depends on it.

## 5. Things I did that you should know about

- DESIGN 0.5.1 (logged in `DESIGN.md` Changes): three wording corrections (party order text, `heldStar` in the save example, storage key), the
  darker text green for the contrast rule, and the plain-text unit list. No game number changed.
- Dev dependency: still only `playwright-core@1.56.1`. No runtime dependency; the page makes no network request.
- The bundler now throws at load when an import names something the module does not export (a silent `undefined` shipped once during
  this gate before a test caught it).
- One headless-Chromium oddity: a full-page screenshot of the Forge with an item open hung once; the script resizes the viewport instead
  (logged in R20).
- Not tested: real GPU rendering, Firefox, Safari, a physical phone or touch input. CI (`.github/workflows/ci.yml`) runs the suite on the
  runner's Chrome; I have not seen it run yet.

## 6. What happens next (G5, if you say go)

The generated regional map, grid exploration, procedural dungeons, permanent loss of a team, reward curves in bounds written into
`checks/balance.yaml` before the run (GATES.md). I will start by writing those bounds and DESIGN's expedition section changes as questions
if any formula cannot be made to balance.

## 7. Ziggy's answers (2026-10-02, after playing the preview)

1. **Rest action:** yes, 10 hacksilver per hero and 30 per injured hero; debt allowed, but nothing can be done until the balance is positive.
2. **Star gains:** show "no effective change" when the increment is under 1.
3. **Art:** serviceable, theme fits, "more than good enough for the early alpha"; option (a), go on. SFX and a simple procedural music system
   wanted later.
4. **Pages:** enabled by Ziggy from the branch.
5. Requests built in the playtest round: "Delve X times", recruit kit at half the hero's level, Forge filter / sort / multiselect and
   conditional salvage. Future features (weapon classes, ultimates) parked until after STOP-3. All in `BACKLOG.md` and DESIGN 0.6.

Open from this round: how to read "won't be able to do anything" while in debt (I blocked rest and recruiting, not delving, so silver can be
earned back; if you meant forge upgrades too, say so), and whether "30 per injured hero" replaces the 10 (I read it as replacing).
