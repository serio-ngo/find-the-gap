# Find the Gap

A pattern game built from real software delivery evidence.

- Phase 1: offline, standalone game (this repo).
- Phase 2: site integration, tracked in serio-ngo/audioblog#133.
- Design docs (private).

## Play

Open `/find-the-gap/1` in Polish or `/en/find-the-gap/1` in English. Inspect a formation to compare the marks on its targets, then select one by mouse, touch or keyboard. A shot records one choice. Two waves per level award points. The final research wave accepts any pick.

The four levels draw from public workflow evidence. Every choice is an asteroid drawn from its own record: crystals for the step outputs of its job, craters and inner bands for the stages, and a core with the clue that the scan splits open. Replaying the same presentation recreates it. After the game, the decision history shows the selected evidence and the stored d1.1 comparison. [Level data, visual design and history](LEVELS.md)

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
