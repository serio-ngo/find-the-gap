import type { Signs } from './gen.ts'

export type Mode = 'standard' | 'adaptive'
export type Spec = { rule: string; step: number; seed: number }
export type Wave = Spec & { symbols: string[]; answers: number[]; ids?: string[] }
export type Policy = { high: number; low: number; window: number; confirm: number }
export type ChoiceRecord = { id?: string; clue: string; rule: string; values: string[]; url?: string; signs?: Signs | null }
export type Rule = { id: string; make: (step: number, seed: number) => Pick<Wave, 'symbols' | 'answers' | 'ids'> }
// tail: the last waves every mode plays from the fixed sequence
export type Level = { id: number; start: { rule: string; step: number }; anchors: number[]; sequence: Spec[]; tail?: number }
export type Deck = {
  id: string; steps: number; policy: Policy; rules: Rule[]
  poolSize: number; question?: string; levels: Level[]
  choiceRecords?: (wave: Wave) => ChoiceRecord[]
  typical?: (wave: Wave) => boolean
}
export type Decision = { spec: Spec; pick: number; hit: boolean; anchor: boolean; secs: number; ai?: number | null }
export type Game = { mode: Mode; level: number; rule: string; step: number; streak: number; decisions: Decision[] }
export type AiPick = { choice: string; probabilities: Record<string, number> }
export type AiRun = { hash: string; model: string; date: string; standard: Record<string, (number | null)[]> }

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const MODEL = 'd1.1'
export const URL_AI = 'https://api.liquid.ai/decisions/v1/systemone'
export const HISTORY = 3

// longest reaction time or aim dwell a research row stores, in ms
export const MAX_MS = 600_000

export const round05 = (x: number) => Math.round(x * 20) / 20

export const keys = (w: Wave) => w.symbols.map((_, i) => `r${i}`)

export const wave = (d: Deck, s: Spec): Wave => ({ ...s, ...d.rules.find((r) => r.id === s.rule)!.make(s.step, s.seed) })

export const ANCHOR_POOL = 2000

export const pool = (d: Deck, rule: string, step: number, anchor = false): Spec[] =>
  Array.from({ length: d.poolSize }, (_, i) => ({ rule, step, seed: (anchor ? ANCHOR_POOL : 1000) + i }))

export const begin = (d: Deck, level: number, mode: Mode): Game => {
  const { rule, step } = d.levels.find((l) => l.id === level)!.start
  return { mode, level, rule, step, streak: 0, decisions: [] }
}

const fixedFrom = (d: Deck, level: number) => {
  const l = d.levels.find((x) => x.id === level)!
  return l.sequence.length - (l.tail ?? 0)
}

export const upcoming = (d: Deck, g: Game): Spec | null => {
  const i = g.decisions.length
  const level = d.levels.find((l) => l.id === g.level)!
  if (g.mode === 'standard' || i >= fixedFrom(d, g.level)) return level.sequence[i] ?? null
  const anchor = level.anchors.includes(i)
  const all = pool(d, g.rule, g.step, anchor)
  const free = all.filter((s) => !g.decisions.some((x) => x.spec.seed === s.seed))
  const gap = (s: Spec) => { const w = wave(d, s); return w.ids?.[w.answers[0]!] }
  const fresh = anchor ? free.filter((s) => !g.decisions.some((x) => x.anchor && gap(x.spec) === gap(s))) : free
  const from = fresh.length ? fresh : free.length ? free : all
  return from[Math.floor(rng(g.level * 100 + i)() * from.length)]!
}

export const estimate = (d: Deck, g: Game): number => {
  const last = g.decisions.filter((x) => x.spec.rule === g.rule).slice(-d.policy.window)
  return round05((last.filter((x) => x.hit).length + 1) / (last.length + 2))
}

export const forecast = (d: Deck, g: Game, live?: { hit: number; miss: number }) =>
  live ? live[g.decisions.at(-1)!.hit ? 'hit' : 'miss'] : estimate(d, { ...g, decisions: g.decisions.filter((x) => x.anchor) })

export const advance = (d: Deck, s: { rule: string; step: number; streak: number }, p: number, hit: boolean) => {
  const up = hit && p >= d.policy.high
  const down = !hit && p < d.policy.low
  const streak = (up && s.step === d.steps) || (down && s.step === 1) ? s.streak + 1 : 0
  if (streak >= d.policy.confirm) {
    const next = d.rules[d.rules.findIndex((r) => r.id === s.rule) + (up ? 1 : -1)]
    if (next) return { rule: next.id, step: up ? 2 : 1, streak: 0, switched: true }
  }
  const step = Math.min(d.steps, Math.max(1, s.step + (up ? 1 : down ? -1 : 0)))
  return { rule: s.rule, step, streak, switched: false }
}

export const band = (secs: number): 0 | 1 | 2 => (secs < 3 ? 0 : secs < 8 ? 1 : 2)

