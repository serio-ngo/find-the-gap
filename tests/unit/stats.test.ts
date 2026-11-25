import { describe, expect, it } from 'vitest'
import { load, save, wilson } from '../../src/game/stats.ts'

const fake = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as Storage
}

describe('stats', () => {
  it('loads nothing then saves plays and best', () => {
    const s = fake()
    expect(load('lifecycle', 1, s)).toBeNull()
    save('lifecycle', 1, 5, { mode: 'standard', picks: [1, 2] }, s)
    save('lifecycle', 1, 3, { mode: 'adaptive', picks: [0] }, s)
    expect(JSON.parse(s.getItem('ftg:lifecycle:1')!)).toEqual({ plays: 2, best: 5, top: [5, 3], last: { mode: 'adaptive', picks: [0] } })
    expect(load('lifecycle', 1, s)?.best).toBe(5)
  })
  it('keeps the top 5 scores sorted descending', () => {
    const s = fake()
    for (const n of [2, 9, 4, 7, 1, 8, 6]) save('a', 1, n, { mode: 'standard', picks: [] }, s)
    expect(load('a', 1, s)?.top).toEqual([9, 8, 7, 6, 4])
  })
  it('retains legacy scores and keeps each edition separately', () => {
    const legacy = '{"plays":1,"best":9}'
    const s = fake({ 'ftg:a:1': legacy })
    save('a', 1, 3, { mode: 'standard', picks: [], edition: 'one' }, s)
    save('a', 1, 6, { mode: 'standard', picks: [], edition: 'two' }, s)
    expect(load('a', 1, s, 'one')?.top).toEqual([3])
    expect(load('a', 1, s, 'two')?.top).toEqual([6])
    expect(s.getItem('ftg:a:1')).toBe(legacy)
  })
  it('survives a throwing storage', () => {
    const bad = { get length(): number { throw new Error('x') }, key: () => { throw new Error('x') }, getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } } as unknown as Storage
    expect(load('a', 1, bad)).toBeNull()
    expect(() => save('a', 1, 1, { mode: 'standard', picks: [] }, bad)).not.toThrow()
  })
  it('ignores corrupt data', () => {
    expect(load('a', 1, fake({ 'ftg:a:1': '{' }))).toBeNull()
  })

  it('gives a 95% Wilson interval', () => {
    const [lo, hi] = wilson(6, 100)
    expect(lo).toBeCloseTo(0.0278, 3)
    expect(hi).toBeCloseTo(0.1247, 3)
  })
})
