import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AiPick, AiRun, Deck, Spec } from '../../src/game/engine.ts'
import { lifecycle } from '../../src/game/levels/lifecycle.ts'
import { checkRun, hashContent, loadRun } from '../../src/game/eval/version.ts'
import { spread, validate } from '../../src/game/eval/run-ai.ts'

beforeAll(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('network')
  })
})

const make = (sym = 'a', seed = 1, high = 0.8, question = 'q?'): Deck => {
  const sequence: Spec[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ rule: 'a', step: 1, seed: seed + i })),
    { rule: 'research', step: 1, seed: 99 },
  ]
  return {
    id: 'tiny',
    steps: 2,
    policy: { high, low: 0.55, window: 4, confirm: 2 },
    rules: [{ id: 'a', make: (step, s) => ({ symbols: [sym, `${step}`, `${s}`], answers: [0], evidence: 'e' }) }],
    research: () => ({ symbols: ['x', 'y'], answers: [], evidence: 'e' }),
    poolSize: 2,
    evidence: [],
    question,
    levels: [{ id: 1, start: { rule: 'a', step: 1 }, anchors: [2, 7], sequence }],
  }
}

const pick: AiPick = { choice: 'r0', probabilities: { r0: 0.9, r1: 0.1 } }
const full = (d: Deck, hash: string): AiRun => ({
  hash,
  model: 'd1.1',
  date: '2026-11-20',
  standard: { 1: Array.from({ length: 11 }, () => pick) },
  pool: Object.fromEntries(
    [1, 2].map((step) => [`a:${step}`, [1000, 1001].map((seed) => ({ ...pick, seed }))]),
  ),
  spread: { choiceDiffs: 0, maxProbDiff: 0 },
})

describe('hashContent', () => {
  const base = hashContent(make())
  it('is stable for an identical deck', () => {
    expect(hashContent(make())).toBe(base)
    expect(base).toMatch(/^[0-9a-f]{64}$/)
  })
  it('changes with a symbol, a seed, a threshold or the question', () => {
    for (const d of [make('b'), make('a', 2), make('a', 1, 0.9), make('a', 1, 0.8, 'other?')]) {
      expect(hashContent(d)).not.toBe(base)
    }
  })
  it('ignores anchors', () => {
    const d = make()
    d.levels[0].anchors = [1]
    expect(hashContent(d)).toBe(base)
  })
  it('keeps the committed run fresh for the lifecycle deck', () => {
    expect(loadRun('src/game/eval/ai-run.json')?.hash).toBe(hashContent(lifecycle))
  })
})

describe('checkRun', () => {
  const d = make()
  const hash = hashContent(d)
  it('accepts a complete fresh run', () => expect(checkRun(full(d, hash), hash, d)).toBeNull())
  it('rejects a missing run', () => expect(checkRun(undefined, hash, d)).toMatch(/missing/))
  it('rejects a stale run', () => expect(checkRun(full(d, 'old'), hash, d)).toMatch(/stale/))
  it('rejects a missing level pick', () => {
    const r = full(d, hash)
    r.standard[1].pop()
    expect(checkRun(r, hash, d)).toMatch(/standard/)
  })
  it('rejects a missing pool entry', () => {
    const r = full(d, hash)
    r.pool['a:2'].pop()
    expect(checkRun(r, hash, d)).toMatch(/pool/)
  })
})

describe('loadRun', () => {
  it('returns undefined for a missing file', () => expect(loadRun('/nope/ai-run.json')).toBeUndefined())
})

describe('validate', () => {
  const ks = ['r0', 'r1']
  it('rounds a good answer to 3 decimals', () => {
    expect(validate(ks, { choice: 'r1', probabilities: { r0: 0.12345, r1: 0.87655 } })).toEqual({
      choice: 'r1',
      probabilities: { r0: 0.123, r1: 0.877 },
    })
  })
  it('rejects a bad choice', () => {
    expect(() => validate(ks, { choice: 'r9', probabilities: { r0: 0.5, r1: 0.5 } })).toThrow()
  })
  it('rejects a missing key', () => {
    expect(() => validate(ks, { choice: 'r0', probabilities: { r0: 1 } })).toThrow()
  })
  it('rejects an extra key', () => {
    expect(() => validate(ks, { choice: 'r0', probabilities: { r0: 1, r1: 0, r2: 0 } })).toThrow()
  })
  it('rejects an out-of-range probability', () => {
    expect(() => validate(ks, { choice: 'r0', probabilities: { r0: 1.2, r1: 0 } })).toThrow()
  })
})

describe('spread', () => {
  it('counts choice differences and the largest probability gap', () => {
    const b: AiPick = { choice: 'r1', probabilities: { r0: 0.7, r1: 0.3 } }
    expect(spread([pick, pick], [pick, b])).toEqual({ choiceDiffs: 1, maxProbDiff: 0.2 })
  })
})
