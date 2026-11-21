import { rng } from '../engine.ts'
import type { ChoiceRecord, Deck, Rule, Wave } from '../engine.ts'
import type { Signs } from '../gen.ts'
import { rows } from './rows.ts'

// The pull request when the gate ran; null where the archive has no snapshot of it.
export type Context = { locks: number | null; impacts: number | null; agent: number | null; job: string | null; share: number | null }
export type Row = { id: string; rule: string; roles: string[]; values: string[]; gap: boolean; research: boolean; run: string; context: Context | null }

export const gapOf: Record<string, (values: string[]) => boolean> = {
  odd_revision: (v) => v[0] !== v[1],
  missing_link: (v) => v.includes('missing'),
  pair: (v) => new Set(v).size < v.length,
}

// Each context channel at the level it is drawn; a run without a snapshot draws nothing.
export const level = {
  locks: (c: Context | null) => Math.min(3, c?.locks ?? 0),
  job: (c: Context | null) => (c?.job === 'success' ? 2 : c?.job ? 1 : 0),
  share: (c: Context | null) => (c?.share == null ? 0 : Math.round(c.share * 4)),
  impacts: (c: Context | null) => Math.min(2, c?.impacts ?? 0),
  agent: (c: Context | null) => Math.min(3, c?.agent ?? 0),
}
export type Channel = keyof typeof level
// Channels drawn per level; tests/unit/leak.test.ts keeps out any that gives the gap away.
export const CHANNELS: Record<string, Channel[]> = {
  odd_revision: ['job', 'share', 'impacts'],
  missing_link: ['locks', 'job', 'share', 'impacts', 'agent'],
  pair: ['job', 'share', 'impacts'],
}

// A channel the level does not draw shows at its resting level, so a rock never carries a channel that gives its gap away.
export const signs = (r: Row): Signs | null =>
  r.context && (Object.fromEntries(Object.entries(level).map(([k, f]) => [k, CHANNELS[r.rule]!.includes(k as Channel) ? f(r.context) : 0])) as Signs)

const order = ['odd_revision', 'missing_link', 'pair']
// Only waves 5, 10, 15 and 20 are certain: the player sees a verdict there and nowhere else. The rest is research.
export const CERTAIN = [4, 9, 14, 19]
const counts = [4, 5, 6, 6, 7]
const WAVES = 20
// Seeds 900 to 999 draw runs that no scored wave of the deck uses.
export const UNSEEN = 900
export const unseen = (seed: number) => seed >= UNSEEN && seed < UNSEEN + 100
// A gap pattern seen in fewer than a quarter of its rule's gap runs is atypical.
export const ATYPICAL = 0.25

for (const r of rows) {
  if (gapOf[r.rule]?.(r.values) !== r.gap) throw new Error(`row ${r.id} breaks its rule`)
}

export const clue = (r: Row) => r.roles.map((role, i) => `${role} ${r.values[i]}`).join(' · ')

// What the player sees, as a signature: equal or different commits, otherwise the values in role order.
export const pattern = (r: Row) => (r.rule === 'odd_revision' ? (r.values[0] === r.values[1] ? 'same' : 'differ') : r.values.join(','))

// Parameters a run gives from its own values: how many items, how many break the rule, and its pattern.
export const params = (r: Row) => {
  const breaks = r.rule === 'odd_revision' ? +(r.values[0] !== r.values[1])
    : r.rule === 'missing_link' ? r.values.filter((v) => v === 'missing').length
    : r.values.filter((v) => r.values.indexOf(v) !== r.values.lastIndexOf(v)).length
  return { arity: r.values.length, breaks, pattern: pattern(r) }
}

const scored = rows.filter((r) => !r.research)

// Share of the rule's scored runs with the same gap flag that show this pattern.
export const typicality = (r: Row) => {
  const peers = scored.filter((x) => x.rule === r.rule && x.gap === r.gap)
  return peers.filter((x) => pattern(x) === pattern(r)).length / peers.length
}

const shuffle = <T>(r: () => number, a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

// A control that shares a surface feature with gaps: a failed result looks like trouble, a matching criteria count hides the gap.
const lookalike = (x: Row, gap: Row) => (x.rule === 'missing_link' ? x.values.includes('failed') : x.rule === 'pair' && x.values.length === gap.values.length)

// Step k mixes k control patterns. Steps 1 and 2 keep look-alikes out, steps 4 and 5 bring them in first.
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

const wave = (rule: string, step: number, seed: number) => {
  const from = rows.filter((x) => x.rule === rule && x.research === unseen(seed))
  // gaps take turns, so consecutive seeds show every gap run before any repeats
  const gaps = shuffle(rng(order.indexOf(rule) + 7), from.filter((x) => x.gap))
  const gap = gaps[seed % gaps.length]!
  const r = rng(seed)
  const choice = shuffle(r, [gap, ...controls(r, from.filter((x) => !x.gap), gap, counts[step - 1]! - 1, step)])
  return { symbols: choice.map(clue), answers: choice.flatMap((x, i) => (x.gap ? [i] : [])), ids: choice.map((x) => x.id) }
}

const byId = new Map(rows.map((r) => [r.id, r]))
export const rowOf = (id: string) => byId.get(id)!
export const gapRow = (w: Wave) => rowOf(w.ids![w.answers[0]!]!)

export const observations: Deck = {
  id: 'observations',
  steps: 5,
  policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
  rules: order.map((id): Rule => ({ id, make: (step, seed) => wave(id, step, seed) })),
  choiceRecords: (w): ChoiceRecord[] => w.ids!.map((id) => {
    const r = byId.get(id)!
    return { id, clue: clue(r), rule: r.rule, values: r.values, url: r.run, signs: signs(r) }
  }),
  typical: (w) => typicality(gapRow(w)) >= ATYPICAL,
  poolSize: 8,
  // the AI gets the task the players get: no rule is named
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
