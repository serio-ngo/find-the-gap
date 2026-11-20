# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables: `--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--border-default`, `--font-ui`.

## Modules

- `engine.ts`: waves, scoring, adaptive policy, content, AI request body.
- `levels/`: lifecycle and fixture decks.
- `render.ts`: canvas drawing and rock drift.
- `input.ts`: keyboard, pointer and pause handling.
- `stats.ts`: saves in localStorage.
- `share.ts`: result text and share links.
- `strings.json`: Polish and English text and labels.
- `game.css`: styles.
- `eval/version.ts`: content hash and stale-run check.
- `eval/run-ai.ts`: offline AI run.
