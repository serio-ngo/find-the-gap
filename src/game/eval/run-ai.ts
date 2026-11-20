import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MODEL, HISTORY, aiBody, keys, pool, wave } from '../engine.ts'
import type { AiPick, AiRun, Deck, Wave } from '../engine.ts'
import { hashContent } from './version.ts'

const URL_AI = 'https://api.liquid.ai/decisions/v1/systemone'
const round3 = (x: number) => Math.round(x * 1000) / 1000

export const validate = (ks: string[], answer: any): AiPick => {
  const p = answer?.probabilities
  if (!ks.includes(answer?.choice)) throw new Error(`bad choice: ${String(answer?.choice)}`)
  if (!p || typeof p !== 'object') throw new Error('missing probabilities')
  const got = Object.keys(p)
  if (got.length !== ks.length || !ks.every((k) => got.includes(k))) throw new Error('probability keys differ from criteria')
  for (const k of ks) if (typeof p[k] !== 'number' || !(p[k] >= 0 && p[k] <= 1)) throw new Error(`probability out of range: ${k}`)
  return { choice: answer.choice, probabilities: Object.fromEntries(ks.map((k) => [k, round3(p[k])])) }
}

export const spread = (a: AiPick[], b: AiPick[]) => {
  let choiceDiffs = 0
  let maxProbDiff = 0
  a.forEach((x, i) => {
    if (x.choice !== b[i].choice) choiceDiffs++
    for (const k of Object.keys(x.probabilities)) {
      maxProbDiff = Math.max(maxProbDiff, Math.abs(x.probabilities[k] - b[i].probabilities[k]))
    }
  })
  return { choiceDiffs, maxProbDiff: round3(maxProbDiff) }
}

type Job = { w: Wave; history: Wave[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const post = async (d: Deck, key: string, job: Job): Promise<any> => {
  for (let attempt = 0; ; attempt++) {
    let status = 0
    try {
      const res = await fetch(URL_AI, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(aiBody(d, job.w, job.history)),
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
        out[i] = await ask(d, key, jobs[i], usage)
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
  const d: Deck = decks.lifecycle
  const jobs: Job[] = []
  const slots: { level?: number; pool?: string; seed?: number }[] = []
  for (const l of d.levels) {
    const waves = l.sequence.map((s) => wave(d, s))
    waves.forEach((w, i) => {
      jobs.push({ w, history: waves.slice(Math.max(0, i - HISTORY), i) })
      slots.push({ level: l.id })
    })
  }
  for (const r of d.rules) {
    for (let step = 1; step <= d.steps; step++) {
      for (const s of pool(d, r.id, step)) {
        jobs.push({ w: wave(d, s), history: [] })
        slots.push({ pool: `${r.id}:${step}`, seed: s.seed })
      }
    }
  }
  const usage = { tokens: 0 }
  const first = await runAll(d, key, jobs, usage)
  const second = await runAll(d, key, jobs, usage)
  const standard: AiRun['standard'] = {}
  const poolOut: AiRun['pool'] = {}
  slots.forEach((s, i) => {
    if (s.level !== undefined) (standard[s.level] ??= []).push(first[i])
    else (poolOut[s.pool!] ??= []).push({ seed: s.seed!, ...first[i] })
  })
  const run: AiRun = {
    hash: hashContent(d),
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
