import { rng } from './engine.ts'
import type { ChoiceRecord } from './engine.ts'
import { alien, craters, halo } from './context.ts'
import { LIGHT, REACH, TAU, add, at, dot, hash, len, mirror, plate, sub, unit, wire } from './geom.ts'
import type { Family, Part, Pt } from './geom.ts'

export { colors, hash } from './geom.ts'
export type { Family, Part, Pt, Signs } from './geom.ts'

export type Half = { crystals: number; tint: string; reach: number }
export type Facts = { crystals: number; sides: Half[]; symmetric: boolean; signs: boolean; arcs: number; lit: boolean; craters: number; bright: boolean }
export type Shape = { family: Family; outline: Pt[]; under: Part[]; body: Part[]; over: Part[]; marks: Part[]; facts: Facts }

const slot = (i: number, n: number) => -Math.PI / 2 + (i * TAU) / n
const digits = (v: string) => [...(v.length > 7 ? hash(v).toString(16) : v).padEnd(7, '0').slice(0, 7)].map((c) => {
  const d = parseInt(c, 16)
  return Number.isNaN(d) ? c.codePointAt(0)! % 16 : d
})

type Face = { points: Pt[]; edge: [Pt, Pt]; ring: number; noise: number }
type Side = { out: Pt[]; faces: Face[] }

function side(seed: string, ends: [number, number], squash: number): Side {
  const r = rng(hash(seed))
  const n = 7 + Math.floor(r() * 4)
  const waves = [1, 2, 3].map((k) => ({ k, a: (0.03 + r() * 0.06) / Math.sqrt(k), p: r() * TAU }))
  const out = Array.from({ length: n + 1 }, (_, i): Pt => {
    const a = -Math.PI / 2 + Math.PI * (i && i < n ? (i + (r() - 0.5) * 0.4) / n : i / n)
    const radius = i === 0 ? ends[0] : i === n ? ends[1] : Math.min(0.68, 0.55 + waves.reduce((s, w) => s + w.a * Math.sin(w.k * a + w.p), 0) + (r() - 0.5) * 0.04)
    return [Math.max(0, Math.cos(a)) * radius, Math.sin(a) * radius * squash]
  })
  const rings = [out, out.map((p) => add([0, 0], p, 0.78 + (r() - 0.5) * 0.08)), out.map((p) => add([0, 0], p, 0.45 + (r() - 0.5) * 0.1))]
  const faces: Face[] = []
  for (let i = 0; i < n; i++) {
    for (const [k, a] of rings.entries()) {
      const b = rings[k + 1]
      faces.push({ points: b ? [a[i]!, a[i + 1]!, b[i + 1]!, b[i]!] : [a[i]!, a[i + 1]!, [0, 0]], edge: [out[i]!, out[i + 1]!], ring: k, noise: (r() - 0.5) * 0.8 })
    }
  }
  return { out, faces }
}

const flip = (s: Side): Side => ({
  out: s.out.map(mirror),
  faces: s.faces.map((f) => ({ ...f, points: f.points.map(mirror), edge: [mirror(f.edge[0]), mirror(f.edge[1])] })),
})

function rock(family: Family, shared: string, right: string, left: string) {
  const s = rng(hash(shared))
  const ends: [number, number] = [0.5 + 0.12 * s(), 0.5 + 0.12 * s()]
  const squash = 0.84 + 0.14 * s()
  const halves = [side(right, ends, squash), flip(side(left, ends, squash))]
  const tone = (i: number) => family + Math.min(4, Math.max(0, Math.round(i)))
  const lit = ([p, q]: [Pt, Pt]) => {
    let n = unit([q[1] - p[1], p[0] - q[0]])
    if (dot(n, add(p, q)) < 0) n = [-n[0], -n[1]]
    return dot(n, LIGHT)
  }
  const body: Part[] = []
  const slope = [2.2, 1.5, 0.8]
  for (const h of halves) {
    for (const f of h.faces) {
      const t = tone(2 + (f.ring ? 0.5 : 0) + slope[f.ring]! * lit(f.edge) + f.noise)
      body.push(plate(f.points, t, t, 0.006))
    }
  }
  for (const h of halves) {
    for (let i = 0; i + 1 < h.out.length; i++) {
      const l = lit([h.out[i]!, h.out[i + 1]!])
      body.push(wire([h.out[i]!, h.out[i + 1]!], tone(l > 0.25 ? 4 : l < -0.35 ? 0 : 1), l > 0.25 ? 0.016 : 0.022))
    }
  }
  const [a, b] = halves
  return { outline: [...a!.out, ...b!.out.slice(1, -1).reverse()], body }
}

