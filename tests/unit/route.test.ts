import { afterEach, describe, expect, it, vi } from 'vitest'
import { route } from '../../src/game/worker/route.ts'
import { ENC, ORIGIN, RS, fakeEnv, odds, send, stepReq, stubFetch } from './route-env.ts'

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

  it('rejects a streamed body over 8192 bytes without content-length', async () => {
    const { env } = fakeEnv()
    const stream = new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode(' '.repeat(8193))), c.close()) })
    const req = new Request(ORIGIN + '/api/game/step', { method: 'POST', body: stream, headers: { origin: ORIGIN }, duplex: 'half' } as any)
    expect((await route(req, env, { waitUntil() {} })).status).toBe(400)
  })

  it('rejects an 8193-byte body', async () => {
    const { env } = fakeEnv()
    expect((await send('/api/game/step', ' '.repeat(8193), env)).status).toBe(400)
  })

  it.each([
    ['unknown room', { ...stepReq, room: 9999 }],
    ['room without monsters', { ...stepReq, room: RS.findIndex((r) => !r.monsters.length) }],
    ['another world', { ...stepReq, v: 1 }],
    ['string field', { ...stepReq, room: '1' }],
    ['extra key', { ...stepReq, note: 1 }],
    ['old wave field', { v: 0, room: stepReq.room, wave: [0, 2, 1] }],
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
    stubFetch(async () => new Response(JSON.stringify(odds(ENC[0]!.monsters.length, n++ ? 'r1' : 'r0'))))
    const { env } = fakeEnv()
    expect(await (await send('/api/game/step', stepReq, env)).json()).toMatchObject({ ai: null })
  })

  it('caches, and sends no client strings to Liquid', async () => {
    const { env, cache } = fakeEnv()
    const f = stubFetch()
    const first = await (await send('/api/game/step', stepReq, env)).json()
    expect(first).toEqual({ ai: 1, cached: false })
    expect(cache.size).toBe(1)
    const second = await (await send('/api/game/step', stepReq, env)).json()
    expect(second).toEqual({ ...first, cached: true })
    expect(f).toHaveBeenCalledTimes(2)
    expect(f.mock.calls[0][0]).toBe('https://api.liquid.ai/decisions/v1/systemone')
    expect(f.mock.calls[0][1].headers.authorization).toBe('Bearer k')
    const sent = JSON.parse(f.mock.calls[0][1].body)
    expect(JSON.stringify(sent)).not.toMatch(/example|1\.2\.3\.4/)
    expect(JSON.stringify(sent)).not.toMatch(/"gap"|if_hit|if_miss/)
  })
})
