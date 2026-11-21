export type Mode = 'standard' | 'adaptive'
export type Spec = { rule: string; step: number; seed: number }
export type Wave = Spec & { symbols: string[]; answers: number[]; ids?: string[] }
export type Policy = { high: number; low: number; window: number; confirm: number }
export type ChoiceRecord = { id?: string; clue: string; cells: string[]; url?: string }
export type Rule = { id: string; make: (step: number, seed: number) => Pick<Wave, 'symbols' | 'answers' | 'ids'> }
export type Level = { id: number; start: { rule: string; step: number }; anchors: number[]; sequence: Spec[] }
export type Deck = {
  id: string; steps: number; policy: Policy; rules: Rule[]; research?: Rule['make']
  poolSize: number; question?: string; levels: Level[]
  choiceRecords?: (wave: Wave) => ChoiceRecord[]
}
export type Decision = { spec: Spec; pick: number; hit: boolean | null; anchor: boolean; secs: number; ai?: number | null }
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

export const round05 = (x: number) => Math.round(x * 20) / 20

export const keys = (w: Wave) => w.symbols.map((_, i) => `r${i}`)

export const wave = (d: Deck, s: Spec): Wave => ({
  ...s,
  ...(s.rule === 'research' ? d.research! : d.rules.find((r) => r.id === s.rule)!.make)(s.step, s.seed),
})

export const pool = (d: Deck, rule: string, step: number): Spec[] =>
  Array.from({ length: d.poolSize }, (_, i) => ({ rule, step, seed: 1000 + i }))

export const begin = (d: Deck, level: number, mode: Mode): Game => {
  const { rule, step } = d.levels.find((l) => l.id === level)!.start
  return { mode, level, rule, step, streak: 0, decisions: [] }
}

export const upcoming = (d: Deck, g: Game): Spec | null => {
  const sequence = d.levels.find((l) => l.id === g.level)!.sequence
  const i = g.decisions.length
  const waves = sequence.at(-1)?.rule === 'research' ? sequence.length - 1 : sequence.length
  if (g.mode === 'standard' || i >= waves) return sequence[i] ?? null
  const p = pool(d, g.rule, g.step)
  const j = Math.floor(rng(g.level * 100 + i)() * d.poolSize)
  return p[p[j]!.seed === g.decisions.at(-1)?.spec.seed ? (j + 1) % d.poolSize : j]!
}

export const estimate = (d: Deck, g: Game): number => {
  const last = g.decisions.filter((x) => x.spec.rule === g.rule && x.hit !== null).slice(-d.policy.window)
  return round05((last.filter((x) => x.hit).length + 1) / (last.length + 2))
}

export const advance = (d: Deck, s: { rule: string; step: number; streak: number }, p: number) => {
  const up = p >= d.policy.high
  const down = p < d.policy.low
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
  const hit = spec.rule === 'research' ? null : wave(d, spec).answers.includes(pick)
  const anchor = d.levels.find((l) => l.id === g.level)!.anchors.includes(g.decisions.length)
  const next = { ...g, decisions: [...g.decisions, { spec, pick, hit, anchor, secs }] }
  if (g.mode === 'standard' || hit === null) return next
  const { rule, step, streak } = advance(d, g, live ? live[hit ? 'hit' : 'miss'] : estimate(d, next))
  return { ...next, rule, step, streak }
}

export const score = (g: Game) =>
  g.decisions.reduce((t, x) => (x.anchor && x.hit ? t + 100 + Math.max(0, Math.round(100 - 10 * x.secs)) : t), 0)

export const aiPick = (run: AiRun, g: Game, i: number): number | null | undefined =>
  g.mode === 'standard' || g.decisions[i]!.spec.rule === 'research' ? run.standard[g.level]?.[i] : undefined

export const agreement = (g: Game): { agree: number; n: number } | null => {
  const rows = g.decisions.filter((x) => typeof x.ai === 'number')
  return rows.length ? { agree: Math.round((100 * rows.filter((x) => x.ai === x.pick).length) / rows.length), n: rows.length } : null
}

export const aiBody = (d: Deck, w: Wave, history: Wave[]): object => ({
  model: MODEL,
  state: {
    rule: w.rule,
    step: w.step,
    rocks: w.symbols,
    history: history.slice(-HISTORY).map((h) => ({ rocks: h.symbols, answers: h.answers })),
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
      history: past.slice(-HISTORY).map((p) => ({ rocks: p.w.symbols, answers: p.w.answers, hit: p.hit, tempo: p.tempo })),
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

export const content = (d: Deck): unknown => ({
  id: d.id,
  model: MODEL,
  history: HISTORY,
  steps: d.steps,
  poolSize: d.poolSize,
  policy: d.policy,
  question: d.question,
  levels: d.levels.map((l) => ({ id: l.id, start: l.start, waves: l.sequence.map((s) => wave(d, s)) })),
  pool: d.rules.flatMap((r) =>
    Array.from({ length: d.steps }, (_, i) => pool(d, r.id, i + 1).map((s) => wave(d, s))).flat(),
  ),
})

export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  )
