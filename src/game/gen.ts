import { rng } from './engine.ts'

// Each target is one asteroid drawn from one choice record:
// identity -> silhouette, facets, crater and vent placement (unique per choice)
// family -> mineral palette (shuffled per wave, never tied to the answer)
// own step output (record.context) -> crystal druse: one crystal per step of that job, the own step is the heart crystal
// pipeline stages -> one crater per stage outside, one band per stage inside, one tick per step output on its band
// context stage -> the docked craft; marks (the clue) -> the core, visible only when the scan splits the rock

export type Pt = [number, number]
export type Tone = string
export type Part = { points: Pt[]; fill?: Tone; stroke?: Tone; width: number }
type Stage = { stage: string; conclusion?: string; steps: string[]; url?: string }
type Art = { marks: string[]; stages: Stage[]; context?: { quote: string; url?: string } }

const base = {
  void: '#141c23', shadow: '#283541', frame: '#576776', armor: '#aeb9bc', light: '#f3f1de',
  glass: '#3f7f8a', signal: '#a6e8e1', copper: '#e0ac70', ember: '#9b4f2f', dull: '#4a5157', dusk: '#2d3338',
}
const minerals = {
  basalt: ['#1a2127', '#28323a', '#3f4c55', '#5f6e77', '#8b9a9f'],
  iron: ['#261a15', '#3f2c24', '#5f4334', '#876345', '#b38c62'],
  ice: ['#1b2c37', '#2c4757', '#4a7080', '#7aa2ad', '#bcd6da'],
  carbon: ['#15120e', '#221e18', '#363027', '#50483c', '#716756'],
  olivine: ['#192217', '#293725', '#425539', '#637a51', '#91a676'],
  chondrite: ['#29221a', '#41362a', '#615241', '#87745e', '#b3a083'],
  obsidian: ['#15121b', '#231e2d', '#372f46', '#534764', '#7a6c8b'],
} as const
export type Family = keyof typeof minerals
export const families = Object.keys(minerals) as Family[]
export const colors: Record<string, string> = {
  ...base,
  ...Object.fromEntries(families.flatMap((f) => minerals[f].map((c, i) => [f + i, c]))),
}

export type Shape = {
  family: Family
  outline: Pt[]
  shell: Part[]
  surface: Part[]
  inner: Part[]
  spin: { rate: number; phase: number }
  lum: number
}

export const hash = (s: string) => {
  let n = 2166136261
  for (const c of s) n = Math.imul(n ^ c.codePointAt(0)!, 16777619)
  return n >>> 0
}

const TAU = 2 * Math.PI
const LIGHT: Pt = [-0.6, -0.8]
const STEP = /^(\d+)\. (.+) · (\w+)$/
const parse = (s: string, j: number) => {
  const [, number, name, result] = STEP.exec(s) ?? ['', String(j + 1), s, 'unknown']
  return { number: Number(number), name, result }
}
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const len = (a: Pt) => Math.hypot(a[0], a[1])
const unit = (a: Pt): Pt => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1]
const mean = (ps: Pt[]): Pt => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]
const clampInt = (x: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(x)))
const plate = (points: Pt[], fill: Tone, stroke?: Tone, width = 0.008): Part => ({ points, fill, stroke, width })
const wire = (points: Pt[], stroke: Tone, width = 0.02): Part => ({ points, stroke, width })
const box = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const ellipse = (c: Pt, a: number, b: number, angle: number, n = 12): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i * TAU) / n
    const x = a * Math.cos(t)
    const y = b * Math.sin(t)
    return [c[0] + x * Math.cos(angle) - y * Math.sin(angle), c[1] + x * Math.sin(angle) + y * Math.cos(angle)]
  })
const rim = (x: number, y: number, rx: number, ry: number, n: number, phase = 0): Pt[] => ellipse([x, y], rx, ry, phase, n)

