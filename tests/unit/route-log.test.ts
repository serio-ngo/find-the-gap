import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameEnv } from '../../src/game/worker/route.ts'
import { ENC, fakeEnv, send, stepReq, stubFetch } from './route-env.ts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('step fallback logging', () => {
  const quiet = async (env: GameEnv) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    log.mockClear()
    await send('/api/game/step', stepReq, env)
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/1\.2\.3\.4|example|liquid\.ai|"v"/)
    return log.mock.calls[0]![0]
  }
  it('logs a fixed reason at each fallback', async () => {
    expect(await quiet(fakeEnv({ KEY: undefined }).env)).toBe('step fallback: no key')
    const spent = fakeEnv()
    spent.use.step = 1000
    stubFetch()
    expect(await quiet(spent.env)).toBe('step fallback: cap spent')
    const boom = async () => {
      throw new Error('d1 1.2.3.4')
    }
    expect(await quiet(fakeEnv({ DB: { prepare: () => ({ bind: () => ({ first: boom, run: boom, all: boom }) }) } }).env)).toBe('step fallback: error')
  })
  it('logs why Liquid failed, without its payload', async () => {
    stubFetch(async () => new Response('secret payload', { status: 500 }))
    expect(await quiet(fakeEnv().env)).toBe('step fallback: liquid 500')
    stubFetch(async () => new Response(JSON.stringify({ answers: { ai: { choice: 'r9', probabilities: {} } } })))
    expect(await quiet(fakeEnv().env)).toBe('step fallback: invalid answer')
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
    stubFetch(async () => {
      throw new Error('aborted')
    })
    expect(await quiet(fakeEnv().env)).toBe('step fallback: timeout')
  })
})
