import { describe, expect, it } from 'vitest'
import { chart, spread, table } from '../../src/game/chart.ts'
import type { Labels } from '../../src/game/chart.ts'
import strings from '../../src/game/strings.json'
import { wilson } from '../../src/game/stats.ts'

const tally = (you: number, n: number, ai: number, aiN: number, chance: number) => ({ you, n, ai, aiN, chance })
const rep = (all: ReturnType<typeof tally>, typical: ReturnType<typeof tally> | null = null, atypical: ReturnType<typeof tally> | null = null) => ({ all, typical, atypical })
const en: Labels = { ...strings.visible.en, chart: strings.labels.en.chart }
const pl: Labels = { ...strings.visible.pl, chart: strings.labels.pl.chart }
const label = (svg: string) => /aria-label="([^"]*)"/.exec(svg)![1]!

describe('chart', () => {
  it('labels the Wilson interval and chance', () => {
    const [lo, hi] = wilson(3, 4).map((p) => Math.round(p * 100))
    const a = label(chart(rep(tally(3, 4, 4, 4, 1.25)), en))
    expect(a).toContain(`You 3/4, 95% interval ${lo}–${hi}%`)
    expect(a).toContain('AI 4/4')
    expect(a).toContain('chance 31%')
  })
  it('has no AI row and no NaN without AI waves', () => {
    const svg = chart(rep(tally(3, 4, 0, 0, 1.25)), en)
    expect(svg).not.toContain('AI')
    expect(svg).not.toContain('NaN')
  })
  it('returns nothing for an empty report', () => {
    expect(chart(rep(tally(0, 0, 0, 0, 0)), en)).toBe('')
  })
  it('speaks PL and EN', () => {
    expect(label(chart(rep(tally(3, 4, 4, 4, 1.25)), pl))).toContain('Ty 3/4, przedział 95%')
    expect(strings.visible.pl.explain).not.toBe(strings.visible.en.explain)
  })
})

describe('table', () => {
  it('shows chance as a percent, never 1.0', () => {
    const t = table(rep(tally(3, 4, 0, 0, 1.25)), en)
    expect(t).toContain('31%')
    expect(t).not.toContain('1.0')
    expect(t).toContain('<td>—</td>')
  })
  it('hides Atypical when it has no waves', () => {
    expect(table(rep(tally(3, 4, 4, 4, 1.25), tally(3, 4, 4, 4, 1.25), tally(0, 0, 0, 0, 0)), en)).not.toContain('Atypical')
    expect(table(rep(tally(3, 5, 4, 4, 1.25), tally(2, 3, 2, 2, 1), tally(1, 2, 1, 2, 0.5)), en)).toContain('Atypical')
  })
})

describe('spread', () => {
  it('gives median and range', () => {
    expect(spread([5, 1, 3])).toEqual({ n: 3, median: 3, min: 1, max: 5 })
    expect(spread([4, 2, 8, 6]).median).toBe(5)
  })
})
