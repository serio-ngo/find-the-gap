import { describe, expect, it } from 'vitest'
import { pool, wave } from '../../src/game/engine.ts'
import type { Spec } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { edition } from '../../src/game/eval/version.ts'
import { FIXTURE, fakeEnv, send } from './route-env.ts'

describe('result', () => {
  const row = (pick: number, hit: number) => [0, 1, 0, pick, hit, 1, 0, 12, 0, 0, 1, 2345, 3, 0, ...Array(wave(decks.fixture!, { rule: decks.fixture!.rules[0]!.id, step: 1, seed: 0 }).symbols.length).fill(812)]
  const body = (waves: number[][]) => ({ v: FIXTURE, level: 1, mode: 0, waves })

  it('stores one row under the exact deck edition with the day only, and rejects a lying hit', async () => {
    const { env, results } = fakeEnv()
    const d = decks.fixture
    const pick = wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).answers[0]!
    const ok = await send('/api/game/result', body([row(pick, 1)]), env)
    expect(ok.status).toBe(204)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveLength(5)
    const [day, version, level, mode, waves] = results[0]
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([version, level, mode]).toEqual([await edition(d), 1, 0])
    expect(JSON.parse(waves as string)).toHaveLength(1)
    expect((await send('/api/game/result', body([row(pick, 1)]), env)).status).toBe(204)
    const bent = (i: number, x: number) => row(pick, 1).map((c, k) => (k === i ? x : c))
    expect((await send('/api/game/result', body([row(pick, 1).slice(0, 14)]), env)).status).toBe(400)
    expect((await send('/api/game/result', body([[...row(pick, 1), 0]]), env)).status).toBe(400)
    expect((await send('/api/game/result', body([bent(14, 600_001)]), env)).status).toBe(400)
    expect((await send('/api/game/result', body([bent(11, 600_001)]), env)).status).toBe(400)
    expect((await send('/api/game/result', body([bent(13, 1)]), env)).status).toBe(400)
    const lie = await send('/api/game/result', body([row(pick, 0)]), env)
    expect(lie.status).toBe(400)
    expect(results).toHaveLength(2)
  })

  it('204 without inserting past the daily result cap', async () => {
    const { env, results, use } = fakeEnv()
    use.result = 5000
    const d = decks.fixture
    const pick = wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).answers[0]!
    expect((await send('/api/game/result', body([row(pick, 1)]), env)).status).toBe(204)
    expect(results).toHaveLength(0)
  })

  it('scores the unseen last wave like any other and rejects an invalid pick on it', async () => {
    const { env } = fakeEnv()
    const d = decks.observations
    const seq = d.levels[0]!.sequence
    const rows = (last: unknown, hit: number) => seq.map((s, i) => {
      const w = wave(d, s)
      const pick = w.answers[0] ?? 0
      return [d.rules.findIndex((x) => x.id === s.rule), s.step, s.seed, i === seq.length - 1 ? last : pick, i === seq.length - 1 ? hit : +w.answers.includes(pick), 1, -1, 0, 0, 0, 1, 600_000, 99, +d.levels[0]!.anchors.includes(i), ...w.symbols.map(() => 600_000)]
    })
    const tail = wave(d, seq.at(-1)!)
    const send0 = (last: unknown, hit: number) => send('/api/game/result', { v: 0, level: 1, mode: 0, waves: rows(last, hit) }, env)
    expect((await send0('x', 0)).status).toBe(400)
    expect((await send0(99, 0)).status).toBe(400)
    for (const pick of tail.symbols.keys()) {
      const hit = +tail.answers.includes(pick)
      expect((await send0(pick, 1 - hit)).status).toBe(400)
      expect((await send0(pick, hit)).status).toBe(204)
    }
  })

  it('rejects an adaptive certain wave from outside the certain pool, and a research wave from inside it or from the fixed sequence', async () => {
    const { env } = fakeEnv()
    const d = decks.observations
    const l = d.levels[0]!
    const row = (s: Spec, i: number) => {
      const w = wave(d, s)
      const pick = w.answers[0] ?? 0
      return [d.rules.findIndex((x) => x.id === s.rule), s.step, s.seed, pick, +w.answers.includes(pick), 1, -1, 0, 0, 0, 1, 1000, 0, +l.anchors.includes(i), ...w.symbols.map(() => 0)]
    }
    const research = pool(d, l.start.rule, 1)
    const certain = pool(d, l.start.rule, 1, true)
    const send1 = (specs: Spec[]) => send('/api/game/result', { v: 0, level: 1, mode: 1, waves: specs.map(row) }, env)
    expect((await send1([...research.slice(0, 4), certain[0]!])).status).toBe(204)
    expect((await send1([...research.slice(0, 4), research[4]!])).status).toBe(400)
    expect((await send1([...research.slice(0, 4), l.sequence[0]!])).status).toBe(400)
    expect((await send1([certain[0]!])).status).toBe(400)
    expect((await send1([l.sequence[4]!])).status).toBe(400)
  })
})
