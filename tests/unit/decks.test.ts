import { describe, expect, it } from 'vitest'
import { replay, score, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'

const { lifecycle, fixture } = decks
const counts = [4, 5, 6, 6, 7]
const steps = [1, 2, 3, 4, 5]
const seeds = Array.from({ length: 100 }, (_, i) => i)
const indexes = (s: string[], f: (x: string) => boolean) => s.flatMap((x, i) => (f(x) ? [i] : []))
const definitions: Record<string, (s: string[]) => number[]> = {
  pair: (s) => indexes(s, (x) => s.filter((y) => y === x).length === 2),
  odd: (s) => indexes(s, (x) => s.filter((y) => y === x).length === 1),
  changed: (s) => indexes(s, (x) => x.split('→')[0] !== x.split('→')[1]),
  missing: (s) => indexes(s, (x) => x[0] === '◇' && !s.includes('⬡' + x.slice(1))),
}

describe('lifecycle rules', () => {
  for (const [rule, answers] of Object.entries(definitions)) {
    it(`${rule}: answers follow the definition`, () => {
      for (const step of steps)
        for (const seed of seeds) {
          const w = wave(lifecycle, { rule, step, seed })
          expect(w.symbols).toHaveLength(counts[step - 1])
          expect(w.answers).toEqual(answers(w.symbols))
          expect(w.answers).toHaveLength(rule === 'pair' ? 2 : 1)
          if (rule === 'pair') expect(new Set(w.symbols).size).toBe(w.symbols.length - 1)
          if (rule === 'odd') expect(new Set(w.symbols).size).toBe(2)
        }
    })
  }

  it('is deterministic', () => {
    for (const rule of Object.keys(definitions)) {
      const s = { rule, step: 4, seed: 7 }
      expect(wave(lifecycle, s)).toEqual(wave(lifecycle, s))
    }
  })

  it('level 1 wave 0 is the lecture case', () => {
    const w = wave(lifecycle, lifecycle.levels[0].sequence[0])
    expect(w.rule).toBe('pair')
    expect(w.symbols).toHaveLength(4)
    expect(w.answers).toEqual([0, 1])
    expect(w.symbols[0]).toBe(w.symbols[1])
    expect(new Set(w.symbols).size).toBe(3)
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
