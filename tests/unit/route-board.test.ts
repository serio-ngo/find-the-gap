import { describe, expect, it } from 'vitest'
import { world } from '../../src/game/levels/world.ts'
import { CERTAIN, ED, ENC, RECEIPT, fakeEnv, gapSlot, send, visitRow, visits } from './route-env.ts'

const others = ENC.filter((r) => !r.certain)
const miss = (r: (typeof ENC)[number]) => (gapSlot(r) + 1) % r.monsters.length
const game = (hit: boolean, ms: number, name: unknown = 'Ada', receipt = RECEIPT) => ({
  v: 0, level: 1, edition: ED, name, receipt,
  visits: [...CERTAIN.map((r, i) => visitRow(r, i, hit || i ? gapSlot(r) : miss(r), i === 0 ? ms : 1000)), ...others.slice(0, world.key - 4).map((r, i) => visitRow(r, i + 4, 0))],
})
const speed = (ms: number) => Math.max(0, Math.round(100 - ms / 100))

describe('leaderboard', () => {
  it('scores the stored rows itself, stores the name with the day only, and stores the research result once per receipt', async () => {
    const { env, board, results } = fakeEnv()
    const rest = 3 * (100 + speed(1000))
    const res = await send('/api/game/board', game(true, 2500), env)
    expect(res.status).toBe(200)
    const score = rest + 100 + speed(2500)
    expect(await res.json()).toEqual({ top: [['Ada', score]], n: 1, below: 0, score })
    expect(board).toEqual([{ version: ED, level: 1, mode: 0, name: 'Ada', score }])
    expect(results).toHaveLength(1)
    await send('/api/game/board', game(false, 2500, ' Bo '), env)
    expect(results).toHaveLength(1)
    const third = await (await send('/api/game/board', game(true, 9000, 'Cy', RECEIPT + 1), env)).json()
    expect(results).toHaveLength(2)
    expect(third).toEqual({ top: [['Ada', score], ['Cy', rest + 100 + speed(9000)], ['Bo', rest]], n: 3, below: 1, score: rest + 100 + speed(9000) })
  })

  it('needs an accusation in all four certain rooms and at least the key count of accusations', async () => {
    const { env, board } = fakeEnv()
    const all = game(true, 2500).visits
    const post = (v: number[][]) => send('/api/game/board', { ...game(true, 2500), visits: v }, env)
    expect(world.key).toBeGreaterThan(CERTAIN.length)
    expect((await post(visits(CERTAIN))).status).toBe(400)
    expect((await post(all.slice(1).map((a, i) => [a[0]!, i, ...a.slice(2)]))).status).toBe(400)
    expect((await post(all.map((a, i) => (i === 0 ? a.map((x, k) => (k === 2 ? -1 : x)) : a)))).status).toBe(400)
    expect((await post(all.slice(0, -1))).status).toBe(400)
    expect((await post(all)).status).toBe(200)
    expect(board).toHaveLength(1)
  })

  it('stops at the daily result cap before storing anything', async () => {
    const { env, board, results, use } = fakeEnv()
    use.result = 5000
    expect((await send('/api/game/board', game(true, 2500), env)).status).toBe(429)
    expect(board).toEqual([])
    expect(results).toEqual([])
  })

  it('rejects a bad name and another edition without storing', async () => {
    const { env, board } = fakeEnv()
    for (const body of [game(true, 2500, ''), game(true, 2500, 'x'.repeat(21)), game(true, 2500, '<b>'), game(true, 2500, 7), { ...game(true, 2500), edition: 'world:000000000000' }]) {
      expect((await send('/api/game/board', body, env)).status).toBe(400)
    }
    expect((await send('/api/game/board', { ...game(true, 2500), receipt: 2 }, env)).status).toBe(400)
    expect(board).toEqual([])
  })
})
