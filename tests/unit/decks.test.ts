import { describe, expect, it } from 'vitest'
import curation from '../../scripts/deck/curation.json'
import { pool, score, wave } from '../../src/game/engine.ts'
import { replay } from '../replay.ts'
import { decks } from '../../src/game/levels/index.ts'
import { ATYPICAL, clue, gapOf, pattern, rowOf, typicality, unseen } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { staleRepos, toRows } from '../../scripts/make-deck.ts'

const { observations, fixture } = decks
const specs = [
  ...observations.levels.flatMap((l) => l.sequence),
  ...observations.rules.flatMap((r) => [1, 2, 3, 4, 5].flatMap((step) => pool(observations, r.id, step))),
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

  it('gives every row a context with every field set', () => {
    for (const r of rows) expect((['locks', 'impacts', 'agent', 'job', 'share'] as const).every((k) => r.context?.[k] != null), r.id).toBe(true)
  })

  it('keeps every curated row out of the deck', () => {
    expect(rows.filter((r) => r.id in curation)).toEqual([])
  })

  it('never repeats the gap of an anchor wave in a later non-anchor wave', () => {
    for (const l of observations.levels) {
      expect(rows.filter((r) => r.rule === l.start.rule && r.gap && !r.research).length, `level ${l.id} scored gaps`).toBeGreaterThan(l.anchors.length)
      const gaps = l.sequence.slice(0, 20).map((s) => { const w = wave(observations, s); return w.ids![w.answers[0]!] })
      gaps.forEach((g, i) => {
        if (l.anchors.includes(i)) expect(gaps.findIndex((x, j) => j > i && x === g && !l.anchors.includes(j)), `level ${l.id} wave ${i}`).toBe(-1)
      })
    }
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

  it('has three levels of 21 waves, certain only at 5, 10, 15 and 20, the last from runs no scored wave uses', () => {
    expect(observations.levels).toHaveLength(3)
    for (const l of observations.levels) {
      expect(l.anchors).toEqual([4, 9, 14, 19])
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
