import { afterEach, describe, expect, it, vi } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { route } from '../../src/game/worker/route.ts'
import type { GameEnv } from '../../src/game/worker/route.ts'

const FIXTURE = 1
const ORIGIN = 'https://example.org'

const fakeEnv = (over: Partial<GameEnv> = {}) => {
  const cache = new Map<string, { body: string; created: number }>()
  const use = { step: 0, result: 0 }
  const results: unknown[][] = []
  const deleted: string[] = []
  const env: GameEnv = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...v: unknown[]) => ({
          first: async () =>
            (sql.includes('game_use')
              ? { n: (use[sql.includes('(day, step)') ? 'step' : 'result'] += v[1] as number) }
              : cache.get(v[0] as string) ?? null) as any,
          run: async () => {
            if (sql.includes('game_cache')) cache.set(v[0] as string, { body: v[1] as string, created: v[2] as number })
            else if (sql.startsWith('DELETE')) deleted.push(v[0] as string)
            else results.push(v)
          },
        }),
      }),
    },
    LIMIT: { limit: async () => ({ success: true }) },
    KEY: 'k',
    ...over,
  }
  return { env, cache, results, use, deleted }
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
  vi.restoreAllMocks()
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

  it('rejects a streamed body over 2048 bytes without content-length', async () => {
    const { env } = fakeEnv()
    const stream = new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode(' '.repeat(2049))), c.close()) })
    const req = new Request(ORIGIN + '/api/game/step', { method: 'POST', body: stream, headers: { origin: ORIGIN }, duplex: 'half' } as any)
    expect((await route(req, env, { waitUntil() {} })).status).toBe(400)
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
    const { env } = fakeEnv({ LIMIT: { limit: async () => ({ success: false }) } })
    expect((await send('/api/game/step', stepReq, env)).status).toBe(429)
  })
})

describe('step', () => {
  it('falls back without key', async () => {
    const { env } = fakeEnv({ KEY: undefined })
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
  })

  it('falls back when the daily cap is spent, without calling the model', async () => {
    const { env, use } = fakeEnv()
    use.step = 1000
    const f = stubFetch()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
    expect(f).not.toHaveBeenCalled()
  })

  it('falls back on a hung fetch', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const c = new AbortController()
      setTimeout(() => c.abort(), ms)
      return c.signal
    })
    const f = stubFetch((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('t')))))
    const { env } = fakeEnv()
    const pending = send('/api/game/step', stepReq, env)
    await vi.waitFor(() => expect(f).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(1500)
    const res = await pending
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fallback: true })
  })

  it('falls back when D1 throws', async () => {
    const boom = async () => {
      throw new Error('d1')
    }
    const { env } = fakeEnv({ DB: { prepare: () => ({ bind: () => ({ first: boom, run: boom }) }) } })
    const res = await send('/api/game/step', stepReq, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fallback: true })
  })

  it.each([
    ['throws', { limit: async () => { throw new Error('rl') } }],
    ['is missing', undefined],
  ])('falls back when the limiter %s', async (_, LIMIT) => {
    const { env } = fakeEnv({ LIMIT: LIMIT as any })
    const res = await send('/api/game/step', stepReq, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fallback: true })
  })

  it('falls back on a malformed model answer', async () => {
    stubFetch(async () => new Response(JSON.stringify({ answers: { ai: { choice: 'r9', probabilities: {} } } })))
    const { env, cache } = fakeEnv()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
    expect(cache.size).toBe(0)
  })

  it('counts failed calls but not cache hits', async () => {
    const { env, use } = fakeEnv()
    stubFetch(async () => new Response('no', { status: 500 }))
    await send('/api/game/step', stepReq, env)
    expect(use.step).toBe(2)
    stubFetch()
    await send('/api/game/step', stepReq, env)
    expect(use.step).toBe(4)
    await send('/api/game/step', stepReq, env)
    expect(use.step).toBe(4)
  })

  it('gives no AI pick when the two model passes disagree', async () => {
    let n = 0
    const answer = (choice: string) => ({ answers: {
      ai: { choice, probabilities: { r0: 0.5, r1: 0.5, r2: 0, r3: 0, r4: 0 } },
      if_hit: { choice: 'hit', probabilities: { hit: 0.8, miss: 0.2 } },
      if_miss: { choice: 'miss', probabilities: { hit: 0.4, miss: 0.6 } },
    } })
    stubFetch(async () => new Response(JSON.stringify(answer(n++ ? 'r1' : 'r0'))))
    const { env } = fakeEnv()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toMatchObject({ ai: null, hit: 0.8, miss: 0.4 })
  })

  it('rounds floats, caches, and sends no client strings to Liquid', async () => {
    const { env, cache } = fakeEnv()
    const f = stubFetch()
    const first = await (await send('/api/game/step', stepReq, env)).json()
    expect(first).toEqual({ ai: 1, hit: 0.85, miss: 0.4, cached: false })
    expect(cache.size).toBe(1)
    const second = await (await send('/api/game/step', stepReq, env)).json()
    expect(second).toEqual({ ...first, cached: true })
    expect(f).toHaveBeenCalledTimes(2)
    expect(f.mock.calls[0][0]).toBe('https://api.liquid.ai/decisions/v1/systemone')
    expect(f.mock.calls[0][1].headers.authorization).toBe('Bearer k')
    const sent = JSON.parse(f.mock.calls[0][1].body)
    expect(JSON.stringify(sent)).not.toMatch(/example|1\.2\.3\.4/)
    expect(sent.state.rule).toBe('colour')
  })
})

