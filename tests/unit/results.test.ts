import { expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { summarize } from '../../scripts/results.ts'
import { edition } from '../../src/game/eval/version.ts'
import { wilson } from '../../src/game/stats.ts'

it('reads only results of the current deck edition and splits human and AI hits by rule, pattern and gap case', async () => {
  const d = decks.observations!
  const spec = d.levels[0]!.sequence[0]!
  const w = wave(d, spec)
  const right = w.answers[0]!
  const row = (pick: number, ai: number, first: number, ms: number) => [0, spec.step, spec.seed, pick, +(pick === right), 1, ai, 0, 0, 0, first, ms, 1, 0, ...w.symbols.map((_, k) => (k === right ? ms / 2 : ms / 10))]
  const waves = JSON.stringify([row(right, right, 1, 1000), row((right + 1) % w.symbols.length, -1, 1, 3000)])
  const out = await summarize([
    { version: await edition(d), level: 1, mode: 0, waves },
    { version: 'observations:000000000000', level: 1, mode: 0, waves },
  ])
  expect(out).toMatchObject({ edition: await edition(d), games: 1, otherEditions: 1 })
  expect(out.rules.odd_revision).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.patterns['odd_revision typical']).toEqual({ shown: 2, human: 0.5, ai: 1 })
  expect(out.hardest).toEqual([{ id: w.ids![right], arity: 2, breaks: 1, pattern: 'differ', typicality: 1, shown: 2, human: 0.5, ai: 1 }])
  expect(out.waves).toEqual({ research: { shown: 2, human: 0.5, ai: 1 } })
  expect(out.aim).toEqual({ hit: { n: 1, ms: 1000, gap: 500, others: 100, switches: 1 }, miss: { n: 1, ms: 3000, gap: 1500, others: 300, switches: 1 } })
  expect(out.peers).toEqual([{ wave: `1:odd_revision:${spec.step}:${spec.seed}`, n: 2, enough: false }])
})

it('counts a wave as certain from the row flag', async () => {
  const d = decks.observations!
  const spec = d.levels[0]!.sequence[0]!
  const w = wave(d, spec)
  const waves = JSON.stringify([[0, spec.step, spec.seed, w.answers[0], 1, 1, -1, 0, 0, 0, 1, 1000, 0, 1, ...w.symbols.map(() => 0)]])
  expect((await summarize([{ version: await edition(d), level: 1, mode: 0, waves }])).waves).toEqual({ certain: { shown: 1, human: 1, ai: null } })
})

it('gives a 95% Wilson interval', () => {
  const [lo, hi] = wilson(6, 100)
  expect(lo).toBeCloseTo(0.0278, 3)
  expect(hi).toBeCloseTo(0.1247, 3)
})
