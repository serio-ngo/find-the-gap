# Value and evidence

[Design](DESIGN.md) · [Levels](LEVELS.md) · [Runtime](RUNTIME.md) · [Data and loops](DATA.md)

**As a lecture example**, one wave shows three things: the player shoots a specific rock, an independent AI may pick another, and the presenter can point to the source line that gave both rocks their clue. The sandbox report really has four criteria and three distinct test names; the asteroids, their motion and effects are game design. [Report](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620)

**Playability is the biggest unknown.** Shooting and matching are known mechanics. What can stand out: the same real trace drives the game, the AI's choices wait as a reveal at the end, and the adaptive mode reacts to each player. The first test is a voluntary rematch after a demo; people following a presenter's instruction only show that they could play.

## What the adaptive double loop gives

| Area | Gain | How we would know |
|---|---|---|
| Gameplay | difficulty follows each player; a stuck player gets a simpler rule instead of a wall | replay, time in band |
| Style | a game master that visibly reacts; every rule change is a beat; the AI's picks wait as a reveal | replay, share rate |
| Research | every wave yields a state, an AI estimate of the player and the real outcome: data on whether an AI can predict where a person struggles. Rule switches the player must work out are the core of set-shifting tasks such as the Wisconsin Card Sorting Test | calibration, waves to adapt |
| Lifecycle | states where people beat d1.1 nominate eval cases, which their source confirms; loop 3 is a small, public, measurable improve loop | number of such states, accepted policy changes |

## Risks

| Risk | Fix |
|---|---|
| The player shoots the nearest rock and a stat suggests a trait | the shot aims itself; equivalent waves swap positions; stats describe decisions only |
| The interface rewards guessing the model | points come from the source record, never from agreeing with the AI |
| d1.1 floats are not calibrated for people | calibration per version; thresholds move in loop 3; the local estimate stays the control |
| d1.1 is late | the request leaves when the wave appears; 1,500 ms budget; the local estimate otherwise |
| Paths differ per player | in adaptive mode the AI plays the player's exact states; standard mode keeps one shared path |
| The model saw symbols, the player sees rocks | the saved run was evaluated on symbolic observations and its prompt names the rule, so no claim about equal information or visual perception holds |

## What similar projects show

| Example | Lesson |
|---|---|
| **Genes in Space and Cell Slider** | The Cancer Research UK game turned data into a ship's route; the separate Cell Slider reported an AUC of 0.95 for identifying cells. Keep launching a game apart from proving accuracy. [Genes in Space](https://news.cancerresearchuk.org/2014/02/04/cancer-research-uk-launches-spaceship-smartphone-game-to-seek-cancer-cures/) · [Cell Slider](https://pubmed.ncbi.nlm.nih.gov/26288840/) |
| **Borderlands Science and Space Warps** | The first collected over 135 million solved puzzles by embedding the game in an existing product. The second recovered about 65% of known real lenses and found 29 promising candidates. Promotion helps scale; accuracy needs its own measurement. [Borderlands](https://www.nature.com/articles/s41587-024-02175-6) · [Space Warps](https://arxiv.org/abs/1504.05587) |
| **Gravity Spy and a CHI control** | Gravity Spy uses verified human labels to grow a training set. In a CHI study the game format was more enjoyable but gave less accurate data than the equivalent task. Keep a comparison with a plain table and expert verification. [Gravity Spy](https://link.springer.com/article/10.1140/epjp/s13360-023-04795-4) · [CHI study](https://ray.yorksj.ac.uk/id/eprint/7952/) |

## Evidence still owed

- **First contact:** a trial with 12 new players; targets 9 unaided starts, 8 finishes and 4 voluntary replays, counted apart from presenter-led play.
- **Larger study:** whether anonymous player choices help pick cases for audit, against a plain table and a simple rule, with the same expert time, grouped held-out cases, independent adjudication and model baselines. Targets: 10 percentage points more precision in the top fifth of the audit queue, or review 20% faster than the table with at most 5 points lost in accuracy.
- **Also missing:** neurodivergent co-design, a calibration study and a physical mid-range phone benchmark. A browser playthrough can establish offline behaviour; it cannot establish public deployment, consented contributions or any clinical reading of a player's decisions.
