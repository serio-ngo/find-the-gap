import { rng } from '../engine.ts'
import type { Deck, Rule } from '../engine.ts'

const rule = (id: string, symbol: (i: number, k: number) => string): Rule => ({
  id,
  make: (step, seed) => {
    const n = step + 3
    const k = Math.floor(rng(seed)() * n)
    return { symbols: Array.from({ length: n }, (_, i) => symbol(i, k)), answers: [k] }
  },
})

export const fixture: Deck = {
  id: 'fixture',
  steps: 3,
  policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
  rules: [rule('colour', (i, k) => (i === k ? 'blue' : 'red')), rule('count', (i, k) => (i === k ? '••' : '•'))],
  poolSize: 2,
  levels: [
    {
      id: 1,
      start: { rule: 'colour', step: 1 },
      anchors: [1],
      sequence: [
        { rule: 'colour', step: 1, seed: 0 },
        { rule: 'colour', step: 2, seed: 1 },
        { rule: 'count', step: 1, seed: 2 },
        { rule: 'count', step: 2, seed: 3 },
        { rule: 'count', step: 3, seed: 4 },
      ],
    },
  ],
}
