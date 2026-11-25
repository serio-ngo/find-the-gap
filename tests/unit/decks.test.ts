import { describe, expect, it } from 'vitest'
import curation from '../../scripts/deck/curation.json'
import { pool, score, wave } from '../../src/game/engine.ts'
import type { Spec } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { ATYPICAL, clue, gapOf, pattern, rowOf, typicality, unseen } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { staleRepos, toRows } from '../../scripts/make-deck.ts'

const { observations, fixture } = decks
const specs = [
  ...observations.levels.flatMap((l) => l.sequence.map((s, i) => ({ s, certain: l.anchors.includes(i) }))),
  ...observations.rules.flatMap((r) => [1, 2, 3, 4, 5].flatMap((step) => [false, true].flatMap((certain) => pool(observations, r.id, step, certain).map((s) => ({ s, certain }))))),
]

describe('observation deck', () => {
  it('reads only public deck rows and names every row whose values contradict the archive flag', () => {
    const context = { locks: 0, impacts: 0, agent: 0, job: 'failure', share: 0.5 }
    const line = (o: object) => JSON.stringify({
      id: 'x', relation: 'odd_revision', items: [{ role: 'reported', value: 'a' }, { role: 'tested', value: 'b' }], gap: true,
      links: { run: 'r' }, flags: { visibility: 'public', split: 'deck', labelled: true }, context, ...o,
    })
    const text = [
      line({}),
      line({ id: 'p', flags: { visibility: 'private', split: 'deck', labelled: true } }),
      line({ id: 'h', flags: { visibility: 'public', split: 'holdout', labelled: true } }),
      line({ id: 'm', gap: false }),
      line({ id: 'n', context: { ...context, agent: null } }),
      line({ id: 'k', context: { locks: 0, impacts: 0, agent: 0, job: 'failure' } }),
      line({ id: 'c' }),
    ].join('\n')
    const { rows: kept, findings, stale, manual } = toRows(text, { c: 'reviewed', p: 'private', gone: 'removed' })
    expect(findings.find((f) => f.id === 'm')!.reason).toMatch(/archive gap/)
    expect(findings.map((f) => f.id).sort()).toEqual(['k', 'm', 'n'])
    expect(kept.map((r) => r.id)).toEqual(['x'])
    expect(stale.sort()).toEqual(['gone', 'p'])
    expect(manual).toEqual(['c'])
  })

  it('keeps every curated row out of the deck', () => {
    expect(rows.filter((r) => r.id in curation)).toEqual([])
  })

  it('draws every choice from a public run whose values decide its gap', () => {
    for (const r of rows) {
      expect(r.run).toMatch(/^https:\/\/github\.com\/serio-ngo\/(lifecycle-sandbox|serio-focus)\/actions\/runs\/\d+$/)
      expect(gapOf[r.rule]!(r.values)).toBe(r.gap)
    }
  })

  it('gives every wave exactly 4, 5, 6, 6 or 7 distinct runs by step, exactly one gap on a certain wave and any number on a research wave', () => {
    const research = new Set<number>()
    for (const { s, certain } of specs) {
      const w = wave(observations, s)
      const picked = w.ids!.map(rowOf)
      expect(w.symbols).toEqual(picked.map(clue))
      expect(w.symbols).toHaveLength([4, 5, 6, 6, 7][s.step - 1]!)
      expect(new Set(picked.map((r) => r.run)).size).toBe(picked.length)
      if (certain) expect(w.answers).toHaveLength(1)
      else research.add(w.answers.length)
      expect(w.answers).toEqual(picked.flatMap((r, i) => (r.gap ? [i] : [])))
      expect(picked.every((r) => r.rule === s.rule && r.research === unseen(s.seed))).toBe(true)
      expect(wave(observations, s)).toEqual(w)
    }
    expect([Math.min(...research), Math.max(...research) > 1]).toEqual([0, true])
  })

  it('reveals four different gap runs per level, the same in fixed and adaptive play, and never draws them on a research wave', () => {
    for (const l of observations.levels) {
      const gapOfWave = (s: Spec) => { const w = wave(observations, s); return w.ids![w.answers[0]!]! }
      const shown = l.anchors.map((i) => gapOfWave(l.sequence[i]!))
      expect(new Set(shown).size).toBe(l.anchors.length)
      expect(new Set([1, 2, 3, 4, 5].flatMap((step) => pool(observations, l.start.rule, step, true)).map(gapOfWave))).toEqual(new Set(shown))
      const research = [...l.sequence.filter((_, i) => !l.anchors.includes(i)), ...[1, 2, 3, 4, 5].flatMap((step) => pool(observations, l.start.rule, step))]
      expect(research.flatMap((s) => wave(observations, s).ids!.filter((id) => shown.includes(id)))).toEqual([])
    }
  })

  it('calls a gap pattern atypical when under a quarter of its rule\'s gap runs show it', () => {
    const missing = rows.filter((r) => r.rule === 'missing_link' && r.gap && !r.research)
    for (const r of missing) {
      const share = missing.filter((x) => x.values.join() === r.values.join()).length / missing.length
      expect(typicality(r)).toBe(share)
    }
    expect(observations.typical!(wave(observations, observations.levels[0]!.sequence[4]!))).toBe(true)
    expect(typicality(rows.find((r) => r.rule === 'pair' && r.gap && !r.research && r.values.join() === 't1,t1,t3,t4')!)).toBeLessThan(ATYPICAL)
  })
})
