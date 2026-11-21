import { afterEach, describe, expect, it, vi } from 'vitest'
import { copy, links, resultText, share } from '../../src/game/share.ts'

const url = 'https://serio.org.pl/find-the-gap/3'
const base = { deck: 'Find the Gap', level: 3, score: 7, you: '15/21', ai: '19/20', names: { score: 'Score', you: 'You', ai: 'AI' }, url }

afterEach(() => vi.unstubAllGlobals())

describe('share', () => {
  it('formats the result block with passed-in labels', () => {
    expect(resultText(base)).toBe(`Find the Gap #3\nScore 7\nYou 15/21 · AI 19/20\n${url}`)
  })
  it('builds network links', () => {
    const l = links('a b', url), t = encodeURIComponent('a b'), u = encodeURIComponent(url)
    expect(l.x).toBe(`https://x.com/intent/post?text=${t}`)
    expect(l.bluesky).toBe(`https://bsky.app/intent/compose?text=${t}`)
    expect(l.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`)
    expect(l.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${u}`)
  })
  it('share returns false without navigator.share', async () => {
    vi.stubGlobal('navigator', {})
    expect(await share('t')).toBe(false)
  })
  it('share uses navigator.share', async () => {
    const s = vi.fn(async () => {})
    vi.stubGlobal('navigator', { share: s })
    expect(await share('t')).toBe(true)
    expect(s).toHaveBeenCalledWith({ text: 't' })
  })
  it('copy reports success and failure', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => {} } })
    expect(await copy('t')).toBe(true)
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('no') } } })
    expect(await copy('t')).toBe(false)
  })
})
