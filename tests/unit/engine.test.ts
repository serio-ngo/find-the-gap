import { describe, expect, it } from 'vitest'
import {
  ANCHOR_POOL, advance, aiBody, aiPick, band, begin, canonical, estimate, pool, report, rng, score, shoot, stepBody, upcoming, wave,
} from '../../src/game/engine.ts'
import type { AiRun, Deck, Game, Spec, Wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
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
    expect(advance(deck, { rule: 'a', step: 1, streak: 0 }, 0.8, true)).toMatchObject({ rule: 'a', step: 2, switched: false })
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.55, false)).toMatchObject({ step: 2, switched: false })
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.54, false)).toMatchObject({ step: 1, switched: false })
    expect(advance(deck, { rule: 'a', step: 3, streak: 0 }, 0.9, true)).toMatchObject({ step: 3, streak: 1, switched: false })
    expect(advance(deck, { rule: 'a', step: 1, streak: 0 }, 0.3, false)).toMatchObject({ step: 1, streak: 1, switched: false })
  })

  it('advance holds the step when the verdict contradicts the forecast', () => {
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.9, false)).toMatchObject({ step: 2, switched: false })
    expect(advance(deck, { rule: 'a', step: 2, streak: 0 }, 0.1, true)).toMatchObject({ step: 2, switched: false })
  })

  it('advance switches rule after two confirming waves at a limit', () => {
    expect(advance(deck, { rule: 'b', step: 3, streak: 1 }, 0.9, true)).toMatchObject({ rule: 'c', step: 2, streak: 0, switched: true })
    expect(advance(deck, { rule: 'b', step: 1, streak: 1 }, 0.3, false)).toMatchObject({ rule: 'a', step: 1, streak: 0, switched: true })
    expect(advance(deck, { rule: 'c', step: 3, streak: 1 }, 0.9, true)).toMatchObject({ rule: 'c', step: 3 })
    expect(advance(deck, { rule: 'a', step: 1, streak: 1 }, 0.3, false)).toMatchObject({ rule: 'a', step: 1 })
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

  it('adaptive shoot holds the step on a research wave', () => {
    const g = { ...begin(deck, 1, 'adaptive'), step: 2 }
    expect(shoot(deck, g, 0, 0, { hit: 0.9, miss: 0.9 }).step).toBe(2)
    expect(shoot(deck, g, 0, 0, { hit: 0.1, miss: 0.1 }).step).toBe(2)
  })

  it('shoot with live steps up on a hit, down on a miss and holds when the verdict contradicts the forecast; without it the result is the estimate', () => {
    const start = { ...begin(deck, 1, 'adaptive'), step: 2 }
    const g = [0, 0, 0].reduce((acc, p) => shoot(deck, acc, p), start)
    expect(g.step).toBe(2)
    const right = wave(deck, upcoming(deck, g)!).answers[0]!
    const wrong = (right + 1) % 3
    expect(shoot(deck, g, right, 0, { hit: 0.9, miss: 0.9 }).step).toBe(3)
    expect(shoot(deck, g, wrong, 0, { hit: 0.1, miss: 0.1 }).step).toBe(1)
    expect(shoot(deck, g, wrong, 0, { hit: 0.9, miss: 0.9 }).step).toBe(2)
    for (const pick of [right, wrong]) {
      const next = shoot(deck, g, pick)
      expect(next.step).toBe(advance(deck, g, estimate(deck, { ...next, decisions: next.decisions.filter((x) => x.anchor) }), next.decisions[3]!.hit).step)
    }
  })

  it('a 4/4 game with the forecasts of a real production game steps up and never down', () => {
    const d = decks.observations!
    let g = begin(d, 1, 'adaptive')
    const steps: number[] = []
    for (let i = 0; upcoming(d, g); i++) {
      const spec = upcoming(d, g)!
      const certain = d.levels[0]!.anchors.includes(i)
      g = shoot(d, g, wave(d, spec).answers[0] ?? 0, 0, certain ? { hit: [0.55, 0.6, 0.7, 0.6][d.levels[0]!.anchors.indexOf(i)]!, miss: 0.5 } : undefined)
      if (certain) steps.push(g.step)
    }
    expect(Math.max(...steps)).toBeGreaterThan(1)
    expect(steps.every((x, i) => x >= (steps[i - 1] ?? 1))).toBe(true)
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

  it('adaptive draws unseen pool seeds, certain waves from their own pool, and falls back to the whole pool once all are used', () => {
    let g = begin(deck, 1, 'adaptive')
    const seeds = []
    for (let i = 0; i < 10; i++) {
      seeds.push(upcoming(deck, g)!.seed)
      g = shoot(deck, g, 0)
    }
    expect(new Set(seeds.slice(0, 3)).size).toBe(3)
    expect(seeds.map((x) => x - (x % 1000))).toEqual([1000, 1000, 1000, ANCHOR_POOL, ANCHOR_POOL, 1000, 1000, 1000, 1000, 1000])
    expect(seeds.every((x) => x % 1000 < 3)).toBe(true)
  })

  it('every real level plays 20 distinct adaptive seeds, one gap on each certain wave, and never shows a revealed gap again', () => {
    const d = decks.observations!
    for (const l of d.levels) {
      for (const pick of [() => 0, (s: Spec) => wave(d, s).answers[0] ?? 0]) {
        let g = begin(d, l.id, 'adaptive')
        const seeds = new Set<number>()
        const revealed: string[] = []
        for (let i = 0; i < 20; i++) {
          const s = upcoming(d, g)!
          const w = wave(d, s)
          const gaps = w.answers.map((k) => w.ids![k]!)
          expect(gaps.filter((x) => revealed.includes(x)), `level ${l.id} wave ${i}`).toEqual([])
          if (l.anchors.includes(i)) {
            expect([s.seed >= ANCHOR_POOL, gaps.length], `level ${l.id} wave ${i}`).toEqual([true, 1])
            revealed.push(gaps[0]!)
          }
          seeds.add(s.seed)
          g = shoot(d, g, pick(s))
        }
        expect(seeds.size, `level ${l.id}`).toBe(20)
      }
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

  it('aiBody and stepBody carry symbols only: no rule, no answers, no rule id, no answer values', () => {
    const w: Wave = { rule: 'rule-id-77', step: 1, seed: 1, symbols: ['sym-cur-0', 'sym-cur-1'], answers: [4242] }
    const h: Wave = { rule: 'rule-id-77', step: 1, seed: 2, symbols: ['sym-his-0', 'sym-his-1'], answers: [4141] }
    const keysOf = (v: unknown): string[] => (v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [])
    for (const body of [aiBody(deck, w, [h]), stepBody(deck, w, [{ w: h, hit: true, tempo: 1 }])]) {
      const text = JSON.stringify(body)
      expect(keysOf(body).filter((k) => k === 'rule' || k === 'answers')).toEqual([])
      for (const gone of ['rule-id-77', '4242', '4141']) expect(text).not.toContain(gone)
      for (const kept of ['sym-cur-0', 'sym-his-0']) expect(text).toContain(kept)
    }
    expect((aiBody(deck, w, []) as { state: { history: unknown[] } }).state.history).toEqual([])
  })

  it('canonical sorts keys', () => {
    expect(canonical({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}')
  })
})
