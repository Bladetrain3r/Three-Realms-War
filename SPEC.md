# Three Realms (working title) — specification

*Written 2026-10-01 by the conductor (Ziggy's fleet) from Ziggy's brief of the same evening. `GATES.md` is the order and the
pass/fail; `CLAUDE.md` is how the building session works. Decisions marked **Ziggy** need his word (a STOP point).*

## What it is

A semi-idle, turn-based team-tactics game in the browser, with the emphasis on loadouts, synergy and upgrade-focused
progression. A player builds a roster of heroes, equips and upgrades them, writes simple **runbooks** (rules that
trigger actions on plain criteria, in the manner of Dragon Age: Origins' tactics), and sends the team on dungeon
delves and expeditions that resolve by simulation. The genre is the idle team RPG with gear crafting (Gladiatus is a
named inspiration); the setting is Norse: Asgard, Midgard and Helheim contending for the world as Ragnarök nears.

Open source, MIT. Not monetised. No accounts, no server, no telemetry.

## Decisions (Ziggy, 2026-10-01)

1. **Single player, purely local, in the browser.** Saves in the browser's own storage. No server, no accounts.
2. **No energy or daily activity limits** in this build. (They were in the original brief to keep later PvP fair;
   they come back, if ever, with PvP, as configuration.)
3. **HTML5 and plain JavaScript. Minimise external dependencies.** No three.js, no framework, no bundler unless one
   earns its place (and then it is a dev dependency only). Canvas 2D for the drawing. Runtime dependencies: none.
   Dev dependencies allowed: a test runner and a headless browser for the client tests.
4. **Art is made as needed by the build, replaced later if desired.** Vector/procedural 2D in a stated style guide;
   no third-party art, no art from any existing game.
5. **Nothing from the commercial games this resembles**: no names, art, copy, assets or data from them, anywhere in the
   repo. "We've got RAID at home" is a joke for the chat, not a string in the code.
6. **Working title** "Three Realms" until Ziggy names it.

## The replay is the oracle (the load-bearing design rule)

The game has no external source of truth, so its own simulation must be one. **The simulation is deterministic:** a
seeded pseudo-random generator, no `Math.random`, no dependence on object iteration order or wall-clock time, integer
or fixed-point arithmetic where floating point could drift. The same seed, roster, loadouts and runbooks produce the
same **replay**, and a replay's hash is stable across machines. A replay plays back in the browser. Later multiplayer
(out of scope) is exactly this: a submission hashed, resolved once, replayed anywhere. Every balance, content and
client gate below rests on this property, and it is proved first (G1).

## Systems (in scope)

**Heroes.** A roster of named heroes with a class, a realm affinity, base stats, a level and a small kit of actions.
Stats: attack, defence, magic resist, elemental resistances (fire, frost, lightning), status resists; HP; speed (turn
order). Training raises level and base stats; a hero can die for good on an expedition.

**Equipment and upgrades.** Slots per hero (a small fixed set). Items have a commonality tier, an item level, and
individual stat lines; upgrading an item consumes materials (common ones from delves, rare ones from boss rewards)
and rolls on a stated table. Set bonuses give the synergy layer. Fewer moving parts than the inspirations, and
every table is data, not code.

**Combat.** Turn-based by speed; attack versus defence, magic versus resist, elements versus elemental resists,
status effects with resist rolls. The formula is written in `DESIGN.md` before it is coded.

**Runbooks.** Per hero: an ordered list of (condition, action) rules from a bounded vocabulary (conditions on self,
ally and enemy state; actions from the hero's kit and items). The first rule whose condition holds fires. A runbook
is data (JSON), validated against a schema; an invalid runbook is refused with the reason.

**Dungeon delves.** Three to five encounters from a themed roster per trip, with loose coupling of enemy type to
strength; a boss at the end with rare rewards. Automated: the player sets the team and runbooks and the delve
resolves; the replay shows what happened.

**Expeditions.** A single regional map, generated anew for each expedition, explored on a grid; procedurally
generated dungeons on it; the team is lost permanently if all die. Rewards scale with depth and distance.

**Progression.** Hero training, item upgrades, roster growth, realm reputation. No gates on time.

**Persistence.** The save is one JSON document in browser storage, versioned, exportable and importable as a file
(so a player can back up and move it). Nothing else is stored.

## Out of scope for this build

PvP, servers, replay submission, private servers, multiple character slots, spirit pets, energy limits, accounts,
monetisation, mobile layouts beyond "it works at phone width", sound.

## Budgets (measured, stated in `DESIGN.md`, enforced by tests)

Client: one tab under a stated memory figure (target well under 1 GB; the design states the number); 60 frames a second
drawing a dungeon encounter at 1920×1080 on an ordinary laptop GPU; the deployed bundle under a stated size. Sim: an
encounter resolves in under a stated time headless; ten thousand delves run in a test in under a stated time.

## Delivery

Static files, served by GitHub Pages; runs from `file://` too. Works in current Firefox and Chromium.
