# Design

[Levels](LEVELS.md) · [Runtime](RUNTIME.md) · [Data and loops](DATA.md) · [Research](RESEARCH.md)

Find the Gap is a short arcade game built on real evidence from Serio's AI Dev Lifecycle. Rocks drift into the field, a scan splits them open, and the player shoots the rock that answers the wave's rule, for example the symbol that repeats. One shot is one decision. After the game the player sees, for every decision, what the AI chose.

## Play

- Tap or click a rock, or use the arrows and Space. The shot aims itself, so the score measures the choice, not dexterity.
- A level is 10 waves plus one 🔬 research wave with no right answer, about two minutes. Two waves are scored; on the others the rock bursts while the next wave flies in. A scored miss splits and rings the right rocks.
- Pause is always available. Calm mode starts when the device asks for reduced motion: slower drift, no shake, no particles. Nothing flashes in any mode, and every state has a shape as well as a colour.
- The rules are learned by playing. There is no written guide.

## Rules

| Rule | Source relation |
|---|---|
| Pair | two criteria point to the same test ([four criteria, three test names](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620)) |
| Odd one out | the report names `26dd775`, the checkout tested `237c08c` |
| Changed value | a regression turns `5.00` into `5.000` |
| Missing link | a criterion without a test of its own |

Each rule has five steps: more rocks (4 to 7), closer look-alikes, faster drift outside calm mode. Level 1 is the lecture case: four rocks, two share a test. How each record becomes an asteroid: [Levels](LEVELS.md).

## Modes

- **Standard, the default.** One fixed sequence per level version, the same for everyone, with the AI result of that version stored. Players share it like a daily puzzle.
- **Adaptive, 🛸.** The game master moves the difficulty step after every decision and changes the rule when the step stays at its limit. 🔀 shows that the rule changed, never what it changed to. The AI plays exactly the waves the player got. [Policy](RUNTIME.md#policy-floats-in-steps-out)

## End screen

The score from the two scored waves, agreement with the AI, atypicality (the research-wave pick against the stored d1.1 run) and a local top five. The decision rows, with each side's pick and its source links, sit behind one icon. Sharing uses the phone's share sheet, copy, X, Bluesky, LinkedIn and Facebook; each level has its own preview image.

## Languages

Polish and English, at most 12 visible strings per language; icons carry the rest, each with an accessible name in both languages. The name stays English; the addresses are `/find-the-gap` and `/en/find-the-gap`.

## Acceptance

| Check | What must be visible |
|---|---|
| First contact | A new player starts and finishes the first wave without text instructions, by keyboard, touch and mouse; pause works everywhere. |
| Screen readers | A keyboard-only path and a screen-reader path finish a level through the rocks' HTML button twins, each with an accessible name. |
| Playability | After the first game the player decides alone whether to play again; voluntary returns are counted apart from runs a demo asks for. |
| AI comparison | Standard mode uses the stored AI run of that exact version; each decision row shows both picks. |
| Versions | Changing a deck, sequence, threshold or question changes the hash; a stale AI run fails the build. |
| Framework | A second deck runs on the same engine with its own rules; local saves keep the levels apart. |
| Offline | Phase 1 makes no network request: with every request blocked, standard and adaptive games play the same. |
| Predictable policy | The same state gives the same step and rule in the game, the eval and the analysis; a recorded path replays exactly. |
| Objects | The same seed and record always draw the same target; a wave offers 4 to 7 choices and no two share a record or a look; nothing shows right or wrong before the shot. |
| Almost no text | Play and the end screen need no words beyond the visible-string budget. |
| Smoothness | A median of at least 55 fps on a mid-range phone, at most 30 kB of gzipped JS. |
| Extraction | `src/game/` builds in an empty Astro project with only the two page files and no private package; brand tokens are CSS variables with local fallbacks. |
| Lecture | The presenter ties a rock and a result to a line of the real report. |
| Phase 2 | Adaptive speed, security and research checks: [Runtime](RUNTIME.md#phase-2-the-site). |

## Open

- **Not measured:** 55 fps on a real mid-range phone; the first-contact trial with 12 new players ([targets](RESEARCH.md#evidence-still-owed)).
- **Model input repeats a token** in the revision and output levels (for example `26dd775` on every rock but one). A unique input needs one new `npm run ai` through the local audioblog Worker with the real d1.1 model; that Worker route does not exist yet.
- **Faint clue veins:** equal clue values share a vein pattern, so in level 1 the correct pair matches below conscious notice. Needs a decision before the site launch.
- **Decks are authored** in `src/game/levels/`; reading the archive's flagged observations is the next data step ([Data](DATA.md#from-lifecycle-evidence-to-a-level-version)).
- **Dropped by decision:** lives, a field hint event, the picture guide and the duel line with ✓/✕ strips.
