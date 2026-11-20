import { describe, expect, it } from 'vitest'
import { clearSaves, exportSaves, load, save } from '../../src/game/stats.ts'

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
  it('upgrades an old record without top', () => {
    const s = fake({ 'ftg:a:1': '{"plays":1,"best":4,"last":{"mode":"standard","picks":[]}}' })
    expect(load('a', 1, s)?.best).toBe(4)
    save('a', 1, 6, { mode: 'standard', picks: [] }, s)
    expect(load('a', 1, s)).toMatchObject({ plays: 2, best: 6, top: [6] })
  })
  it('exports and clears only ftg: keys', () => {
    const s = fake({ 'ftg:a:1': '{"plays":1}', other: 'x' })
    expect(JSON.parse(exportSaves(s))).toEqual({ 'ftg:a:1': '{"plays":1}' })
    clearSaves(s)
    expect(s.getItem('ftg:a:1')).toBeNull()
    expect(s.getItem('other')).toBe('x')
  })
  it('survives a throwing storage', () => {
    const bad = { get length(): number { throw new Error('x') }, key: () => { throw new Error('x') }, getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } } as unknown as Storage
    expect(load('a', 1, bad)).toBeNull()
    expect(() => save('a', 1, 1, { mode: 'standard', picks: [] }, bad)).not.toThrow()
    expect(exportSaves(bad)).toBe('{}')
    expect(() => clearSaves(bad)).not.toThrow()
  })
  it('ignores corrupt data', () => {
    expect(load('a', 1, fake({ 'ftg:a:1': '{' }))).toBeNull()
  })
})
