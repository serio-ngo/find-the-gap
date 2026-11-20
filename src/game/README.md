# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables: `--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--border-default`, `--font-ui`.

## Modules

- `engine.ts`: waves, anchor scoring, deviation from the AI, adaptive policy, content, AI request body.
- `levels/`: lifecycle and fixture decks; `anchors` are the rare scored waves and stay out of the AI-run hash.
- `gen.ts`: deterministic target generator; structure is shared per wave, each token only nudges continuous terms.
- `render.ts`: one-canvas loop: generated sprites, motion, collisions, stars, ship, shots.
- `input.ts`: keyboard, pointer, aim, focus and pause handling.
- `stats.ts`: saves and the local top 5 in localStorage.
- `share.ts`: result text (score, AI agreement, atypicality) and share links.
- `strings.json`: Polish and English text (8 visible strings) and accessible labels.
- `game.css`: styles.
- `eval/version.ts`: content hash and stale-run check.
- `eval/run-ai.ts`: offline AI run.
