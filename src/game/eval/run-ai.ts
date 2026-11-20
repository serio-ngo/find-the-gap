import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODEL, URL_AI, keys, validate } from '../engine.ts'
import type { AiPick, AiRun, Deck } from '../engine.ts'
import { hashContent, hashRequests, jobsFor, requestBody } from './version.ts'
import type { Job, RecordedRun } from './version.ts'

const round3 = (x: number) => Math.round(x * 1000) / 1000

export const spread = (a: AiPick[], b: AiPick[]) => {
  let choiceDiffs = 0
  let maxProbDiff = 0
  a.forEach((x, i) => {
    if (x.choice !== b[i]!.choice) choiceDiffs++
    for (const k of Object.keys(x.probabilities)) {
      maxProbDiff = Math.max(maxProbDiff, Math.abs(x.probabilities[k]! - b[i]!.probabilities[k]!))
    }
  })
  return { choiceDiffs, maxProbDiff: round3(maxProbDiff) }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const post = async (d: Deck, key: string, job: Job): Promise<any> => {
  for (let attempt = 0; ; attempt++) {
    let status = 0
    try {
      const res = await fetch(URL_AI, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: requestBody(d, job),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) return await res.json()
      status = res.status
    } catch {}
    if ((status && status !== 429 && status < 500) || attempt === 3) throw new Error(status ? `HTTP ${status}` : 'network error')
    await sleep(1000 * 2 ** attempt)
  }
}

const ask = async (d: Deck, key: string, job: Job, usage: { tokens: number }): Promise<AiPick> => {
  const json = await post(d, key, job)
  usage.tokens += json.usage?.input_tokens ?? json.usage?.prompt_tokens ?? 0
  return validate(keys(job.w), json.answers?.ai)
}

const runAll = async (d: Deck, key: string, jobs: Job[], usage: { tokens: number }) => {
  const out: AiPick[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < jobs.length) {
        const i = next++
        out[i] = await ask(d, key, jobs[i]!, usage)
      }
    }),
  )
  return out
}

const main = async () => {
  const key = process.env.LIQUID_AI_KEY
  if (!key) {
    console.error('LIQUID_AI_KEY missing')
    process.exit(1)
  }
  const { decks } = await import('../levels/index.ts')
  const d: Deck = decks.lifecycle!
  const jobs = jobsFor(d)
  const usage = { tokens: 0 }
  const first = await runAll(d, key, jobs, usage)
  const second = await runAll(d, key, jobs, usage)
  const standard: AiRun['standard'] = {}
  const poolOut: AiRun['pool'] = {}
  jobs.forEach(({ slot }, i) => {
    if ('level' in slot) (standard[slot.level] ??= []).push(first[i]!)
    else (poolOut[slot.pool] ??= []).push({ seed: slot.seed, ...first[i]! })
  })
  const run: RecordedRun = {
    hash: hashContent(d),
    requestHash: hashRequests(d, jobs),
    model: MODEL,
    date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }),
    standard,
    pool: poolOut,
    spread: spread(first, second),
  }
  writeFileSync(fileURLToPath(new URL('./ai-run.json', import.meta.url)), JSON.stringify(run, null, 2) + '\n')
  console.log(`requests ${jobs.length * 2}, input tokens ${usage.tokens || 'n/a'}, spread ${JSON.stringify(run.spread)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : 'failed')
    process.exit(1)
  })
}
