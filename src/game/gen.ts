import { rng } from './engine.ts'

type Pt = [number, number]
export type Family = 'rock' | 'ship' | 'probe'
export type Look = {
  family: Family
  seed: number
  size: number
  spin: number
  verts: number
  craters: number
  lights: number
  hull: 'saucer' | 'delta' | 'block'
  left: number
  right: number
}
export type Shape = {
  outline: Pt[][]
  details: Pt[][]
  dots: [number, number, number][]
  spin: { rate: number; phase: number }
  lum: number
  crack?: Pt[]
}

const cl = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const hash = (s: string) => {
  let x = 2166136261
  for (const c of s) x = Math.imul(x ^ c.codePointAt(0)!, 16777619)
  return x >>> 0
}
const family = (t: string): Family => (/^AC\d+ /.test(t) ? 'ship' : t.includes('→') ? 'probe' : 'rock')
const hexOf = (t: string) => /^[0-9a-f]*/i.exec(t)![0]
// Most frequent item, ties to the first seen.
const major = <T extends string>(a: T[]) => {
  const c = new Map<T, number>()
  a.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1))
  return a.reduce((b, t) => (c.get(t)! > c.get(b)! ? t : b))
}
const poly = (n: number, f: (a: number) => Pt): Pt[] => Array.from({ length: n }, (_, i) => f((2 * Math.PI * i) / n))

export const waveLook = (tokens: string[], seed: number): Look => {
  const m = major(tokens)
  const hex = hexOf(m)
  const [a, b = ''] = m.split('→')
  const r = rng(seed)
  return {
    family: major(tokens.map(family)),
    seed,
    size: 0.8 + 0.4 * r(),
    spin: 0.02 + 0.03 * r(),
    verts: cl(hex.length + 5, 7, 12),
    craters: cl(Math.floor(new Set(hex).size / 2), 1, 3),
    lights: cl(Number(/^AC(\d+)/.exec(m)?.[1]) || 1, 1, 4),
    hull: m.endsWith('▲') ? 'delta' : m.endsWith('■') ? 'block' : 'saucer',
    left: cl(a.length, 1, 6),
    right: cl(b.length, 1, 6),
  }
}

// hull outline, dome (cockpit), underside band and the lights' height along the rim at x
const HULLS: Record<Look['hull'], { hull: Pt[]; dome: Pt[]; band: Pt[]; rim: (x: number) => number }> = {
  saucer: {
    hull: poly(12, (a) => [0.9 * Math.cos(a), 0.4 * Math.sin(a)]),
    dome: poly(12, (a) => [0.4 * Math.cos(a), -0.1 + 0.4 * Math.min(0, Math.sin(a))]),
    band: poly(12, (a) => [0.9 * Math.cos(a), 0.4 * Math.max(0, Math.sin(a))]),
    rim: (x) => 0.34 * Math.sqrt(1 - (x / 0.9) ** 2),
  },
  delta: {
    hull: [[0, -0.9], [0.6, 0.7], [0, 0.4], [-0.6, 0.7]],
    dome: poly(8, (a) => [0.17 * Math.cos(a), -0.15 + 0.3 * Math.sin(a)]),
    band: [[-0.6, 0.7], [0, 0.4], [0.6, 0.7], [0, 0.55]],
    rim: (x) => 0.32 + 0.5 * Math.abs(x),
  },
  block: {
    hull: [[-0.7, -0.6], [0.7, -0.6], [0.7, 0.6], [-0.7, 0.6]],
    dome: poly(12, (a) => [0.4 * Math.cos(a), -0.6 + 0.3 * Math.min(0, Math.sin(a))]),
    band: [[-0.7, 0.3], [0.7, 0.3], [0.7, 0.6], [-0.7, 0.6]],
    rim: () => 0.45,
  },
}

export const shape = (token: string, look: Look, opts: { bad?: boolean } = {}): Shape => {
  const u = rng(hash(token))
  const spin = { rate: look.spin * (0.9 + 0.2 * u()), phase: u() * 2 * Math.PI }
  const lum = (u() - 0.5) * 0.1
  const mod = 0.12 * (u() - 0.5) // ±6 %, hash only
  const own = family(token) === look.family
  let outline: Pt[][] = []
  let details: Pt[][] = []
  const dots: Shape['dots'] = []
  if (look.family === 'rock') {
    const hex = own ? hexOf(token) : ''
    const ds = hex ? [...hex].map((c) => parseInt(c, 16) / 15) : Array.from({ length: look.verts }, u)
    const base = rng(look.seed + 1)
    outline = [poly(look.verts, (a) => {
      const r = (0.7 + 0.2 * base()) * (1 + 0.12 * (ds[Math.round((a * look.verts) / (2 * Math.PI)) % ds.length] - 0.5))
      return [r * Math.cos(a), r * Math.sin(a)]
    })]
    for (let i = 0; i < look.craters; i++) {
      const a = u() * 2 * Math.PI
      const d = 0.5 * u()
      dots.push([d * Math.cos(a), d * Math.sin(a), 0.08 + 0.07 * u()])
    }
    const i = Math.floor(u() * look.verts)
    details = [[outline[0][i], outline[0][(i + 3) % look.verts]]]
  } else if (look.family === 'ship') {
    const n = look.lights
    const H = HULLS[look.hull]
    const sc = (p: Pt[]) => p.map(([x, y]): Pt => [x * (1 + mod), y * (1 + mod)])
    outline = [sc(H.hull)]
    for (let i = 0; i < n; i++) {
      const x = ((i + 1) / (n + 1) - 0.5) * 0.8
      dots.push([x * (1 + mod), H.rim(x) * (1 + mod), 0.05])
    }
    details = [sc(H.dome), sc(H.band)]
  } else {
    const [a, b = ''] = own ? token.split('→') : ['', '']
    const t = own ? (b.length - a.length) / (a.length + b.length || 1) : 2 * u() - 1 // wing balance −1..1
    const wing = (n: number, sign: number, k: number) => Array.from({ length: n }, (_, i): Pt[] => {
      const x0 = 0.3 + 0.1 * i * k
      const x1 = x0 + 0.09 * k
      return [[sign * x0, -0.2], [sign * x1, -0.2], [sign * x1, 0.2], [sign * x0, 0.2]]
    })
    outline = [poly(8, (r): Pt => [0.3 * Math.cos(r), 0.3 * Math.sin(r)]), ...wing(look.left, -1, 1 - 0.06 * t), ...wing(look.right, 1, 1 + 0.06 * t)]
    details = [[[-0.3, 0], [0.3, 0]]]
  }
  return { outline, details, dots, spin, lum, ...(opts.bad && { crack: [[-0.6, -0.2], [-0.2, 0.1], [0.2, -0.1], [0.6, 0.25]] as Pt[] }) }
}
