import { describe, expect, it } from 'vitest'
import { shape, waveLook } from '../../src/game/gen.ts'

const rocks = ['236fd0a', '26', '26dd', '237c']
const radii = (t: string, l: ReturnType<typeof waveLook>) => shape(t, l).outline[0].map(([x, y]) => Math.hypot(x, y))
const ratio = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.max(x / b[i], b[i] / x)))

describe('gen', () => {
  it('is deterministic', () => {
    const l = waveLook(rocks, 5)
    expect(shape('26dd', l)).toEqual(shape('26dd', l))
    expect(waveLook(rocks, 5)).toEqual(l)
  })

  it('picks family from the majority token family, tie to the first', () => {
    expect(waveLook(['AC1 ◆', 'AC2 ◆', '26'], 1).family).toBe('ship')
    expect(waveLook(['5.00→5.00', '26'], 1).family).toBe('probe')
    expect(waveLook(['26', '5.00→5.00'], 1).family).toBe('rock')
    expect(waveLook(['hello', '26'], 1).family).toBe('rock')
  })

  it('rock verts and craters', () => {
    expect(waveLook(['236fd0a'], 1).verts).toBe(12)
    expect(waveLook(['26'], 1).verts).toBe(7)
    expect(waveLook(['26'], 1).craters).toBe(1)
    expect(waveLook(['236fd0a'], 1).craters).toBe(3)
    expect(waveLook(['26dd'], 1).craters).toBe(1)
    expect(waveLook(['26dd', '237c', '237c'], 1).verts).toBe(9)
    const l = waveLook(['236fd0a'], 1)
    const s = shape('236fd0a', l)
    expect(s.outline[0]).toHaveLength(12)
    expect(s.dots).toHaveLength(3)
  })

  it('ship hull and lights', () => {
    const l = (t: string) => waveLook([t], 2)
    expect(l('AC1 ◆').hull).toBe('saucer')
    expect(l('AC1 ▲').hull).toBe('delta')
    expect(l('AC1 ■').hull).toBe('block')
    for (const n of [1, 2, 3, 4]) expect(shape('AC1 ◆', l(`AC${n} ◆`)).dots).toHaveLength(n)
    expect(shape('AC1 ◆', l('AC9 ◆')).dots).toHaveLength(4)
    for (const t of ['AC2 ◆', 'AC2 ▲', 'AC2 ■']) {
      const { details } = shape(t, l(t))
      expect(details).toHaveLength(2) // dome, underside band
      expect(details.flat().every(([x, y]) => Math.hypot(x, y) <= 1)).toBe(true)
    }
  })

  it('probe panels', () => {
    const l = waveLook(['5.00→5.000'], 3)
    expect([l.left, l.right]).toEqual([4, 5])
    expect(shape('5.00→5.000', l).outline).toHaveLength(1 + 4 + 5)
    expect(waveLook(['123456789→1'], 3)).toMatchObject({ left: 6, right: 1 })
  })

  it('wave tokens that do not parse draw the family from their hash', () => {
    const l = waveLook(['AC1 ◆'], 4)
    const s = shape('26', l)
    expect(s.dots.length).toBeGreaterThanOrEqual(1)
    expect(s.dots.length).toBeLessThanOrEqual(4)
  })

  it('caps over random tokens', () => {
    let x = 7
    const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648)
    const alpha = '0123456789abcdef→.AC ◆▲■xyz'
    for (let i = 0; i < 300; i++) {
      const t = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => alpha[Math.floor(rnd() * alpha.length)]).join('')
      const l = waveLook([t, 'AC2 ■', t], i)
      expect(l.verts).toBeLessThanOrEqual(12)
      expect(l.craters).toBeGreaterThanOrEqual(1)
      expect(l.craters).toBeLessThanOrEqual(3)
      for (const p of [l, waveLook(rocks, i), waveLook(['5.00→5.00'], i)]) {
        expect(p.left).toBeLessThanOrEqual(6)
        expect(p.right).toBeGreaterThanOrEqual(1)
        const s = shape(t, p)
        for (const [px, py] of [...s.outline.flat(), ...s.dots]) expect(Math.hypot(px, py)).toBeLessThanOrEqual(1)
        expect(s.dots.length).toBeLessThanOrEqual(4)
        expect(Math.abs(s.lum)).toBeLessThanOrEqual(0.05)
      }
    }
  })

  it('token modulation is small', () => {
    const l = waveLook(['26dd', '237c'], 9)
    const a = shape('26dd', l)
    const b = shape('237c', l)
    expect(a.outline[0]).toHaveLength(b.outline[0].length)
    expect(ratio(radii('26dd', l), radii('237c', l))).toBeLessThanOrEqual(1.13)
    for (const s of [a, b]) {
      expect(s.spin.rate).toBeGreaterThanOrEqual(l.spin * 0.9)
      expect(s.spin.rate).toBeLessThanOrEqual(l.spin * 1.1)
      expect(Math.abs(s.lum)).toBeLessThanOrEqual(0.05)
    }
    const p = waveLook(['5.00→5.00', '5.00→5.000'], 9)
    const c = shape('5.00→5.00', p)
    const d = shape('5.00→5.000', p)
    expect(c.outline).toHaveLength(d.outline.length)
    const xs = (s: typeof c) => s.outline.flat().map(([x]) => x)
    xs(c).forEach((x, i) => expect(Math.abs(x - xs(d)[i])).toBeLessThanOrEqual(0.07))
    const longer = shape('1→12345', p)
    const right = Math.max(...longer.outline.flat().map(([x]) => x))
    expect(right / Math.max(...shape('12345→1', p).outline.flat().map(([x]) => x))).toBeLessThanOrEqual(1.13)
  })

  it('shares structure across a wave', () => {
    const l = waveLook(['AC1 ◆', 'AC3 ◆', 'AC2 ◆'], 11)
    const s = ['AC1 ◆', 'AC3 ◆', 'AC2 ◆'].map((t) => shape(t, l))
    expect(new Set(s.map((x) => x.outline.length + ':' + x.outline[0].length + ':' + x.dots.length + ':' + x.details.map((d) => d.length))).size).toBe(1)
    const r = waveLook(rocks, 11)
    expect(new Set(rocks.map((t) => shape(t, r).outline[0].length)).size).toBe(1)
    expect(new Set(rocks.map((t) => shape(t, r).dots.length)).size).toBe(1)
  })

  it('bad adds a crack and leaves the outline', () => {
    const l = waveLook(rocks, 5)
    const a = shape('26dd', l)
    const b = shape('26dd', l, { bad: true })
    expect(a.crack).toBeUndefined()
    expect(b.crack!.length).toBeGreaterThanOrEqual(2)
    expect(b.outline).toEqual(a.outline)
    expect({ ...b, crack: undefined }).toEqual({ ...a, crack: undefined })
  })
})
