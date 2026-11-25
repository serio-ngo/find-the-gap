import { afterEach, describe, expect, it, vi } from 'vitest'
import { route } from '../../src/game/worker/route.ts'
import { ORIGIN, fakeEnv, send, stepReq, stubFetch } from './route-env.ts'

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
  it('falls back when the daily cap is spent, without calling the model', async () => {
    const { env, use } = fakeEnv()
    use.step = 1000
    const f = stubFetch()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toEqual({ fallback: true })
    expect(f).not.toHaveBeenCalled()
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
    expect(sent.state).not.toHaveProperty('rule')
  })
})
