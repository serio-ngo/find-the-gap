# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables: `--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--border-default`, `--font-ui`.

## Modules

- `engine.ts`: waves, anchor scoring, deviation from the AI, adaptive policy, content, AI request body.
- `levels/` holds the lifecycle and fixture decks. `records.ts` pins the ordered steps of the source jobs. Each lifecycle choice carries its own evidence and comparison operands.
- `objects.ts` binds a public observation to a reproducible hull for a particular wave and appearance. `gen.ts` draws the outer equipment, internal workflow assemblies and comparison marks.
- `render.ts` handles cached canvas sprites, the scan, motion, collisions and shots. Answer indices enter the field when a shot resolves.
- `input.ts`: keyboard, pointer, aim, focus and pause handling.
- `stats.ts` stores edition-specific results, the latest decision path and the local top five.
- `share.ts`: result text (score, AI agreement, atypicality) and share links.
- `strings.json` holds the Polish and English controls, object names and accessible labels.
- `game.css`: styles.
- `eval/version.ts` verifies the exact recorded model inputs and computes the playable edition identifier.
- `eval/run-ai.ts`: offline AI run.
