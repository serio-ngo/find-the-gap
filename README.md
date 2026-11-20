# Find the Gap

A pattern game built from real software delivery evidence.

- Phase 1: offline, standalone game (this repo).
- Phase 2: site integration, tracked in serio-ngo/audioblog#133.
- Design docs (private).

## Status: failed, not for merge

Phase 1 runs offline and its checks pass, with the first review's findings fixed, but the owner rejected the design on 20 November 2026.
Open before a new attempt (design: serio-ngo/ops#86):
- Shootable objects (asteroids, alien ships or similar) from a deterministic algorithm that balances looks against how closely they map to the source data.
- UI with almost no text.
- Minimal end-screen stats, as in the vision.

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
