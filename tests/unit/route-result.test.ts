import { describe, expect, it } from 'vitest'
import { BINDINGS } from '../../src/game/levels/observations.ts'
import { CERTAIN, ED, ENC, fakeEnv, gapSlot, resultBody, send, readCodes, visitRow, visits } from './route-env.ts'

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
    expect((await send('/api/game/result', resultBody([visitRow(r, 0, (gapSlot(r) + 1) % r.monsters.length)]), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody([visitRow(r, 0, -1)]), env)).status).toBe(204)
    expect((await send('/api/game/result', resultBody([]), env)).status).toBe(204)
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

  it('204 without inserting past the daily result cap', async () => {
    const { env, results, use } = fakeEnv()
    use.result = 5000
    expect((await send('/api/game/result', resultBody([one]), env)).status).toBe(204)
    expect(results).toHaveLength(0)
  })
})
