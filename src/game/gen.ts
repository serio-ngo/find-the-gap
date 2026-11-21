import { rng } from './engine.ts'
import type { ChoiceRecord } from './engine.ts'

export type Pt = [number, number]
// fill and stroke name a palette colour or carry a #hex mixed for the level's context strength
export type Part = { points: Pt[]; fill?: string; stroke?: string; width: number; crystal?: true }
// Context at the gate, as drawn levels: locks 0-3, job 0 none / 1 failed / 2 passed, share 0-4 quarters, impacts 0-2, agent 0-3.
export type Signs = { locks: number; job: number; share: number; impacts: number; agent: number }

const base = {
  void: '#141c23', shadow: '#283541', frame: '#576776', armor: '#aeb9bc', light: '#f3f1de',
  glass: '#3f7f8a', signal: '#a6e8e1', copper: '#e0ac70', ember: '#9b4f2f', violet: '#b79cf0', rose: '#f08fb0', lime: '#c6e87a', dull: '#4a5157',
  // context hues: never an evidence hue, so a halo or an alien is never read as a crystal
  halo0: '#2e4166', halo1: '#3f63b0', halo2: '#a9c6ff', alien0: '#7d6a1c', alien1: '#f2d45c', alienDim0: '#55503f', alienDim1: '#bdb595',
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

// Unit space: 1 is half of the rock's cell. The rock reaches about 0.68, its crystals about 0.95.
// under: the halo behind the rock; over: craters and the alien on it; marks: the evidence; facts: what is drawn, for accessible names.
export type Facts = { crystals: number; sockets: number; symmetric: boolean; segments: number; lit: number; craters: number; eyes: number; bright: boolean }
export type Shape = { family: Family; outline: Pt[]; under: Part[]; body: Part[]; over: Part[]; marks: Part[]; facts: Facts }

export const hash = (s: string) => {
  let n = 2166136261
  for (const c of s) n = Math.imul(n ^ c.codePointAt(0)!, 16777619)
  return n >>> 0
}

const TAU = 2 * Math.PI
const LIGHT: Pt = [0, -1]
const REACH = 0.95
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
const len = (a: Pt) => Math.hypot(a[0], a[1])
const unit = (a: Pt): Pt => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1]
const mirror = (p: Pt): Pt => [-p[0], p[1]]
const at = (a: number, r: number): Pt => [Math.cos(a) * r, Math.sin(a) * r]
const plate = (points: Pt[], fill: string, stroke?: string, width = 0.008): Part => ({ points, fill, stroke, width })
const wire = (points: Pt[], stroke: string, width = 0.02): Part => ({ points, stroke, width })
const ellipse = (c: Pt, a: number, b: number, angle: number, n = 12): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const x = a * Math.cos((i * TAU) / n)
    const y = b * Math.sin((i * TAU) / n)
    return [c[0] + x * Math.cos(angle) - y * Math.sin(angle), c[1] + x * Math.sin(angle) + y * Math.cos(angle)]
  })
// slot i of n sits at a fixed clock position, clockwise from 12 o'clock, in every rock
const slot = (i: number, n: number) => -Math.PI / 2 + (i * TAU) / n
const digits = (v: string) => [...(v.length > 7 ? hash(v).toString(16) : v).padEnd(7, '0').slice(0, 7)].map((c) => {
  const d = parseInt(c, 16)
  return Number.isNaN(d) ? c.codePointAt(0)! % 16 : d
})

type Face = { points: Pt[]; edge: [Pt, Pt]; ring: number; noise: number }
type Side = { out: Pt[]; faces: Face[] }

// One half of a rock (x >= 0, 12 o'clock to 6 o'clock), all from one data seed; equal seeds give mirror-equal halves.
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

// A lit, faceted rock from two halves: shading follows the geometry, so equal halves give a mirror-symmetric rock.
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

// The rim point straight out from the centre at angle a.
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
  passed: ['signal', 'glass', 'signal'], failed: ['copper', 'ember', 'copper'],
  violet: ['violet', 'obsidian3', 'violet'], lime: ['lime', 'olivine3', 'lime'], rose: ['rose', 'iron3', 'rose'],
}