// Lumpy silhouette: a few low harmonics plus vertex noise, squashed and tilted.
function silhouette(r: () => number): Pt[] {
  const n = 14 + Math.floor(r() * 8)
  const waves = [1, 2, 3, 5].map((k) => ({ k, a: (0.035 + r() * 0.07) / Math.sqrt(k), p: r() * TAU }))
  const squash = 0.8 + r() * 0.17
  const tilt = r() * TAU
  return Array.from({ length: n }, (_, i): Pt => {
    const a = ((i + (r() - 0.5) * 0.6) / n) * TAU
    const radius = Math.min(0.8, 0.64 + waves.reduce((s, w) => s + w.a * Math.sin(w.k * a + w.p), 0) + (r() - 0.5) * 0.05)
    const x = Math.cos(a) * radius
    const y = Math.sin(a) * radius * squash
    return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]
  })
}

const scaled = (ps: Pt[], c: Pt, k: number): Pt[] => ps.map((p) => add(c, sub(p, c), k))

// Point at fraction f of the closed polygon's perimeter, with the inward direction to c.
function along(ps: Pt[], f: number): Pt {
  const edges = ps.map((p, i) => len(sub(ps[(i + 1) % ps.length]!, p)))
  let d = f * edges.reduce((s, e) => s + e, 0)
  for (const [i, e] of edges.entries()) {
    if (d <= e) return add(ps[i]!, sub(ps[(i + 1) % ps.length]!, ps[i]!), d / e)
    d -= e
  }
  return ps[0]!
}

function shellOf(family: Family, out: Pt[], c: Pt, r: () => number, parts: Part[]) {
  const tone = (i: number) => family + clampInt(i, 0, 4)
  const ring = (k: number, jitter: number) => out.map((p, i) => {
    const q = out[(i + 1) % out.length]
    return add(add(c, sub(p, c), k + (r() - 0.5) * jitter), sub(q!, p), (r() - 0.5) * 0.25)
  })
  const rings = [out, ring(0.78, 0.08), ring(0.45, 0.12)]
  const slope = [2.2, 1.5, 0.8]
  for (const [i, p] of out.entries()) {
    const j = (i + 1) % out.length
    const edge = sub(out[j]!, p)
    let normal = unit([edge[1], -edge[0]])
    if (dot(normal, sub(mean([p, out[j]!]), c)) < 0) normal = [-normal[0], -normal[1]]
    const lit = dot(normal, LIGHT)
    for (const [k, a] of rings.entries()) {
      const b = rings[k + 1]
      const face: Pt[] = b ? [a[i]!, a[j]!, b[j]!, b[i]!] : [a[i]!, a[j]!, c]
      const t = tone(2 + (k ? 0.5 : 0) + slope[k]! * lit + (r() - 0.5) * 0.8)
      parts.push(plate(face, t, t, 0.006))
    }
    parts.push(wire([p, out[j]!], lit > 0.25 ? tone(4) : lit < -0.35 ? tone(0) : tone(1), lit > 0.25 ? 0.016 : 0.022))
  }
  const fissures = 1 + Math.floor(r() * 3)
  for (let f = 0; f < fissures; f++) {
    let p = rings[1]![Math.floor(r() * out.length)]!
    const line: Pt[] = [p]
    for (let s = 0; s < 4; s++) {
      p = add(add(p!, sub(c, p!), 0.22 + r() * 0.15), [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12])
      line.push(p)
    }
    parts.push(wire(line.map((q) => add(q, LIGHT, -0.012)), tone(4), 0.008))
    parts.push(wire(line, tone(0), 0.016))
  }
  return rings[2]
}

