export type Pt = [number, number]
export type Part = { points: Pt[]; fill?: string; stroke?: string; width: number; crystal?: true }
export type Signs = { locks: number; job: number; share: number; impacts: number; agent: number }

const base = {
  void: '#141c23', shadow: '#283541', frame: '#576776', armor: '#aeb9bc', light: '#f3f1de',
  glass: '#3f7f8a', signal: '#a6e8e1', copper: '#e0ac70', ember: '#9b4f2f', violet: '#b79cf0', rose: '#f08fb0', lime: '#c6e87a', dull: '#4a5157',
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

export const hash = (s: string) => {
  let n = 2166136261
  for (const c of s) n = Math.imul(n ^ c.codePointAt(0)!, 16777619)
  return n >>> 0
}

export const TAU = 2 * Math.PI
export const LIGHT: Pt = [0, -1]
export const REACH = 0.95
export const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
export const len = (a: Pt) => Math.hypot(a[0], a[1])
export const unit = (a: Pt): Pt => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1]
export const mirror = (p: Pt): Pt => [-p[0], p[1]]
export const at = (a: number, r: number): Pt => [Math.cos(a) * r, Math.sin(a) * r]
export const plate = (points: Pt[], fill: string, stroke?: string, width = 0.008): Part => ({ points, fill, stroke, width })
export const wire = (points: Pt[], stroke: string, width = 0.02): Part => ({ points, stroke, width })
export const ellipse = (c: Pt, a: number, b: number, angle: number, n = 12): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const x = a * Math.cos((i * TAU) / n)
    const y = b * Math.sin((i * TAU) / n)
    return [c[0] + x * Math.cos(angle) - y * Math.sin(angle), c[1] + x * Math.sin(angle) + y * Math.cos(angle)]
  })
