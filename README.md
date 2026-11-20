# Find the Gap

A pattern game built from real software delivery evidence.

- Phase 1: offline, standalone game (this repo).
- Phase 2: site integration, tracked in serio-ngo/audioblog#133.
- Design docs (private).

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