describe('result', () => {
  const row = (hit: number) => [0, 1, 0, 0, hit, 1, 0, 12, 0, 0]
  const body = (waves: number[][]) => ({ v: FIXTURE, level: 1, mode: 0, waves })

  it('stores one row with the day only, drops rows older than a year once a day and rejects a lying hit', async () => {
    const { env, results, deleted } = fakeEnv()
    const d = decks.fixture
    const pick = wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).answers[0]!
    const ok = await send('/api/game/result', body([[0, 1, 0, pick, 1, 1, 0, 12, 0, 0]]), env)
    expect(ok.status).toBe(204)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveLength(5)
    const [day, version, level, mode, waves] = results[0]
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([version, level, mode]).toEqual(['fixture', 1, 0])
    expect(JSON.parse(waves as string)).toHaveLength(1)
    expect(deleted).toEqual([new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)])
    expect((await send('/api/game/result', body([[0, 1, 0, pick, 1, 1, 0, 12, 0, 0]]), env)).status).toBe(204)
    expect(deleted).toHaveLength(1)
    const lie = await send('/api/game/result', body([[0, 1, 0, pick, 0, 1, 0, 12, 0, 0]]), env)
    expect(lie.status).toBe(400)
    expect(results).toHaveLength(2)
  })

  it('204 without inserting past the daily result cap', async () => {
    const { env, results, use } = fakeEnv()
    use.result = 5000
    const d = decks.fixture
    const pick = wave(d, { rule: d.rules[0]!.id, step: 1, seed: 0 }).answers[0]!
    expect((await send('/api/game/result', body([[0, 1, 0, pick, 1, 1, 0, 12, 0, 0]]), env)).status).toBe(204)
    expect(results).toHaveLength(0)
  })

  it('rejects an invalid pick on the research wave', async () => {
    const { env } = fakeEnv()
    const d = decks.observations
    const rows = (research: unknown) => d.levels[0]!.sequence.map((s) => {
      const r = s.rule === 'research' ? d.rules.length : d.rules.findIndex((x) => x.id === s.rule)
      return [r, s.step, s.seed, s.rule === 'research' ? research : wave(d, s).answers[0], s.rule === 'research' ? 2 : 1, 1, -1, 0, 0, 0]
    })
    const send0 = (research: unknown) => send('/api/game/result', { v: 0, level: 1, mode: 0, waves: rows(research) }, env)
    expect((await send0('x')).status).toBe(400)
    expect((await send0(99)).status).toBe(400)
    expect((await send0(0)).status).toBe(204)
  })
})
