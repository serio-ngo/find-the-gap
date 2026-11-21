# Research session 2026-11-21

**Everything in this folder was produced by an AI agent (Claude) in one session. Check every claim yourself. Do not believe a single word here until you have run the checks below.**

No game file changed in this session. See `POSTMORTEM.md`.

## Contents

| Path | What it is |
|---|---|
| `sim.mjs` | Simulation: draws every wave of the three levels with today's rocks and with data-driven variants, then measures them |
| `results/report.md` | Its output, tables A to I |
| `results/level-1.png`, `level-2.png`, `level-3.png` | Left to right: today, evidence only, data-driven context. Top: step 1; bottom: step 5 |
| `results/legend.png` | Element designs. Rows: rock size, halo, craters, alien |
| `results/same-run.png` | One gap run in four waves. Top: today; bottom: data-driven |
| `results/salience.png` | One level-2 wave as context grows from none to full |
| `POSTMORTEM.md` | What went wrong in this session |

## Run the checks

The simulation reads the game code in `src/game/` (read-only) and a local copy of the lifecycle run archive. The archive is not public, so it is not in this repository.

```
node research/sim.mjs <run archive folder> --self-test
node research/sim.mjs <run archive folder>
```

- `--self-test` must print `self-test ok`. It checks that the same input gives the same picture, that the drawing never reads the answer, and that context elements keep odd_revision rocks mirror-symmetric.
- The second command rewrites `results/`. A rerun must leave `git diff` empty.
- The simulation's rule reader must score 100% on all 63 waves, matching `tests/unit/gen.test.ts`.

## What the report claims (verify it)

- Today's rocks are mostly noise: the same run looks about as different from itself in another wave as from other runs (noise ratio 0.98 / 0.69 / 0.72 for levels 1 / 2 / 3).
- An evidence-only rock with no random seeds is found faster by the pre-attentive observer: 81% / 90% / 90%, against 86% / 48% / 14% today (chance 19%).
- Context elements (halo, craters, alien) during the guess raise how well the picture follows the data, and lower that findability.
- Every odd_revision gap predates the tested-commit fix (serio-focus#94). Ordering rocks by time puts the level-1 gap first in 100% of waves.
- The admission rule was set before the sweep. No configuration passed it.

## Not proven

- How real players behave. The observers are stand-ins, not people, and there is no human data.
- 21 waves per level, so one wave moves a level's score by 4.8 points.
- The stored AI picks come from a prompt that names the rules; players never see the rules.
