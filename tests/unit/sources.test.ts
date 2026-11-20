import { describe, expect, it } from 'vitest'
import { archivedLog, fetchText, matchesJob, parseFacts, verify } from '../../scripts/check-sources.ts'
import type { Evidence } from '../../src/game/engine.ts'
import { sandboxUrl, workflowJobs } from '../../src/game/levels/records.ts'

const ev = (kind: Evidence['kind'], api: string): Evidence => ({ id: 'x', kind, api, url: 'u', quote: [] })
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
  it('passes when every quote line is in the text', () => {
    expect(verify('a b c\nd', ['b c', 'd'])).toEqual([])
  })
  it('reports lines that are missing', () => {
    expect(verify('a\nc', ['a', 'a c'])).toEqual(['a c'])
  })
})

describe('parseFacts', () => {
  it('reads the facts from the source texts', () => {
    const report = ['**Acceptance: pass** for `abc1234` · x', '| Criterion | Test | Result |', '| AC1 | one | passed |', '| AC2 | one | passed |', '| AC3 | two | passed |'].join('\n')
    const checkout = '2026 HEAD is now at 1111111 Merge ' + 'a'.repeat(40) + ' into ' + 'b'.repeat(40)
    const regression = 'x Expected: "1.0"\nx Received: "1.00"'
    expect(parseFacts({ report, checkout, regression })).toEqual({
      criteria: [['AC1', 'one'], ['AC2', 'one'], ['AC3', 'two']],
      reportSha: 'abc1234',
      testedSha: '1111111',
      baseSha: 'bbbbbbb',
      expected: '1.0',
      received: '1.00',
    })
  })
  it('throws when a source lacks its line', () => {
    expect(() => parseFacts({ report: '', checkout: '', regression: '' })).toThrow()
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

it('fetchText retries a thrown network error', async () => {
  let calls = 0
  const fetchFn = (async () => {
    calls++
    if (calls === 1) throw new TypeError('fetch failed')
    return new Response(JSON.stringify({ body: 'ok' }), { status: 200 })
  }) as typeof fetch
  expect(await fetchText(ev('comment', 'x'), 't', fetchFn)).toBe('ok')
  expect(calls).toBe(2)
})

it('verifies every workflow step in order and ignores unselected fields', () => {
  const pinned = workflowJobs[0]
  const actual = {
    ...pinned,
    run_id: pinned.run,
    html_url: `${sandboxUrl}/actions/runs/${pinned.run}/job/${pinned.id}`,
    steps: pinned.steps.map((s) => ({ ...s, status: 'completed' })),
  }
  expect(matchesJob(pinned, actual)).toBe(true)
  expect(matchesJob(pinned, { ...actual, steps: [...actual.steps].reverse() })).toBe(false)
  expect(matchesJob(pinned, { ...actual, steps: actual.steps.slice(1) })).toBe(false)
  expect(matchesJob(pinned, { ...actual, conclusion: 'failure' })).toBe(false)
})

it('uses frozen excerpts only when an actual sandbox job log has expired', () => {
  const url = 'https://api.github.com/repos/serio-ngo/lifecycle-sandbox/actions/jobs/135181131850/logs'
  expect(archivedLog({ status: 404, url })).toBe(true)
  expect(archivedLog({ status: 410, url })).toBe(true)
  expect(archivedLog({ status: 403, url })).toBe(false)
  expect(archivedLog({ status: 404, url: url.slice(0, -5) })).toBe(false)
})
