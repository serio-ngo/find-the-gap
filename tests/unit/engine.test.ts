import { describe, expect, it } from 'vitest'
import {
  advance, aiBody, aiScore, begin, canonical, estimate, pool, replay, rng, score, shoot, upcoming, wave,
} from '../../src/game/engine.ts'
import type { AiRun, Deck, Game, Spec, Wave } from '../../src/game/engine.ts'

const policy = { high: 0.8, low: 0.55, window: 4, confirm: 2 }

const rule = (id: string) => ({
  id,
  make: (step: number, seed: number) => ({
    symbols: Array.from({ length: step + 2 }, (_, i) => `${id}${step}-${i}`),
    answers: [seed % 2],
    evidence: 'ev',
  }),
})

const sequence: Spec[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ rule: 'a', step: 1, seed: i + 1 })),
  { rule: 'research', step: 1, seed: 99 },
]

const deck: Deck = {
  id: 'tiny',
  steps: 3,
  policy,
  rules: [rule('a'), rule('b'), rule('c')],
  research: () => ({ symbols: ['x', 'y', 'z'], answers: [], evidence: 'ev' }),
  poolSize: 3,
  evidence: [],
  question: 'q',
  levels: [{ id: 1, start: { rule: 'a', step: 1 }, sequence }],
}

const picks = [0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 0]

describe('engine', () => {
  it('advance moves the step by the thresholds and clamps it', () => {
    expect(advance(deck, { rule: 'a', step: 1, streak: 0 }, 0.8)).toMatchObject({ rule: 'a', step: 2, switched: false })
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.55)).toMatchObject({ step: 2, switched: false })
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.54)).toMatchObject({ step: 1, switched: false })
    expect(advance(deck, { rule: 'a', step: 3, streak: 0 }, 0.9)).toMatchObject({ step: 3, streak: 1, switched: false })
    expect(advance(deck, { rule: 'a', step: 1, streak: 0 }, 0.3)).toMatchObject({ step: 1, streak: 1, switched: false })
  })

  it('advance switches rule after two confirming waves at a limit', () => {
    expect(advance(deck, { rule: 'b', step: 3, streak: 1 }, 0.9)).toMatchObject({ rule: 'c', step: 2, streak: 0, switched: true })
    expect(advance(deck, { rule: 'b', step: 1, streak: 1 }, 0.3)).toMatchObject({ rule: 'a', step: 1, streak: 0, switched: true })
    expect(advance(deck, { rule: 'c', step: 3, streak: 1 }, 0.9)).toMatchObject({ rule: 'c', step: 3 })
    expect(advance(deck, { rule: 'a', step: 1, streak: 1 }, 0.3)).toMatchObject({ rule: 'a', step: 1 })
  })

  it('estimate uses the last four non-research waves of the current rule', () => {
    const d = (r: string, hit: boolean | null) => ({ spec: { rule: r, step: 1, seed: 1 }, pick: 0, hit })
    const g: Game = {
      mode: 'adaptive', level: 1, rule: 'a', step: 1, streak: 0,
      decisions: [d('a', true), d('a', true), d('b', false), d('a', true), d('research', null), d('a', false), d('a', false), d('a', false)],
    }
    expect(estimate(deck, g)).toBe(0.35)
    expect(estimate(deck, { ...g, decisions: [] })).toBe(0.5)
  })

  it('shoot is pure and scores research waves as null', () => {
    const g = begin(deck, 1, 'standard')
    const before = JSON.stringify(g)
    const next = shoot(deck, g, 0)
    expect(JSON.stringify(g)).toBe(before)
    expect(next.decisions).toHaveLength(1)
    expect(next.decisions[0].hit).toBe(wave(deck, sequence[0]).answers.includes(0))
    const end = picks.reduce((acc, p) => shoot(deck, acc, p), g)
    expect(end.decisions[10].hit).toBeNull()
    const expected = sequence.slice(0, 10).filter((s, i) => wave(deck, s).answers.includes(picks[i])).length
    expect(score(end)).toBe(expected)
  })

  it('replay equals folding shoot over the picks and repeats exactly', () => {
    for (const mode of ['standard', 'adaptive'] as const) {
      const folded = picks.reduce((g, p) => shoot(deck, g, p), begin(deck, 1, mode))
      expect(replay(deck, 1, mode, picks)).toEqual(folded)
      expect(replay(deck, 1, mode, picks)).toEqual(replay(deck, 1, mode, picks))
    }
  })

  it('upcoming is deterministic and draws adaptive seeds from the pool', () => {
    const g = begin(deck, 1, 'adaptive')
    const spec = upcoming(deck, g)
    expect(upcoming(deck, begin(deck, 1, 'adaptive'))).toEqual(spec)
    expect(pool(deck, g.rule, g.step)).toContainEqual(spec)
    expect(spec).toEqual(pool(deck, g.rule, g.step)[Math.floor(rng(100)() * deck.poolSize)])
    expect(upcoming(deck, begin(deck, 1, 'standard'))).toEqual(sequence[0])
  })

  it('adaptive never repeats the previous seed', () => {
    let g = begin(deck, 1, 'adaptive')
    for (let i = 0; i < 10; i++) {
      const spec = upcoming(deck, g)!
      expect(spec.seed).not.toBe(g.decisions.at(-1)?.spec.seed)
      g = shoot(deck, g, 0)
    }
  })

  it('aiScore counts right AI choices and skips research', () => {
    const g = replay(deck, 1, 'standard', picks)
    const choices = sequence.map((s, i) =>
      i === 10 ? 'r0' : i % 2 === 0 ? `r${wave(deck, s).answers[0]}` : 'r2',
    )
    const run: AiRun = {
      hash: 'h', model: 'm', date: 'd', pool: {}, spread: { choiceDiffs: 0, maxProbDiff: 0 },
      standard: { 1: choices.map((choice) => ({ choice, probabilities: {} })) },
    }
    expect(aiScore(deck, run, g)).toBe(5)
  })

  it('aiBody holds rocks and history but never the current answers', () => {
    const w: Wave = { rule: 'a', step: 1, seed: 1, symbols: ['sym-cur-0', 'sym-cur-1'], answers: [4242], evidence: 'ev' }
    const h: Wave = { rule: 'a', step: 1, seed: 2, symbols: ['sym-his-0', 'sym-his-1'], answers: [4141], evidence: 'ev' }
    const text = JSON.stringify(aiBody(deck, w, [h]))
    expect(text).toContain('sym-cur-0')
    expect(text).toContain('sym-his-0')
    expect(text).toContain('4141')
    expect(text).not.toContain('4242')
    expect((aiBody(deck, w, []) as { state: { history: unknown[] } }).state.history).toEqual([])
  })

  it('canonical sorts keys', () => {
    expect(canonical({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}')
  })
})
