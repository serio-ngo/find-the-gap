import { band } from './engine.ts'
import type { Deck, Decision, Mode, Spec } from './engine.ts'

export type Step = { ai: { pick: number; p: number }; hit: number; miss: number; cached: boolean }

const post = (api: string, path: string, body: unknown, init: RequestInit) =>
  fetch(`${api}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...init })

// The player never waits on this: any failure, timeout or fallback answer is null and the caller uses its local estimate.
export const askStep = async (api: string, body: unknown, ms = 1500): Promise<Step | null> => {
  try {
    const r = await post(api, 'step', body, { signal: AbortSignal.timeout(ms) })
    const a = await r.json()
    const ok = r.ok && typeof a?.ai?.pick === 'number' && typeof a.ai.p === 'number' && typeof a.hit === 'number' && typeof a.miss === 'number'
    return ok ? a : null
  } catch {
    return null
  }
}

export const sendResult = (api: string, body: unknown) => post(api, 'result', body, { keepalive: true }).then(() => {}, () => {})

// Request bodies are integer-only; rule index = position in deck.rules, deck.rules.length = research wave.
const ruleIdx = (d: Deck, r: string) => (r === 'research' ? d.rules.length : d.rules.findIndex((x) => x.id === r))
const u = (x: number) => Math.round(20 * x)

export const stepRequest = (d: Deck, v: number, level: number, w: Spec, past: Decision[]) => ({
  v,
  level,
  mode: 1,
  wave: [ruleIdx(d, w.rule), w.step, w.seed],
  past: past.filter((x) => x.hit !== null).map((x) => [ruleIdx(d, x.spec.rule), x.spec.step, x.spec.seed, x.pick, band(x.secs)]),
})

// ai is null when no AI pick exists (the fixture deck has none): the route accepts -1 there only.
export const resultRow = (d: Deck, x: Decision, ai: { pick: number; p: number } | null | undefined, p: number, live: Step | null) => [
  ruleIdx(d, x.spec.rule), x.spec.step, x.spec.seed, x.pick, x.hit === null ? 2 : +x.hit, band(x.secs),
  ai ? ai.pick : -1, ai ? u(ai.p) : 0, u(p), live ? 1 : 0, +!!live?.cached,
]

export const resultRequest = (v: number, level: number, mode: Mode, waves: number[][]) => ({ v, level, mode: mode === 'adaptive' ? 1 : 0, waves })
