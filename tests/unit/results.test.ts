import { expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { edition, summarize, wilson } from '../../scripts/results.ts'

it('reads only results of the current deck edition and splits human and AI hits by rule, pattern and gap case', () => {
  const d = decks.observations!
  const spec = d.levels[0]!.sequence[0]!
  const w = wave(d, spec)
  const right = w.answers[0]!
  const row = (pick: number, ai: number, first: number) => [0, spec.step, spec.seed, pick, +(pick === right), 1, ai, 0, 0, 0, first]
  const waves = JSON.stringify([row(right, right, 1), row((right + 1) % w.symbols.length, -1, 1)])
  const out = summarize([
    { version: edition(d), level: 1, mode: 0, waves },
    { version: 'observations:000000000000', level: 1, mode: 0, waves },
  ])
  expect(out).toMatchObject({ edition: edition(d), games: 1, otherEditions: 1 })
  expect(out.rules.odd_revision).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.patterns['odd_revision typical']).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.hardest).toEqual([{ id: w.ids![right], arity: 2, breaks: 1, pattern: 'differ', typicality: 1, shown: 2, human: 0.5, ai: 1 }])
  expect(out.peers).toEqual([{ wave: `1:odd_revision:${spec.step}:${spec.seed}`, n: 2, enough: false }])
})

it('gives a 95% Wilson interval', () => {
  const [lo, hi] = wilson(6, 100)
  expect(lo).toBeCloseTo(0.0278, 3)
  expect(hi).toBeCloseTo(0.1247, 3)
})
