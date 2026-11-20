# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Add the two pages, `find-the-gap/[level].astro` and `en/find-the-gap/[level].astro`.
3. Provide the brand CSS variables below; each has a local fallback in `game.css`.

`--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--ink-1`, `--ink-2`, `--ink-3`, `--ink-3-on-dark`, `--paper-0`, `--paper-2`, `--paper-3`, `--brick`, `--font-ui`, `--font-mono`, `--font-display`.

`net.ts` makes no request unless `PUBLIC_GAME_API` is set.
