export type Mode = 'standard' | 'adaptive'
export type Spec = { rule: string; step: number; seed: number }
export type Wave = Spec & { symbols: string[]; answers: number[]; evidence: string }
export type Policy = { high: number; low: number; window: number; confirm: number }
export type Evidence = { id: string; kind: 'comment' | 'job' | 'run'; api: string; url: string; lines: string[][] }
export type Rule = { id: string; make: (step: number, seed: number) => Pick<Wave, 'symbols' | 'answers' | 'evidence'> }
export type Level = { id: number; start: { rule: string; step: number }; sequence: Spec[] }
export type Deck = {
  id: string; steps: number; policy: Policy; rules: Rule[]; research?: Rule['make']
  poolSize: number; evidence: Evidence[]; question?: string; levels: Level[]
}
export type Decision = { spec: Spec; pick: number; hit: boolean | null }
export type Game = { mode: Mode; level: number; rule: string; step: number; streak: number; decisions: Decision[] }
export type AiPick = { choice: string; probabilities: Record<string, number> }
export type AiRun = {
  hash: string; model: string; date: string
  standard: Record<string, AiPick[]>
  pool: Record<string, (AiPick & { seed: number })[]>
  spread: { choiceDiffs: number; maxProbDiff: number }
}

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

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
  return pool(d, g.rule, g.step)[Math.floor(rng(g.level * 100 + i)() * d.poolSize)]
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

export const shoot = (d: Deck, g: Game, pick: number): Game => {
  const spec = upcoming(d, g)
  if (!spec) return g
  const hit = spec.rule === 'research' ? null : wave(d, spec).answers.includes(pick)
  const next = { ...g, decisions: [...g.decisions, { spec, pick, hit }] }
  if (g.mode === 'standard' || hit === null) return next
  const { rule, step, streak } = advance(d, g, estimate(d, next))
  return { ...next, rule, step, streak }
}

export const replay = (d: Deck, level: number, mode: Mode, picks: number[]): Game =>
  picks.reduce((g, p) => shoot(d, g, p), begin(d, level, mode))

export const score = (g: Game) => g.decisions.filter((x) => x.hit).length

export const aiPick = (run: AiRun, g: Game, i: number): AiPick | undefined => {
  const { spec } = g.decisions[i]
  if (g.mode === 'standard' || spec.rule === 'research') return run.standard[g.level]?.[i]
  return run.pool[`${spec.rule}:${spec.step}`]?.find((e) => e.seed === spec.seed)
}

export const aiScore = (d: Deck, run: AiRun, g: Game) =>
  g.decisions.filter((x, i) => {
    const pick = aiPick(run, g, i)
    return pick && wave(d, x.spec).answers.includes(Number(pick.choice.slice(1)))
  }).length

export const aiBody = (d: Deck, w: Wave, history: Wave[]): object => ({
  model: 'd1.1',
  state: {
    rule: w.rule,
    step: w.step,
    rocks: w.symbols,
    history: history.slice(-3).map((h) => ({ rocks: h.symbols, answers: h.answers })),
  },
  questions: {
    ai: {
      type: 'choice',
      instructions: d.question,
      criteria: Object.fromEntries(keys(w).map((k, i) => [k, w.symbols[i]])),
    },
  },
})

export const content = (d: Deck): unknown => ({
  id: d.id,
  steps: d.steps,
  poolSize: d.poolSize,
  policy: d.policy,
  evidence: d.evidence,
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
