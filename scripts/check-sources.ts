import { pathToFileURL } from 'node:url'
import { canonical, content } from '../src/game/engine.ts'
import type { Evidence } from '../src/game/engine.ts'
import { facts, lifecycle, lifecycleDeck } from '../src/game/levels/lifecycle.ts'
import type { Facts } from '../src/game/levels/lifecycle.ts'

const root = 'https://api.github.com/'

export const verify = (text: string, quote: string[]): string[] => quote.filter((q) => !text.includes(q))

export const parseFacts = (t: Record<string, string>): Facts => {
  const one = (text: string, re: RegExp) => {
    const m = text.match(re)
    if (!m) throw new Error(`no match for ${re}`)
    return m
  }
  const head = one(t.checkout, /HEAD is now at ([0-9a-f]+) Merge [0-9a-f]+ into ([0-9a-f]{7})/)
  return {
    criteria: [...t.report.matchAll(/^\|\s*(AC\d+)\s*\|\s*(.+?)\s*\|\s*passed\s*\|/gm)].map((m) => [m[1], m[2]]),
    reportSha: one(t.report, /Acceptance: pass\*{0,2} for `([0-9a-f]+)`/)[1],
    testedSha: head[1],
    baseSha: head[2],
    expected: one(t.regression, /Expected: "([^"]*)"/)[1],
    received: one(t.regression, /Received: "([^"]*)"/)[1],
  }
}

export const fetchText = async (e: Evidence, token: string, fetchFn: typeof fetch = fetch): Promise<string> => {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'find-the-gap-check' }
  const get = async (url: string, tries = 3): Promise<Response> => {
    const r = await fetchFn(url, { headers, redirect: 'follow' }).catch((err: unknown) => {
      if (tries > 1) return null
      throw err
    })
    if (!r) return get(url, tries - 1)
    if (!r.ok) throw Object.assign(new Error(`GET ${url} failed with ${r.status}`), { status: r.status })
    return r
  }
  if (e.kind === 'comment') return ((await (await get(root + e.api)).json()) as { body: string }).body
  if (e.kind === 'job') return (await get(e.api.startsWith('http') ? e.api : root + e.api)).text()
  const { jobs } = (await (await get(`${root}${e.api}/jobs`)).json()) as { jobs: { id: number; conclusion: string }[] }
  const base = root + e.api.replace(/\/runs\/\d+$/, '')
  const logs = await Promise.all(jobs.filter((j) => j.conclusion === 'failure').map(async (j) => (await get(`${base}/jobs/${j.id}/logs`)).text()))
  return logs.join('\n')
}

const main = async () => {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (!token) {
    console.error('GH_TOKEN or GITHUB_TOKEN required')
    process.exit(1)
  }
  const texts: Record<string, string> = {}
  let bad = 0
  for (const e of lifecycle.evidence) {
    let text: string
    try {
      text = await fetchText(e, token)
    } catch (x: any) {
      if (e.kind === 'comment' || ![404, 410].includes(x.status)) throw x
      console.log(`archived ${e.id}`)
      texts[e.id] = e.quote.join('\n')
      continue
    }
    texts[e.id] = text
    const miss = verify(text, e.quote)
    miss.length ? miss.forEach((q) => console.log(`missing ${e.id}: ${q}`)) : console.log(`ok ${e.id}`)
    bad += miss.length
  }
  const parsed = parseFacts(texts)
  if (canonical(parsed) !== canonical(facts)) {
    console.log(`facts differ: ${canonical(parsed)}`)
    bad++
  }
  if (canonical(content(lifecycleDeck(parsed))) !== canonical(content(lifecycle))) {
    console.log('deck differs from the one built from the sources')
    bad++
  }
  if (bad) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
