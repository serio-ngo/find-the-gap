# Game module

Self-contained: it imports nothing from outside this folder.

## Embed

1. Copy this folder.
2. Render `<Game level lang api />` on the host's level pages; `api` is the route path, for example `/api/game`.
3. Provide the brand CSS variables below; each has a local fallback in `game.css`.

`--surface-page`, `--surface-card`, `--text-strong`, `--text-muted`, `--ink-1`, `--ink-2`, `--ink-3`, `--ink-3-on-dark`, `--paper-0`, `--paper-2`, `--paper-3`, `--brick`, `--font-ui`, `--font-mono`, `--font-display`.

Without `api` the game makes no request. The host Worker serves `worker/route.ts` and applies `worker/schema.sql`.