const inside = (ps: Pt[], [x, y]: Pt) => ps.reduce((odd, [ax, ay], i) => {
  const [bx, by] = ps[(i + 1) % ps.length]!
  return (ay > y) !== (by > y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? !odd : odd
}, false)

// Faint veins seeded only by the clue's value (test name, SHA, reading), never by the criterion id or the answer:
// equal values share a pattern below conscious notice; the readable clue appears only in the split core.
function veins(family: Family, marks: string[], out: Pt[], c: Pt, parts: Part[]) {
  const key = marks.filter((m) => !/^AC\d+$/.test(m)).join('|')
  if (!key) return
  const v = rng(hash(key))
  const angle = v() * Math.PI
  const d: Pt = [Math.cos(angle), Math.sin(angle)]
  const n: Pt = [-d[1], d[0]]
  const count = 2 + Math.floor(v() * 2)
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * (0.13 + v() * 0.06)
    const amp = 0.02 + v() * 0.04
    const freq = 2 + v() * 3
    const phase = v() * TAU
    let run: Pt[] = []
    for (let k = 0; k <= 12; k++) {
      const t = -0.7 + (k * 1.4) / 12
      const p = add(add(c, d, t), n, offset + amp * Math.sin(freq * t * Math.PI + phase))
      if (inside(out, add(c, sub(p, c), 1.12))) run.push(p)
      else if (run.length) {
        if (run.length > 1) parts.push(wire(run, family + 3, 0.011))
        run = []
      }
    }
    if (run.length > 1) parts.push(wire(run, family + 3, 0.011))
  }
}

function craters(family: Family, stages: Stage[], mid: Pt[], c: Pt, r: () => number, parts: Part[]) {
  const tone = (i: number) => family + i
  const count = stages.length || 2
  for (let i = 0; i < count; i++) {
    const at = add(c, sub(mid[Math.floor(r() * mid.length)]!, c), 0.3 + r() * 1.2)
    const steps = stages[i]?.steps.length ?? 6
    const size = 0.035 + Math.min(steps, 21) * 0.0035 + r() * 0.015
    const away = sub(at, c)
    const angle = Math.atan2(away[1], away[0])
    const flat = 1 - Math.min(0.55, len(away) * 0.7)
    parts.push(plate(ellipse(at, size * flat, size, angle), tone(stages[i]?.conclusion === 'failure' ? 0 : 1)))
    parts.push(plate(ellipse(add(at, LIGHT, -size * 0.28), size * flat * 0.72, size * 0.72, angle), tone(3)))
    parts.push(plate(ellipse(add(at, LIGHT, -size * 0.12), size * flat * 0.62, size * 0.62, angle), tone(2)))
  }
  const pocks = 7 + Math.floor(r() * 8)
  for (let i = 0; i < pocks; i++) {
    const at = add(c, sub(mid[Math.floor(r() * mid.length)]!, c), 0.2 + r() * 1.6)
    const size = 0.01 + r() * 0.014
    parts.push(plate(ellipse(at, size, size * (0.6 + r() * 0.4), r() * TAU, 6), tone(r() < 0.5 ? 1 : 4)))
  }
}

