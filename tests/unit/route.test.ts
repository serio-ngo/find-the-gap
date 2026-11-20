import { afterEach, describe, expect, it, vi } from 'vitest'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

const FIXTURE = 1 // index in decks: lifecycle 0, fixture 1
const ORIGIN = 'https://example.org'

const fakeEnv = (over: Partial<GameEnv> = {}) => {
  const cache = new Map<string, { body: string; created: number }>()
  const results: unknown[][] = []
  const env: GameEnv = {
    ASK_DB: {
      prepare: (sql: string) => ({
        bind: (...v: unknown[]) => ({
          first: async () =>
            (sql.startsWith('SELECT body')
              ? cache.get(v[0] as string) ?? null
              : { n: [...cache.values()].filter((r) => r.created >= (v[0] as number)).length }) as any,
          run: async () => {
            if (sql.includes('game_cache')) cache.set(v[0] as string, { body: v[1] as string, created: v[2] as number })
            else results.push(v)
          },
        }),
      }),
    },
    RL_GAME: { limit: async () => ({ success: true }) },
    LIQUID_AI_KEY: 'k',
    ...over,
  }
  return { env, cache, results }
}

const send = async (path: string, body: unknown, env: GameEnv, headers: Record<string, string> = {}) => {
  const pending: Promise<unknown>[] = []
  const req = new Request(ORIGIN + path, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { origin: ORIGIN, 'cf-connecting-ip': '1.2.3.4', ...headers },
  })
  const res = await route(req, env, { waitUntil: (p) => void pending.push(p) })
  await Promise.all(pending)
  return res
}

const stepReq = { v: FIXTURE, level: 1, mode: 0, wave: [0, 2, 1], past: [[0, 1, 0, 0, 1]] }
const liquid = {
  answers: {
    ai: { choice: 'r1', probabilities: { r0: 0.1, r1: 0.62, r2: 0.18, r3: 0.05, r4: 0.05 } },
    if_hit: { choice: 'hit', probabilities: { hit: 0.83, miss: 0.17 } },
    if_miss: { choice: 'miss', probabilities: { hit: 0.41, miss: 0.59 } },
  },
}
const stubFetch = (impl?: (...a: any[]) => any) => {
  const f = vi.fn(impl ?? (async () => new Response(JSON.stringify(liquid))))
  vi.stubGlobal('fetch', f)
  return f
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('route checks', () => {
  it('rejects bad origin, cross-site and GET', async () => {
    const { env } = fakeEnv()
    expect((await send('/api/game/step', stepReq, env, { origin: 'https://evil.example' })).status).toBe(403)
    expect((await send('/api/game/step', stepReq, env, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    const get = await route(new Request(ORIGIN + '/api/game/step', { headers: { origin: ORIGIN } }), env, { waitUntil() {} })
    expect(get.status).toBe(405)
  })

  it('rejects a 2049-byte body', async () => {
    const { env } = fakeEnv()
    expect((await send('/api/game/step', ' '.repeat(2049), env)).status).toBe(400)
  })

  it.each([
    ['unknown rule', { ...stepReq, wave: [9, 2, 1] }],
    ['unknown step', { ...stepReq, wave: [0, 9, 1] }],
    ['wrong standard seed', { ...stepReq, wave: [0, 2, 7] }],
    ['string field', { ...stepReq, level: '1' }],
    ['string in wave', { ...stepReq, wave: [0, 2, '1'] }],
    ['extra key', { ...stepReq, note: 1 }],
    ['adaptive seed outside pool', { ...stepReq, mode: 1, wave: [0, 2, 5], past: [] }],
  ])('400 on %s without echo', async (_, body) => {
    const { env } = fakeEnv()
    const f = stubFetch()
    const res = await send('/api/game/step', body, env)
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('')
    expect(f).not.toHaveBeenCalled()
  })

  it('429 when the rate limit fails', async () => {
    const { env } = fakeEnv({ RL_GAME: { limit: async () => ({ success: false }) } })
    expect((await send('/api/game/step', stepReq, env)).status).toBe(429)
  })
})

describe('step', () => {
  it('falls back without key', async () => {
    const { env } = fakeEnv({ LIQUID_AI_KEY: undefined })
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
  })

  it('falls back when the daily cap is spent, without calling the model', async () => {
    const { env, cache } = fakeEnv()
    for (let i = 0; i < 1000; i++) cache.set('k' + i, { body: '{}', created: Date.now() })
    const f = stubFetch()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
    expect(f).not.toHaveBeenCalled()
  })

  it('falls back on a hung fetch', async () => {
    stubFetch((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('t')))))
    const { env } = fakeEnv()
    const res = await send('/api/game/step', stepReq, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fallback: true })
  })

  it('rounds floats, caches, and sends no client strings to Liquid', async () => {
    const { env, cache } = fakeEnv()
    const f = stubFetch()
    const first = await (await send('/api/game/step', stepReq, env)).json()
    expect(first).toEqual({ ai: { pick: 1, p: 0.6 }, hit: 0.85, miss: 0.4, cached: false })
    expect(cache.size).toBe(1)
    const second = await (await send('/api/game/step', stepReq, env)).json()
    expect(second).toEqual({ ...first, cached: true })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toBe('https://api.liquid.ai/decisions/v1/systemone')
    expect(f.mock.calls[0][1].headers.authorization).toBe('Bearer k')
    const sent = JSON.parse(f.mock.calls[0][1].body)
    expect(JSON.stringify(sent)).not.toMatch(/example|1\.2\.3\.4/)
    expect(sent.state.rule).toBe('colour')
  })
})

describe('result', () => {
  const row = (hit: number) => [0, 1, 0, 0, hit, 1, 0, 12, 12, 0, 0]
  const body = (waves: number[][]) => ({ v: FIXTURE, level: 1, mode: 0, waves })

  it('stores one row with the day only and rejects a lying hit', async () => {
    const { env, results } = fakeEnv()
    // pick 0 is right or wrong depending on the seeded rock: learn the truth from the 400
    const truth = (await send('/api/game/result', body([row(1)]), env)).status === 204 ? 1 : 0
    if (!truth) expect((await send('/api/game/result', body([row(0)]), env)).status).toBe(204)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveLength(5)
    const [day, version, level, mode, waves] = results[0]
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([version, level, mode]).toEqual(['fixture', 1, 0])
    expect(JSON.parse(waves as string)).toHaveLength(1)
    const lie = await send('/api/game/result', body([row(1 - truth)]), env)
    expect(lie.status).toBe(400)
    expect(results).toHaveLength(1)
  })
})
