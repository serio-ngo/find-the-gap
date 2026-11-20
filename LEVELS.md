# From a lifecycle record to a playable level

Find the Gap has four public levels. The first one starts with four criteria and three test names. AC1 and AC2 both point to `Add with an empty field shows the empty-field message in the result`. Those two asteroids must look like different rocks. The core that represents their shared test must be recognizable in both. [Original acceptance report](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620)

## What is actually stored

These counts are for the archive at `4e9acf3` on 20 November 2026. A case is a decision at a particular run, attempt and stage. Several decisions can concern the same pull request. The 165 public cases span 38 distinct, identified pull requests. [Archive schema](https://github.com/serio-ngo/lifecycle-runs/blob/4e9acf3/README.md) · [Case extractor](https://github.com/serio-ngo/lifecycle-runs/blob/4e9acf3/cases.mjs)

| Layer | Stored data | What it can support |
|---|---|---|
| Run archive | 250 records. The envelope holds `trace`, `eval`, `result`, `gate`, `transcript`, `revision`, `plugin`, `model`, `effort`, `dropped`. Of these records, 46 are local. `revision` is absent or null in 249. | Technical provenance and model telemetry. Most old records cannot support a like-for-like comparison across verifier versions. A pointer to a transcript is unnecessary for drawing a target. |
| Snapshots | Six repositories. Tasks, pull requests, commits, test approvals, review findings, role, times and run references. | Reconstruct what was known at a decision. A later merge, repair or new lock belongs to the retrospective. |
| Decision cases | 204 rows. 130 gate decisions and 74 model runs. 165 rows have public sources, 39 are private. | Use a pinned public report, commit or job for each playable observation. Keep related runs together when reserving a holdout. |
| Gate case | Candidate, reported and tested commits, verifier, lock, per-criterion `id/test/result`, JUnit counts, job results, context, source links and derived action. | Visible equality of revisions, test ownership, a missing result and a real expected/received difference are different puzzles. |
| Model case | Stage, run/attempt, turns, cost, duration, termination, validity, park and review context. | Depict the sequence of work. Neither cost nor successful termination certifies that the output was correct. |
| Local game data | A deck contains rules, five lifecycle difficulty steps, policy thresholds, fixed sequences, scored wave positions, a finite adaptive pool and evidence. Each decision records its wave, pick, hit or open outcome, scored status and elapsed time in memory. The offline model file stores a choice and a probability for each allowed target. | Replay the same case, compare actual decisions and present the evidence after the shot. The archive and the model service are outside the gameplay request path. |

The public split is **106 gates, 19 spec reviews, 18 test-writing runs, 15 deliveries and 7 review/fix runs**. Only 50 public cases have a rule-supported next action. Of those, 22 request evidence, 17 proceed, 7 repair code and 4 request a human test re-lock. The other **115 are `unknown`**. An unknown next action can still contain a verifiable local relation such as two equal SHAs. Scoring one of those relations makes no claim about what the whole task should do next. [Pinned case rows](https://github.com/serio-ngo/lifecycle-runs/blob/4e9acf3/cases.jsonl)

## Which choices the levels offer

| Level | What the player compares | What determines the answer |
|---|---|---|
| 1 · Pair | Criterion and test in each rock's core | Two different criteria name the same test. Either member of that pair counts. [Four report rows](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620) |
| 2 · Odd revision | Revision marks in the same formation | The report names `26dd775` and checkout tested `237c08c`, a merge of the reported head into `236fd0a`. Difficulty progressively shortens the comparison. [CI checkout](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44411666642/job/135181131850) |
| 3 · Changed output | Two readings on each object | The regression records `5.00` and `5.000`. Those are strings, so the extra zero matters. The unchanged comparison reuses the expectation on both sides as a constructed control. [Regression](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206) · [Subsequent repair](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288595622) |
| 4 · Missing independent link | Each criterion’s test and its order in the report | AC2 points back to the test already used by AC1. All four rows say `passed`. A genuinely absent test result would be a different case. [Four report rows](https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620) |
| Research · last wave of each level | Four observations from the report, checkout and regression | Every choice is allowed. The selection can be compared with the model and has no hit/miss grade. |

**Choice limits are 4 and 7.** Four fits the real opening case and leaves two other objects to compare against the pair. Seven is the existing ceiling for a moving formation. The four fixed routes each have 10 decisions and one research wave. Their 44 waves contain 209 choice positions and reach 6 objects. The adaptive pool has 80 predefined waves and 416 positions. Twelve of those waves reach 7. The missing-link rule keeps the four actual criterion rows at every step. The 625 positions across the two collections reuse the public evidence. [Level sequences and generators](src/game/levels/lifecycle.ts)

## How a record becomes an asteroid

The game contains **ten pinned GitHub jobs with 134 ordered step outputs**, including setup, skipped work, failed tests and cleanup. Four jobs contribute 50 outputs for sandbox PR #22. Six contribute 84 for PR #20. They cover spec review, writing tests, delivery, the gate and the review/fix loop. Each output supplies its actual step number, name and conclusion. The regression level stops at the failed gate (55 outputs in four jobs). The later PR-loop and repaired gate appear in the retrospective research wave. [Public job projections](src/game/levels/records.ts) · [Source verification](scripts/check-sources.ts)

Every choice is one asteroid. One deterministic function turns one choice record into one rock; the same wave, appearance and record always draw the same rock. [Object generator](src/game/gen.ts) · [Choice projection](src/game/levels/lifecycle.ts)

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

The scan splits every rock into a cross-section and enlarges it by 35%; the rocks slow down while open. Calm mode opens them without motion. The written readout of the clues is for screen readers only; on screen the cores carry it. After the game each decision lists the rocks with the same drawing and their source links.

### Choice limits and uniqueness

**A wave offers at least 4 and at most 7 choices** (steps 1 to 5: 4, 5, 6, 6, 7). Four is the real report: four criteria, one shared test. Seven is the most rocks a phone field keeps readable. Each wave's choices draw distinct own step outputs, and every timeline has at least 50 outputs, so seven choices never need to repeat one.

**No two choices in a wave are the same.** A unit test checks every fixed wave and every adaptive pool wave: the full records (clue, own step output, sources, stages) differ, and so do the closed rocks. In the revision and output levels the stored model input still repeats a token, for example `26dd775` on every rock but one. The rocks differ by their own step output. Making the model input itself unique needs a new d1.1 run (`npm run ai` with `LIQUID_AI_KEY`); without it the build rejects the level.

**No choice shows whether it is right before the shot.** The answer key is not an input to the generator: the test swaps the answers and gets identical rocks. The readable clue appears only in the split core, and the outcome mark appears only after the shot.

The build checks all 124 model requests against the original d1.1 input and validates the choice and probability keys for each wave. The frozen run's second pass differed on 10 choices, with a maximum probability difference of `0.524`. A replay uses the stored first pass. The visual edition has a separate identifier, so a player can identify which objects and rules produced a saved result. [Model recording](src/game/eval/ai-run.json) · [Version checks](src/game/eval/version.ts)

## More levels the data could support

| Distinct puzzle | Public observations available | What can be judged |
|---|---|---|
| Red at which stage? | In the same sandbox task, initial test writing yielded 13 passing and 3 failing tests. A later regression yielded 3 passing and 13 failing tests. After repair all 16 passed. | The relation between the stage and a test failure. A red lamp on its own would give a misleading answer. [Test-writing gate](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44287245490) · [Regression](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206) · [Repair](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288595622) |
| Which piece of evidence is missing? | In Focus run `44611003055`, reported and tested revisions agree at `0fb019f`. AC4 is `missing`, while the four other criteria are `failed`. | A missing observation and an observed failure need different symbols. [Gate run](https://github.com/serio-ngo/serio-focus/actions/runs/44611003055) |
| Which connection needs approval? | The public archive has four cases where the tests pass and the lock fails. One sandbox gate records 7 passing tests and 0 failures. | Re-lock approval and code repair call for different actions. [Sandbox gate](https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/43505151629) |
| Can both observations be true? | Focus reported 4/4 while review still recorded a P1 finding. | The acceptance report and the independent review answer different questions. The pair is useful for open exploration until the particular scoring relation has a source. [Report](https://github.com/serio-ngo/serio-focus/pull/101#issuecomment-7006607108) · [Finding](https://github.com/serio-ngo/serio-focus/pull/101#discussion_r4640224214) |

## Where the earlier builds departed from the vision

The comparison point is game commit `5d57a4e`. The earliest design, the later arcade design and the owner's rejection record different decisions. Attribution below refers to those written versions. [First concept](https://github.com/serio-ngo/ops/blob/6ebbd72/lifecycle/game/VISION.md) · [Arcade revision](https://github.com/serio-ngo/ops/blob/4c4b36b/lifecycle/game/VISION.md) · [Redesign acceptance](https://github.com/serio-ngo/ops/blob/d165e3d/lifecycle/game/PLAN.md) · [Game diff](https://github.com/serio-ngo/find-the-gap/pull/2)

| Original assumption | What happened by `5d57a4e` |
|---|---|
| Every target should lead a presenter to the specific observation that produced it. | There was one evidence ID per wave. The mixed research wave pointed to the report even for checkout and regression. The end screen lost the evidence links and the lecture test disappeared. |
| A whole object should be distinct, even when one part represents a shared value. Evidence order and process phase have meaning. | The majority token selected a common hull. Equal tokens reused one sprite. Different criterion ships could differ chiefly by scale. The renderer received short strings and had no ordered stage outputs. |
| Players should be able to infer a rule by comparing evidence, without a giveaway from colour, contrast, position, name or anonymisation. | Scored answers acquired a special tint, outline and crack. The HTML button named the answer `bad datum` or `zła dana`. The share art also highlighted a made-up pair. On other waves, some real clue differences were too small to read. |
| The reveal should be an action on the field, with an accessible equivalent. | The first arcade sketch opened an asteroid shell and exposed its symbol. A three-frame visual guide existed in the first implementation. The later branch removed the guide and provided no deliberate inspection of an individual output. |
| One shot is one decision. The AI is an independent opponent, and both players can score on different valid choices. | Auto-aim, keyboard targets and independent stored AI picks survived. The duel line, two outcome strips, each side's pick, confidence and source were removed in favour of aggregate agreement, surprise and a local top five. Agreement alone hides the two valid answers on the lecture wave. |
| The adaptive game should announce a rule switch without naming the new rule. A player should be able to see the path afterwards. | The step policy and finite offline pool survived. The 🔀 cue and the step-history display were removed. Fixed routes use steps 1–3. The adaptive policy can reach steps 4–5. |
| A fair comparison freezes what the player and the model could know. | The saved model was evaluated on symbolic observations. Its prompt names the rule. Standard requests can include prior answer indices, including waves with neutral player feedback. Adaptive pool requests have empty history. This limits any claim about equal information or human-versus-model visual perception. |
| Atypicality should describe a decision in this game, with a denominator and a reference population. | The earlier design proposed comparison with at least 50 contributions for the same version. The standalone implementation compares a pick to d1.1's probability. It has no population sample. The tempo/accuracy and switch-recovery readouts and the contextual explanation were also removed. |
| History, unlocked levels and results should remain available locally, with export and deletion. | Export and deletion existed. The save retained play count, best/top five and the last run's mode and pick indices per deck/level. The original save lacked the edition, past sessions and an unlock history. |
| A shared result should let others play the same level while preserving the reveal. | The branch kept links, platform sharing and per-level files. It replaced the two emoji decision strips with aggregate numbers. The original preview drew unrelated coloured blocks with the supposed answer outlined. |

### Decisions that changed in the written design

The first version used four numbered evidence paths, `none` / `skip`, three announced rule blocks of four rounds, a free example, three lives, 100 points per success and 25 per third consecutive success, up to 1,300. It proposed a tied top ten, one ranked start per edition, a separate training deck and scoring independent of speed. Later plans chose the arcade field, four relations, 10 waves plus research, auto-aim and offline phase one. The local redesign scores two designated waves with a speed bonus and keeps a top five. Valid exceptions, all-clear boards and abstention were meaningful in the first concept. Choosing an object in an open research wave does not exercise those skills. [Earliest rules](https://github.com/serio-ngo/ops/blob/6ebbd72/lifecycle/game/VISION.md) · [Research-profile revision](https://github.com/serio-ngo/ops/blob/b2869cf/lifecycle/game/VISION.md) · [Current vision](https://github.com/serio-ngo/ops/blob/d165e3d/lifecycle/game/VISION.md)

The arcade revision also described shots changing what emerges next, a hint as a board event, a per-dataset end condition, alternate formations or Memory, and an editable replay in Serio ASCII. The standalone game provides a second fixture deck and an adaptive rule path. The two source cases are authored projections. Automated AI case selection, new user-facing game modes and an ASCII replay were proposals or separate work. [Arcade design](https://github.com/serio-ngo/ops/blob/4c4b36b/lifecycle/game/VISION.md) · [Data workflow](https://github.com/serio-ngo/ops/blob/d165e3d/lifecycle/game/WORKFLOW.md)

### Evidence still owed outside this local build

The research plan called for neurodivergent co-design, accessible presentation variants, separate counts for voluntary replay and presenter-led play, and independent verification of player-nominated cases. It proposed a first-contact trial with 12 new players and targets of 9 unaided starts, 8 finishes and 4 voluntary replays. The larger study required grouped, held-out cases, a table and simple-rule comparison, independent adjudication and model baselines including Haiku. The proposed targets were a 10 percentage-point gain in precision in the top fifth of the audit queue and a 20% faster review than the table with at most 5 percentage points lost in accuracy. The repository supplies no participant results, calibration study, physical mid-range phone benchmark or measured gain in audit precision. [Pilot criteria](https://github.com/serio-ngo/ops/blob/6ebbd72/lifecycle/game/PLAN.md) · [Research and value](https://github.com/serio-ngo/ops/blob/d165e3d/lifecycle/game/ANALYSIS.md)

The published phase boundary puts the site embed, online game master, cache/rate limit, optional anonymous research submission, population statistics and policy experiment in phase two. The written target includes a local fallback after 1,500 ms, one opt-in submission per game, no persistent player identifier, suppression of small published groups, and links to the research programmes. A browser playthrough can establish offline behaviour. It cannot establish public deployment, consented contributions or a clinical interpretation of a player's decisions. [Phase boundary](https://github.com/serio-ngo/ops/blob/d165e3d/lifecycle/game/TECH.md) · [Site integration](https://github.com/serio-ngo/audioblog/issues/133)
