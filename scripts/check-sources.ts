import { pathToFileURL } from 'node:url'
import { pool, wave } from '../src/game/engine.ts'
import type { Evidence } from '../src/game/engine.ts'

const root = 'https://api.github.com/'

export const verify = (text: string, lines: string[][]): string[] => {
  const rows = text.split('\n')
  return lines.filter((g) => !rows.some((r) => g.every((s) => r.includes(s)))).map((g) => g.join(' + '))
}

export const fetchText = async (e: Evidence, token: string, fetchFn: typeof fetch = fetch): Promise<string> => {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'find-the-gap-check' }
  const get = async (url: string) => {
    const r = await fetchFn(url, { headers, redirect: 'follow' })
    if (!r.ok) throw new Error(`GET ${url} failed with ${r.status}`)
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
  const { decks } = await import('../src/game/levels/index.ts')
  let bad = 0
  for (const d of Object.values(decks).filter((x) => x.evidence.length)) {
    for (const e of d.evidence) {
      const miss = verify(await fetchText(e, token), e.lines)
      miss.length ? miss.forEach((g) => console.log(`missing ${e.id}: ${g}`)) : console.log(`ok ${e.id}`)
      bad += miss.length
    }
    const ids = new Set(d.evidence.map((e) => e.id))
    for (const l of d.levels) {
      for (const s of [...l.sequence, ...d.rules.flatMap((r) => Array.from({ length: d.steps }, (_, i) => pool(d, r.id, i + 1)).flat())]) {
        const w = wave(d, s)
        if (!ids.has(w.evidence)) {
          console.log(`missing ${w.evidence}: level ${l.id} wave ${s.rule}`)
          bad++
        }
      }
    }
  }
  if (bad) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