// A crystal rooted just inside the rim; a failed result is copper, bent and cracked.
function crystal(root: Pt, dir: Pt, length: number, w: number, tint: string, marks: Part[], hand = 1) {
  const perp: Pt = [-dir[1] * hand, dir[0] * hand]
  const reach = len(add(root, dir, length))
  const l = reach > REACH ? length - (reach - REACH) : length
  const shaft = add(root, dir, l * 0.78)
  const failed = tint === 'failed'
  const tip = add(add(root, dir, l), perp, failed ? w * 0.9 : 0)
  const [lit, shade, edge] = tints[tint] ?? tints.passed!
  marks.push({ ...plate([add(root, perp, w), add(shaft, perp, w), tip, root], lit, edge, 0.007), crystal: true })
  marks.push(plate([root, tip, add(shaft, perp, -w), add(root, perp, -w)], shade, edge, 0.007))
  if (failed) marks.push(wire([add(shaft, perp, w), add(add(root, dir, l * 0.55), perp, -w * 0.6)], 'void', 0.014))
}

// An empty socket where a crystal should stand: a pale rim no rock tone uses, a dark pit and a broken stump.
function socket(rim: Pt, dir: Pt, marks: Part[]) {
  const c = add(rim, dir, -0.07)
  const angle = Math.atan2(dir[1], dir[0]) + Math.PI / 2
  marks.push(plate(ellipse(c, 0.095, 0.06, angle), 'light', 'light', 0.01))
  marks.push(plate(ellipse(c, 0.07, 0.04, angle), 'void', 'void', 0.006))
  marks.push(plate([add(c, [-dir[1], dir[0]], 0.03), add(c, dir, 0.045), add(c, [dir[1], -dir[0]], 0.03)], 'dull', 'shadow', 0.006))
}

const radial = (out: Pt[], i: number, n: number) => {
  const dir = at(slot(i, n), 1)
  const rim = rimAt(out, slot(i, n))
  return { rim, dir, root: add(rim, dir, -0.06) }
}

// odd_revision: each side carries a druse grown from one commit's digits; equal commits give mirror-equal druses.
function druse(v: string, right: boolean, vent: number, out: Pt[], marks: Part[]) {
  const d = digits(v)
  const n = 2 + (d[0]! % 3)
  const tint = ['passed', 'violet', 'lime', 'rose'][d[6]! % 4]!
  for (let j = 0; j < n; j++) {
    const a = vent + (j - (n - 1) / 2) * 0.32
    const dir = at(right ? a : Math.PI - a, 1)
    crystal(add(rimAt(out, right ? a : Math.PI - a), dir, -0.07), dir, 0.16 + 0.014 * d[j + 1]! + (j === n - 1 ? 0.006 * d[5]! : 0), 0.03 + 0.003 * d[(j + 3) % 7]!, tint, marks, right ? 1 : -1)
  }
}

// A palette colour moved toward another by 1 - k: the step's context strength fades context into what lies behind it.
const mix = (a: string, b: string, k: number) =>
  `#${[1, 3, 5].map((i) => Math.round(parseInt(colors[a]!.slice(i, i + 2), 16) * k + parseInt(colors[b]!.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('')}`

// Halo: one segment per lock plus one, centred on 12 o'clock; each segment lights its middle by the pass share.
function halo(sg: Signs, k: number, parts: Part[]) {
  const n = 1 + sg.locks
  const span = TAU / n - (n > 1 ? 0.24 : 0)
  const arc = (c: number, w: number): Pt[] => {
    const m = Math.max(6, Math.ceil((64 * w) / TAU))
    return Array.from({ length: m + 1 }, (_, i) => at(c - w / 2 + (i * w) / m, 0.86))
  }
  for (let i = 0; i < n; i++) {
    const c = -Math.PI / 2 + (i * TAU) / n
    parts.push(wire(arc(c, span), mix('halo0', 'void', k), 0.035))
    if (!sg.share) continue
    const lit = arc(c, (span * sg.share) / 4)
    parts.push(wire(lit, mix('halo1', 'void', k), 0.085))
    parts.push(wire(lit, mix('halo2', 'void', k), 0.032))
  }
}

// Craters: review findings since the previous gate, on fixed mirrored spots.
const SPOTS: Pt[][] = [[], [[0, -0.36]], [[-0.3, -0.26], [0.3, -0.26]]]
function craters(sg: Signs, family: Family, k: number, parts: Part[]) {
  for (const c of SPOTS[sg.impacts]!) {
    const size = 0.09
    const flat = 1 - Math.min(0.5, len(c) * 0.9)
    const angle = Math.atan2(c[1], c[0])
    const tone = (t: number) => mix(`${family}${t}`, `${family}2`, k)
    parts.push(plate(ellipse(c, size * flat, size, angle), tone(0)))
    parts.push(plate(ellipse(add(c, LIGHT, -size * 0.28), size * flat * 0.72, size * 0.72, angle), tone(4)))
    parts.push(plate(ellipse(add(c, LIGHT, -size * 0.12), size * flat * 0.62, size * 0.62, angle), tone(1)))
  }
}

