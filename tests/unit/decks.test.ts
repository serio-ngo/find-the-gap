import { describe, expect, it } from 'vitest'
import curation from '../../scripts/deck/curation.json'
import { pool, wave } from '../../src/game/engine.ts'
import type { Spec } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { gapOf, rowOf, seen, unseen } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { staleRepos, toRows } from '../../scripts/make-deck.ts'

const { observations } = decks
const specs = [
  ...observations.levels.flatMap((l) => l.sequence.map((s, i) => ({ s, certain: l.anchors.includes(i) }))),
  ...observations.rules.flatMap((r) => [1, 2, 3, 4, 5].flatMap((step) => [false, true].flatMap((certain) => pool(observations, r.id, step, certain).map((s) => ({ s, certain }))))),
]

describe('observation deck', () => {
  it('splits the certain waves into typical and atypical gaps by their drawn signs', () => {
    const l = observations.levels[0]!
    expect(new Set(l.anchors.map((i) => observations.typical!(wave(observations, l.sequence[i]!)))).size).toBe(2)
  })

  it('reads only public deck rows and names every row whose values contradict the archive flag', () => {
    const context = { locks: 0, impacts: 0, agent: 0, job: 'failure', share: 0.5, tests: 30, criteria: 4 }
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

  it('lists public repos whose gates are missing from the cases or newer than the snapshot', () => {
    const gate = (repo: string, run: number, at: string) => ({ repo, key: `serio-ngo/${repo}/${run}-1-gate`, at })
    const gates = [gate('fresh', 0, '2026-01-02T10:00:00Z'), gate('old', 1, '2026-01-02T10:00:00.123Z'), gate('missing', 2, '2026-01-02T10:00:00Z'), gate('hidden', 3, '2026-01-02T10:00:00Z'), gate('broken', 4, 'not a time')]
    const cases = new Set(['serio-ngo/fresh/0-1-gate', 'serio-ngo/old/1-1-gate', 'serio-ngo/broken/4-1-gate'])
    const snap = (priv: boolean, taken: string) => ({ private: priv, taken })
    const stale = staleRepos(gates, cases, {
      fresh: snap(false, '2026-01-02T10:00:01Z'), old: snap(false, '2026-01-02T10:00:00Z'), missing: snap(false, '2026-01-03T00:00:00Z'),
      hidden: snap(true, '2025-01-01T00:00:00Z'), broken: snap(false, '2026-01-03T00:00:00Z'),
    })
    expect(stale.map((x) => x.split(':')[0]).sort()).toEqual(['broken', 'missing', 'old'])
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
      expect(w.symbols).toEqual(picked.map(seen))
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

  it('has one odd revision level of 21 waves, certain only at 5, 10, 15 and 20, the last from runs no scored wave uses', () => {
    expect(observations.levels.map((l) => l.start.rule)).toEqual(['odd_revision'])
    for (const l of observations.levels) {
      expect(l.anchors).toEqual([4, 9, 14, 19])
      expect(l.sequence).toHaveLength(21)
      expect(l.tail).toBe(1)
      expect(unseen(l.sequence.at(-1)!.seed)).toBe(true)
    }
  })
})
