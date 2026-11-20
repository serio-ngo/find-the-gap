import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { HISTORY, MODEL, aiBody, canonical, content, keys, pool, wave } from '../engine.ts'
import type { AiPick, AiRun, Deck, Wave } from '../engine.ts'

const digest = (text: string) => createHash('sha256').update(text).digest('hex')

export const hashContent = (d: Deck): string => digest(canonical(content(d)))

type Slot = { level: number; index: number } | { pool: string; seed: number }
export type Job = { w: Wave; history: Wave[]; slot: Slot }
export type RecordedRun = AiRun & { requestHash?: string }

export const jobsFor = (d: Deck): Job[] => [
  ...d.levels.flatMap(({ id, sequence }) => {
    const waves = sequence.map((s) => wave(d, s))
    return waves.map((w, index) => ({ w, history: waves.slice(Math.max(0, index - HISTORY), index), slot: { level: id, index } }))
  }),
  ...d.rules.flatMap(({ id }) =>
    Array.from({ length: d.steps }, (_, i) => pool(d, id, i + 1)).flat().map((s) => ({
      w: wave(d, s), history: [], slot: { pool: `${id}:${s.step}`, seed: s.seed },
    })),
  ),
]

export const requestBody = (d: Deck, { w, history }: Job) => JSON.stringify(aiBody(d, w, history))
export const hashRequests = (d: Deck, jobs = jobsFor(d)) => digest(`[${jobs.map((job) => requestBody(d, job)).join(',')}]`)

const legacyContent = '383ce71837fb15e68ceee6ec4c8714a679314bdc374ee45ffdc1b656a44f2e00'
const legacyRequests = '9cfa3b0efc3c146b5870bcbd3060fe4ca25947c652f7f6b962ce817f62841417'

export const hashEdition = (d: Deck, files: Record<string, string>): string => {
  const source = Object.fromEntries(Object.entries(files).map(([path, text]) => [path, text.replace(/\r\n/g, '\n')]))
  return digest(canonical({ content: content(d), anchors: d.levels.map((l) => l.anchors), source }))
}

export const validate = (ks: string[], answer: AiPick): AiPick => {
  const p = answer?.probabilities
  if (!ks.includes(answer?.choice)) throw new Error(`bad choice: ${String(answer?.choice)}`)
  if (!p || typeof p !== 'object') throw new Error('missing probabilities')
  const got = Object.keys(p)
  if (got.length !== ks.length || !ks.every((k) => got.includes(k))) throw new Error('probability keys differ from criteria')
  for (const k of ks) if (typeof p[k] !== 'number' || !(p[k] >= 0 && p[k] <= 1)) throw new Error(`probability out of range: ${k}`)
  return { choice: answer.choice, probabilities: Object.fromEntries(ks.map((k) => [k, Math.round(p[k] * 1000) / 1000])) }
}

export const loadRun = (path: string): RecordedRun | undefined => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

export const checkRun = (run: RecordedRun | undefined, hash: string, d: Deck): string | null => {
  if (!run) return 'ai run missing: run npm run ai'
  if (run.hash !== hash || run.model !== MODEL) return 'ai run stale: run npm run ai'
  const jobs = jobsFor(d)
  const recorded = run.requestHash ?? (run.hash === legacyContent ? legacyRequests : undefined)
  if (recorded !== hashRequests(d, jobs)) return 'ai request bodies stale: run npm run ai'
  if (Object.keys(run.standard ?? {}).length !== d.levels.length) return 'ai run incomplete: standard level keys'
  if (Object.keys(run.pool ?? {}).length !== d.rules.length * d.steps) return 'ai run incomplete: pool keys'
  for (const l of d.levels) {
    const picks = run.standard[l.id]
    if (!Array.isArray(picks) || picks.length !== l.sequence.length) return `ai run incomplete: standard level ${l.id}`
  }
  for (const [key, picks] of Object.entries(run.pool)) {
    if (!Array.isArray(picks) || picks.length !== d.poolSize) return `ai run incomplete: pool ${key}`
  }
  for (const { w, slot } of jobs) {
    const label = 'level' in slot ? `standard level ${slot.level}, wave ${slot.index + 1}` : `pool ${slot.pool}, seed ${slot.seed}`
    const pick = 'level' in slot
      ? run.standard[slot.level][slot.index]
      : run.pool[slot.pool]?.find((e) => e?.seed === slot.seed)
    if (!pick) return `ai run incomplete: ${label}`
    try {
      validate(keys(w), pick)
    } catch (e) {
      return `ai run invalid: ${label}: ${(e as Error).message}`
    }
  }
  return null
}
