import { ANCHOR_POOL, rng } from '../engine.ts'
import type { ChoiceRecord, Deck, Rule, Wave } from '../engine.ts'
import { shape } from '../gen.ts'
import type { Signs } from '../gen.ts'
import { rows } from './rows.ts'

export type Context = { locks: number | null; impacts: number | null; agent: number | null; job: string | null; share: number | null; tests: number | null; criteria: number | null }
export type Row = { id: string; rule: string; roles: string[]; values: string[]; gap: boolean; research: boolean; run: string; context: Context | null }

export const gapOf: Record<string, (values: string[]) => boolean> = {
  odd_revision: (v) => v[0] !== v[1],
}

export const MANY = 56

export const level = {
  job: (c: Context | null) => (c?.job === 'success' ? 2 : c?.job ? 1 : 0),
  impacts: (c: Context | null) => Math.min(2, c?.impacts ?? 0),
  criteria: (c: Context | null) => Math.min(5, c?.criteria ?? 0),
  many: (c: Context | null) => +((c?.tests ?? 0) > MANY),
}

export const signs = (r: Row): Signs | null => r.context && (Object.fromEntries(Object.entries(level).map(([k, f]) => [k, f(r.context)])) as Signs)

const order = ['odd_revision']
export const CERTAIN = [4, 9, 14, 19]
const counts = [4, 5, 6, 6, 7]
const WAVES = 20
export const UNSEEN = 900
export const unseen = (seed: number) => seed >= UNSEEN && seed < UNSEEN + 100

for (const r of rows) {
  if (gapOf[r.rule]?.(r.values) !== r.gap) throw new Error(`row ${r.id} breaks its rule`)
}

export const clue = (r: Row) => r.roles.map((role, i) => `${role} ${r.values[i]}`).join(' · ')

export const seen = (r: Row) => {
  const f = shape({ rule: r.rule, values: r.values, signs: signs(r) }, 'iron').facts
  return [
    ...f.sides.map((s, i) => `${i ? 'right' : 'left'} half: ${s.crystals} ${s.tint} crystals, longest ${s.reach}`),
    ...(f.signs ? [`halo: ${f.arcs} arcs, ${f.lit ? 'lit' : 'dark'}`, `craters: ${f.craters}`, `alien: ${f.bright ? 'bright' : 'dim'}`] : []),
  ].join('; ')
}

export const pattern = (r: Row) => (r.values[0] === r.values[1] ? 'same' : 'differ')

const scored = rows.filter((r) => !r.research)

const key = (r: Row) => JSON.stringify(signs(r))
const base = scored.filter((r) => r.gap).length / scored.length
const looks = new Map([...new Set(scored.map(key))].map((k) => { const s = scored.filter((r) => key(r) === k); return [k, s.filter((r) => r.gap).length / s.length > base] }))
export const typical = (r: Row) => (looks.get(key(r)) ?? false) === r.gap

const shuffle = <T>(r: () => number, a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

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
  const choice = gap ? shuffle(r, [gap, ...shuffle(r, from.filter((x) => !x.gap)).slice(0, n - 1)]) : shuffle(r, from.filter((x) => !certain.includes(x))).slice(0, n)
  return { symbols: choice.map(seen), answers: choice.flatMap((x, i) => (x.gap ? [i] : [])), ids: choice.map((x) => x.id) }
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
  poolSize: 20,
  question: 'Each rock is one public gate run, described as it is drawn: its left and right half, its halo, craters and alien. Which rock does not fit with the others? Pick one.',
  typical: (w) => typical(gapRow(w)),
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
