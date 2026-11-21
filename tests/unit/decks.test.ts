import { describe, expect, it } from 'vitest'
import { pool, score, wave } from '../../src/game/engine.ts'
import { replay } from '../replay.ts'
import { decks } from '../../src/game/levels/index.ts'
import { cells, clue, gapOf } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { toRows } from '../../scripts/make-deck.ts'

const { observations, fixture } = decks
const looksBroken: Record<string, (c: string[]) => boolean> = {
  odd_revision: (c) => c[0] !== c[1],
  missing_link: (c) => c.includes('void'),
  pair: (c) => new Set(c).size < c.length,
}
const specs = [
  ...observations.levels.flatMap((l) => l.sequence),
  ...observations.rules.flatMap((r) => [1, 2, 3, 4, 5].flatMap((step) => pool(observations, r.id, step))),
]

describe('observation deck', () => {
  it('reads only public deck rows whose visible structure matches their gap flag', () => {
    const line = (o: object) => JSON.stringify({
      id: 'x', relation: 'odd_revision', items: [{ role: 'reported', value: 'a' }, { role: 'tested', value: 'b' }], gap: true,
      links: { run: 'r' }, flags: { visibility: 'public', split: 'deck', labelled: true }, ...o,
    })
    const text = [
      line({}),
      line({ id: 'p', flags: { visibility: 'private', split: 'deck', labelled: true } }),
      line({ id: 'h', flags: { visibility: 'public', split: 'holdout', labelled: true } }),
      line({ id: 'm', gap: false }),
    ].join('\n')
    expect(toRows(text).map((r) => r.id)).toEqual(['x'])
  })

  it('draws every rock from a public run and shows its gap in the core', () => {
    for (const r of rows) {
      expect(r.run).toMatch(/^https:\/\/github\.com\/serio-ngo\/(lifecycle-sandbox|serio-focus)\/actions\/runs\/\d+$/)
      expect(gapOf[r.rule]!(r.values)).toBe(r.gap)
      expect(looksBroken[r.rule]!(cells(r))).toBe(r.gap)
    }
  })

  it('gives every scored wave one broken rock among distinct rocks, and research waves none', () => {
    for (const s of specs) {
      const w = wave(observations, s)
      const picked = w.ids!.map((id) => rows.find((r) => r.id === id)!)
      expect(w.symbols).toEqual(picked.map(clue))
      expect(new Set(w.symbols).size).toBe(w.symbols.length)
      expect(w.symbols.length).toBeGreaterThanOrEqual(4)
      expect(w.symbols.length).toBeLessThanOrEqual(7)
      if (s.rule === 'research') {
        expect(w.answers).toEqual([])
        expect(picked.every((r) => r.research)).toBe(true)
      } else {
        expect(w.answers).toHaveLength(1)
        expect(w.answers).toEqual(picked.flatMap((r, i) => (r.gap ? [i] : [])))
        expect(picked.every((r) => !r.research && r.rule === s.rule)).toBe(true)
      }
    }
  })

  it('has three levels of 20 scored waves and a research wave', () => {
    expect(observations.levels).toHaveLength(3)
    for (const l of observations.levels) {
      expect(l.anchors).toHaveLength(20)
      expect(l.sequence).toHaveLength(21)
      expect(l.sequence.at(-1)!.rule).toBe('research')
    }
  })
})

describe('fixture deck', () => {
  it('runs to the end through replay', () => {
    const level = fixture.levels[0]!
    const g = replay(fixture, 1, 'standard', level.sequence.map((s) => wave(fixture, s).answers[0]!))
    expect(score(g)).toBe(200)
  })
})
