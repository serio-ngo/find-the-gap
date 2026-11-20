# From a lifecycle record to a playable level

[Design](DESIGN.md) · [Runtime](RUNTIME.md) · [Data and loops](DATA.md) · [Research](RESEARCH.md)

Find the Gap has four public levels. The first one starts with four criteria and three test names. AC1 and AC2 both point to `Add with an empty field shows the empty-field message in the result`. Those two asteroids must look like different rocks. The core that represents their shared test must be recognizable in both. [Original acceptance report](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620)

## What is actually stored

These counts are for the private run archive at `4e9acf3` on 20 November 2026. A case is a decision at a particular run, attempt and stage. Several decisions can concern the same pull request. The 165 public cases span 38 distinct, identified pull requests.

| Layer | Stored data | What it can support |
|---|---|---|
| Run archive | 250 records. The envelope holds `trace`, `eval`, `result`, `gate`, `transcript`, `revision`, `plugin`, `model`, `effort`, `dropped`. Of these records, 46 are local. `revision` is absent or null in 249. | Technical provenance and model telemetry. Most old records cannot support a like-for-like comparison across verifier versions. A pointer to a transcript is unnecessary for drawing a target. |
| Snapshots | Six repositories. Tasks, pull requests, commits, test approvals, review findings, role, times and run references. | Reconstruct what was known at a decision. A later merge, repair or new lock belongs to the retrospective. |
| Decision cases | 204 rows. 130 gate decisions and 74 model runs. 165 rows have public sources, 39 are private. | Use a pinned public report, commit or job for each playable observation. Keep related runs together when reserving a holdout. |
| Gate case | Candidate, reported and tested commits, verifier, lock, per-criterion `id/test/result`, JUnit counts, job results, context, source links and derived action. | Visible equality of revisions, test ownership, a missing result and a real expected/received difference are different puzzles. |
| Model case | Stage, run/attempt, turns, cost, duration, termination, validity, park and review context. | Depict the sequence of work. Neither cost nor successful termination certifies that the output was correct. |
| Local game data | A deck contains rules, five lifecycle difficulty steps, policy thresholds, fixed sequences, scored wave positions, a finite adaptive pool and evidence. Each decision records its wave, pick, hit or open outcome, scored status and elapsed time in memory. The offline model file stores a choice and a probability for each allowed target. | Replay the same case, compare actual decisions and present the evidence after the shot. The archive and the model service are outside the gameplay request path. |

The public split is **106 gates, 19 spec reviews, 18 test-writing runs, 15 deliveries and 7 review/fix runs**. Only 50 public cases have a rule-supported next action. Of those, 22 request evidence, 17 proceed, 7 repair code and 4 request a human test re-lock. The other **115 are `unknown`**. An unknown next action can still contain a verifiable local relation such as two equal SHAs. Scoring one of those relations makes no claim about what the whole task should do next.

## Which choices the levels offer

| Level | What the player compares | What determines the answer |
|---|---|---|
| 1 · Pair | Criterion and test in each rock's core | Two different criteria name the same test. Either member of that pair counts. [Four report rows](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620) |
| 2 · Odd revision | Revision marks in the same formation | The report names `26dd775` and checkout tested `237c08c`, a merge of the reported head into `236fd0a`. Difficulty progressively shortens the comparison. [CI checkout](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44411666642/job/135181131850) |
| 3 · Changed output | Two readings on each object | The regression records `5.00` and `5.000`. Those are strings, so the extra zero matters. The unchanged comparison reuses the expectation on both sides as a constructed control. [Regression](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206) · [Subsequent repair](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288595622) |
| 4 · Missing independent link | Each criterion’s test and its order in the report | AC2 points back to the test already used by AC1. All four rows say `passed`. A genuinely absent test result would be a different case. [Four report rows](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620) |
| Research · last wave of each level | Four observations from the report, checkout and regression | Every choice is allowed. The selection can be compared with the model and has no hit/miss grade. |

**Choice limits are 4 and 7.** Four fits the real opening case and leaves two other objects to compare against the pair. Seven is the existing ceiling for a moving formation. The four fixed routes each have 10 decisions and one research wave. Their 44 waves contain 209 choice positions and reach 6 objects. The adaptive pool has 80 predefined waves and 416 positions. Twelve of those waves reach 7. The missing-link rule keeps the four actual criterion rows at every step. The 625 positions across the two collections reuse the public evidence. [Level sequences and generators](../src/game/levels/lifecycle.ts)

## How a record becomes an asteroid

The game contains **ten pinned GitHub jobs with 134 ordered step outputs**, including setup, skipped work, failed tests and cleanup. Four jobs contribute 50 outputs for sandbox PR #22. Six contribute 84 for PR #20. They cover spec review, writing tests, delivery, the gate and the review/fix loop. Each output supplies its actual step number, name and conclusion. The regression level stops at the failed gate (55 outputs in four jobs). The later PR-loop and repaired gate appear in the retrospective research wave. [Public job projections](../src/game/levels/records.ts) · [Source verification](../scripts/check-sources.ts)

