import { afterEach, describe, expect, it, vi } from 'vitest'
import { copy, links, resultText, share } from '../../src/game/share.ts'

const url = 'https://serio.org.pl/game/3'
const base = { deck: 'Find the Gap', level: 3, score: 7, you: '15/21', ai: '19/20', names: { score: 'Score', you: 'You', ai: 'AI' }, url }

afterEach(() => vi.unstubAllGlobals())

describe('share', () => {
  it('share uses navigator.share', async () => {
    const s = vi.fn(async () => {})
    vi.stubGlobal('navigator', { share: s })
    expect(await share('t')).toBe(true)
    expect(s).toHaveBeenCalledWith({ text: 't' })
  })
})
