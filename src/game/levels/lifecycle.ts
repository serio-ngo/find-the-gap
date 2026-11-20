import { rng } from '../engine.ts'
import type { Deck, Evidence, Rule } from '../engine.ts'
import { regressionJobId, sandboxUrl, workflowStages } from './records.ts'
import type { ChoiceRecord, Origin, StageRecord } from './records.ts'

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

export const revisions = {
  reportSha: '26dd7758a637f366ed29e23451e11bf7cab2ffaf',
  testedSha: '237c08c8198e72447e4836318e3297069fb8a5bf',
  baseSha: '236fd0a07ea7dd4dff2816d950e2ecaf5bbe9034',
}

const counts = [4, 5, 6, 6, 7]
const prefixes = [7, 4, 3, 2, 2]
const glyphs = ['◆', '▲', '■']
const alike = ['◆', '◇', '◈']
const extra = ['★', '✚', '▼']
const order = [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]

const shuffle = <T>(r: () => number, a: T[]) =>
  a.map((x) => [r(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1])

type Revision = keyof typeof revisions
type Field = number | Revision | 'received' | 'comparison' | 'control'
type Rock = [string, boolean, Field]

const waveData = (rocks: Rock[], evidence: string) => ({
  symbols: rocks.map(([clue]) => clue),
  answers: rocks.flatMap(([, hit], i) => (hit ? [i] : [])),
  evidence,
})

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

const [report, checkout, regression] = evidence
const regressionJob = `${regression.url}/job/${regressionJobId}`
const reportStages = workflowStages(22)
const regressionStages = workflowStages(20)
const failedStages = regressionStages.slice(0, 4)
// Every recorded step output can be a choice's own context; a wave never repeats one (at most 7 choices, 40+ outputs).
const contextsFor = (stages: StageRecord[]) => stages.flatMap(({ url, steps }) => steps.map((quote) => ({ url, quote })))

export const lifecycleDeck = (f: Facts): Deck => {
  const tests = [...new Set(f.criteria.map((c) => c[1]))]
  const label = (step: number, c: [string, string]) => `${c[0]} ${(step < 3 ? glyphs : alike)[tests.indexOf(c[1])]}`
  const shared = f.criteria.map((c) => f.criteria.filter((d) => d[1] === c[1]).length > 1)
  const later = f.criteria.map((c, i) => f.criteria.slice(0, i).some((d) => d[1] === c[1]))

  const rule = (
    id: string,
    ev: string,
    g: (step: number, seed: number, r: () => number, n: number) => Rock[],
  ): Rule & { rocks: (step: number, seed: number) => Rock[] } => {
    const rocks = (step: number, seed: number) => g(step, seed, rng(seed), counts[step - 1])
    return { id, rocks, make: (step, seed) => waveData(rocks(step, seed), ev) }
  }

  const pair = rule('pair', 'report', (step, seed, r, n) => {
    const rocks = f.criteria.map((c, i): Rock => [label(step, c), shared[i], i])
    if (step === 1 && seed === 0) return rocks
    const fields = ['reportSha', 'testedSha', 'baseSha', 'received'] as const
    const tokens = shuffle(r, [...fields])
      .slice(0, Math.max(0, n - rocks.length))
      .map((field, i): Rock => [`${f[field]} ${extra[i]}`, false, field])
    return shuffle(r, [...rocks, ...tokens])
  })

  const odd = rule('odd', 'checkout', (step, _seed, r, n) => {
    const k = Math.floor(r() * n)
    const p = prefixes[step - 1]
    return Array.from({ length: n }, (_, j) => {
      const field = j === k ? 'testedSha' : 'reportSha'
      return [f[field].slice(0, p), j === k, field]
    })
  })

  const changed = rule('changed', 'regression', (_step, _seed, r, n) => {
    const k = Math.floor(r() * n)
    return Array.from({ length: n }, (_, j) => [
      `${f.expected}→${j === k ? f.received : f.expected}`, j === k, j === k ? 'comparison' : 'control',
    ])
  })

  const missing = rule('missing', 'report', (step, _seed, r) => {
    const rocks = f.criteria.map((c, i): Rock => [label(step, c), later[i], i])
    return step === 1 ? rocks : shuffle(r, rocks)
  })

  const rules = [pair, odd, changed, missing]
  const researchRocks = (): Rock[] => [
    [f.reportSha, false, 'reportSha'],
    [f.testedSha, false, 'testedSha'],
    [`${f.expected}→${f.received}`, false, 'comparison'],
    [label(1, f.criteria[1]), false, 1],
  ]

  const regressionSource = (field: 'expected' | 'received'): Origin[] => f[field] === facts[field]
    ? [{ url: regressionJob, quote: regression.quote[field === 'expected' ? 0 : 1] }]
    : []
  const revisionSources = (field: Revision): Origin[] => f[field] === facts[field] ? [
    { url: field === 'reportSha' ? report.url : checkout.url, quote: field === 'reportSha' ? report.quote[0] : checkout.quote[0] },
    { url: `${sandboxUrl}/commit/${revisions[field]}`, quote: `sha: ${revisions[field]}` },
  ] : []

  const record = ([clue, , field]: Rock, stages: StageRecord[], context: Origin): ChoiceRecord => {
    const base = { clue, stages, context }
    if (typeof field === 'number') {
      const [id, name] = f.criteria[field]
      const quote = `| ${id} | ${name} | passed |`
      return { ...base, marks: [id, clue.split(' ')[1], name], sources: report.quote.includes(quote) ? [{ url: report.url, quote }] : [] }
    }
    if (field === 'comparison' || field === 'control') {
      const other = field === 'control' ? 'expected' : 'received'
      return {
        ...base, marks: [f.expected, f[other]], sources: [...regressionSource('expected'), ...regressionSource(other)],
        ...(field === 'control' ? { constructed: true } : {}),
      }
    }
    return {
      ...base, marks: clue.split(' '), sources: field === 'received' ? regressionSource(field) : revisionSources(field),
    }
  }

  return {
    id: 'lifecycle',
    steps: 5,
    policy: { high: 0.8, low: 0.55, window: 4, confirm: 2 },
    rules,
    research: () => waveData(researchRocks(), 'report'),
    choiceRecords: ({ rule, step, seed }) => {
      const ruleIndex = rules.findIndex((r) => r.id === rule)
      const rocks = rule === 'research' ? researchRocks() : rules[ruleIndex].rocks(step, seed)
      const contextRng = rng(seed ^ Math.imul(step * (rules.length + 1) + ruleIndex, 0x9e3779b1))
      const timeline = (stages: StageRecord[]) => ({ stages, contexts: shuffle(contextRng, contextsFor(stages)) })
      const reporting = timeline(reportStages)
      const regression = timeline(rule === 'research' ? regressionStages : failedStages)
      return rocks.map((rock, i) => {
        const field = rock[2]
        const { stages, contexts } = field === 'received' || field === 'comparison' || field === 'control' ? regression : reporting
        return record(rock, stages, contexts[i % contexts.length])
      })
    },
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
