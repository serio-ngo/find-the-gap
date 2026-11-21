import { describe, expect, it } from 'vitest'
import { families, paintObject, shape } from '../../src/game/gen.ts'
import type { Part } from '../../src/game/gen.ts'

const painted = (cells: string[], inspected: boolean) => {
  const parts: Part[] = []
  paintObject(shape(cells, 'wave:0', 'basalt'), (p) => parts.push(p), inspected)
  return parts
}

describe('asteroid geometry', () => {
  it('reproduces every family and gives each identity its own silhouette', () => {
    for (const family of families) {
      expect(shape(['signal'], 'alpha', family)).toEqual(shape(['signal'], 'alpha', family))
      expect(shape(['signal'], 'alpha', family).outline).not.toEqual(shape(['signal'], 'beta', family).outline)
    }
  })

  it('shows the evidence cells only in the split core, one sector per cell', () => {
    const cells = ['signal', 'copper', 'void']
    expect(painted(cells, false)).toEqual(painted(['lime'], false))
    expect(painted(cells, true).slice(-3).map((p) => p.fill)).toEqual(cells)
  })
})
