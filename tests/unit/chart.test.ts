import { describe, expect, it } from 'vitest'
import { label } from '../../src/game/chart.ts'
import type { Labels } from '../../src/game/chart.ts'
import strings from '../../src/game/strings.json'
import { wilson } from '../../src/game/stats.ts'

const tally = (you: number, n: number, ai: number, aiN: number, chance: number) => ({ you, n, ai, aiN, chance })
const rep = (all: ReturnType<typeof tally>) => ({ all })
const en: Labels = { ...strings.visible.en, chart: strings.labels.en.chart }
const pc = (hits: number, n: number) => wilson(hits, n).map((p) => Math.round(p * 100)).join('–')

describe('chart', () => {
  it('labels each row with its Wilson interval and the chance rate', () => {
    expect(label(rep(tally(3, 4, 4, 4, 1.25)), en)).toBe(
      `${en.you} 3/4, ${en.chart} ${pc(3, 4)}%; ${en.ai} 4/4, ${en.chart} ${pc(4, 4)}%; ${en.chance.toLowerCase()} 31%`,
    )
  })
})
