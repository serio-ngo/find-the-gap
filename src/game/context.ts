import { LIGHT, TAU, add, at, colors, ellipse, len, plate, wire } from './geom.ts'
import type { Family, Part, Pt, Signs } from './geom.ts'

const mix = (a: string, b: string, k: number) =>
  `#${[1, 3, 5].map((i) => Math.round(parseInt(colors[a]!.slice(i, i + 2), 16) * k + parseInt(colors[b]!.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('')}`

export function halo(sg: Signs, k: number, parts: Part[]) {
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

const SPOTS: Pt[][] = [[], [[0, -0.36]], [[-0.3, -0.26], [0.3, -0.26]]]
export function craters(sg: Signs, family: Family, k: number, parts: Part[]) {
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

export function alien(sg: Signs, family: Family, k: number, parts: Part[]) {
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
