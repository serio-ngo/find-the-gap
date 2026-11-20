import { describe, expect, it } from 'vitest'
import { pool, replay, score, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { facts, lifecycleDeck } from '../../src/game/levels/lifecycle.ts'
import { choiceRecords } from '../../src/game/levels/records.ts'

const { lifecycle, fixture } = decks
const counts = [4, 5, 6, 6, 7]
const steps = [1, 2, 3, 4, 5]
const seeds = Array.from({ length: 100 }, (_, i) => i)
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

  it('projects all lifecycle choices from their own operands and public records', () => {
    const specs = [
      ...lifecycle.levels.flatMap((l) => l.sequence),
      ...lifecycle.rules.flatMap((r) => steps.flatMap((step) => pool(lifecycle, r.id, step))),
    ]
    for (const spec of specs) {
      const w = wave(lifecycle, spec)
      const records = choiceRecords(lifecycle, w)
      expect(records.map((record) => record.clue)).toEqual(w.symbols)
      expect(choiceRecords(lifecycle, { ...w, answers: [] })).toEqual(records)
      expect(new Set(records.map(({ context }) => JSON.stringify(context))).size).toBe(records.length)
      for (const { context, sources, stages } of records) {
        expect(stages.some(({ url, steps }) => url === context?.url && steps.includes(context.quote))).toBe(true)
        expect(sources.length).toBeGreaterThan(0)
        expect(stages.map(({ run }) => run)).toEqual(stages.map(({ run }) => run).sort((a, b) => a - b))
      }
    }
  })
})

describe('fixture deck', () => {
  it('runs to the end through replay', () => {
    const level = fixture.levels[0]
    expect(level.sequence).toHaveLength(5)
    expect(fixture.rules.map((r) => r.id)).toEqual(['colour', 'count'])
    const picks = level.sequence.map((s) => wave(fixture, s).answers[0])
    const g = replay(fixture, 1, 'standard', picks)
    expect(score(g)).toBe(200)
    expect(level.anchors).toEqual([1])
  })
})
