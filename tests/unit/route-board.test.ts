import { describe, expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { edition } from '../../src/game/eval/version.ts'
import { FIXTURE, fakeEnv, send } from './route-env.ts'

const d = decks.fixture!
const ed = await edition(d)
const seq = d.levels[0]!.sequence

describe('leaderboard', () => {
  const row = (i: number, hit: boolean, ms: number) => {
    const w = wave(d, seq[i]!)
    const pick = hit ? w.answers[0]! : (w.answers[0]! + 1) % w.symbols.length
    return [d.rules.findIndex((r) => r.id === seq[i]!.rule), seq[i]!.step, seq[i]!.seed, pick, +hit, 1, -1, 0, 0, 0, 1, ms, 0, +(i === 1), ...Array(w.symbols.length).fill(100)]
  }
  const game = (hit: boolean, ms: number, name: unknown = 'Ada', sent = 0) => ({ v: FIXTURE, level: 1, mode: 0, waves: [row(0, true, 900), row(1, hit, ms)], edition: ed, name, sent })

  it('scores the stored waves itself, stores the name with the day only, and also stores the research result once', async () => {
    const { env, board, results } = fakeEnv()
    const res = await send('/api/game/board', game(true, 2500), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ top: [['Ada', 175]], n: 1, below: 0, score: 175 })
    expect(board).toEqual([{ version: ed, level: 1, name: 'Ada', score: 175 }])
    expect(results).toHaveLength(1)
    await send('/api/game/board', game(false, 2500, ' Bo ', 1), env)
    expect(results).toHaveLength(1)
    const third = await (await send('/api/game/board', game(true, 9000, 'Cy', 1), env)).json()
    expect(third).toEqual({ top: [['Ada', 175], ['Cy', 110], ['Bo', 0]], n: 3, below: 1, score: 110 })
  })

  it('rejects a lying hit, a bad name and another edition without storing', async () => {
    const { env, board } = fakeEnv()
    const lie = game(true, 2500)
    lie.waves[1]![4] = 0
    for (const body of [lie, game(true, 2500, ''), game(true, 2500, 'x'.repeat(21)), game(true, 2500, '<b>'), game(true, 2500, 7), { ...game(true, 2500), edition: 'fixture:000000000000' }]) {
      expect((await send('/api/game/board', body, env)).status).toBe(400)
    }
    expect((await send('/api/game/board', { ...game(true, 2500), sent: 2 }, env)).status).toBe(400)
    expect(board).toEqual([])
  })
})