function druse(family: Family, record: Art, out: Pt[], c: Pt, r: () => number, parts: Part[]) {
  const job = record.stages.find((s) => s.url === record.context?.url) ?? record.stages[0]
  const steps = job?.steps ?? []
  const ventIndex = Math.floor(r() * out.length)
  if (!steps.length) return ventIndex
  const vent = out[ventIndex]
  const dir0 = unit(sub(vent!, c))
  const angle0 = Math.atan2(dir0[1], dir0[0])
  const root = add(c, sub(vent!, c), 0.7)
  const heart = steps.indexOf(record.context?.quote ?? '')
  const n = steps.length
  const spread = Math.min(2.1, 0.12 * n + 0.35)
  parts.push(plate(ellipse(root, 0.1, 0.075, angle0 + Math.PI / 2, 9), family + 0, family + 1, 0.01))
  const crystals = steps.map((s, j) => {
    const { number, name, result } = parse(s, j)
    const f = n > 1 ? j / (n - 1) - 0.5 : 0
    const dir: Pt = [Math.cos(angle0 + f * spread), Math.sin(angle0 + f * spread)]
    const perp: Pt = [-dir[1], dir[0]]
    const start = add(root, [-dir0[1], dir0[0]], f * 0.14)
    const own = j === heart
    let length = (0.17 + (hash(name) % 6) * 0.028) * (own ? 1.5 : 1) * (result === 'skipped' ? 0.5 : 1)
    const reach = len(add(start, dir, length))
    if (reach > 0.97) length -= reach - 0.97
    const w = (0.028 + (number % 3) * 0.007) * (own ? 1.45 : 1)
    return { dir, perp, start, length, w, result, own }
  })
  crystals.sort((a, b) => Number(a.own) - Number(b.own) || a.length - b.length)
  for (const { dir, perp, start, length, w, result, own } of crystals) {
    const p0 = add(start, perp, w)
    const p3 = add(start, perp, -w)
    const shaft = add(start, dir, length * 0.78)
    const bend = result === 'failure' ? w * 0.9 : 0
    const tip = add(add(start, dir, length), perp, bend)
    const p1 = add(shaft, perp, w)
    const p2 = add(shaft, perp, -w)
    const [left, right, edge] = result === 'success' ? ['signal', 'glass', own ? 'light' : 'signal']
      : result === 'failure' ? ['copper', 'ember', 'copper'] : ['dull', 'dusk', undefined]
    parts.push(plate([p0, p1, tip, start], left, edge, 0.007))
    parts.push(plate([start, tip, p2, p3], right, edge, 0.007))
    if (result === 'failure') parts.push(wire([add(shaft, perp, w), add(add(start, dir, length * 0.55), perp, -w * 0.6)], 'void', 0.012))
    if (own) parts.push(wire([add(start, perp, w * 0.45), add(shaft, perp, w * 0.45)], 'light', 0.014))
  }
  return ventIndex
}

const vessels: Record<string, (r: () => number, d: Part[]) => void> = {
  'spec-review': (r, d) => {
    const rx = 0.5 + r() * 0.15
    d.push(plate(rim(0, 0, rx, 0.42, 12, 0.26), 'armor', 'light'))
    d.push(plate(rim(0, 0, rx - 0.15, 0.3, 12, 0.26), 'void', 'frame'))
    d.push(plate(rim(0, -0.1, 0.17, 0.17, 8), 'signal', 'light'))
    d.push(plate(rim(0, -0.1, 0.08, 0.08, 8), 'void', 'glass'))
    d.push(wire([[-rx, 0], [-rx - 0.22, -0.2]], 'copper', 0.06))
  },
  'write-tests': (r, d) => {
    for (const x of [-0.22, 0.22]) {
      d.push(plate(box(x - 0.1, -0.45, 0.2, 0.8 + r() * 0.1), 'glass', 'signal', 0.03))
      d.push(plate(box(x - 0.1, 0.05, 0.2, 0.3), 'signal', 'light', 0.03))
    }
    d.push(plate(box(-0.36, -0.55, 0.72, 0.12), 'armor', 'light', 0.03))
  },
  deliver: (r, d) => {
    const w = 0.7 + r() * 0.2
    d.push(plate([[-w, -0.25], [w * 0.7, -0.35], [w, 0], [w * 0.7, 0.35], [-w, 0.25]], 'armor', 'light', 0.03))
    d.push(plate([[-w * 0.6, -0.15], [w * 0.4, -0.2], [w * 0.4, 0.2], [-w * 0.6, 0.15]], 'copper', 'ember', 0.03))
    d.push(plate([[w * 0.55, -0.2], [w * 0.9, 0], [w * 0.55, 0.2]], 'glass', 'light', 0.03))
    d.push(wire([[-w, -0.15], [-w - 0.2, -0.1]], 'signal', 0.05))
    d.push(wire([[-w, 0.15], [-w - 0.2, 0.1]], 'signal', 0.05))
  },
  gate: (r, d) => {
    const s = 0.42 + r() * 0.1
    d.push(plate(rim(0, 0, s, s, 8, Math.PI / 8), 'armor', 'light', 0.03))
    d.push(plate(rim(0, 0, s * 0.55, s * 0.55, 8, Math.PI / 8), 'void', 'frame', 0.03))
    d.push(plate(box(-0.09, -s * 0.4, 0.18, s * 0.8), 'copper', 'light', 0.03))
    d.push(wire([[-s, 0], [-s - 0.25, 0]], 'frame', 0.08))
  },
  'pr-loop': (r, d) => {
    const s = 0.45 + r() * 0.1
    d.push(wire(rim(0, 0, s, s * 0.7, 14).slice(0, 12), 'copper', 0.1))
    d.push(wire(rim(0, 0, s * 0.62, s * 0.42, 14).slice(2, 14), 'signal', 0.07))
    d.push(plate([[-0.18, -0.12], [0.2, -0.16], [0.24, 0.12], [-0.2, 0.14]], 'armor', 'light', 0.03))
  },
}

