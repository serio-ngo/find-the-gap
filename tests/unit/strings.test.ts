import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
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

describe('game.css', () => {
  const css = readFileSync('src/game/game.css', 'utf8')
  it('gives every brand token a fallback', () => {
    const local = new Set([...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]))
    const uses = [...css.matchAll(/var\((--[\w-]+)([^)]*)\)/g)].filter((m) => !local.has(m[1]))
    expect(uses.map((m) => m[1])).toEqual(expect.arrayContaining(['--surface-page', '--text-strong', '--font-ui']))
    for (const m of uses) expect(m[2]).toMatch(/^,\s*\S/)
  })
  it('has calm and reduced-motion variants and no flashing', () => {
    expect(css).toContain('[data-calm]')
    expect(css).toContain('prefers-reduced-motion')
    expect(css).not.toMatch(/infinite/)
  })
})
