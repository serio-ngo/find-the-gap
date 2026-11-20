# Find the Gap

A pattern game built from real software delivery evidence.

- Phase 1: offline, standalone game (this repo).
- Phase 2: site integration, tracked in serio-ngo/audioblog#133.
- Design docs (private).

## Status: redesign

The owner rejected the first design on 20 November 2026. This build follows the redesign:
- Targets come from a deterministic generator; the data shapes them only subtly, except in rare anchor waves, where the bad datum is plain.
- Only anchor waves score. The end screen shows the score, agreement with the AI, atypicality and a local top 5.
- No explanatory text; icons carry the UI.
- The wave content is unchanged, so the committed AI run stays valid. A global leaderboard needs a backend (phase 2).

## Run

```
npm ci
npm run dev
npm test
npm run build
npx playwright test
```

## Offline AI run

`npm run ai` needs `LIQUID_AI_KEY` and writes `src/game/eval/ai-run.json`.
The build fails when that run is stale.

## Source check

`GH_TOKEN=... npm run check-sources` verifies the evidence lines against GitHub.

## License

Apache-2.0
