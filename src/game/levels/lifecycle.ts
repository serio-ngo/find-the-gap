import { rng } from '../engine.ts'
import type { Deck, Evidence, Rule } from '../engine.ts'

const counts = [4, 5, 6, 6, 7]
const shas = ['26dd775', '237c08c', '236fd0a']
const values = ['5.00', '1.50', '12', '0.25', '7.5']
const glyphs = ['▲', '■', '●', '◆', '★', '✚', '▼']
const alike = ['◆', '◇', '●', '○', '■', '□']
const hex = '0123456789abcdef'
const order = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]

const shuffle = <T>(r: () => number, a: T[]) =>
  a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

const rule = (
  id: string,
  evidence: string,
  f: (step: number, seed: number, r: () => number, n: number) => [string[], number[]],
): Rule => ({
  id,
  make: (step, seed) => {
    const [symbols, answers] = f(step, seed, rng(seed), counts[step - 1])
    return { symbols, answers, evidence }
  },
})

const pair = rule('pair', 'report', (step, seed, r, n) => {
  if (step === 1 && seed === 0) return [['◆', '◆', '●', '▲'], [0, 1]]
  const g = shuffle(r, step < 3 ? glyphs : alike).slice(0, n - 1)
  const symbols = shuffle(r, [...g, g[0]])
  return [symbols, symbols.flatMap((s, i) => (s === g[0] ? [i] : []))]
})

const odd = rule('odd', 'checkout', (step, _seed, r, n) => {
  const i = Math.floor(r() * 3)
  const k = Math.floor(r() * n)
  const p = Math.floor(r() * 7)
  const a = shas[i]
  const b =
    step < 3
      ? shas[(i + 1 + Math.floor(r() * 2)) % 3]
      : a.slice(0, p) + hex[(hex.indexOf(a[p]) + 1 + Math.floor(r() * 15)) % 16] + a.slice(p + 1)
  return [Array.from({ length: n }, (_, j) => (j === k ? b : a)), [k]]
})

const changed = rule('changed', 'regression', (step, _seed, r, n) => {
  const k = Math.floor(r() * n)
  const symbols = Array.from({ length: n }, (_, i) => {
    const j = Math.floor(r() * 5)
    const x = values[j]
    if (i !== k) return `${x}→${x}`
    return step < 3 ? `${x}→${values[(j + 1 + Math.floor(r() * 4)) % 5]}` : `${x}→${x}0`
  })
  return [symbols, [k]]
})

const missing = rule('missing', 'report', (step, _seed, r, n) => {
  const m = (n + 1) >> 1
  const labels = [...(step < 3 ? 'abcd' : 'oO0l')].slice(0, m)
  const gap = Math.floor(r() * m)
  const covered = labels.filter((_, i) => i !== gap)
  const extra = Array.from({ length: n - m - covered.length }, () => covered[Math.floor(r() * covered.length)])
  const symbols = shuffle(r, [...labels.map((l) => '◇' + l), ...[...covered, ...extra].map((l) => '⬡' + l)])
  return [symbols, [symbols.indexOf('◇' + labels[gap])]]
})

const evidence: Evidence[] = [
  {
    id: 'report',
    kind: 'comment',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620',
    api: 'repos/serio-ngo/lifecycle-sandbox/issues/comments/6991893620',
    lines: [
      ['Acceptance: pass', '26dd775'],
      ['AC1', 'Add with an empty field shows the empty-field message in the result'],
      ['AC2', 'Add with an empty field shows the empty-field message in the result'],
      ['AC3', 'Filling both numbers after the empty-field message shows their sum'],
      ['AC4', 'Clear empties the empty-field message'],
    ],
  },
  {
    id: 'checkout',
    kind: 'job',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44411666642/job/135181131850',
    api: 'repos/serio-ngo/lifecycle-sandbox/actions/jobs/135181131850/logs',
    lines: [['HEAD is now at 237c08c', 'Merge 26dd7758']],
  },
  {
    id: 'regression',
    kind: 'run',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206',
    api: 'repos/serio-ngo/lifecycle-sandbox/actions/runs/44288017206',
    lines: [['Expected: "5.00"'], ['Received: "5.000"']],
  },
]

const rules = [pair, odd, changed, missing]

export const lifecycle: Deck = {
  id: 'lifecycle',
  steps: 5,
  policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
  rules,
  research: () => ({ symbols: ['26dd775', '237c08c', '5.00→5.000', '◇b'], answers: [], evidence: 'report' }),
  poolSize: 4,
  evidence,
  question:
    'Each state has a rule: pair (two rocks show the same symbol, pick one of them), odd (one rock differs from the rest), changed (pick the rock whose value before and after the arrow differs) or missing (pick the ◇ criterion that has no matching ⬡ test). Pick the rock that answers the rule of this wave, using the rule, step, rocks and history in the state.',
  levels: rules.map((r, k) => ({
    id: k + 1,
    start: { rule: r.id, step: 1 },
    sequence: [
      ...order.map((step, i) => ({ rule: r.id, step, seed: k * 11 + i })),
      { rule: 'research', step: 3, seed: k * 11 + 10 },
    ],
  })),
}
