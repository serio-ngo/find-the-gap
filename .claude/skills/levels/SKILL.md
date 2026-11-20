---
name: levels
description: Use when adding or changing a Find the Gap level, deck, wave or the stored AI run.
---

# Levels

1. Evidence is public only: a pinned GitHub URL and the exact quoted line, in `src/game/levels/`.
2. One choice is one record and one rock (`objects.ts`, `gen.ts`). The answer is never an input to drawing.
3. A wave has 4 to 7 choices; no two choices in a wave share a record or a model input.
4. `GH_TOKEN=... npm run check-sources` verifies every quote against GitHub.
5. Any change to a model input needs a new `npm run ai`; `npm run build` fails while `src/game/eval/ai-run.json` is stale.
6. `npm run previews` redraws `src/game/levels/preview-*.png` after a visual change.
