# Runtime

[Design](DESIGN.md) · [Levels](LEVELS.md) · [Data and loops](DATA.md) · [Research](RESEARCH.md)

## Phase 1: the game on its own

A small Astro project around one folder, `src/game/` ([modules and embedding](../src/game/README.md)), plus the Polish and English pages. It makes no network request during play.

- **Field:** Canvas 2D with sprites drawn once, a fixed-timestep loop and a pause when the tab is hidden. The HUD and the end screen are HTML. No game library. Limits: at most 30 kB of gzipped JS, a median of at least 55 fps on a mid-range phone.
- **Access:** every rock on the canvas has an HTML button twin with an accessible name, so a screen reader or a switch can play, and the tests drive those buttons.
- **Brand:** no dependency on a private package; `game.css` reads brand tokens as CSS variables with local fallbacks, and the host supplies the real values.
- **AI:** every AI pick comes from an offline run stored with the level version: the standard sequence, and for adaptive waves a finite seed pool per rule and step. The local estimate moves the step.

## Phase 2: the site

Everything that needs a server: the route, the cache, the rate limit, the research upload and the live d1.1 game master, on `serio.org.pl`. The game keeps playing when the route is absent. Host steps: [checklist](../src/game/README.md#host-checklist).

- **Routes:** `POST /api/game/step` and `POST /api/game/result` on the host Worker, an `RL_GAME` rate limit, two D1 tables (`game_cache`, `game_results`) and a daily counter that caps d1.1 calls.
- **Checks:** same origin, strict schema, a 2 kB body. Model input is built only from the Worker's own copy of the level; a request with text or unknown indices gets 400. Worker logs keep no state and no IP.
- **Speed:** with d1.1 slower than 1,500 ms or the network off, the next wave starts on time from the local estimate.

### d1.1, one request per adaptive wave

Liquid's decision model answers several choice questions in one request. For each it returns a `choice` and a probability for every allowed key, and it is billed by input tokens only. The game uses only these floats.

| Question | Allowed keys | Used for |
|---|---|---|
| `ai`: which rock answers the rule? | the rocks on screen | the AI's pick and confidence, revealed at the end |
| `if_hit`: after a hit now, will the player hit the next wave at this rule and step? | `hit`, `miss` | the next step after a hit |
| `if_miss`: the same after a miss | `hit`, `miss` | the next step after a miss |

- **Before the shot:** the request leaves when the wave appears and covers both outcomes, so the answer is ready when the player shoots.
- **Same view:** the model gets the rocks on screen, the last three waves with their revealed answers, the player's hits and tempo bands, and the rule and step. No question includes the current answer.
- **Indices only:** the client sends version, rule, step, wave seed, picks, hits and tempo bands. The prompt size is fixed.
- **Same state, same floats:** answers are cached in D1 under a hash of the state; floats are rounded to 0.05 before the policy.

## Policy: floats in, steps out

```text
p = probability of "hit" for the outcome that happened, rounded to 0.05
p >= 0.80                   -> step + 1                      too easy
p <  0.55                   -> step - 1                      too hard
otherwise                   -> same step                     in the band
step 5 and p >= 0.80 twice  -> next rule at step 2      🔀   mastered
step 1 and p <  0.55 twice  -> simpler rule at step 1   🔀   stuck: split
local estimate p = (hits + 1) / (waves + 2) over the last 4 waves of this rule
```

The step moves by at most one per wave, and the rule changes only after two confirming waves. The same code runs in the game, the offline eval and the analysis, so any recorded path replays exactly. The thresholds belong to the level version.

Rejected: letting d1.1 choose the next action directly. Its floats would be preferences rather than predictions checkable against real outcomes, and tuning would mean rewriting prompts instead of moving a threshold.

## Cost

- **Model:** one call per adaptive wave of about 1,000 input tokens (to be measured) at 0.042 USD per million: about 0.40 USD per 1,000 adaptive games before cache hits. Standard mode calls no model during play.
- **Worker requests:** about 11 per adaptive game and 1 per standard game. 2,500 adaptive games a day make about 27,500 requests, over a quarter of the Workers Free daily quota.
- **Standard AI result:** the `ai` question runs offline over the fixed sequence. The level stores the picks, floats, model, date and the hash of the sequence; a second run checks determinism and any difference is stored as a spread.
