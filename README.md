# Find the Gap

A pattern game built from public software delivery evidence. Every rock is one public gate run; one rock per wave breaks its rule.

## Play

Three levels of 20 scored waves: odd revision, missing link, pair. Scan the rocks, compare their cores, pick the broken one by mouse, touch or keyboard. Adaptive mode asks the AI live and changes the rule as you play. The last wave of each level has no right answer.

## Run

The game is a module in `src/game/`; the host site serves its pages and Worker route.

```
npm ci
npm test
npm run typecheck
```

With the host running locally (`npm run dev` there, port 4321):

```
npm run e2e
npm run ai
```

## License

Apache-2.0