// Alien: colour = tests job, eyes = agent commits since the previous gate (plus one), size grows with them.
function alien(sg: Signs, family: Family, k: number, parts: Part[]) {
  const r = 0.2 + 0.015 * sg.agent
  const y = 0.1
  const job = sg.job === 2 ? 'alien' : 'alienDim'
  const c = (t: string) => mix(t, `${family}2`, k)
  for (const s of [-1, 1]) {
    parts.push(wire([[s * 0.35 * r, y - 0.8 * r], [s * 0.62 * r, y - 1.4 * r]], c(`${job}0`), 0.02))
    parts.push(plate(ellipse([s * 0.62 * r, y - 1.4 * r], 0.17 * r, 0.17 * r, 0, 10), c(`${job}1`), c(`${job}0`), 0.008))
  }
  parts.push(plate(ellipse([0, y], r, r * 1.05, 0, 20), c(`${job}0`), c(`${job}0`), 0.01))
  parts.push(plate(ellipse([0, y - 0.12 * r], r * 0.86, r * 0.9, 0, 20), c(`${job}1`)))
  for (const e of [[0], [-0.38, 0.38], [-0.48, 0, 0.48], [-0.56, -0.19, 0.19, 0.56]][sg.agent]!) {
    parts.push(plate(ellipse([e * r, y - 0.12 * r], 0.2 * r, 0.27 * r, 0, 12), c('armor')))
    parts.push(plate(ellipse([e * r, y - 0.06 * r], 0.1 * r, 0.14 * r, 0, 10), c('void')))
  }
}

// Every part comes from the record: evidence from its values, context from the pull request when the gate ran.
// strength (0 to 1) is the step's context strength: it changes how strongly context shows, never what is drawn.
export function shape(record: Pick<ChoiceRecord, 'rule' | 'values' | 'signs'>, family: Family, strength = 1): Shape {
  const v = record.values
  const mirrored = record.rule === 'odd_revision'
  const seed = `${record.rule}:${v.join(',')}`
  // odd_revision grows each half from one commit, so equal commits give a mirror-symmetric rock
  const { outline, body } = rock(family, record.rule, mirrored ? `c:${v[1]}` : seed, mirrored ? `c:${v[0]}` : seed)
  const marks: Part[] = []
  if (mirrored) {
    const vent = -0.35 + ((hash(record.rule) % 100) / 100) * 0.7
    druse(v[0] ?? '', false, vent, outline, marks)
    druse(v[1] ?? '', true, vent, outline, marks)
  } else if (record.rule === 'missing_link') {
    // each result is a druse on its own slot; a missing result leaves the slot an empty socket
    const r = rng(hash(`${seed}:druse`))
    for (const [i, s] of v.entries()) {
      const { rim, dir, root } = radial(outline, i, v.length)
      if (s === 'missing') {
        socket(rim, dir, marks)
        continue
      }
      marks.push(plate(ellipse(root, 0.06, 0.04, slot(i, v.length) + Math.PI / 2, 9), `${family}0`, `${family}1`, 0.01))
      for (const k of [-1, 1, 0]) crystal(add(root, [-dir[1], dir[0]], k * 0.035), at(slot(i, v.length) + k * (0.3 + 0.1 * r()), 1), (k ? 0.17 : 0.27) + 0.05 * r(), k ? 0.032 : 0.045, s, marks)
    }
  } else if (record.rule === 'pair') {
    // a criterion's crystal grows on the slot of the first criterion naming the same test; its own slot stays an empty socket
    const home = v.map((t) => v.indexOf(t))
    home.forEach((h, i) => {
      if (h !== i) socket(radial(outline, i, v.length).rim, radial(outline, i, v.length).dir, marks)
    })
    for (const h of new Set(home)) {
      const fan = home.filter((x) => x === h).length
      const r = rng(hash(`${seed}:${h}`))
      for (let j = 0; j < fan; j++) crystal(radial(outline, h, v.length).root, at(slot(h, v.length) + (j - (fan - 1) / 2) * 0.42 + (r() - 0.5) * 0.2, 1), 0.26 + 0.06 * r(), 0.05, 'passed', marks)
    }
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
    sockets: marks.filter((m) => m.fill === 'light').length,
    symmetric: !mirrored || v[0] === v[1],
    segments: sg ? 1 + sg.locks : 0,
    lit: sg?.share ?? 0,
    craters: sg?.impacts ?? 0,
    eyes: sg ? 1 + sg.agent : 0,
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
