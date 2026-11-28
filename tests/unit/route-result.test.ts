import { describe, expect, it } from 'vitest'
import { BINDINGS } from '../../src/game/levels/observations.ts'
import { CERTAIN, ED, ENC, RECEIPT, fakeEnv, gapSlot, resultBody, send, readCodes, visitRow, visits } from './route-env.ts'

const one = visitRow(CERTAIN[0]!, 0)
const bent = (i: number, x: number) => one.map((c, k) => (k === i ? x : c))

describe('result', () => {
  it('stores the validated rows under the exact edition with the day only, and rejects every bent field', async () => {
    const { env, results } = fakeEnv()
    const ok = await send('/api/game/result', resultBody([one]), env)
    expect(ok.status).toBe(204)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveLength(5)
    const [day, version, level, mode, waves] = results[0]!
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([version, level, mode]).toEqual([ED, 1, 0])
    expect(JSON.parse(waves as string)).toEqual([one])
    const bad = async (v: number[]) => expect((await send('/api/game/result', resultBody([v]), env)).status).toBe(400)
    await bad(one.slice(0, 22))
    await bad([...one, 0])
    await bad(bent(0, 99_999))
    await bad(bent(1, 1))
    await bad(bent(2, 9))
    await bad(bent(3, 600_001))
    await bad(bent(4, 100))
    await bad(bent(5, 2))
    await bad(bent(6, 99))
    await bad(bent(7, 9))
    await bad(bent(8, one[7]!))
    await bad(bent(19, 600_001))
    const small = ENC.find((r) => r.monsters.length < 4)!
    await bad(visitRow(small, 0).map((x, i) => (i === 19 + small.monsters.length ? 812 : x)))
    const carried = readCodes(CERTAIN[0]!)
    const k = Array.from({ length: BINDINGS.length }, (_, b) => b).find((b) => !carried.includes(b))
    if (k !== undefined) await bad(bent(7, k))
    await bad(bent(7, CERTAIN[0]!.monsters.length * BINDINGS.length))
    await bad(one.map((x, i) => (i === 7 ? -1 : i === 8 ? 0 : x)))
    expect(results).toHaveLength(1)
  })

  it('accepts a wrong pick, no pick and a partial run', async () => {
    const { env, results } = fakeEnv()
    const r = CERTAIN[0]!
    expect((await send('/api/game/result', resultBody([visitRow(r, 0, (gapSlot(r) + 1) % r.monsters.length)], ED, 2 ** 32), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody([visitRow(r, 0, -1)], ED, 2 ** 33), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody([], ED, 2 ** 34), env)).status).toBe(204)
    expect(results).toHaveLength(3)
  })

  it('rejects a repeated room, a wrong route, too many rows and a room without monsters', async () => {
    const { env } = fakeEnv()
    const a = visitRow(CERTAIN[0]!, 0)
    expect((await send('/api/game/result', resultBody([a, visitRow(CERTAIN[0]!, 1)]), env)).status).toBe(400)
    expect((await send('/api/game/result', resultBody([a, visitRow(CERTAIN[1]!, 0)]), env)).status).toBe(400)
    expect((await send('/api/game/result', resultBody([...visits(), a]), env)).status).toBe(400)
    expect((await send('/api/game/result', resultBody([bent(0, 0)]), env)).status).toBe(400)
    expect((await send('/api/game/result', resultBody(visits(ENC)), env)).status).toBe(204)
  })

  it('stores a result of the current edition and rejects a missing or another edition without storing', async () => {
    const { env, results } = fakeEnv()
    expect((await send('/api/game/result', resultBody([one]), env)).status).toBe(204)
    expect(results.map((r) => r[1])).toEqual([ED])
    const { edition: _, ...bare } = resultBody([one])
    expect((await send('/api/game/result', bare, env)).status).toBe(400)
    expect((await send('/api/game/result', resultBody([one], 'world:000000000000'), env)).status).toBe(400)
    expect((await send('/api/game/result', { ...resultBody([one]), v: 1 }, env)).status).toBe(400)
    expect((await send('/api/game/result', { ...resultBody([one]), mode: 0 }, env)).status).toBe(400)
    expect(results).toHaveLength(1)
  })

  it('a partial send, then the full play with the same receipt, stores one row with all picks', async () => {
    const { env, results } = fakeEnv()
    const full = visits(CERTAIN)
    expect((await send('/api/game/result', resultBody(full.slice(0, 1)), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody(full), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody(full.slice(0, 2)), env)).status).toBe(204)
    const late = full.map((a, i) => (i === full.length - 1 ? [...a.slice(0, 2), -1, ...a.slice(3)] : a))
    expect((await send('/api/game/result', resultBody(late), env)).status).toBe(204)
    expect(results).toHaveLength(1)
    expect(JSON.parse(results[0]![4] as string)).toEqual(full)
  })

  it('counts a play once against the daily cap, so resends of a stored play pass the cap', async () => {
    const { env, results, use } = fakeEnv()
    expect((await send('/api/game/result', resultBody([one]), env)).status).toBe(204)
    use.result = 5000
    expect((await send('/api/game/result', resultBody(visits(CERTAIN)), env)).status).toBe(204)
    expect(use.result).toBe(5000)
    expect(JSON.parse(results[0]![4] as string)).toHaveLength(CERTAIN.length)
  })

  it('answers 429 without storing past the daily cap or the rate limit, and a retry stores the play', async () => {
    const { env, results, use } = fakeEnv()
    use.result = 5000
    expect((await send('/api/game/result', resultBody([one]), env)).status).toBe(429)
    const limited = fakeEnv({ LIMIT: { limit: async () => ({ success: false }) } })
    expect((await send('/api/game/result', resultBody([one]), limited.env)).status).toBe(429)
    expect([...results, ...limited.results]).toHaveLength(0)
    use.result = 0
    expect((await send('/api/game/result', resultBody([one]), env)).status).toBe(204)
    expect(results).toHaveLength(1)
  })

  it('rejects a missing, small or fractional receipt', async () => {
    const { env, results } = fakeEnv()
    const { receipt: _, ...bare } = resultBody([one])
    for (const body of [bare, resultBody([one], ED, 5), resultBody([one], ED, 2 ** 40 + 0.5)]) expect((await send('/api/game/result', body, env)).status).toBe(400)
    expect(results).toHaveLength(0)
    expect(RECEIPT).toBeGreaterThan(2 ** 32)
  })
})
