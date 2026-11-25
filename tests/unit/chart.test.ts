import { describe, expect, it } from 'vitest'
import { chart, label, spread, table } from '../../src/game/chart.ts'
import type { Labels } from '../../src/game/chart.ts'
import strings from '../../src/game/strings.json'
import { wilson } from '../../src/game/stats.ts'

const tally = (you: number, n: number, ai: number, aiN: number, chance: number) => ({ you, n, ai, aiN, chance })
const rep = (all: ReturnType<typeof tally>, typical: ReturnType<typeof tally> | null = null, atypical: ReturnType<typeof tally> | null = null) => ({ all, typical, atypical })
const en: Labels = { ...strings.visible.en, chart: strings.labels.en.chart }
const pc = (hits: number, n: number) => wilson(hits, n).map((p) => Math.round(p * 100)).join('–')

describe('chart', () => {
  it('labels each row with its Wilson interval and the chance rate', () => {
    expect(label(rep(tally(3, 4, 4, 4, 1.25)), en)).toBe(
      `${en.you} 3/4, ${en.chart} ${pc(3, 4)}%; ${en.ai} 4/4, ${en.chart} ${pc(4, 4)}%; ${en.chance.toLowerCase()} 31%`,
    )
  })
})

describe('spread', () => {
  it('gives median and range', () => {
    expect(spread([5, 1, 3])).toEqual({ n: 3, median: 3, min: 1, max: 5 })
    expect(spread([4, 2, 8, 6]).median).toBe(5)
  })
})
