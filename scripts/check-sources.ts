import { pathToFileURL } from 'node:url'
import { canonical, content } from '../src/game/engine.ts'
import type { Evidence } from '../src/game/engine.ts'
import { facts, lifecycle, lifecycleDeck, revisions } from '../src/game/levels/lifecycle.ts'
import type { Facts } from '../src/game/levels/lifecycle.ts'
import { regressionJobId, sandboxApi, sandboxUrl, workflowJobs } from '../src/game/levels/records.ts'
import type { JobStep } from '../src/game/levels/records.ts'

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

const request = (token: string, fetchFn: typeof fetch = fetch) => {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'find-the-gap-check' }
  const get = async (url: string, tries = 3): Promise<Response> => {
    const r = await fetchFn(url, { headers, redirect: 'follow' }).catch((err: unknown) => {
      if (tries > 1) return null
      throw err
    })
    if (!r) return get(url, tries - 1)
    if (!r.ok) throw Object.assign(new Error(`GET ${url} failed with ${r.status}`), { status: r.status, url })
    return r
  }
  return get
}

export const fetchText = async (e: Evidence, token: string, fetchFn: typeof fetch = fetch): Promise<string> => {
  const get = request(token, fetchFn)
  if (e.kind === 'comment') return ((await (await get(root + e.api)).json()) as { body: string }).body
  if (e.kind === 'job') return (await get(e.api.startsWith('http') ? e.api : root + e.api)).text()
  const { jobs } = (await (await get(`${root}${e.api}/jobs`)).json()) as { jobs: { id: number; conclusion: string }[] }
  const base = root + e.api.replace(/\/runs\/\d+$/, '')
  const logs = await Promise.all(jobs.filter((j) => j.conclusion === 'failure').map(async (j) => (await get(`${base}/jobs/${j.id}/logs`)).text()))
  return logs.join('\n')
}

type PublicJob = {
  id: number; run_id: number; html_url: string; name: string; conclusion: string; steps: JobStep[]
}

export const matchesJob = (pinned: typeof workflowJobs[number], actual: PublicJob): boolean => {
  const { id, run, name, steps, conclusion } = pinned
  const full = actual.steps.map(({ number, name, conclusion }) => ({ number, name, conclusion }))
  return actual.id === id && actual.run_id === run && actual.name === name && actual.conclusion === conclusion
    && actual.html_url === `${sandboxUrl}/actions/runs/${run}/job/${id}`
    && canonical(steps) === canonical(full)
}

export const archivedLog = (x: unknown): boolean => {
  const error = x as { status?: number; url?: string } | null
  return (error?.status === 404 || error?.status === 410)
    && /^https:\/\/api\.github\.com\/repos\/serio-ngo\/lifecycle-sandbox\/actions\/jobs\/\d+\/logs$/.test(error.url ?? '')
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
      const source = e.id === 'regression' ? { ...e, kind: 'job' as const, api: `${sandboxApi}/actions/jobs/${regressionJobId}/logs` } : e
      text = await fetchText(source, token)
    } catch (x) {
      if (e.kind === 'comment' || !archivedLog(x)) throw x
      console.log(`archived ${e.id}: using the frozen excerpt because GitHub no longer serves the job log`)
      texts[e.id] = e.quote.join('\n')
      continue
    }
    texts[e.id] = text
    const miss = verify(text, e.quote)
    miss.length ? miss.forEach((q) => console.log(`missing ${e.id}: ${q}`)) : console.log(`ok ${e.id}`)
    bad += miss.length
  }
  const get = request(token)
  for (const [field, sha] of Object.entries(revisions)) {
    const actual = await (await get(`${root}${sandboxApi}/commits/${sha}`)).json() as {
      sha: string; html_url: string; parents: { sha: string }[]
    }
    const expectedParents = [revisions.baseSha, revisions.reportSha]
    if (actual.sha === sha && actual.html_url === `${sandboxUrl}/commit/${sha}`
      && sha.startsWith(facts[field as keyof typeof revisions])
      && (field !== 'testedSha' || canonical(actual.parents.map((p) => p.sha)) === canonical(expectedParents))) {
      console.log(`ok ${field}`)
    } else {
      console.log(`revision differs: ${field}`)
      bad++
    }
  }
  for (const job of workflowJobs) {
    const actual = await (await get(`${root}${sandboxApi}/actions/jobs/${job.id}`)).json() as PublicJob
    if (matchesJob(job, actual)) console.log(`ok PR #${job.pr} ${job.stage} job ${job.id} (${job.steps.length} steps)`)
    else {
      console.log(`workflow job differs: PR #${job.pr} ${job.stage} job ${job.id}`)
      bad++
    }
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
