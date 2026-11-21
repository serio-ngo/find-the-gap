---
name: levels
description: Use when adding or changing a Find the Gap level, deck, wave or the stored AI run.
---

# Levels

1. `npm run deck -- <observations.jsonl>` writes `src/game/levels/rows.ts` from public deck rows only; pair values become neutral labels (t1, t2); a row whose visible structure contradicts its gap flag is dropped.
2. One choice is one row and one rock. The rock's core shows the row's structure (`cells` in `levels/observations.ts`); the answer is never an input to drawing.
3. A wave has 4 to 7 distinct rocks; a scored wave has exactly one broken rock.
4. `GH_TOKEN=... npm run check-sources` checks that every run link is public.
5. A deck change makes `npm test` fail until `npm run ai` reruns the AI through the host's local Worker; a wave whose two model passes disagree stores `null`.
6. `npm run previews` redraws `src/game/levels/preview-*.png`.
7. Results: pipe the host's `wrangler d1 execute <database> --json --command "SELECT waves FROM game_results WHERE version = 'observations'"` into `node scripts/results.ts`; it prints human and AI hit rates per rule and the hardest gap cases.
