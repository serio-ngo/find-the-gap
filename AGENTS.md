# AGENTS.md

Rules for every contributor and coding agent. This repository is public and open source.

- Requirements: `VISION.md`, the owner's words. Never edit or reword it. No other documents.
- Public only: the game and public evidence. No secret, personal data, private repository, issue, archive, host config or internal process.
- Read the code a change touches first. The smallest complete diff wins: change a value or a branch before adding a function, a function before a file. Never drop a feature, check or test to cut lines.
- Every rock's evidence comes from its record values only; the answer never steers how a rock is drawn.
- A change that alters play keeps one test through a public entry point (`npm test`, `npm run typecheck`); prove a visual change with real output, not a mock.
- Code, names and messages in English; product copy stays in its own language (`strings.json`). No comments in code beyond a one-line why.
- Work on a branch and open a pull request into `main`; a person reviews and merges. Answer every review finding before asking for a merge.
- Workflow: [serio-focus](https://github.com/serio-ngo/serio-focus).
