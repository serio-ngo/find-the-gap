import { describe, expect, it } from 'vitest'
import { pool, replay, score, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { facts, lifecycleDeck, revisions } from '../../src/game/levels/lifecycle.ts'
import { choiceRecords } from '../../src/game/levels/records.ts'

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

  it('links the duplicate mapping to its own passing report row', () => {
    const records = choiceRecords(lifecycle, wave(lifecycle, { rule: 'missing', step: 1, seed: 0 }))
    expect(records[1].marks).toEqual(['AC2', ...records[0].marks.slice(1)])
    expect(records[1].sources[0].quote).toBe(`| AC2 | ${facts.criteria[1][1]} | passed |`)
  })

  it('varies the source context of AC2 while its low-step logical slot stays fixed', () => {
    const standard = lifecycle.levels[3].sequence.filter(({ step }) => step === 1)
    for (const specs of [standard, pool(lifecycle, 'missing', 1)]) {
      const contexts = specs.map((spec) => {
        const w = wave(lifecycle, spec)
        expect(w.answers).toEqual([1])
        const record = choiceRecords(lifecycle, w)[1]
        expect(record.clue).toMatch(/^AC2 /)
        return record.context?.url
      })
      expect(new Set(contexts).size).toBeGreaterThan(1)
    }
  })

  it('attributes pair fillers and research slots to their own source', () => {
    const pair = choiceRecords(lifecycle, wave(lifecycle, { rule: 'pair', step: 5, seed: 1 }))
    const filler = pair.filter(({ clue }) => !clue.startsWith('AC'))
    expect(filler).toHaveLength(3)
    for (const { marks, sources } of filler) {
      const sha = Object.values(revisions).find((value) => value.startsWith(marks[0]))
      expect(sources.at(-1)?.quote).toBe(sha ? `sha: ${sha}` : 'Received: "5.000"')
    }
    const records = choiceRecords(lifecycle, wave(lifecycle, { rule: 'research', step: 3, seed: 10 }))
    expect(records.map(({ sources }) => sources[0].quote)).toEqual([
      lifecycle.evidence[0].quote[0], lifecycle.evidence[1].quote[0], 'Expected: "5.00"', lifecycle.evidence[0].quote[2],
    ])
    expect(records[2].stages.map(({ stage }) => stage)).toEqual(['spec-review', 'write-tests', 'deliver', 'gate', 'pr-loop', 'gate'])
  })

  it('uses the exact expected operand twice in a constructed control and stops at the failing gate', () => {
    const records = choiceRecords(lifecycle, wave(lifecycle, { rule: 'changed', step: 5, seed: 3 }))
    for (const { marks, sources, stages, constructed } of records) {
      if (constructed) {
        expect(marks).toEqual(['5.00', '5.00'])
        expect(sources[0]).toEqual(sources[1])
      } else expect(sources.map((s) => s.quote)).toEqual(['Expected: "5.00"', 'Received: "5.000"'])
      expect(stages.at(-1)).toMatchObject({ run: 44288017206, conclusion: 'failure' })
    }
    expect(records.filter(({ constructed }) => constructed)).toHaveLength(6)
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

  it('offers at least four synthetic choices with no public evidence in every wave', () => {
    const specs = [
      ...fixture.levels[0].sequence,
      ...fixture.rules.flatMap(({ id }) => [1, 2, 3].flatMap((step) => pool(fixture, id, step))),
    ]
    for (const spec of specs) {
      const records = choiceRecords(fixture, wave(fixture, spec))
      expect(records.length).toBeGreaterThanOrEqual(4)
      expect(records.length).toBeLessThanOrEqual(7)
      expect(records.every(({ sources, stages }) => !sources.length && !stages.length)).toBe(true)
    }
  })

  it('every lifecycle level scores waves 2 and 7', () => {
    expect(lifecycle.levels.map((l) => l.anchors)).toEqual([[2, 7], [2, 7], [2, 7], [2, 7]])
  })
})
