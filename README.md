# Find the Gap

A pattern game built from real software delivery evidence.

- Phase 1: offline, standalone game (this repo).
- Phase 2: site integration, tracked in serio-ngo/audioblog#133.
- Docs: [Design](docs/DESIGN.md) · [Levels](docs/LEVELS.md) · [Runtime](docs/RUNTIME.md) · [Data and loops](docs/DATA.md) · [Research](docs/RESEARCH.md)

## Play

Open `/find-the-gap/1` in Polish or `/en/find-the-gap/1` in English. Scan the field to split every rock and compare the cores, then select one by mouse, touch or keyboard. A shot records one choice and cracks that rock. Two waves per level award points; on the others the next wave flies in while the rock bursts. Adaptive mode shows a shuffle icon after a rule switch. The final research wave accepts any pick.

The four levels draw from public workflow evidence. Every choice is an asteroid drawn from its own record: crystals for the step outputs of its job, craters and inner bands for the stages, and a core with the clue that the scan splits open. Replaying the same presentation recreates it. After the game, the decision history shows the selected evidence and the stored d1.1 comparison. [How a record becomes a level](docs/LEVELS.md)

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