export const shoot = (d: Deck, g: Game, pick: number, secs = 0, live?: { hit: number; miss: number }): Game => {
  const spec = upcoming(d, g)
  if (!spec) return g
  const hit = wave(d, spec).answers.includes(pick)
  const anchor = d.levels.find((l) => l.id === g.level)!.anchors.includes(g.decisions.length)
  const next = { ...g, decisions: [...g.decisions, { spec, pick, hit, anchor, secs }] }
  // adaptive play moves its parameters only after a certain wave, so a research wave's truth never shows in the next wave
  if (g.mode === 'standard' || !anchor) return next
  // shortcut: the live AI forecast still sees research picks, as a fuzzy aggregate; filter its history if that proves readable
  const { rule, step, streak } = advance(d, g, forecast(d, next, live), hit)
  return { ...next, rule, step, streak }
}

export const asks = (d: Deck, g: Game, i: number) => !fixed(d, g, i) && d.levels.find((l) => l.id === g.level)!.anchors.includes(i)

export const score = (g: Game) =>
  g.decisions.reduce((t, x) => (x.anchor && x.hit ? t + 100 + Math.max(0, Math.round(100 - 10 * x.secs)) : t), 0)

// Wave i is the same for everyone: all of standard mode and the fixed tail of adaptive mode. The stored AI run covers exactly these.
export const fixed = (d: Deck, g: Game, i: number) => g.mode === 'standard' || i >= fixedFrom(d, g.level)

export const aiPick = (run: AiRun, d: Deck, g: Game, i: number): number | null | undefined =>
  fixed(d, g, i) ? run.standard[g.level]?.[i] : undefined

export type Tally = { you: number; ai: number; aiN: number; chance: number; n: number }

// Scored waves only. You: hits of n. AI: hits of the aiN waves where it gave a stable pick. Chance: expected hits by guessing.
export const report = (d: Deck, g: Game) => {
  const rows = g.decisions.filter((x) => x.anchor).map((x) => ({ x, w: wave(d, x.spec) }))
  const tally = (rs: typeof rows): Tally => {
    const ai = rs.filter(({ x }) => typeof x.ai === 'number')
    return {
      you: rs.filter(({ x }) => x.hit).length,
      ai: ai.filter(({ x, w }) => w.answers.includes(x.ai!)).length,
      aiN: ai.length,
      chance: rs.reduce((t, { w }) => t + 1 / w.symbols.length, 0),
      n: rs.length,
    }
  }
  const typical = d.typical
  return {
    all: tally(rows),
    typical: typical ? tally(rows.filter(({ w }) => typical(w))) : null,
    atypical: typical ? tally(rows.filter(({ w }) => !typical(w))) : null,
  }
}

export const aiBody = (d: Deck, w: Wave, history: Wave[]): object => ({
  model: MODEL,
  state: {
    step: w.step,
    rocks: w.symbols,
    history: history.slice(-HISTORY).map((h) => ({ rocks: h.symbols })),
  },
  questions: {
    ai: {
      type: 'choice',
      instructions: d.question,
      criteria: Object.fromEntries(keys(w).map((k, i) => [k, w.symbols[i]])),
    },
  },
})

const IF_HIT = 'If the player picks a correct rock on this wave, what is the probability that they are correct on the next wave?'
const IF_MISS = 'If the player picks a wrong rock on this wave, what is the probability that they are correct on the next wave?'

export type Past = { w: Wave; hit: boolean | null; tempo: 0 | 1 | 2 }

export const stepBody = (d: Deck, w: Wave, past: Past[]): object => {
  const body = aiBody(d, w, past.map((p) => p.w)) as { state: object; questions: object }
  const answer = { type: 'choice', criteria: { hit: 'hit', miss: 'miss' } }
  return {
    ...body,
    state: {
      ...body.state,
      history: past.slice(-HISTORY).map((p) => ({ rocks: p.w.symbols, hit: p.hit, tempo: p.tempo })),
    },
    questions: { ...body.questions, if_hit: { ...answer, instructions: IF_HIT }, if_miss: { ...answer, instructions: IF_MISS } },
  }
}

export const validate = (ks: string[], answer: AiPick | undefined): AiPick => {
  const p = answer?.probabilities
  if (!answer || !ks.includes(answer.choice)) throw new Error(`bad choice: ${String(answer?.choice)}`)
  if (!p || typeof p !== 'object') throw new Error('missing probabilities')
  const got = Object.keys(p)
  if (got.length !== ks.length || !ks.every((k) => got.includes(k))) throw new Error('probability keys differ from criteria')
  for (const k of ks) if (typeof p[k] !== 'number' || !(p[k] >= 0 && p[k] <= 1)) throw new Error(`probability out of range: ${k}`)
  return { choice: answer.choice, probabilities: Object.fromEntries(ks.map((k) => [k, Math.round(p[k]! * 1000) / 1000])) }
}

const drawn = (d: Deck, s: Spec, records: boolean) => { const w = wave(d, s); return records ? { ...w, records: d.choiceRecords?.(w) } : w }

export const content = (d: Deck, records = false): unknown => ({
  id: d.id,
  model: MODEL,
  history: HISTORY,
  steps: d.steps,
  poolSize: d.poolSize,
  policy: d.policy,
  question: d.question,
  levels: d.levels.map((l) => ({ id: l.id, start: l.start, anchors: l.anchors, waves: l.sequence.map((s) => drawn(d, s, records)) })),
  pool: d.rules.flatMap((r) =>
    Array.from({ length: d.steps }, (_, i) => [...pool(d, r.id, i + 1), ...pool(d, r.id, i + 1, true)].map((s) => drawn(d, s, records))).flat(),
  ),
})

export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  )
