import { describe, expect, it } from 'vitest'
import { digits, druse, monster } from '../../src/game/gen.ts'
import { rows } from '../../src/game/levels/rows.ts'

const odd = (a: string, b: string, criteria = 3) =>
  monster({ rule: 'odd_revision', values: [a, b], context: { locks: 0, impacts: 0, agent: 0, job: 'success', share: 1, tests: 1, criteria } })
const count = (s: string, tag: string) => s.split(tag).length - 1
const segments = (values: string[]) => (monster({ rule: 'pair', values, context: null }).match(/,19\.5\)">.*?<\/g>/g) ?? [])

describe('the monster carries the evidence', () => {
  it('reads a short value as hex digits and a long one through a hash', () => {
    expect(digits('a4757c3')).toEqual([10, 4, 7, 5, 7, 12, 3])
    expect(digits('0123456789abcdef')).toHaveLength(7)
  })

  it('draws horns per half from the druse of its own SHA', () => {
    expect(count(odd('a4757c3', '994920d'), 'rotate(')).toBe(druse('a4757c3').count + druse('994920d').count)
    expect(odd('a4757c3', '994920d')).not.toBe(odd('994920d', 'a4757c3'))
  })

  it('draws 1, 2 or 3 eyes from the criteria', () => {
    expect([2, 3, 4, 5, 6].map((c) => count(odd('a4757c3', '994920d', c), '<ellipse') - 2)).toEqual([1, 1, 2, 3, 3])
  })

  it('draws one segment per item: equal names give equal glyphs, a status a rivet', () => {
    const [a, b, c] = segments(['same name', 'same name', 'other name'])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(new Set(segments(['passed', 'failed', 'missing'])).size).toBe(3)
  })

  it('never reads the gap flag or the id, and draws every row', () => {
    for (const r of rows) {
      const svg = monster(r)
      expect(svg).toBe(monster({ rule: r.rule, values: r.values, context: r.context }))
      expect(svg.startsWith('<svg')).toBe(true)
    }
  })

  it('draws no mouth or fang, and varies the body by family from the values alone', () => {
    const shapes = new Set(rows.map((r) => monster(r).match(/<path d="([^"]*)"/)![1]))
    expect(shapes.size).toBeGreaterThanOrEqual(3)
    for (const r of rows) expect(monster(r)).not.toMatch(/Q0,16|<polygon points="-3,12\.4/)
    const gap = rows.find((r) => r.gap)!
    expect(monster({ ...gap, gap: false, id: 'x' } as typeof gap)).toBe(monster(gap))
  })
})
