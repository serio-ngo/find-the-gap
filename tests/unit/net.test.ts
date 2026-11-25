import { afterEach, describe, expect, it, vi } from 'vitest'
import { askStep, sendResult } from '../../src/game/net.ts'

const ok = { ai: 0, hit: 0.6, miss: 0.4, cached: false }
const reply = (b: unknown) => vi.fn(async () => new Response(JSON.stringify(b)))
afterEach(() => vi.unstubAllGlobals())

describe('askStep', () => {
  it('posts JSON to /step and returns a well-formed answer', async () => {
    const f = reply(ok)
    vi.stubGlobal('fetch', f)
    expect(await askStep('/api', { v: 'x' })).toEqual(ok)
    expect(f).toHaveBeenCalledWith('/api/step', expect.objectContaining({ method: 'POST', body: '{"v":"x"}' }))
  })
  it('returns null on a bad shape, a fallback, an error status or a network error', async () => {
    for (const f of [reply({ ai: 1 }), reply({ fallback: true }), vi.fn(async () => new Response(JSON.stringify(ok), { status: 500 })), vi.fn(async () => { throw new Error('x') })]) {
      vi.stubGlobal('fetch', f)
      expect(await askStep('/api', {})).toBeNull()
    }
  })
})

describe('sendResult', () => {
  it('posts with keepalive and swallows errors', async () => {
    const f = vi.fn(async () => { throw new Error('x') })
    vi.stubGlobal('fetch', f)
    await expect(sendResult('/api', { v: 'x' })).resolves.toBeUndefined()
    expect(f).toHaveBeenCalledWith('/api/result', expect.objectContaining({ method: 'POST', keepalive: true }))
  })
})
