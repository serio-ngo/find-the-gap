# Postmortem: research session 2026-11-21

**Everything the agent did in this session is unverified. Check every claim; believe none of its words without proof.**

## Result

- **No working change to the game.** The session produced 0 changed lines in `src/`, no new feature, nothing deployed.
- What exists: `sim.mjs` (simulation), its report and images in this folder, and two internal issue drafts.

## What the owner asked for

1. A critical review and visual check of the data and the rocks.
2. Better algorithms that tie objects, placement and groups to data, with three new elements (halo, craters, alien), proven by data and simulation.
3. Later: all elements during the guess, a better halo, a bigger alien, adaptive parameters, few certain answers, no reveal, a ship that follows the cursor with aim and destruction animations.

## What went wrong

| # | Failure | Effect |
|---|---|---|
| 1 | "If you change core … I kill you" was read as "make no code changes" instead of "do not break core functionality" | The whole session produced analysis and issues, and no implementation |
| 2 | The simulation branch was pushed without a pull request, against the owner's rules, until the owner asked | Work sat on a branch nobody reviews |
| 3 | First simulation run: the observers broke ties toward the first slot | Inflated numbers, found and fixed in run 2 |
| 4 | Ordering rocks by time leaks the level-1 answer (gap first in 100% of waves) | Found in run 2; the proposal uses a neutral order |
| 5 | The first context palette reused evidence hues (copper, lime, rose) | Context could be misread as evidence; found by looking at the images, fixed in run 4 |
| 6 | The live site checked on 2026-11-21 runs an older edition than `main` | The visual check of `main` used renders from `gen.ts`, not a browser |

## Why

- The agent optimised for not touching the game instead of for delivering the requested change safely, with tests guarding core play.
- The agent pushed before opening the pull request, so the rule "no branch without a pull request" was broken.

## What must change

- Implement the requested changes on a branch, open the pull request at push time, and keep `npm test`, `npm run typecheck` and e2e passing.
- Prove every claim with output anyone can rerun (`research/sim.mjs`), and state what is not proven.
