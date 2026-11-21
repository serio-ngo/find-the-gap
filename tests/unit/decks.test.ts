import { describe, expect, it } from 'vitest'
import { pool, score, wave } from '../../src/game/engine.ts'
import { replay } from '../replay.ts'
import { decks } from '../../src/game/levels/index.ts'
import { ATYPICAL, clue, gapOf, pattern, rowOf, typicality, unseen } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { toRows } from '../../scripts/make-deck.ts'

const { observations, fixture } = decks
const specs = [
  ...observations.levels.flatMap((l) => l.sequence),
  ...observations.rules.flatMap((r) => [1, 2, 3, 4, 5].flatMap((step) => pool(observations, r.id, step))),
]

describe('observation deck', () => {
  it('reads only public deck rows and names every row whose values contradict the archive flag', () => {
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
    const { rows: kept, dropped } = toRows(text)
    expect(kept.map((r) => r.id)).toEqual(['x'])
    expect(dropped).toEqual(['m odd_revision [a,b] archive gap false'])
  })

  it('draws every choice from a public run whose values decide its gap', () => {
    for (const r of rows) {
      expect(r.run).toMatch(/^https:\/\/github\.com\/serio-ngo\/(lifecycle-sandbox|serio-focus)\/actions\/runs\/\d+$/)
      expect(gapOf[r.rule]!(r.values)).toBe(r.gap)
    }
  })

  it('gives every wave exactly 4, 5, 6, 6 or 7 distinct runs by step and exactly one gap', () => {
    for (const s of specs) {
      const w = wave(observations, s)
      const picked = w.ids!.map(rowOf)
      expect(w.symbols).toEqual(picked.map(clue))
      expect(w.symbols).toHaveLength([4, 5, 6, 6, 7][s.step - 1]!)
      expect(new Set(picked.map((r) => r.run)).size).toBe(picked.length)
      expect(w.answers).toHaveLength(1)
      expect(w.answers).toEqual(picked.flatMap((r, i) => (r.gap ? [i] : [])))
      expect(picked.every((r) => r.rule === s.rule && r.research === unseen(s.seed))).toBe(true)
      expect(wave(observations, s)).toEqual(w)
    }
  })

  it('mixes more control patterns at higher steps', () => {
    const level = observations.levels[1]!
    const kinds = level.sequence.slice(0, 20).map((s) => {
      const w = wave(observations, s)
      return new Set(w.ids!.filter((_, i) => !w.answers.includes(i)).map((id) => pattern(rowOf(id)))).size
    })
    expect(kinds).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5])
  })

  it('shows every scored gap run of a level before repeating one', () => {
    for (const l of observations.levels) {
      const gaps = l.sequence.slice(0, 20).map((s) => wave(observations, s)).map((w) => w.ids![w.answers[0]!])
      const all = rows.filter((r) => r.rule === l.start.rule && r.gap && !r.research).length
      expect(new Set(gaps.slice(0, Math.min(20, all))).size).toBe(Math.min(20, all))
    }
  })

  it('has three levels of 21 scored waves, the last from runs no scored wave uses', () => {
    expect(observations.levels).toHaveLength(3)
    for (const l of observations.levels) {
      expect(l.anchors).toHaveLength(21)
      expect(l.sequence).toHaveLength(21)
      expect(l.tail).toBe(1)
      expect(unseen(l.sequence.at(-1)!.seed)).toBe(true)
    }
  })

  it('calls a gap pattern atypical when under a quarter of its rule\'s gap runs show it', () => {
    const missing = rows.filter((r) => r.rule === 'missing_link' && r.gap && !r.research)
    for (const r of missing) {
      const share = missing.filter((x) => x.values.join() === r.values.join()).length / missing.length
      expect(typicality(r)).toBe(share)
    }
    expect(observations.typical!(wave(observations, observations.levels[0]!.sequence[0]!))).toBe(true)
    expect(typicality(rows.find((r) => r.rule === 'pair' && r.gap && !r.research && r.values.join() === 't1,t1,t3,t4')!)).toBeLessThan(ATYPICAL)
  })
})

describe('fixture deck', () => {
  it('runs to the end through replay', () => {
    const level = fixture.levels[0]!
    const g = replay(fixture, 1, 'standard', level.sequence.map((s) => wave(fixture, s).answers[0]!))
    expect(score(g)).toBe(200)
  })
})
