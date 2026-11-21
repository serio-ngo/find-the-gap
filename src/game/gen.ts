import { rng } from './engine.ts'

export type Pt = [number, number]
export type Tone = string
export type Part = { points: Pt[]; fill?: Tone; stroke?: Tone; width: number }

const base = {
  void: '#141c23', shadow: '#283541', frame: '#576776', armor: '#aeb9bc', light: '#f3f1de',
  glass: '#3f7f8a', signal: '#a6e8e1', copper: '#e0ac70', violet: '#b79cf0', rose: '#f08fb0', lime: '#c6e87a', dull: '#4a5157',
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

const reach: Record<string, number> = { signal: 1, copper: 0.85, violet: 0.7, rose: 0.58, lime: 0.47 }

function core(cells: string[], c: Pt, parts: Part[]) {
  const n = cells.length
  const gap = Math.min(0.25, Math.PI / n / 3)
  for (const [i, tone] of cells.entries()) {
    const a0 = -Math.PI / 2 + (i * TAU) / n + gap
    const a1 = a0 + TAU / n - 2 * gap
    const arc = Array.from({ length: 9 }, (_, k): Pt => {
      const a = a0 + ((a1 - a0) * k) / 8
      const radius = 0.34 * (reach[tone] ?? 1)
      return [c[0] + radius * Math.cos(a), c[1] + radius * Math.sin(a)]
    })
    const hub: Pt[] = [add(c, [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)], 0.06)]
    parts.push(plate([...hub, ...arc], tone, tone === 'void' ? 'frame' : 'light', tone === 'void' ? 0.03 : 0.012))
  }
}

export function shape(cells: string[], identity: string, family: Family): Shape {
  const r = rng(hash(identity))
  const out = silhouette(r)
  const c: Pt = add(mean(out), [(r() - 0.5) * 0.08, (r() - 0.5) * 0.08])
  const shell: Part[] = []
  shellOf(family, out, c, r, shell)
  const inner: Part[] = [plate(scaled(out, c, 0.9), family + 0, family + 1, 0.012), plate(scaled(out, c, 0.62), 'void', 'glass', 0.014)]
  core(cells, c, inner)
  return { family, outline: out, shell, surface: [], inner, spin: { rate: 0.012 + 0.012 * r(), phase: r() * TAU }, lum: r() - 0.5 }
}

export function paintObject(s: Shape, draw: (part: Part) => void, inspected = false) {
  s.shell.forEach(draw)
  if (inspected) s.inner.forEach(draw)
  s.surface.forEach(draw)
}
