import { afterEach, describe, expect, it, vi } from 'vitest'
import { askBoard, sendResult } from '../../src/game/net.ts'

const board = { top: [['Ada', 300]], n: 1, below: 0, score: 300 }
const reply = (b: unknown) => vi.fn(async () => new Response(JSON.stringify(b)))
afterEach(() => vi.unstubAllGlobals())

describe('askBoard', () => {
  it('posts JSON to /board and returns a well-formed standing', async () => {
    const f = reply(board)
    vi.stubGlobal('fetch', f)
    expect(await askBoard('/api', { v: 'x' })).toEqual(board)
    expect(f).toHaveBeenCalledWith('/api/board', expect.objectContaining({ method: 'POST', body: '{"v":"x"}' }))
  })
  it('returns null on a bad shape, an error status or a network error', async () => {
    for (const f of [reply({ top: 1 }), vi.fn(async () => new Response(JSON.stringify(board), { status: 400 })), vi.fn(async () => { throw new Error('x') })]) {
      vi.stubGlobal('fetch', f)
      expect(await askBoard('/api', {})).toBeNull()
    }
  })
})

describe('sendResult', () => {
  it('posts with keepalive and resolves true only when the worker stored it', async () => {
    const f = vi.fn(async () => { throw new Error('x') })
    vi.stubGlobal('fetch', f)
    await expect(sendResult('/api', { v: 'x' })).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 429 })))
    await expect(sendResult('/api', {})).resolves.toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(sendResult('/api', {})).resolves.toBe(true)
    vi.stubGlobal('fetch', f)
    await sendResult('/api', { v: 'x' })
    expect(f).toHaveBeenCalledWith('/api/result', expect.objectContaining({ method: 'POST', keepalive: true }))
  })
})
