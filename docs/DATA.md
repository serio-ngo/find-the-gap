# Data, versions and loops

[Design](DESIGN.md) · [Levels](LEVELS.md) · [Runtime](RUNTIME.md) · [Research](RESEARCH.md)

## From lifecycle evidence to a level version

1. **Evidence.** Only public lifecycle cases (tests, changes, reviews), each with its source link and version; private cases stay internal. The run archive keeps one flagged row per gate relation (`odd_revision`, `pair`, `missing_link`, `lock_only`): the compared items, the gap's indices, links and the flags `visibility`, `split`, `labelled` and `comparable`. A deck reads only rows with `visibility: public` and `split: deck`. Changed value has no archived source yet: gate records keep no test failure message. Today the decks are authored projections in `src/game/levels/`.
2. **Deck.** Each rule gets a wave generator: symbols stand for test names or SHAs, with five difficulty steps and a seed per wave. The right answer comes from the source record.
3. **Version.** A level version is the deck, the generator, the fixed sequence, the policy thresholds and the d1.1 question text. Its hash changes when any of them changes.
4. **AI run.** The `ai` question runs offline over the fixed sequence and the adaptive seed pool, and its picks and floats are stored with the hash. The build fails when the stored hash differs from the level, so no player is compared with a stale AI.
5. **Back to the source.** After the game the presenter opens the record behind each wave.

## Three loops

| Loop | What changes | Evidence | AI | Human |
|---|---|---|---|---|
| **1 · Step**, every wave | the difficulty step within a rule | hit or miss, tempo | d1.1 estimates the chance of the next hit | the player plays; code applies the policy |
| **2 · Rule**, in the game | the rule itself | two waves at the step limit | d1.1 floats trigger 🔀 through fixed thresholds; the AI player meets the same switch | the player sees 🔀, drops the old rule and works out the new one |
| **3 · Policy**, per version | thresholds, deck, question text | time in band, calibration, waves to adapt, replay, people vs AI | a script computes the numbers; a model drafts at most three changes | a person decides; a new version gets a new hash and a new AI run |

Loop 1 alone is a thermostat. Loops 2 and 3 change the rule the thermostat follows: the player's rule inside the game, the game master's rule between versions.

## Measures per version

- **Time in band:** the share of waves where the player's real hit rate stays between 55% and 80%.
- **Calibration:** d1.1's mean "hit" probability against the real hit rate, per 0.1 bin.
- **Waves to adapt:** waves after 🔀 until the next hit, for the player and for the AI.
- **Replay:** the share of players who start another game on their own.
- **People vs AI:** hit rate per rule and step.

In phase 2 each adaptive game randomly uses the d1.1 estimate or the local estimate, with the same deck and look; the local estimate is the control. From a 30% replay baseline, about 360 games per arm show a gain of 10 points and about 1,400 show 5 points (80% power). d1.1 becomes the default only if it beats the local estimate.

## Back into the lifecycle

- A research-wave pick, or a state where people beat d1.1, never becomes a label by itself. It only nominates a case; a script or a person checks it against its source, and only a confirmed gap enters the lifecycle's replay set.
- A holdout of public cases (`split: holdout`, about 20% of pull requests by hash, never one the game already shows) never enters a deck, so a lifecycle change is judged on cases no player has seen.
- The research wave draws rows with `labelled: false`. Each decision stores the level version and the observation `id` of every choice, so a pick names the row it nominates.

## Privacy

- History, unlocked levels and stats stay on the device, and the player can download or delete them.
- Phase 1 sends nothing. From phase 2, only after the opt-in "🔬 → Serio" toggle shown after the first game, one POST per game: version and mode, and per wave the rule, step, seed, pick, hit, tempo band, the AI's pick and float, the "hit" float used, the estimator and whether the cache answered; the date only as a day. No ID, no stored IP, no free text. Published numbers hide groups smaller than 10. Stats never depend on consent. What Cloudflare invocation logs keep for `/api/game/*` is checked before launch.
- Asking whether someone is neurodivergent would turn the data into health data under GDPR Art. 9, so the game does not ask. Stats describe decisions in this game; linking them to traits needs separate validation. [Co-design with autistic people](https://doi.org/10.1177/1362361319830523) · [Reliability of cognitive tasks](https://pubmed.ncbi.nlm.nih.gov/28726177/)
