import { rng } from '../engine.ts'
import type { ChoiceRecord, Deck, Rule } from '../engine.ts'
import { rows } from './rows.ts'

export type Row = { id: string; rule: string; roles: string[]; values: string[]; gap: boolean; research: boolean; run: string }

export const gapOf: Record<string, (values: string[]) => boolean> = {
  odd_revision: (v) => v[0] !== v[1],
  missing_link: (v) => v.includes('missing'),
  pair: (v) => new Set(v).size < v.length,
}

const order = ['odd_revision', 'missing_link', 'pair']
const counts = [4, 5, 6, 6, 7]
const status: Record<string, string> = { passed: 'signal', failed: 'copper', missing: 'void' }
const hues = ['signal', 'copper', 'violet', 'rose', 'lime']
const WAVES = 20

for (const r of rows) {
  if (gapOf[r.rule]?.(r.values) !== r.gap) throw new Error(`row ${r.id} breaks its rule`)
}

export const clue = (r: Row) => r.roles.map((role, i) => `${role} ${r.values[i]}`).join(' · ')
export const cells = (r: Row) => r.values.map((v) => (r.rule === 'missing_link' ? status[v]! : hues[r.values.indexOf(v)]!))

const shuffle = <T>(r: () => number, a: T[]) => a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])
const distinct = (a: Row[], n: number) => a.filter((x, i) => a.findIndex((y) => clue(y) === clue(x)) === i).slice(0, n)

const choose = (r: () => number, from: Row[], n: number, research: boolean) => {
  if (research) return distinct(shuffle(r, from), n)
  const gap = shuffle(r, from.filter((x) => x.gap))[0]!
  return shuffle(r, [gap, ...distinct(shuffle(r, from.filter((x) => !x.gap)), n - 1)])
}

const wave = (rule: string, n: number, seed: number, research: boolean) => {
  const choice = choose(rng(seed), rows.filter((x) => x.rule === rule && x.research === research), n, research)
  return { symbols: choice.map(clue), answers: research ? [] : choice.flatMap((x, i) => (x.gap ? [i] : [])), ids: choice.map((x) => x.id) }
}

const byId = new Map(rows.map((r) => [r.id, r]))

export const observations: Deck = {
  id: 'observations',
  steps: 5,
  policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
  rules: order.map((id): Rule => ({ id, make: (step, seed) => wave(id, counts[step - 1]!, seed, false) })),
  research: (_step, seed) => wave(order[seed % order.length]!, 4, seed, true),
  choiceRecords: (w): ChoiceRecord[] => w.ids!.map((id) => {
    const r = byId.get(id)!
    return { id, clue: clue(r), cells: cells(r), url: r.run }
  }),
  poolSize: 8,
  question:
    'Each rock is the evidence of one public gate run. odd_revision: the reported and the tested commit should be the same. missing_link: every criterion should have a test result. pair: every criterion should have its own test. Exactly one rock breaks the rule of the wave; pick it. A research wave may have none.',
  levels: order.map((rule, k) => ({
    id: k + 1,
    start: { rule, step: 1 },
    anchors: Array.from({ length: WAVES }, (_, i) => i),
    sequence: [
      ...Array.from({ length: WAVES }, (_, i) => ({ rule, step: 1 + Math.floor(i / 4), seed: k * 100 + i })),
      { rule: 'research', step: 1, seed: 900 + k },
    ],
  })),
}
