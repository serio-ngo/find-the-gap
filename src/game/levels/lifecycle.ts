import { rng } from '../engine.ts'
import type { Deck, Evidence, Rule } from '../engine.ts'

export type Facts = {
  criteria: [string, string][]
  reportSha: string
  testedSha: string
  baseSha: string
  expected: string
  received: string
}

const T1 = 'Add with an empty field shows the empty-field message in the result'
const T2 = 'Filling both numbers after the empty-field message shows their sum'
const T3 = 'Clear empties the empty-field message'

export const facts: Facts = {
  criteria: [['AC1', T1], ['AC2', T1], ['AC3', T2], ['AC4', T3]],
  reportSha: '26dd775',
  testedSha: '237c08c',
  baseSha: '236fd0a',
  expected: '5.00',
  received: '5.000',
}

const counts = [4, 5, 6, 6, 7]
const prefixes = [7, 4, 3, 2, 2]
const glyphs = ['◆', '▲', '■']
const alike = ['◆', '◇', '◈']
const extra = ['★', '✚', '▼']
const order = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]

const shuffle = <T>(r: () => number, a: T[]) =>
  a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

type Rock = [string, boolean]

const out = (rocks: Rock[]): [string[], number[]] => [rocks.map((x) => x[0]), rocks.flatMap((x, i) => (x[1] ? [i] : []))]

const evidence: Evidence[] = [
  {
    id: 'report',
    kind: 'comment',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/pull/22#issuecomment-6991893620',
    api: 'repos/serio-ngo/lifecycle-sandbox/issues/comments/6991893620',
    quote: [
      '**Acceptance: pass** for `26dd775` · test lock: locked at 41e9082',
      `| AC1 | ${T1} | passed |`,
      `| AC2 | ${T1} | passed |`,
      `| AC3 | ${T2} | passed |`,
      `| AC4 | ${T3} | passed |`,
    ],
  },
  {
    id: 'checkout',
    kind: 'job',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44411666642/job/135181131850',
    api: 'repos/serio-ngo/lifecycle-sandbox/actions/jobs/135181131850/logs',
    quote: [
      'HEAD is now at 237c08c Merge 26dd7758a637f366ed29e23451e11bf7cab2ffaf into 236fd0a07ea7dd4dff2816d950e2ecaf5bbe9034',
    ],
  },
  {
    id: 'regression',
    kind: 'run',
    url: 'https://github.com/serio-ngo/lifecycle-sandbox/actions/runs/44288017206',
    api: 'repos/serio-ngo/lifecycle-sandbox/actions/runs/44288017206',
    quote: ['Expected: "5.00"', 'Received: "5.000"'],
  },
]

export const lifecycleDeck = (f: Facts): Deck => {
  const tests = [...new Set(f.criteria.map((c) => c[1]))]
  const label = (step: number, c: [string, string]) => `${c[0]} ${(step < 3 ? glyphs : alike)[tests.indexOf(c[1])]}`
  const shared = f.criteria.map((c) => f.criteria.filter((d) => d[1] === c[1]).length > 1)
  const later = f.criteria.map((c, i) => f.criteria.slice(0, i).some((d) => d[1] === c[1]))

  const rule = (
    id: string,
    ev: string,
    g: (step: number, seed: number, r: () => number, n: number) => [string[], number[]],
  ): Rule => ({
    id,
    make: (step, seed) => {
      const [symbols, answers] = g(step, seed, rng(seed), counts[step - 1])
      return { symbols, answers, evidence: ev }
    },
  })

  const pair = rule('pair', 'report', (step, seed, r, n) => {
    const rocks = f.criteria.map((c, i): Rock => [label(step, c), shared[i]])
    if (step === 1 && seed === 0) return out(rocks)
    const tokens = shuffle(r, [f.reportSha, f.testedSha, f.baseSha, f.received])
      .slice(0, Math.max(0, n - rocks.length))
      .map((t, i): Rock => [`${t} ${extra[i]}`, false])
    return out(shuffle(r, [...rocks, ...tokens]))
  })

  const odd = rule('odd', 'checkout', (step, _seed, r, n) => {
    const k = Math.floor(r() * n)
    const p = prefixes[step - 1]
    return [Array.from({ length: n }, (_, j) => (j === k ? f.testedSha : f.reportSha).slice(0, p)), [k]]
  })

  const changed = rule('changed', 'regression', (_step, _seed, r, n) => {
    const k = Math.floor(r() * n)
    return [Array.from({ length: n }, (_, j) => `${f.expected}→${j === k ? f.received : f.expected}`), [k]]
  })

  const missing = rule('missing', 'report', (step, _seed, r) => {
    const rocks = f.criteria.map((c, i): Rock => [label(step, c), later[i]])
    return out(step === 1 ? rocks : shuffle(r, rocks))
  })

  const rules = [pair, odd, changed, missing]

  return {
    id: 'lifecycle',
    steps: 5,
    policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
    rules,
    research: () => ({
      symbols: [f.reportSha, f.testedSha, `${f.expected}→${f.received}`, label(1, f.criteria[1])],
      answers: [],
      evidence: 'report',
    }),
    poolSize: 4,
    evidence,
    question:
      'Each state has a rule: pair (two criteria show the same test glyph, pick one of them), odd (one rock shows a different commit than the rest), changed (pick the rock whose value before and after the arrow differs) or missing (pick the criterion whose test glyph already belongs to an earlier criterion). Pick the rock that answers the rule of this wave, using the rule, step, rocks and history in the state.',
    levels: rules.map((r, k) => ({
      id: k + 1,
      start: { rule: r.id, step: 1 },
      anchors: [2, 7],
      sequence: [
        ...order.map((step, i) => ({ rule: r.id, step, seed: k * 11 + i })),
        { rule: 'research', step: 3, seed: k * 11 + 10 },
      ],
    })),
  }
}

export const lifecycle: Deck = lifecycleDeck(facts)