Every choice is one asteroid. One deterministic function turns one choice record into one rock; the same wave, appearance and record always draw the same rock. [Object generator](../src/game/gen.ts) · [Choice projection](../src/game/levels/lifecycle.ts)

| Record data | Drawn as | Visible |
|---|---|---|
| Choice identity: deck, rule, step, seed, appearance, clue and slot | Silhouette, three rings of lit facets, fissures, crater and vent placement | Always. No two choices share it |
| Mineral family, shuffled per wave | One of seven palettes: basalt, iron-nickel, ice, carbon, olivine, chondrite, obsidian | Always. Never derived from the answer |
| The clue's value without the criterion id: test name, revision or reading | Two or three faint veins seeded by that value | Always. Equal values share a vein pattern; nothing marks right or wrong |
| The choice's own step output, unique within the wave | A crystal druse: one crystal per step of that job, in step order. The own step is the long heart crystal. Success is a clear prism, failure a bent amber crystal, skipped a short dull stub | Always |
| The stage that produced the own step | A docked craft: dish for spec review, twin vials for writing tests, cargo pod for delivery, lock ring for the gate, coil for the PR loop | Always |
| Every stage of the case, in order | One crater per stage outside. Inside, one band per stage; a failed stage is a rust band | Craters always, bands after the scan |
| Every step output of those stages | One tick on its stage band: light for success, copper for failure, short and dim for skipped | After the scan |
| The clue | The split core: the test glyph, ordinal notches in the missing-link level, revision digits as crystal bars sized by hex value, readings as two bar groups (`5.00` three bars, `5.000` four) | After the scan |

The scan splits every rock into a cross-section and enlarges it by 35%; the rocks slow down while open. Calm mode opens them without motion. A shot cracks the chosen rock. On the two scored waves a miss stays open on its core and the right rocks are ringed; on unscored waves the rock bursts while the next wave already flies in. In adaptive mode a shuffle icon marks the wave after a rule switch and never names the new rule. The written readout of the clues is for screen readers only; on screen the cores carry it. After the game each decision lists the rocks with the same drawing and their source links.

### Choice limits and uniqueness

**A wave offers at least 4 and at most 7 choices** (steps 1 to 5: 4, 5, 6, 6, 7). Four is the real report: four criteria, one shared test. Seven is the most rocks a phone field keeps readable. Each wave's choices draw distinct own step outputs, and every timeline has at least 50 outputs, so seven choices never need to repeat one.

**No two choices in a wave are the same.** A unit test checks every fixed wave and every adaptive pool wave: the full records (clue, own step output, sources, stages) differ, and so do the closed rocks. In the revision and output levels the stored model input still repeats a token, for example `26dd775` on every rock but one. The rocks differ by their own step output. Making the model input itself unique needs a new d1.1 run (`npm run ai` with `LIQUID_AI_KEY`); without it the build rejects the level.

**No choice shows whether it is right before the shot.** The answer key is not an input to the generator: the test swaps the answers and gets identical rocks. The readable clue appears only in the split core, and the outcome mark appears only after the shot.

The build checks all 124 model requests against the original d1.1 input and validates the choice and probability keys for each wave. The frozen run's second pass differed on 10 choices, with a maximum probability difference of `0.524`. A replay uses the stored first pass. The visual edition has a separate identifier, so a player can identify which objects and rules produced a saved result. [Model recording](../src/game/eval/ai-run.json) · [Version checks](../src/game/eval/version.ts)

## More levels the data could support

| Distinct puzzle | Public observations available | What can be judged |
|---|---|---|
| Red at which stage? | In the same sandbox task, initial test writing yielded 13 passing and 3 failing tests. A later regression yielded 3 passing and 13 failing tests. After repair all 16 passed. | The relation between the stage and a test failure. A red lamp on its own would give a misleading answer. [Test-writing gate](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44287245490) · [Regression](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206) · [Repair](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288595622) |
| Which piece of evidence is missing? | In Focus run `44611003055`, reported and tested revisions agree at `0fb019f`. AC4 is `missing`, while the four other criteria are `failed`. | A missing observation and an observed failure need different symbols. [Gate run](https://github.com/serio-ngo/serio-focus/actions/runs/44611003055) |
| Which connection needs approval? | The public archive has four cases where the tests pass and the lock fails. One sandbox gate records 7 passing tests and 0 failures. | Re-lock approval and code repair call for different actions. [Sandbox gate](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/43505151629) |
| Can both observations be true? | Focus reported 4/4 while review still recorded a P1 finding. | The acceptance report and the independent review answer different questions. The pair is useful for open exploration until the particular scoring relation has a source. [Report](https://github.com/serio-ngo/serio-focus/pull/101#issuecomment-7006607108) · [Finding](https://github.com/serio-ngo/serio-focus/pull/101#discussion_r4640224214) |
