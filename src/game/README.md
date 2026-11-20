# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables: `--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--border-default`, `--font-ui`.

### Host checklist

For serio.org.pl (serio-ngo/audioblog#133).


- Copy the folder from a merged commit of this repository, not from a branch, and record that commit.
- This repository builds and tests on Astro 7.4.13 and Node 22.23.4. A host on an older version (audioblog: Astro 7.3.2, Node 22.18) runs the game's tests on its own version first.
- The page script is same-origin and makes no network request in phase 1, so a CSP with `script-src 'self'` and `connect-src 'self'` covers it.
- The host's product rules must allow this client JS on the two game pages and in an article block; record that exception first.
- Reserve the `find-the-gap` slug in both languages so no article can take it.
- Each level page sets `og:image` to `levels/preview-<level>.png`; copy those files with the folder.
- Phase 2 adds the game routes on the host Worker ([Runtime](../../docs/RUNTIME.md#phase-2-the-site)); the game still plays when they are absent.

## Modules

- `engine.ts`: waves, anchor scoring, deviation from the AI, adaptive policy, content, AI request body.
- `levels/` holds the lifecycle and fixture decks. `records.ts` pins the ordered steps of the source jobs. Each lifecycle choice carries its own evidence and comparison operands.
- `objects.ts` binds a public observation to a reproducible asteroid for a particular wave and appearance. `gen.ts` draws the rock shell, the crystal druse of its own job, the docked stage craft, the stage bands and the clue core.
- `render.ts` handles cached canvas sprites, the scan that splits rocks, motion, collisions and shots: a shot cracks its rock, a scored miss also splits and rings the right rocks, and an unscored burst overlaps the next wave. Answer indices enter the field only when a shot resolves.
- `input.ts`: keyboard, pointer, aim, focus and pause handling.
- `stats.ts` stores edition-specific results, the latest decision path and the local top five.
- `share.ts`: result text (score, AI agreement, atypicality) and share links.
- `strings.json` holds the Polish and English controls, object names and accessible labels.
- `game.css`: styles.
- `eval/version.ts` verifies the exact recorded model inputs and computes the playable edition identifier.
- `eval/run-ai.ts`: offline AI run.
