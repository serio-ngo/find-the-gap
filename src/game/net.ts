import { MAX_MS, band } from './engine.ts'
import type { Deck, Decision, Mode, Spec } from './engine.ts'

export type Step = { ai: number | null; hit: number; miss: number; cached: boolean }

const post = (api: string, path: string, body: unknown, init: RequestInit) =>
  fetch(`${api}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...init })

export const askStep = async (api: string, body: unknown, ms = 1500): Promise<Step | null> => {
  try {
    const r = await post(api, 'step', body, { signal: AbortSignal.timeout(ms) })
    const a = await r.json()
    const ok = r.ok && (a?.ai === null || Number.isInteger(a?.ai)) && typeof a.hit === 'number' && typeof a.miss === 'number'
    return ok ? a : null
  } catch {
    return null
  }
}

export const sendResult = (api: string, body: unknown) => post(api, 'result', body, { keepalive: true }).then(() => {}, () => {})

const ruleIdx = (d: Deck, r: string) => d.rules.findIndex((x) => x.id === r)
const u = (x: number) => Math.round(20 * x)

export const stepRequest = (d: Deck, v: number, level: number, w: Spec, past: Decision[]) => ({
  v,
  level,
  mode: 1,
  wave: [ruleIdx(d, w.rule), w.step, w.seed],
  past: past.map((x) => [ruleIdx(d, x.spec.rule), x.spec.step, x.spec.seed, x.pick, band(x.secs)]),
})

export type Aim = { ms: number; dwell: number[]; switches: number }
const ms = (x: number) => Math.min(MAX_MS, Math.max(0, Math.round(x)))

export const resultRow = (d: Deck, x: Decision, p: number, live: Step | null, first: boolean, aim: Aim) => [
  ruleIdx(d, x.spec.rule), x.spec.step, x.spec.seed, x.pick, +x.hit, band(x.secs),
  typeof x.ai === 'number' ? x.ai : -1, u(p), live ? 1 : 0, +!!live?.cached, +first,
  ms(aim.ms), Math.min(99, aim.switches), +x.anchor, ...aim.dwell.map(ms),
]

export const resultRequest = (v: number, level: number, mode: Mode, waves: number[][], edition: string) => ({ v, level, mode: mode === 'adaptive' ? 1 : 0, waves, edition })