const rimAt = (out: Pt[], a: number): Pt => {
  const d = at(a, 1)
  let best = 0.5
  out.forEach((p, i) => {
    const e = sub(out[(i + 1) % out.length]!, p)
    const den = d[0] * e[1] - d[1] * e[0]
    if (Math.abs(den) < 1e-9) return
    const s = (p[0] * e[1] - p[1] * e[0]) / den
    const t = (p[0] * d[1] - p[1] * d[0]) / den
    if (t >= -1e-9 && t <= 1 + 1e-9 && s > 0) best = s
  })
  return at(a, best)
}

const tints: Record<string, [string, string, string]> = {
  passed: ['signal', 'glass', 'signal'],
  violet: ['violet', 'obsidian3', 'violet'], lime: ['lime', 'olivine3', 'lime'], rose: ['rose', 'iron3', 'rose'],
}

function crystal(root: Pt, dir: Pt, length: number, w: number, tint: string, marks: Part[], hand = 1) {
  const perp: Pt = [-dir[1] * hand, dir[0] * hand]
  const reach = len(add(root, dir, length))
  const l = reach > REACH ? length - (reach - REACH) : length
  const shaft = add(root, dir, l * 0.78)
  const tip = add(root, dir, l)
  const [lit, shade, edge] = tints[tint] ?? tints.passed!
  marks.push({ ...plate([add(root, perp, w), add(shaft, perp, w), tip, root], lit, edge, 0.007), crystal: true })
  marks.push(plate([root, tip, add(shaft, perp, -w), add(root, perp, -w)], shade, edge, 0.007))
}

const radial = (out: Pt[], i: number, n: number) => {
  const dir = at(slot(i, n), 1)
  const rim = rimAt(out, slot(i, n))
  return { rim, dir, root: add(rim, dir, -0.06) }
}

function druse(v: string, right: boolean, vent: number, out: Pt[], marks: Part[]): Half {
  const d = digits(v)
  const n = 2 + (d[0]! % 3)
  const tint = ['passed', 'violet', 'lime', 'rose'][d[6]! % 4]!
  const length = (j: number) => 0.16 + 0.014 * d[j + 1]! + (j === n - 1 ? 0.006 * d[5]! : 0)
  for (let j = 0; j < n; j++) {
    const a = vent + (j - (n - 1) / 2) * 0.32
    const dir = at(right ? a : Math.PI - a, 1)
    crystal(add(rimAt(out, right ? a : Math.PI - a), dir, -0.07), dir, length(j), 0.03 + 0.003 * d[(j + 3) % 7]!, tint, marks, right ? 1 : -1)
  }
  return { crystals: n, tint: (tints[tint] ?? tints.passed!)[0], reach: Math.round(Math.max(...Array.from({ length: n }, (_, j) => length(j))) * 100) }
}

export function shape(record: Pick<ChoiceRecord, 'rule' | 'values' | 'signs'>, family: Family, strength = 1): Shape {
  const v = record.values
  const mirrored = record.rule === 'odd_revision'
  const seed = `${record.rule}:${v.join(',')}`
  const { outline, body } = rock(family, record.rule, mirrored ? `c:${v[1]}` : seed, mirrored ? `c:${v[0]}` : seed)
  const marks: Part[] = []
  const sides: Half[] = []
  if (mirrored) {
    const vent = -0.35 + ((hash(record.rule) % 100) / 100) * 0.7
    sides.push(druse(v[0] ?? '', false, vent, outline, marks), druse(v[1] ?? '', true, vent, outline, marks))
  } else {
    const k = hash(v.join(''))
    const n = 1 + (k % 5)
    for (let i = 0; i < n; i++) crystal(radial(outline, i, n).root, radial(outline, i, n).dir, 0.26, 0.045, ['passed', 'violet', 'lime'][k % 3]!, marks)
  }
  const under: Part[] = []
  const over: Part[] = []
  const sg = record.signs
  if (sg) {
    halo(sg, strength, under)
    craters(sg, family, strength, over)
    alien(sg, family, strength, over)
  }
  const facts: Facts = {
    crystals: marks.filter((m) => m.crystal).length,
    sides,
    symmetric: !mirrored || v[0] === v[1],
    signs: !!sg,
    arcs: sg ? Math.max(1, sg.criteria) : 0,
    lit: !!sg?.many,
    craters: sg?.impacts ?? 0,
    bright: sg?.job === 2,
  }
  return { family, outline, under, body, over, marks, facts }
}

export function paintObject(s: Shape, draw: (part: Part) => void) {
  s.under.forEach(draw)
  s.body.forEach(draw)
  s.over.forEach(draw)
  s.marks.forEach(draw)
}
