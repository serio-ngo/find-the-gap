import { ANCHOR_POOL, rng } from '../engine.ts'
import type { ChoiceRecord, Deck, Rule, Wave } from '../engine.ts'
import type { Signs } from '../gen.ts'
import { rows } from './rows.ts'

export type Context = { locks: number | null; impacts: number | null; agent: number | null; job: string | null; share: number | null }
export type Row = { id: string; rule: string; roles: string[]; values: string[]; gap: boolean; research: boolean; run: string; context: Context | null }

export const gapOf: Record<string, (values: string[]) => boolean> = {
  odd_revision: (v) => v[0] !== v[1],
  missing_link: (v) => v.includes('missing'),
  pair: (v) => new Set(v).size < v.length,
}

export const level = {
  locks: (c: Context | null) => Math.min(3, c?.locks ?? 0),
  job: (c: Context | null) => (c?.job === 'success' ? 2 : c?.job ? 1 : 0),
  share: (c: Context | null) => (c?.share == null ? 0 : Math.round(c.share * 4)),
  impacts: (c: Context | null) => Math.min(2, c?.impacts ?? 0),
  agent: (c: Context | null) => Math.min(3, c?.agent ?? 0),
}
export type Channel = keyof typeof level
export const CHANNELS: Record<string, Channel[]> = {
  odd_revision: ['job', 'impacts'],
  missing_link: ['locks', 'impacts', 'agent'],
  pair: ['job'],
}

export const signs = (r: Row): Signs | null =>
  r.context && (Object.fromEntries(Object.entries(level).map(([k, f]) => [k, CHANNELS[r.rule]!.includes(k as Channel) ? f(r.context) : 0])) as Signs)

const order = ['odd_revision', 'missing_link', 'pair']
export const CERTAIN = [4, 9, 14, 19]
const counts = [4, 5, 6, 6, 7]
const WAVES = 20
export const UNSEEN = 900
export const unseen = (seed: number) => seed >= UNSEEN && seed < UNSEEN + 100
export const ATYPICAL = 0.25

for (const r of rows) {
  if (gapOf[r.rule]?.(r.values) !== r.gap) throw new Error(`row ${r.id} breaks its rule`)
}

export const clue = (r: Row) => r.roles.map((role, i) => `${role} ${r.values[i]}`).join(' · ')

export const pattern = (r: Row) => (r.rule === 'odd_revision' ? (r.values[0] === r.values[1] ? 'same' : 'differ') : r.values.join(','))

const scored = rows.filter((r) => !r.research)

export const typicality = (r: Row) => {
  const peers = scored.filter((x) => x.rule === r.rule && x.gap === r.gap)
  return peers.filter((x) => pattern(x) === pattern(r)).length / peers.length
}

const shuffle = <T>(r: () => number, a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

const lookalike = (x: Row, gap: Row) => (x.rule === 'missing_link' ? x.values.includes('failed') : x.rule === 'pair' && x.values.length === gap.values.length)

const controls = (r: () => number, from: Row[], gap: Row, n: number, step: number) => {
  const groups = new Map<string, Row[]>()
  for (const x of shuffle(r, from)) groups.set(pattern(x), [...(groups.get(pattern(x)) ?? []), x])
  const lean = step < 3 ? 1 : step > 3 ? -1 : 0
  const sorted = [...groups.values()].sort((a, b) => lean * (+lookalike(a[0]!, gap) - +lookalike(b[0]!, gap)))
  const lanes = sorted.slice(0, step)
  const out: Row[] = []
  while (out.length < n && lanes.some((l) => l.length)) for (const l of lanes) if (l.length && out.length < n) out.push(l.shift()!)
  for (const x of sorted.slice(step).flat()) if (out.length < n) out.push(x)
  return out
}

const turn = <T>(gaps: T[], i: number) => {
  const queue = [...gaps]
  for (let k = 0; k < i; k++) {
    const head = queue.shift()!
    if (!CERTAIN.includes(k)) queue.push(head)
  }
  return queue[0]!
}

const shown = Object.fromEntries(order.map((rule, k) => {
  const gaps = shuffle(rng(k + 7), scored.filter((x) => x.rule === rule && x.gap))
  return [rule, CERTAIN.map((i) => turn(gaps, i))]
}))

const wave = (rule: string, step: number, seed: number) => {
  const from = rows.filter((x) => x.rule === rule && x.research === unseen(seed))
  const certain = shown[rule]!
  const gap = seed >= ANCHOR_POOL ? certain[seed % certain.length] : seed < UNSEEN ? certain[CERTAIN.indexOf(seed % 100)] : undefined
  const r = rng(seed)
  const n = counts[step - 1]!
  const choice = gap ? shuffle(r, [gap, ...controls(r, from.filter((x) => !x.gap), gap, n - 1, step)]) : shuffle(r, from.filter((x) => !certain.includes(x))).slice(0, n)
  return { symbols: choice.map(clue), answers: choice.flatMap((x, i) => (x.gap ? [i] : [])), ids: choice.map((x) => x.id) }
}

const byId = new Map(rows.map((r) => [r.id, r]))
export const rowOf = (id: string) => byId.get(id)!
export const gapRow = (w: Wave) => rowOf(w.ids![w.answers[0]!]!)

export const observations: Deck = {
  id: 'observations',
  steps: 5,
  policy: { high: 0.6, low: 0.5, window: 4, confirm: 2 },
  rules: order.map((id): Rule => ({ id, make: (step, seed) => wave(id, step, seed) })),
  choiceRecords: (w): ChoiceRecord[] => w.ids!.map((id) => {
    const r = byId.get(id)!
    return { id, clue: clue(r), rule: r.rule, values: r.values, url: r.run, signs: signs(r) }
  }),
  typical: (w) => typicality(gapRow(w)) >= ATYPICAL,
  poolSize: 20,
  question: 'Each rock is one public gate run, given by its recorded values. Which rock does not fit with the others? Pick one.',
  levels: order.map((rule, k) => ({
    id: k + 1,
    start: { rule, step: 1 },
    anchors: CERTAIN,
    tail: 1,
    sequence: [
      ...Array.from({ length: WAVES }, (_, i) => ({ rule, step: 1 + Math.floor(i / 4), seed: k * 100 + i })),
      { rule, step: 1, seed: UNSEEN + k },
    ],
  })),
}