function craft(record: Art, out: Pt[], c: Pt, vent: number, r: () => number, parts: Part[]) {
  const stage = record.stages.find((s) => s.url === record.context?.url)?.stage
  const draw = stage && vessels[stage]
  if (!draw) return
  const local: Part[] = []
  draw(r, local)
  const dock = out[(vent + Math.floor(out.length / 2) + Math.floor(r() * 3) - 1) % out.length]
  const away = unit(sub(dock!, c))
  const angle = Math.atan2(away[1], away[0]) + Math.PI / 2
  const at = add(c, sub(dock!, c), 0.92)
  const k = 0.27
  const move = ([x, y]: Pt): Pt => [at[0] + k * (x * Math.cos(angle) - y * Math.sin(angle)), at[1] + k * (x * Math.sin(angle) + y * Math.cos(angle))]
  for (const p of local) parts.push({ ...p, points: p.points.map(move), width: p.width * k * 2.2 })
}

const glyphs: Record<string, Pt[]> = {
  '◆': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '◇': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '◈': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '▲': [[0, -1], [1, 0.8], [-1, 0.8]],
  '▼': [[-1, -0.8], [1, -0.8], [0, 1]],
  '■': box(-0.78, -0.78, 1.56, 1.56),
  '✚': [[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]],
  '★': rim(0, 0, 1, 1, 10, -Math.PI / 2).map(([x, y], i) => (i % 2 ? [x * 0.42, y * 0.42] : [x, y])),
}

// Digits as crystal bars: hex value -> height, so a prefix, a full SHA and 5.00 vs 5.000 all read by length and rhythm.
function bars(text: string, cx: number, cy: number, span: number, parts: Part[], unitHeight = 0.012) {
  const digits = [...(/^[a-f0-9]+$/i.test(text) ? text.slice(0, 7) : text.replace('.', '')).slice(0, 7)]
  const step = span / 7
  const x0 = cx - (digits.length * step) / 2
  for (const [i, ch] of digits.entries()) {
    const v = parseInt(ch, 16)
    const h = 0.03 + (Number.isNaN(v) ? 2 + (hash(ch) % 6) : v + 1) * unitHeight
    const x = x0 + i * step + step * 0.15
    parts.push(plate([[x, cy], [x, cy - h], [x + step * 0.35, cy - h - step * 0.35], [x + step * 0.7, cy - h], [x + step * 0.7, cy]], 'signal', 'light', 0.006))
  }
}

function core(record: Art, c: Pt, criterionOrder: boolean, parts: Part[]) {
  const { marks } = record
  const figure = glyphs[marks[1]!]
  if (figure) {
    const ordinal = criterionOrder ? Number(/^AC(\d+)$/.exec(marks[0]!)?.[1]) || 0 : 0
    const sha = /^[a-f0-9]{4,}$/i.test(marks[0]!)
    const g: Pt = [c[0] - (ordinal ? 0.09 : 0), c[1] - (sha ? 0.07 : 0)]
    const s = 0.13
    const hollow = marks[1] === '◇' || marks[1] === '◈'
    parts.push(plate(figure.map(([x, y]) => [g[0] + x * s, g[1] + y * s]), hollow ? 'void' : 'light', 'light', 0.022))
    if (marks[1] === '◈') parts.push(plate(rim(g[0], g[1], s * 0.45, s * 0.45, 4), 'light', 'light'))
    for (let i = 0; i < ordinal; i++) parts.push(wire([[c[0] + 0.07 + i * 0.05, c[1] - 0.07], [c[0] + 0.07 + i * 0.05, c[1] + 0.07]], 'signal', 0.024))
    if (sha) bars(marks[0]!, c[0], c[1] + 0.2, 0.26, parts)
    return
  }
  if (marks.length >= 2) {
    bars(marks[0]!, c[0] - 0.135, c[1] + 0.1, 0.25, parts, 0.018)
    bars(marks[1]!, c[0] + 0.135, c[1] + 0.1, 0.25, parts, 0.018)
    parts.push(wire([[c[0] - 0.025, c[1] + 0.14], [c[0] + 0.025, c[1] + 0.14], [c[0] + 0.005, c[1] + 0.12]], 'copper', 0.016))
    return
  }
  bars(marks[0] ?? '', c[0], c[1] + 0.1, 0.34, parts)
}

