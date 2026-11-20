# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables below.

### Host checklist

For serio.org.pl (serio-ngo/audioblog#133). Copy `src/game/` and the two pages from a merged commit, and record it. Then add these host lines.

- `src/worker/index.ts`: `import { route as game } from '../game/worker/route';`, and next to the `/api/a11y` line `if (pathname === '/api/game/step' || pathname === '/api/game/result') return game(req, env, ctx);`.
- `tsconfig.worker.json`: add `"allowImportingTsExtensions": true` to `compilerOptions`; the game imports with `.ts` extensions.
- `wrangler.jsonc`: add `{ "name": "RL_GAME", "namespace_id": "<id>", "simple": { "limit": 30, "period": 60 } }` to `ratelimits` and to `previews.ratelimits`. One adaptive game makes about 11 requests. `/api/*` already runs the Worker first.
- The route uses the existing `ASK_DB` and the `LIQUID_AI_KEY` secret.
- Copy `worker/schema.sql` to `migrations/0002_game.sql`.
- Build with `PUBLIC_GAME_API=/api/game`. Unset, the game makes no request.
- Add `find-the-gap` to `content.reserved` in `scripts/site-tools.mjs`; it covers both languages.
- Owner: add the PRD route row and extend the client-JS exception (`.prd/PRD.md`, Stack rule) to the two game pages.
- CSP stays unchanged: the POSTs are same-origin.
- This repository builds on Astro 7.4.1 and Node >=22.22.0. Astro 7.4.1 refuses older Node, so audioblog's `engines` `>=22.18.0` overstates its floor. Run the game tests on the host version.
- Before launch, check what the invocation logs (`observability.logs.invocation_logs: true`) keep for `/api/game/*`.
- Each level page sets `og:image` to `levels/preview-<level>.png`; copy those files with the folder.

### Brand variables

Each has a local fallback in `game.css`. The brand package defines all of them.

`--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--ink-1`, `--ink-2`, `--ink-3`, `--ink-3-on-dark`, `--paper-0`, `--paper-2`, `--paper-3`, `--brick`, `--font-ui`, `--font-mono`, `--font-display`.

## Modules

- `engine.ts`: waves, anchor scoring, deviation from the AI, adaptive policy, content, AI request body.
- `levels/` holds the lifecycle and fixture decks. `records.ts` pins the ordered steps of the source jobs. Each lifecycle choice carries its own evidence and comparison operands.
- `objects.ts` binds a public observation to a reproducible asteroid for a particular wave and appearance. `gen.ts` draws the rock shell, the crystal druse of its own job, the docked stage craft, the stage bands and the clue core.
- `render.ts` handles cached canvas sprites, the scan that splits rocks, motion, collisions and shots: a shot cracks its rock, a scored miss also splits and rings the right rocks, and an unscored burst overlaps the next wave. Answer indices enter the field only when a shot resolves.
- `input.ts`: keyboard, pointer, aim, focus and pause handling.
- `stats.ts` stores edition-specific results, the latest decision path and the local top five.
- `share.ts`: result text (score, AI agreement, atypicality) and share links.
- `strings.json` holds the Polish and English controls, object names and accessible labels.
- `net.ts`: route calls; off unless `PUBLIC_GAME_API` is set.
- `worker/route.ts` and `worker/schema.sql`: the host Worker route and its D1 tables.
- `game.css`: styles.
- `eval/version.ts` verifies the exact recorded model inputs and computes the playable edition identifier.
- `eval/run-ai.ts`: offline AI run.
