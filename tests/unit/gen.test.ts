import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { wave } from '../../src/game/engine.ts'
import { colors, paintObject, shape } from '../../src/game/gen.ts'
import { families } from '../../src/game/geom.ts'
import type { Part, Shape, Signs } from '../../src/game/gen.ts'
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
  paintObject(s, (p) => p.fill && fill(p, colors[p.fill] ?? p.fill))
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
      expect(shape(r, family)).toEqual(shape(r, family))
    }
  })

  it('odd revision: equal commits give a mirror-symmetric rock, different commits a lopsided one', () => {
    expect(lopsided(picture(shape({ rule: 'odd_revision', values: ['4a4c54a', '4a4c54a'] }, 'ice')))).toBe(0)
    expect(lopsided(picture(shape({ rule: 'odd_revision', values: ['47f353e', '9c2d87a'] }, 'ice')))).toBeGreaterThan(0.02)
  })

  const full: Signs = { locks: 3, job: 2, share: 3, impacts: 2, agent: 3 }
  it('halo, craters and alien keep an equal-commit rock mirror-symmetric, and each follows its field', () => {
    const r = (signs: Signs | null) => shape({ rule: 'odd_revision', values: ['4a4c54a', '4a4c54a'], signs }, 'iron')
    expect(lopsided(picture(r(full)))).toBe(0)
    expect(r(full).facts).toMatchObject({ segments: 4, lit: 3, craters: 2, eyes: 4, symmetric: true })
    expect(r(null).under).toEqual([])
    expect(r(null).over).toEqual([])
    expect(r({ ...full, impacts: 0 }).over.length).toBe(r(full).over.length - 6)
    expect(r({ ...full, locks: 0 }).under.length).toBeLessThan(r(full).under.length)
  })

  it('the alien is at least 0.2 of the half cell wide and grows with agent commits', () => {
    const width = (agent: number) => {
      const xs = shape({ rule: 'pair', values: ['t1', 't2'], signs: { ...full, agent } }, 'basalt').over.slice(-(4 + 2 * (agent + 1)) - 2).flatMap((p) => p.points.map((q) => q[0]))
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(width(0)).toBeGreaterThanOrEqual(0.4)
    expect(width(3)).toBeGreaterThan(width(0))
  })

  it('context strength fades context colours, never evidence or what is drawn', () => {
    const a = shape({ rule: 'pair', values: ['t1', 't1', 't3'], signs: full }, 'basalt', 0.4)
    const b = shape({ rule: 'pair', values: ['t1', 't1', 't3'], signs: full }, 'basalt', 1)
    expect(a.marks).toEqual(b.marks)
    expect(a.body).toEqual(b.body)
    expect(a.facts).toEqual(b.facts)
    expect(a.over.map((p) => p.points)).toEqual(b.over.map((p) => p.points))
    expect(a.over.map((p) => p.fill)).not.toEqual(b.over.map((p) => p.fill))
  })

  it('missing link and pair: one empty socket per criterion without its own result or test', () => {
    const sockets = (rule: string, values: string[]) => shape({ rule, values }, 'iron').facts.sockets
    expect(sockets('missing_link', ['passed', 'failed', 'passed'])).toBe(0)
    expect(sockets('missing_link', ['failed', 'missing', 'missing', 'passed'])).toBe(2)
    expect(sockets('pair', ['t1', 't2', 't3', 't4'])).toBe(0)
    expect(sockets('pair', ['t1', 't1', 't1', 't4'])).toBe(2)
  })

  it('paints the halo, the body, craters and alien, then the evidence on top', () => {
    const s = shape({ rule: 'pair', values: ['t1', 't2'], signs: full }, 'carbon')
    const parts: Part[] = []
    paintObject(s, (p) => parts.push(p))
    expect(parts).toEqual([...s.under, ...s.body, ...s.over, ...s.marks])
  })

  // The proof: an observer that sees only the picture finds the gap in every scored wave; the stored AI run reads the text.
  it('a picture-only observer finds every gap the AI finds from the data, and more', () => {
    const d = decks.observations!
    const ai = JSON.parse(readFileSync(new URL('../../src/game/eval/ai-run.json', import.meta.url), 'utf8')).standard as Record<string, (number | null)[]>
    const tally = d.levels.map((l) => {
      let eye = 0
      let model = 0
      l.anchors.forEach((i) => {
        const w = wave(d, l.sequence[i]!)
        const objects = presentObjects(d, w)
        eye += +w.answers.includes(objects[look(objects.map((o) => o.shape))]!.sourceIndex)
        model += +w.answers.includes(ai[l.id]![i] as number)
      })
      return { level: l.id, waves: l.anchors.length, eye, model }
    })
    console.table(tally)
    for (const t of tally) {
      expect(t.eye).toBe(t.waves)
      expect(t.eye).toBeGreaterThanOrEqual(t.model)
    }
  }, 60_000)
})
