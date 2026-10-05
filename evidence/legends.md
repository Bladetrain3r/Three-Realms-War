# Legendary bosses and the final boss — evidence (2026-10-05)

Design: DESIGN 10.7, 12.6 and Changes 0.11. Rounds: LOG R31 to R34. Everything below is a command and its output.

## Balance (bounds first: `checks/balance.yaml`, sections `legends:` and `final:`)

`node checks/balance-legends.mjs --write evidence/legends-balance.json --table` (150 fights per cell, realms rotated, no dates in the report):
34 checks, 34 in bounds. `--fights 400` also 34 of 34. The table (win rate, median rounds):

| Legend (fought at expedition level + 5) | ready party | weak party | strong party |
|---|---|---|---|
| Fenris (L15) | 0.49, 10 rounds | 0.00 | 1.00 |
| Jormungandr (L25) | 0.48, 17 | 0.00 | 1.00 |
| Ymir (L35) | 0.54, 18 | 0.00 | 1.00 |
| Beowulf (L45) | 0.51, 12 | 0.00 | 1.00 |
| Odin (L55) | 0.46, 17 | 0.00 | 1.00 |

Chaos (L60): solid party (level 50, Heirloom 5-star, one paragon star per stat bought at level 30) 0.30, median 13 rounds; under (level 50, Runed 3-star, no paragon) 0.03;
full (all 18 paragon stars, four Legendary pieces) 0.87. The multipliers were tuned on these same seeds; the bounds are wide (ready 25 to 80 percent against about 50 measured).
All figures in the bounds are mine; Ziggy gave none.

Unchanged by this work: `node checks/balance.mjs` 148 of 148 (report identical), `node checks/balance-expedition.mjs` 79 of 79 (checks and cells identical to `evidence/G5-balance.json`).

## Budget (DESIGN 15, shipped bundle <= 409,600 bytes)

`node tools/bundle.mjs --out /tmp/final-dist`: game.js 392,540, index.html 449 (style.css 12,477, not counted by the test). Before the build-time content validation the same
command gave 440,396 + 449 = 440,845 bytes, over the ceiling (the test failed); the content schemas and the cross-checker are no longer shipped (LOG R34).

## Art

`evidence/legends-art.jpg`: the six figures (`node tests/browser/shoot-gallery.mjs /tmp/gal legends`): Fenris, Jormungandr, Ymir, Beowulf, Odin, Chaos. Serviceable first drafts, procedural, no third-party assets.

## Tests

`npm test`: 578 of 578 (unit, determinism with the static scan of sim/, headless-browser). New: tests/unit/legends.test.mjs (7), lairs.test.mjs (8), balance-legends.test.mjs (3), a bundle test,
a browser test that plays a lair through the page and compares every save with the rules layer's.
