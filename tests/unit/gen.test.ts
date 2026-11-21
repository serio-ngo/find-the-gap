import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { colors, families, paintObject, shape } from '../../src/game/gen.ts'
import type { Part, Shape } from '../../src/game/gen.ts'
import { decks } from '../../src/game/levels/index.ts'
import { presentObjects } from '../../src/game/objects.ts'

const N = 64
const inside = (ps: Part['points'], x: number, y: number) => ps.reduce((odd, [ax, ay], i) => {
  const [bx, by] = ps[(i + 1) % ps.length]!
  return (ay > y) !== (by > y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? !odd : odd
}, false)

// What the eye gets: an N x N picture of the drawn colours, shading included, nothing from the record.
const picture = (s: Shape) => {
  const px: string[] = Array(N * N).fill('')
  const cell = (v: number) => Math.min(N - 1, Math.max(0, Math.floor(((v + 1) / 2) * N)))
  const fill = (p: Part, c: string) => {
    const xs = p.points.map((q) => q[0])
    const ys = p.points.map((q) => q[1])
    for (let j = cell(Math.min(...ys)); j <= cell(Math.max(...ys)); j++) {
      for (let i = cell(Math.min(...xs)); i <= cell(Math.max(...xs)); i++) if (inside(p.points, ((i + 0.5) / N) * 2 - 1, ((j + 0.5) / N) * 2 - 1)) px[j * N + i] = c
    }
  }
  paintObject(s, (p) => p.fill && fill(p, colors[p.fill]!))
  return px
}
const holes = (px: string[]) => px.filter((c) => c === colors.light).length
const lopsided = (px: string[]) => {
  let seen = 0
  let off = 0
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = px[j * N + i]!
    if (!a) continue
    seen++
    off += +(a !== px[j * N + N - 1 - i])
  }
  return off / seen
}
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs))
// Look for an empty socket; with none on the board, pick the most lopsided rock.
export const look = (shapes: Shape[]) => {
  const pics = shapes.map(picture)
  const h = pics.map(holes)
  return Math.max(...h) > 0 ? argmax(h) : argmax(pics.map(lopsided))
}

describe('the board carries the evidence', () => {
  it('is reproducible for every skin', () => {
    for (const family of families) {
      const r = { rule: 'pair', values: ['t1', 't1', 't3'] }
      expect(shape(r, 'a', family)).toEqual(shape(r, 'a', family))
    }
  })

  it('odd revision: equal commits give a mirror-symmetric rock, different commits a lopsided one', () => {
    expect(lopsided(picture(shape({ rule: 'odd_revision', values: ['4a4c54a', '4a4c54a'] }, 'a', 'ice')))).toBe(0)
    expect(lopsided(picture(shape({ rule: 'odd_revision', values: ['47f353e', '9c2d87a'] }, 'a', 'ice')))).toBeGreaterThan(0.02)
  })

  it('missing link and pair: one empty socket per criterion without its own result or test', () => {
    const sockets = (rule: string, values: string[]) => shape({ rule, values }, 'a', 'iron').marks.filter((m) => m.fill === 'light').length
    expect(sockets('missing_link', ['passed', 'failed', 'passed'])).toBe(0)
    expect(sockets('missing_link', ['failed', 'missing', 'missing', 'passed'])).toBe(2)
    expect(sockets('pair', ['t1', 't2', 't3', 't4'])).toBe(0)
    expect(sockets('pair', ['t1', 't1', 't1', 't4'])).toBe(2)
  })

  it('paints the body, then the evidence', () => {
    const s = shape({ rule: 'pair', values: ['t1', 't2'] }, 'a', 'carbon')
    const parts: Part[] = []
    paintObject(s, (p) => parts.push(p))
    expect(parts).toEqual([...s.body, ...s.marks])
  })

  // The proof: an observer that sees only the picture finds the gap in every scored wave; the stored AI run reads the text.
  it('a picture-only observer finds every gap the AI finds from the data, and more', () => {
    const d = decks.observations!
    const ai = JSON.parse(readFileSync(new URL('../../src/game/eval/ai-run.json', import.meta.url), 'utf8')).standard as Record<string, (number | null)[]>
    const tally = d.levels.map((l) => {
      let eye = 0
      let model = 0
      l.sequence.forEach((s, i) => {
        const w = wave(d, s)
        const objects = presentObjects(d, w, `${d.id}:${l.id}:standard:${i}`)
        eye += +w.answers.includes(objects[look(objects.map((o) => o.shape))]!.sourceIndex)
        model += +w.answers.includes(ai[l.id]![i] as number)
      })
      return { level: l.id, waves: l.sequence.length, eye, model }
    })
    console.table(tally)
    for (const t of tally) {
      expect(t.eye).toBe(t.waves)
      expect(t.eye).toBeGreaterThanOrEqual(t.model)
    }
  }, 60_000)
})
