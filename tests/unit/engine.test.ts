import { describe, expect, it } from 'vitest'
import {
  advance, aiBody, aiPick, band, begin, canonical, estimate, pool, report, rng, score, shoot, stepBody, upcoming, wave,
} from '../../src/game/engine.ts'
import type { AiRun, Deck, Game, Spec, Wave } from '../../src/game/engine.ts'
import { replay } from '../replay.ts'

const policy = { high: 0.8, low: 0.55, window: 4, confirm: 2 }

const rule = (id: string) => ({
  id,
  make: (step: number, seed: number) => ({
    symbols: Array.from({ length: step + 2 }, (_, i) => `${id}${step}-${i}`),
    answers: [seed % 2],
  }),
})

const sequence: Spec[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ rule: 'a', step: 1, seed: i + 1 })),
  { rule: 'b', step: 1, seed: 99 },
]

const deck: Deck = {
  id: 'tiny',
  steps: 3,
  policy,
  rules: [rule('a'), rule('b'), rule('c')],
  poolSize: 3,
  question: 'q',
  levels: [{ id: 1, start: { rule: 'a', step: 1 }, anchors: [3, 4], sequence, tail: 1 }],
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

  it('estimate uses the last four waves of the current rule', () => {
    const d = (r: string, hit: boolean) => ({ spec: { rule: r, step: 1, seed: 1 }, pick: 0, hit, anchor: false, secs: 0 })
    const g: Game = {
      mode: 'adaptive', level: 1, rule: 'a', step: 1, streak: 0,
      decisions: [d('a', true), d('a', true), d('b', false), d('a', true), d('b', true), d('a', false), d('a', false), d('a', false)],
    }
    expect(estimate(deck, g)).toBe(0.35)
    expect(estimate(deck, { ...g, decisions: [] })).toBe(0.5)
  })

  it('shoot is pure and scores every wave against its answer', () => {
    const g = begin(deck, 1, 'standard')
    const before = JSON.stringify(g)
    const next = shoot(deck, g, 0)
    expect(JSON.stringify(g)).toBe(before)
    expect(next.decisions).toHaveLength(1)
    expect(next.decisions[0].hit).toBe(wave(deck, sequence[0]).answers.includes(0))
    const end = picks.reduce((acc, p) => shoot(deck, acc, p), g)
    expect(end.decisions[10].hit).toBe(wave(deck, sequence[10]).answers.includes(picks[10]))
    expect(end.decisions.map((x) => x.anchor)).toEqual(picks.map((_, i) => i === 3 || i === 4))
    expect(score(end)).toBe(400)
  })

  it('shoot with live moves the step by the float; without it the result is the estimate', () => {
    const g = { ...begin(deck, 1, 'adaptive'), step: 2 }
    for (const pick of [0, 1]) {
      const up = shoot(deck, g, pick, 0, { hit: 0.9, miss: 0.9 })
      const down = shoot(deck, g, pick, 0, { hit: 0.1, miss: 0.1 })
      const split = shoot(deck, g, pick, 0, { hit: 0.9, miss: 0.1 })
      expect([up.step, down.step]).toEqual([3, 1])
      expect(split.step).toBe(split.decisions[0].hit ? 3 : 1)
      const next = { ...g, decisions: split.decisions }
      expect(shoot(deck, g, pick).step).toBe(advance(deck, g, estimate(deck, next)).step)
    }
  })

  it('band edges', () => {
    expect([2.99, 3, 7.99, 8].map(band)).toEqual([0, 1, 1, 2])
  })

  it('stepBody adds if_hit and if_miss and never the current answer', () => {
    const w = wave(deck, sequence[5])
    const past = Array.from({ length: 4 }, (_, i) => ({ w: wave(deck, sequence[i]), hit: i % 2 === 0, tempo: band(i * 3) }))
    const body = stepBody(deck, w, past) as any
    expect(Object.keys(body.questions)).toEqual(['ai', 'if_hit', 'if_miss'])
    expect(body.questions.ai).toEqual((aiBody(deck, w, []) as any).questions.ai)
    expect(Object.keys(body.questions.if_hit.criteria)).toEqual(['hit', 'miss'])
    expect(body.state.history).toHaveLength(3)
    expect(body.state.history[2]).toMatchObject({ hit: false, tempo: 2 })
    expect(body.state).not.toHaveProperty('answers')
  })

  it('score counts only anchor hits: 100 plus up to 100 for speed', () => {
    const at = (secs: number[]) =>
      secs.reduce((g, s, i) => shoot(deck, g, picks[i], s), begin(deck, 1, 'standard'))
    expect(score(at([0, 0, 0, 0, 0]))).toBe(400)
    expect(score(at([0, 0, 0, 3, 20]))).toBe(270)
    expect(score(replay(deck, 1, 'standard', [1, 1, 1, 1, 0]))).toBe(0)
    expect(score(replay(deck, 1, 'standard', [0, 0, 0, 0, 0]))).toBe(200)
  })

  it('upcoming is deterministic and draws adaptive seeds from the pool', () => {
    const g = begin(deck, 1, 'adaptive')
    const spec = upcoming(deck, g)
    expect(upcoming(deck, begin(deck, 1, 'adaptive'))).toEqual(spec)
    expect(pool(deck, g.rule, g.step)).toContainEqual(spec)
    expect(spec).toEqual(pool(deck, g.rule, g.step)[Math.floor(rng(100)() * deck.poolSize)])
    expect(upcoming(deck, begin(deck, 1, 'standard'))).toEqual(sequence[0])
  })

  it('adaptive mode plays the fixed tail from the sequence, and only fixed waves take the stored AI pick', () => {
    let g = begin(deck, 1, 'adaptive')
    for (let i = 0; i < 10; i++) g = shoot(deck, g, 0)
    expect(upcoming(deck, g)).toEqual(sequence[10])
    g = shoot(deck, g, 0)
    expect(upcoming(deck, g)).toBeNull()
    const run: AiRun = { hash: '', model: '', date: '', standard: { 1: sequence.map((_, i) => i % 3) } }
    expect(g.decisions.map((_, i) => aiPick(run, deck, g, i))).toEqual([...Array(10).fill(undefined), 1])
    const s = replay(deck, 1, 'standard', picks)
    expect(s.decisions.map((_, i) => aiPick(run, deck, s, i))).toEqual(run.standard[1])
  })

  it('adaptive never repeats the previous seed', () => {
    let g = begin(deck, 1, 'adaptive')
    for (let i = 0; i < 10; i++) {
      const spec = upcoming(deck, g)!
      expect(spec.seed).not.toBe(g.decisions.at(-1)?.spec.seed)
      g = shoot(deck, g, 0)
    }
  })

  it('report compares you, the AI and chance on scored waves only, split by typical and atypical patterns', () => {
    const g = replay(deck, 1, 'standard', picks)
    expect(report(deck, g).typical).toBeNull()
    g.decisions.forEach((d, i) => (d.ai = i === 3 ? 1 : i === 4 ? null : d.pick))
    expect(report(deck, g).all).toEqual({ you: 2, ai: 0, aiN: 1, chance: 1 / 3 + 1 / 3, n: 2 })
    const typed = { ...deck, typical: (w: Wave) => w.seed === 4 }
    expect(report(typed, g).typical).toEqual({ you: 1, ai: 0, aiN: 1, chance: 1 / 3, n: 1 })
    expect(report(typed, g).atypical).toEqual({ you: 1, ai: 0, aiN: 0, chance: 1 / 3, n: 1 })
  })

  it('aiBody holds rocks and history but never the current answers', () => {
    const w: Wave = { rule: 'a', step: 1, seed: 1, symbols: ['sym-cur-0', 'sym-cur-1'], answers: [4242] }
    const h: Wave = { rule: 'a', step: 1, seed: 2, symbols: ['sym-his-0', 'sym-his-1'], answers: [4141] }
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
