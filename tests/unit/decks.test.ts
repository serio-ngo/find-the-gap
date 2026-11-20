import { describe, expect, it } from 'vitest'
import { pool, replay, score, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { facts, lifecycleDeck } from '../../src/game/levels/lifecycle.ts'

const { lifecycle, fixture } = decks
const counts = [4, 5, 6, 6, 7]
const prefixes = [7, 4, 3, 2, 2]
const steps = [1, 2, 3, 4, 5]
const seeds = Array.from({ length: 100 }, (_, i) => i)
const glyph = (x: string) => x.split(' ')[1]
const testOf = (x: string) => facts.criteria.find((c) => c[0] === x.split(' ')[0])?.[1]
const criteria = (s: string[]) => s.flatMap((x, i) => (testOf(x) ? [i] : []))
const definitions: Record<string, (s: string[]) => number[]> = {
  pair: (s) => criteria(s).filter((i) => criteria(s).filter((j) => testOf(s[j]) === testOf(s[i])).length > 1),
  odd: (s) => s.flatMap((x, i) => (s.filter((y) => y === x).length === 1 ? [i] : [])),
  changed: (s) => s.flatMap((x, i) => (x.split('→')[0] !== x.split('→')[1] ? [i] : [])),
  missing: (s) => criteria(s).filter((i) => facts.criteria.slice(0, facts.criteria.findIndex((c) => c[0] === s[i].split(" ")[0])).some((c) => c[1] === testOf(s[i]))),
}

describe('lifecycle rules', () => {
  for (const [rule, answers] of Object.entries(definitions)) {
    it(`${rule}: answers follow the facts`, () => {
      for (const step of steps)
        for (const seed of seeds) {
          const w = wave(lifecycle, { rule, step, seed })
          expect(w.symbols).toHaveLength(rule === 'missing' ? 4 : counts[step - 1])
          expect(w.answers).toEqual(answers(w.symbols))
        }
    })
  }

  it('pair: two answers, unique glyphs elsewhere, look-alikes from step 3', () => {
    for (const step of steps)
      for (const seed of seeds) {
        const w = wave(lifecycle, { rule: 'pair', step, seed })
        expect(w.answers).toHaveLength(2)
        const g = w.answers.map((i) => glyph(w.symbols[i]))
        expect(g[0]).toBe(g[1])
        expect(new Set(w.symbols.map(glyph)).size).toBe(w.symbols.length - 1)
        expect(w.symbols.some((x) => x.endsWith('◇'))).toBe(step >= 3)
      }
  })

  it('odd: one tested sha among report shas, prefix shrinks with the step', () => {
    for (const step of steps)
      for (const seed of seeds) {
        const w = wave(lifecycle, { rule: 'odd', step, seed })
        expect(w.answers).toHaveLength(1)
        expect(w.symbols[w.answers[0]]).toBe(facts.testedSha.slice(0, prefixes[step - 1]))
        expect(new Set(w.symbols).size).toBe(2)
        expect(w.symbols.filter((x) => x === facts.reportSha.slice(0, prefixes[step - 1]))).toHaveLength(w.symbols.length - 1)
      }
  })

  it('changed: one received value among unchanged expected values', () => {
    const w = wave(lifecycle, { rule: 'changed', step: 5, seed: 3 })
    expect(w.symbols[w.answers[0]]).toBe('5.00→5.000')
    expect(w.symbols.filter((x) => x === '5.00→5.00')).toHaveLength(6)
  })

  it('missing: AC2 has no test of its own', () => {
    for (const step of steps)
      for (const seed of seeds) {
        const w = wave(lifecycle, { rule: 'missing', step, seed })
        expect(w.answers).toHaveLength(1)
        expect(w.symbols[w.answers[0]]).toMatch(/^AC2 /)
      }
  })

  it('changing a fact changes the answers', () => {
    const t = (c: [string, string][]) => lifecycleDeck({ ...facts, criteria: c })
    const moved = t([['AC1', 'a'], ['AC2', 'b'], ['AC3', 'b'], ['AC4', 'c']])
    const w = (d: typeof lifecycle, rule: string) => wave(d, { rule, step: 1, seed: 1 })
    expect(wave(moved, { rule: 'pair', step: 1, seed: 0 }).answers).toEqual([1, 2])
    expect(w(moved, 'missing').symbols[w(moved, 'missing').answers[0]]).toMatch(/^AC3 /)
    const sha = lifecycleDeck({ ...facts, testedSha: '999c08c' })
    expect(w(sha, 'odd').symbols).not.toEqual(w(lifecycle, 'odd').symbols)
    expect(w(lifecycleDeck({ ...facts, received: '5.0' }), 'changed').symbols).toContain('5.00→5.0')
  })

  it('uses no token outside the facts', () => {
    const tokens = [
      ...facts.criteria.map((c) => c[0]), facts.reportSha, facts.testedSha, facts.baseSha, facts.expected, facts.received,
    ]
    const glyphs = new Set(['◆', '▲', '■', '◇', '◈', '★', '✚', '▼', '→'])
    const specs = [
      ...lifecycle.levels.flatMap((l) => l.sequence),
      ...lifecycle.rules.flatMap((r) => steps.flatMap((step) => pool(lifecycle, r.id, step))),
    ]
    for (const s of specs)
      for (const x of wave(lifecycle, s).symbols)
        for (const part of x.split(/[ →]/)) {
          const known = tokens.some((t) => t.startsWith(part)) || glyphs.has(part)
          expect(known, x).toBe(true)
        }
  })

  it('is deterministic', () => {
    for (const rule of Object.keys(definitions)) {
      const s = { rule, step: 4, seed: 7 }
      expect(wave(lifecycle, s)).toEqual(wave(lifecycle, s))
    }
  })

  it('level 1 wave 0 is the lecture case', () => {
    const w = wave(lifecycle, lifecycle.levels[0].sequence[0])
    expect(w.rule).toBe('pair')
    expect(w.symbols.map((x) => x.split(' ')[0])).toEqual(['AC1', 'AC2', 'AC3', 'AC4'])
    expect(w.answers).toEqual([0, 1])
    expect(glyph(w.symbols[0])).toBe(glyph(w.symbols[1]))
    expect(new Set(w.symbols.map(glyph)).size).toBe(3)
  })

  it('levels hold 11 specs with research last and distinct seeds', () => {
    expect(lifecycle.levels.map((l) => l.start.rule)).toEqual(['pair', 'odd', 'changed', 'missing'])
    const seen = new Set<number>()
    for (const l of lifecycle.levels) {
      expect(l.sequence).toHaveLength(11)
      expect(l.sequence.map((s) => s.step).slice(0, 10)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 3])
      expect(l.sequence[10].rule).toBe('research')
      expect(wave(lifecycle, l.sequence[10]).answers).toEqual([])
      l.sequence.forEach((s) => seen.add(s.seed))
    }
    expect(seen.size).toBe(44)
  })

  it('every wave evidence resolves', () => {
    const ids = new Set(lifecycle.evidence.map((e) => e.id))
    const specs = [
      ...lifecycle.levels.flatMap((l) => l.sequence),
      ...lifecycle.rules.map((r) => ({ rule: r.id, step: 1, seed: 0 })),
    ]
    for (const s of specs) expect(ids.has(wave(lifecycle, s).evidence)).toBe(true)
    expect(wave(lifecycle, { rule: 'odd', step: 1, seed: 0 }).evidence).toBe('checkout')
    expect(wave(lifecycle, { rule: 'changed', step: 1, seed: 0 }).evidence).toBe('regression')
  })

  it('has a question', () => {
    expect(lifecycle.question).toMatch(/rule/)
  })
})

describe('fixture deck', () => {
  it('runs to the end through replay', () => {
    const level = fixture.levels[0]
    expect(level.sequence).toHaveLength(5)
    expect(fixture.rules.map((r) => r.id)).toEqual(['colour', 'count'])
    const picks = level.sequence.map((s) => wave(fixture, s).answers[0])
    const g = replay(fixture, 1, 'standard', picks)
    expect(score(g)).toBe(5)
  })
})
