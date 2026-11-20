import { describe, expect, it } from 'vitest'
import strings from '../../src/game/strings.json' with { type: 'json' }

describe('strings', () => {
  it('has at most 12 visible strings per language', () => {
    for (const l of ['pl', 'en'] as const) expect(Object.keys(strings.visible[l]).length).toBeLessThanOrEqual(12)
  })
  it('has identical key sets', () => {
    expect(Object.keys(strings.visible.pl).sort()).toEqual(Object.keys(strings.visible.en).sort())
    expect(Object.keys(strings.labels.pl).sort()).toEqual(Object.keys(strings.labels.en).sort())
  })
  it('has no empty value', () => {
    for (const g of [strings.visible, strings.labels]) for (const l of ['pl', 'en'] as const)
      for (const v of Object.values(g[l])) expect(v.trim()).not.toBe('')
  })
  it('keeps the rock template', () => {
    expect(strings.labels.pl.rock).toBe('Skała {n}: {s}')
    expect(strings.labels.en.rock).toBe('Rock {n}: {s}')
  })
})
