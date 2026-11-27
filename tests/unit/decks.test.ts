import { describe, expect, it } from 'vitest'
import curation from '../../scripts/deck/curation.json'
import { gapOf } from '../../src/game/levels/observations.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { staleRepos } from '../../scripts/make-deck.ts'
import { toRows } from '../../scripts/world.ts'

describe('observation rows', () => {
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

  it('draws every row from a public run whose values decide its gap, for all four relations', () => {
    for (const r of rows) {
      expect(r.run).toMatch(/^https:\/\/github\.com\/serio-ngo\/(lifecycle-sandbox|serio-focus)\/actions\/runs\/\d+$/)
      expect(gapOf[r.rule]!(r.values)).toBe(r.gap)
    }
    expect(new Set(rows.map((r) => r.rule))).toEqual(new Set(Object.keys(gapOf)))
  })

  it('derives the gap of each relation from its items', () => {
    expect([gapOf.odd_revision!(['a', 'b']), gapOf.odd_revision!(['a', 'a'])]).toEqual([true, false])
    expect([gapOf.lock_only!(['passed', 'fail']), gapOf.lock_only!(['passed', 'pass']), gapOf.lock_only!(['failed', 'pass'])]).toEqual([true, false, false])
    expect([gapOf.missing_link!(['passed', 'missing']), gapOf.missing_link!(['passed', 'failed'])]).toEqual([true, false])
    expect([gapOf.pair!(['t', 'u', 't']), gapOf.pair!(['t', 'u', '-', '-'])]).toEqual([true, false])
  })
})
