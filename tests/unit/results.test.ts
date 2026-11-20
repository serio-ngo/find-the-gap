import { expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { summarize } from '../../scripts/results.ts'

it('turns stored waves into human and AI hit rates per rule and per gap case', () => {
  const d = decks.observations!
  const spec = d.levels[0]!.sequence[0]!
  const w = wave(d, spec)
  const right = w.answers[0]!
  const row = (pick: number, ai: number) => [0, spec.step, spec.seed, pick, 0, 1, ai, 0, 0, 0]
  const out = summarize([{ waves: JSON.stringify([row(right, right), row((right + 1) % w.symbols.length, -1)]) }])
  expect(out.rules.odd_revision).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.hardest).toEqual([{ id: w.ids![right], shown: 2, human: 0.5, ai: 1 }])
})
