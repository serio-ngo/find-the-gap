import { describe, expect, it } from 'vitest'
import { fetchText, verify } from '../../scripts/check-sources.ts'
import type { Evidence } from '../../src/game/engine.ts'

const ev = (kind: Evidence['kind'], api: string): Evidence => ({ id: 'x', kind, api, url: 'u', lines: [] })
const stub = (routes: Record<string, { status?: number; body: unknown }>) => {
  const calls: { url: string; init?: RequestInit }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const r = routes[url] ?? { status: 404, body: '' }
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
    return new Response(text, { status: r.status ?? 200 })
  }) as typeof fetch
  return { f, calls }
}

describe('verify', () => {
  it('passes when a group sits on one line', () => {
    expect(verify('a b c\nd', [['a', 'c']])).toEqual([])
  })
  it('reports groups split across lines', () => {
    expect(verify('a\nc', [['a', 'c'], ['a']])).toEqual([['a', 'c'].join(' + ')])
  })
})

describe('fetchText', () => {
  it('reads a comment body with headers', async () => {
    const { f, calls } = stub({ 'https://api.github.com/repos/o/r/issues/comments/1': { body: { body: 'hello' } } })
    expect(await fetchText(ev('comment', 'repos/o/r/issues/comments/1'), 'tok', f)).toBe('hello')
    expect(calls[0].init?.headers).toMatchObject({
      authorization: 'Bearer tok', accept: 'application/vnd.github+json', 'user-agent': 'find-the-gap-check',
    })
  })
  it('reads job logs', async () => {
    const { f } = stub({ 'https://api.github.com/repos/o/r/actions/jobs/2/logs': { body: 'log' } })
    expect(await fetchText(ev('job', 'https://api.github.com/repos/o/r/actions/jobs/2/logs'), 't', f)).toBe('log')
  })
  it('joins logs of failed jobs of a run', async () => {
    const { f } = stub({
      'https://api.github.com/repos/o/r/actions/runs/3/jobs': {
        body: { jobs: [{ id: 1, conclusion: 'failure' }, { id: 2, conclusion: 'success' }, { id: 4, conclusion: 'failure' }] },
      },
      'https://api.github.com/repos/o/r/actions/jobs/1/logs': { body: 'one' },
      'https://api.github.com/repos/o/r/actions/jobs/4/logs': { body: 'four' },
    })
    expect(await fetchText(ev('run', 'repos/o/r/actions/runs/3'), 't', f)).toBe('one\nfour')
  })
  it('throws with status and url but not the token', async () => {
    const { f } = stub({})
    const err = await fetchText(ev('comment', 'repos/o/r/x'), 'secret', f).catch((e) => String(e))
    expect(err).toContain('404')
    expect(err).toContain('https://api.github.com/repos/o/r/x')
    expect(err).not.toContain('secret')
  })
})