function interior(family: Family, record: Art, out: Pt[], c: Pt, r: () => number, criterionOrder: boolean, parts: Part[]) {
  const tone = (i: number) => family + i
  parts.push(plate(scaled(out, c, 0.9), tone(0), tone(1), 0.012))
  const stages = record.stages.length ? record.stages : [{ stage: '', steps: [] }]
  const outer = 0.82
  const inner = 0.52
  for (const [i, { conclusion, steps }] of stages.entries()) {
    const k = outer - (i * (outer - inner)) / stages.length
    const ring = scaled(out, c, k)
    parts.push(plate(ring, conclusion === 'failure' ? 'ember' : tone(i % 2 ? 3 : 2), tone(1), 0.01))
    const depth = (0.7 * (outer - inner)) / stages.length
    for (const [j, s] of steps.entries()) {
      const { result } = parse(s, j)
      const p = along(ring, (j + 0.5) / steps.length)
      const q = add(p, unit(sub(c, p)), depth * (result === 'failure' ? 1 : result === 'skipped' ? 0.4 : 0.7) * 0.6)
      parts.push(wire([p, q], result === 'success' ? 'light' : result === 'failure' ? 'copper' : tone(1), 0.011))
    }
  }
  const cavity = scaled(out, c, inner * 0.92)
  parts.push(plate(cavity, 'void', 'glass', 0.014))
  const teeth = 10 + Math.floor(r() * 7)
  for (let i = 0; i < teeth; i++) {
    const a = along(cavity, i / teeth)
    const b = along(cavity, (i + 0.6) / teeth)
    const tip = add(mean([a, b]), unit(sub(c, mean([a, b]))), 0.025 + r() * 0.02)
    parts.push(plate([a, b, tip], i % 2 ? 'glass' : 'shadow', 'signal', 0.005))
  }
  core(record, c, criterionOrder, parts)
}

export function shape(record: Art, identity: string, family: Family, criterionOrder = false): Shape {
  const r = rng(hash(JSON.stringify([identity, record.context?.quote ?? ''])))
  const out = silhouette(r)
  const c: Pt = add(mean(out), [(r() - 0.5) * 0.08, (r() - 0.5) * 0.08])
  const shell: Part[] = []
  const mid = shellOf(family, out, c, r, shell)
  veins(family, record.marks, out, c, shell)
  craters(family, record.stages, mid!, c, r, shell)
  const surface: Part[] = []
  const vent = druse(family, record, out, c, r, surface)
  craft(record, out, c, vent, r, surface)
  const inner: Part[] = []
  interior(family, record, out, c, r, criterionOrder, inner)
  return { family, outline: out, shell, surface, inner, spin: { rate: 0.012 + 0.012 * r(), phase: r() * TAU }, lum: r() - 0.5 }
}

// Closed: shell and surface. Inspected: the scan splits the rock and shows the cross-section with the core.
export function paintObject(s: Shape, draw: (part: Part) => void, inspected = false) {
  s.shell.forEach(draw)
  if (inspected) s.inner.forEach(draw)
  s.surface.forEach(draw)
}
