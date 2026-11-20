import { rng } from './engine.ts'

export type Pt = [number, number]
export type Tone = 'void' | 'shadow' | 'frame' | 'armor' | 'light' | 'glass' | 'signal' | 'copper'
export type Part = { points: Pt[]; fill?: Tone; stroke?: Tone; width: number }
type Stage = { stage: string; steps: string[]; url?: string }
type Art = { marks: string[]; stages: Stage[]; context?: { quote: string; url?: string } }

export const colors: Record<Tone, string> = {
  void: '#17232c', shadow: '#283541', frame: '#576776', armor: '#aeb9bc',
  light: '#eff0dc', glass: '#366a75', signal: '#a6e1dd', copper: '#dcab74',
}

export const families = ['salvage tug', 'split-keel courier', 'ring observatory', 'crystal cluster', 'orbital probe', 'freight cutter', 'deep-water skiff'] as const
export type Family = typeof families[number]
export type Shape = {
  family: Family
  outline: Pt[][]
  details: Part[]
  systems: Part[]
  motif: Part[]
  spin: { rate: number; phase: number }
  lum: number
}

export const hash = (s: string) => {
  let n = 2166136261
  for (const c of s) n = Math.imul(n ^ c.codePointAt(0)!, 16777619)
  return n >>> 0
}

const plate = (points: Pt[], fill: Tone, stroke: Tone = 'armor'): Part => ({ points, fill, stroke, width: 0.025 })
const wire = (points: Pt[], stroke: Tone = 'light', width = 0.027): Part => ({ points, stroke, width })
const box = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
const rim = (x: number, y: number, rx: number, ry: number, n: number, phase = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = i * 2 * Math.PI / n + phase
    return [x + rx * Math.cos(a), y + ry * Math.sin(a)]
  })

function hull(family: Family, r: () => number, outline: Pt[][], details: Part[]) {
  const raise = 0.23 + r() * 0.32
  const fork = 0.62 + r() * 0.26
  const sweep = r() < 0.5 ? -1 : 1
  const pods = 2 + Math.floor(r() * 3)
  const body = (points: Pt[], fill: Tone = 'frame') => {
    outline.push(points)
    details.push(plate(points, fill))
    const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length
    const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length
    const inner = points.map(([x, y]): Pt => [x + (cx - x) * 0.21, y + (cy - y) * 0.17])
    for (const [i, p] of points.entries()) {
      const j = (i + 1) % points.length
      const q = points[j]
      const lit = p[0] + q[0] - 2 * cx + 1.4 * (p[1] + q[1] - 2 * cy) < -0.06
      const bevel: Tone = lit ? (fill === 'armor' ? 'light' : 'armor') : (fill === 'armor' ? 'frame' : 'shadow')
      details.push({ points: [p, q, inner[j], inner[i]], fill: bevel, width: 0 })
    }
    details.push(wire([...points, points[0]], fill === 'shadow' ? 'frame' : 'armor', 0.016))
  }
  const mirror = (side: number, points: Pt[]): Pt[] => points.map(([x, y]) => [x * side, y])

  switch (family) {
    case 'salvage tug':
      for (const side of [-1, 1]) {
        const head = side === sweep ? raise + 0.24 : raise
        const tip = side === sweep ? fork : fork - 0.12
        body(mirror(side, [[0.15, 0.06], [0.38, -0.06], [0.53, -head], [tip, -head - 0.08], [tip + 0.09, -head + 0.04], [tip - 0.02, -head + 0.18], [0.6, -head + 0.22], [0.5, 0.23], [0.18, 0.48]]))
        details.push(wire(mirror(side, [[0.22, 0.15], [0.45, 0.02], [0.57, -head + 0.07], [tip, -head + 0.03]]), 'copper', 0.055))
        details.push(plate(mirror(side, box(0.29, 0.2, 0.19, 0.32)), 'void', 'frame'))
      }
      body([[-0.3, 0.43], [-0.34, -0.26], [-0.19, -0.55], [0.08, -0.61], [0.31, -0.41], [0.34, 0.43], [0.18, 0.59], [-0.19, 0.59]], 'armor')
      details.push(plate([[-0.27, -0.08], [-0.17, 0.04], [-0.12, 0.41], [-0.26, 0.35]], 'shadow', 'frame'))
      details.push(plate([[0.19, -0.05], [0.28, -0.16], [0.27, 0.36], [0.15, 0.43]], 'frame', 'light'))
      details.push(plate([[-0.15, 0.36], [0.15, 0.36], [0.18, 0.55], [-0.17, 0.55]], 'void', 'frame'))
      details.push(wire([[-0.1, 0.46], [0.11, 0.46]], 'copper', 0.04))
      for (const x of [-0.22, 0.23]) {
        details.push(wire([[x, 0.13], [x * 0.82, 0.24], [x, 0.32]], 'signal', 0.03))
        details.push(wire([[x * 1.5, 0.43], [x * 1.5, 0.54]], 'copper', 0.036))
      }
      details.push(plate([[-0.2, -0.29], [-0.13, -0.48], [0.08, -0.52], [0.21, -0.35], [0.13, -0.17], [-0.13, -0.14]], 'glass', 'light'))
      break
    case 'split-keel courier':
      body([[-0.27, -0.27], [0.3, -0.37], [0.45, 0.31], [0.1, 0.26], [-0.36, 0.37]], 'shadow')
      for (const side of [-1, 1]) {
        const tip = side === sweep ? -0.87 : -0.57 - raise / 3
        body(mirror(side, [[0.08, -0.28], [0.18, tip], [0.32, tip + 0.04], [0.49, -0.28], [fork, 0.37], [0.77, 0.54], [0.49, 0.36], [0.3, 0.58], [0.19, 0.45], [0.19, 0.01]]), 'armor')
        details.push(plate(mirror(side, [[0.22, tip + 0.12], [0.3, tip + 0.16], [0.41, -0.24], [0.26, -0.14]]), 'glass', 'light'))
        details.push(plate(mirror(side, [[0.31, -0.22], [0.39, -0.13], [0.46, 0.14], [0.3, 0.33], [0.23, 0.04]]), 'frame', 'light'))
        details.push(plate(mirror(side, [[0.35, 0.15], [0.43, 0.13], [0.35, 0.51], [0.3, 0.51]]), 'void', 'frame'))
        details.push(wire(mirror(side, [[0.29, 0.11], [0.36, 0.21], [0.53, 0.19]]), 'copper', 0.033))
        details.push(wire(mirror(side, [[0.48, -0.16], [0.7, 0.37], [0.52, 0.26], [0.37, 0.4]]), 'void', 0.05))
      }
      break
    case 'ring observatory': {
      const rx = fork
      const ry = 0.52 + raise / 3
      body(rim(0, 0, rx, ry, 12, 0.26), 'armor')
      details.push(plate(rim(0, 0, rx - 0.18, ry - 0.16, 12, 0.26), 'void', 'light'))
      for (let i = 0; i < pods; i++) {
        const a = (i + (sweep < 0 ? 0.25 : 0.55)) * 2 * Math.PI / pods
        const x = rx * Math.cos(a)
        const y = ry * Math.sin(a)
        const tangent = [Math.sin(a) * 0.12, -Math.cos(a) * 0.12]
        details.push(wire([[x + tangent[0], y + tangent[1]], [-tangent[0] * 0.58, -tangent[1] * 0.58], [x - tangent[0], y - tangent[1]], [0, 0]], 'frame', 0.061))
        details.push(wire([[x + tangent[0], y + tangent[1]], [x * 0.55, y * 0.55], [x - tangent[0], y - tangent[1]]], 'copper', 0.03))
        body(rim(x, y, 0.14, 0.095, 6), 'glass')
      }
      details.push(wire(rim(0, 0, rx - 0.075, ry - 0.067, 12, 0.26).slice(3, 10), 'frame', 0.036))
      details.push(wire(rim(0, 0, rx - 0.065, ry - 0.052, 12, 0.26).slice(0, 6), 'light', 0.023))
      body([[-0.25, -0.23], [-0.16, -0.58], [0.02, -0.76], [0.2, -0.64], [0.31, -0.22], [0.23, 0.27], [-0.2, 0.31]])
      details.push(plate(rim(0.02, -0.43, 0.16, 0.17, 8), 'signal', 'light'))
      details.push(plate(rim(0.02, -0.43, 0.075, 0.09, 8), 'void', 'glass'))
      details.push(plate([[-0.15, -0.17], [0.17, -0.17], [0.21, 0.08], [0.12, 0.21], [-0.13, 0.21], [-0.17, 0.08]], 'shadow', 'armor'))
      details.push(wire([[-0.12, 0.01], [0.08, 0.01], [0.14, -0.09]], 'signal', 0.034))
      details.push(wire([[-0.09, 0.1], [0.11, 0.1]], 'copper', 0.044))
      break
    }
    case 'crystal cluster': {
      const base: Pt[] = [[-fork, 0.03], [-0.56, -raise], [-0.14, -0.53], [0.32, -0.57], [0.72, -0.26], [fork * 0.85, 0.25], [0.36, 0.61], [-0.22, 0.54], [-0.65, 0.37]]
      body(base, 'shadow')
      details.push(plate([base[0], base[1], base[2], [0.14, -0.21], [-0.35, 0.22]], 'frame'))
      details.push(plate([[0.14, -0.21], base[3], base[4], base[5], [0.32, 0.32]], 'glass', 'frame'))
      for (let i = 0; i < pods; i++) {
        const x = (2 * i / (pods - 1) - 1) * 0.51
        const y = -0.43 - r() * 0.37
        const blade = x + sweep * (0.03 + r() * 0.11)
        body([[x - 0.13, -0.18], [blade - 0.1, y + 0.14], [blade, y], [blade + 0.09, y + 0.12], [x + 0.13, 0.06]], 'glass')
        details.push(plate([[blade, y], [blade + 0.09, y + 0.12], [x + 0.13, 0.06], [x + 0.018, -0.12]], 'signal'))
        details.push(plate([[x - 0.18, 0.05], [x - 0.12, -0.04], [x + 0.04, 0.01], [x + 0.11, 0.16], [x - 0.03, 0.24]], 'shadow', 'glass'))
        details.push(wire([[x - 0.16, 0.04], [x - 0.03, 0.055], [x + 0.02, 0.13]], 'signal', 0.036))
        details.push(wire([[x - 0.2, 0.095], [x + 0.1, 0.24], [x + 0.17, 0.42]], 'copper', 0.04))
      }
      break
    }
    case 'orbital probe':
      for (const side of [-1, 1]) {
        const y = side === sweep ? -raise : raise / 3
        body(mirror(side, [[0.14, -0.06], [0.43, y], [fork + 0.02, y - 0.07], [fork + 0.02, y + 0.07], [0.46, y + 0.13], [0.16, 0.19]]), 'copper')
        for (let i = 0; i < pods; i++) {
          const x = 0.47 + i * (fork - 0.4) / pods
          const span = 0.16 + r() * 0.14
          details.push(plate(mirror(side, [[x, y - span], [x + 0.087, y - span - 0.06], [x + 0.087, y + span], [x, y + span + 0.04]]), 'glass', 'signal'))
          details.push(wire(mirror(side, [[x, y], [x + 0.087, y]]), 'void'))
        }
      }
      body([[-0.08, -0.23], [0.01, -0.89], [0.07, -0.89], [0.13, -0.76], [0.13, -0.31]], 'shadow')
      details.push(plate(rim(0.065, -0.89, 0.065, 0.047, 6), 'copper', 'light'))
      body([[-0.21, 0.39], [-0.32, -0.17], [-0.21, -0.49], [0.18, -0.53], [0.35, -0.2], [0.21, 0.43], [0.08, 0.59], [-0.1, 0.58]], 'armor')
      for (const x of [-0.16, 0.08]) {
        details.push(plate(box(x, 0.08, 0.092, 0.36), 'shadow', 'light'))
        details.push(wire([[x + 0.04, 0.16], [x + 0.04, 0.34]], 'copper', 0.034))
      }
      details.push(plate([[-0.23, -0.46], [-0.32, -0.72], [-0.05, -0.8], [0.25, -0.72], [0.19, -0.53], [0.02, -0.37]], 'glass', 'light'))
      details.push(wire([[-0.26, -0.56], [0.02, -0.63], [0.2, -0.58]], 'signal', 0.04))
      break
    case 'freight cutter':
      body([[-fork, -0.19], [-0.57, -raise], [-0.2, -0.35], [0.03, -0.63], [0.4, -0.57], [fork, -0.35], [0.86, 0.11], [0.63, 0.36], [0.38, 0.34], [0.29, 0.61], [-0.58, 0.61], [-0.77, 0.37]], 'armor')
      details.push(plate([[-fork, -0.19], [-0.51, -0.14], [-0.47, 0.13], [-0.63, 0.34], [-0.77, 0.37]], 'shadow'))
      details.push(plate([[0.63, -0.18], [0.8, -0.045], [0.83, 0.11], [0.6, 0.31], [0.38, 0.28], [0.46, 0.03]], 'frame', 'light'))
      details.push(plate([[-0.44, -0.02], [-0.26, -0.19], [0.19, -0.15], [0.43, 0.06], [0.34, 0.34], [-0.42, 0.37]], 'shadow', 'frame'))
      for (let i = 0; i < 4; i++) {
        const x = -0.34 + i * 0.15
        details.push(plate([[x, 0.06], [x + 0.09, 0.01], [x + 0.14, 0.22], [x + 0.01, 0.25]], i % 2 ? 'frame' : 'glass', 'armor'))
      }
      details.push(wire([[0.54, 0.03], [0.67, -0.04], [0.73, 0.1], [0.56, 0.22]], 'copper', 0.037))
      details.push(wire([[0.51, 0.11], [0.58, 0.15], [0.66, 0.12]], 'signal', 0.031))
      details.push(plate([[0.03, -0.56], [0.39, -0.51], [0.68, -0.32], [0.54, -0.22], [0.13, -0.29], [-0.1, -0.36]], 'glass', 'light'))
      for (let i = 0; i < pods; i++) {
        const x = -0.49 + i * 0.195
        details.push(plate(box(x, 0.4, 0.105, 0.25), 'void', 'copper'))
        details.push(wire([[x + 0.05, 0.47], [x + 0.05, 0.61]], 'signal', 0.035))
      }
      break
    case 'deep-water skiff':
      body([[-fork, -0.22], [-0.45, -0.65], [-0.06, -0.81], [0.43, -0.64], [fork, -0.27], [0.78, 0.04], [0.43, 0.54], [0.09, 0.42], [-0.25, 0.57], [-0.65, 0.34]], 'shadow')
      for (const side of [-1, 1]) {
        const y = side === sweep ? 0.29 : 0.38
        body(mirror(side, [[0.12, -0.24], [0.39, -0.39 - raise / 4], [fork + 0.06, -0.25], [fork - 0.01, y], [0.66, y + 0.14], [0.46, y], [0.48, -0.09], [0.25, 0.16]]), 'armor')
        details.push(plate(mirror(side, [[0.53, -0.21], [fork - 0.03, -0.16], [0.65, y + 0.08], [0.52, y - 0.06]]), 'shadow', 'frame'))
        details.push(wire(mirror(side, [[0.53, 0.01], [0.65, 0.04], [0.56, 0.14], [0.68, 0.18]]), 'copper', 0.039))
        details.push(wire(mirror(side, [[0.29, -0.26], [0.53, -0.29], [fork - 0.02, -0.19], [0.65, y]]), 'glass', 0.062))
      }
      details.push(plate([[-0.31, -0.04], [0.29, -0.05], [0.36, 0.29], [0.1, 0.44], [-0.25, 0.38]], 'frame', 'armor'))
      details.push(wire([[-0.25, 0.11], [-0.15, 0.26], [0.24, 0.25], [0.28, 0.1]], 'copper', 0.05))
      details.push(plate([[-0.22, -0.45], [-0.05, -0.68], [0.16, -0.6], [0.32, -0.38], [0.17, -0.14], [-0.14, -0.1]], 'glass', 'light'))
      break
  }
}

const sockets: Record<Family, Pt> = {
  'salvage tug': [0.41, 0.38],
  'split-keel courier': [0.28, 0.42],
  'ring observatory': [0.21, 0.42],
  'crystal cluster': [0.4, 0.35],
  'orbital probe': [0.17, 0.42],
  'freight cutter': [0.42, 0.32],
  'deep-water skiff': [0.37, 0.37],
}

function attach(record: Art, sourceStep: string, family: Family, r: () => number, outline: Pt[][], details: Part[]) {
  if (!sourceStep) return
  const stage = record.stages.find((s) => s.url === record.context?.url)?.stage
  const count = Number(/^\d+/.exec(sourceStep)?.[0]) || 1
  const [sx, sy] = sockets[family]
  const side = r() < 0.5 ? -1 : 1
  const length = 0.20 + (count % 5) * 0.041
  const local = (points: Pt[]): Pt[] => points.map(([x, y]) => [side * (sx + x), sy + y])
  const bolt = (points: Pt[], fill: Tone) => {
    const p = local(points)
    outline.push(p)
    details.push(plate(p, fill, 'armor'))
  }
  bolt([[-0.16, -0.09], [-0.035, -0.13], [0.088, -0.018], [0.082, 0.11], [-0.12, 0.10]], 'shadow')

  if (/push|publish/i.test(sourceStep) && stage === 'deliver') {
    bolt([[-0.075, 0], [0.045, 0.045], [0.15, length], [0.113, length + 0.08], [-0.038, length - 0.04]], 'frame')
    details.push(wire(local([[-0.047, 0.051], [0.064, length * 0.69], [0.125, length]]), 'copper', 0.05))
    details.push(plate(local(rim(0.098, length + 0.029, 0.082, 0.05, 6)), 'shadow', 'light'))
  } else if (stage === 'gate') {
    const base = length * 0.65
    bolt([[-0.085, 0.03], [0.09, 0.05], [0.13, base], [0.035, base + 0.06], [0.016, base - 0.038], [-0.037, base - 0.04], [-0.06, base + 0.034], [-0.13, base - 0.01]], 'armor')
    details.push(wire(local([[-0.064, 0.09], [0.067, 0.094]]), 'glass', 0.052))
  } else if (stage === 'write-tests' || stage === 'pr-loop') {
    for (const offset of [-0.068, 0.068]) {
      bolt([[offset - 0.05, 0.045], [offset + 0.051, 0.053], [offset + 0.09, length - 0.03], [offset + 0.024, length + 0.049], [offset - 0.034, length + 0.018]], 'glass')
      details.push(wire(local([[offset + 0.013, 0.083], [offset + 0.049, length - 0.033]]), 'signal', 0.027))
    }
  } else {
    const dish = length * 0.7
    bolt([[-0.056, 0.02], [0.061, 0.014], [0.122, dish + 0.008], [0.042, dish + 0.036]], 'frame')
    bolt([[-0.055, dish - 0.007], [0.058, dish + 0.03], [0.19, dish - 0.005], [0.098, dish + 0.121], [0.008, dish + 0.112]], 'copper')
    details.push(wire(local([[-0.03, dish + 0.024], [0.086, dish + 0.067], [0.172, dish + 0.018]]), 'light', 0.024))
  }
}

const banks: Record<Family, (x: number, i: number) => number> = {
  'salvage tug': (x) => -Math.abs(x) * 0.13,
  'split-keel courier': (x) => Math.abs(x) * 0.19,
  'ring observatory': (x) => 0.09 - x ** 2 * 0.23,
  'crystal cluster': (x, i) => x * 0.07 + (i % 2) * 0.073,
  'orbital probe': (x) => 0.04 - Math.abs(x) * 0.19,
  'freight cutter': (x) => x * 0.08,
  'deep-water skiff': (x) => 0.06 - Math.abs(x) * 0.12,
}

function systemsFor(stages: Stage[], family: Family): Part[] {
  if (!stages.length) return []
  const systems: Part[] = []
  const span = 1.5 / stages.length
  const mounts: Pt[] = stages.map((_, i) => {
    const x = -0.75 + (i + 0.5) * span
    return [x, 0.50 + banks[family](x, i)]
  })
  if (mounts.length > 1) systems.push(wire(mounts, 'frame', 0.085))
  for (const [i, { stage, steps }] of stages.entries()) {
    const [mid, bottom] = mounts[i]
    const x = mid - span / 2
    const top = bottom - 0.34
    systems.push(plate([[x + 0.015, bottom], [x + 0.015, top + 0.05], [mid, top], [x + span - 0.015, top + 0.05], [x + span - 0.015, bottom]], 'void', 'frame'))
    const dx = span * 0.26
    switch (stage) {
      case 'write-tests':
        systems.push(plate(rim(mid, top + 0.112, dx, 0.06, 6), 'glass', 'signal'))
        break
      case 'deliver':
        systems.push(plate(box(mid - dx, top + 0.07, dx * 2, 0.095), 'copper', 'copper'))
        break
      case 'gate':
        systems.push(wire([[mid - dx, top + 0.15], [mid - dx, top + 0.075], [mid + dx, top + 0.075], [mid + dx, top + 0.15]], 'armor', 0.036))
        break
      case 'pr-loop':
        systems.push(wire(rim(mid, top + 0.11, dx, 0.05, 6).slice(1), 'copper', 0.031))
        break
      default:
        systems.push(wire([[mid - dx, top + 0.14], [mid, top + 0.05], [mid + dx, top + 0.14]], 'armor', 0.036))
    }
    const columns = Math.ceil(Math.sqrt(steps.length))
    const rows = Math.ceil(steps.length / columns)
    for (const [j, step] of steps.entries()) {
      const [, number, name, result] = /^(\d+)\. (.+) · (\w+)$/.exec(step) ?? ['', String(j + 1), step, 'unknown']
      const col = j % columns
      const row = Math.floor(j / columns)
      const xx = x + 0.028 + col * (span - 0.05) / columns
      const yy = top + 0.165 + row * 0.15 / rows
      const unit = (span - 0.07) / columns
      const reach = unit * (0.42 + (hash(name) % 13) * 0.024)
      const ascent = 0.012 + (Number(number) % 7) * 0.0017
      const end = xx + reach
      const beam: Pt[] = /test|lock|gate|accept/i.test(name)
        ? [[xx, yy + ascent], [xx + reach * 0.35, yy - ascent], [end, yy]]
        : [[xx, yy], [xx + reach * 0.62, yy], [end, yy - ascent]]
      systems.push(wire(beam, 'armor', 0.012))
      switch (result) {
        case 'success':
          systems.push(wire([[end, yy - ascent], [end, yy + ascent]], 'signal', 0.013))
          break
        case 'failure':
          systems.push(wire([[end - unit * 0.2, yy - ascent], [end, yy + ascent], [end + unit * 0.2, yy - ascent]], 'light', 0.013))
          break
        default:
          systems.push(wire([[xx, yy + ascent], [xx + reach * 0.38, yy + ascent]], 'frame', 0.012))
      }
    }
  }
  return systems
}

const glyphs: Record<string, Pt[]> = {
  '◆': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '◇': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '◈': [[0, -1], [1, 0], [0, 1], [-1, 0]],
  '▲': [[0, -1], [1, 0.8], [-1, 0.8]],
  '▼': [[-1, -0.8], [1, -0.8], [0, 1]],
  '■': box(-0.78, -0.78, 1.56, 1.56),
  '✚': [[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]],
  '★': rim(0, 0, 1, 1, 10, -Math.PI / 2).map(([x, y], i) => i % 2 ? [x * 0.42, y * 0.42] : [x, y]),
}

function motifFor({ marks }: Art, criterionOrder: boolean): Part[] {
  const motif = [plate([[-0.74, -0.34], [0.74, -0.34], [0.8, -0.23], [0.8, 0.23], [0.74, 0.34], [-0.74, 0.34], [-0.8, 0.23], [-0.8, -0.23]], 'void', 'signal')]
  const glyph = marks[1]
  const figure = glyphs[glyph]
  const ordinal = criterionOrder ? Number(/^AC(\d+)$/.exec(marks[0])?.[1]) || 0 : 0
  const offset = ordinal ? -0.28 : 0
  if (figure) {
    motif.push(plate(figure.map(([x, y]) => [offset + x * 0.23, y * 0.23]), glyph === '◇' || glyph === '◈' ? 'void' : 'light', 'light'))
    if (glyph === '◈') motif.push(plate(rim(offset, 0, 0.11, 0.11, 4), 'light', 'light'))
    for (let i = 0; i < ordinal; i++) {
      const x = 0.05 + i * 0.14
      motif.push(wire([[x, -0.095], [x, 0.095]], 'signal', 0.046))
    }
    return motif
  }
  if (marks.length === 2) motif.push(wire([[-0.06, 0], [0.07, 0], [0.017, -0.057]], 'signal', 0.035))
  for (const [j, mark] of marks.slice(0, 2).entries()) {
    const digits = (/^[a-f0-9]+$/i.test(mark) ? mark.slice(0, 7) : mark.replace('.', '')).slice(0, 7)
    const half = marks.length > 1 ? 0.61 : 1.28
    const center = marks.length > 1 ? (j === 0 ? -0.42 : 0.42) : 0
    for (const [i, ch] of [...digits].entries()) {
      const value = parseInt(ch, 16)
      const high = Number.isNaN(value) ? 2 + hash(ch) % 6 : value + 1
      const x = center - half / 2 + i * half / 7
      motif.push(plate(box(x, 0.2 - high * 0.025, half / 12, high * 0.025), 'light', 'light'))
    }
  }
  return motif
}

export function shape(record: Art, identity: string, family: Family, criterionOrder = false): Shape {
  const sourceStep = record.context?.quote.split(' · ')[0] ?? ''
  const r = rng(hash(JSON.stringify([identity, sourceStep])))
  const outline: Pt[][] = []
  const details: Part[] = []
  hull(family, r, outline, details)
  attach(record, sourceStep, family, r, outline, details)
  return {
    family,
    outline,
    details,
    systems: systemsFor(record.stages, family),
    motif: motifFor(record, criterionOrder).map((part) => ({ ...part, points: part.points.map(([x, y]) => [x, y * 0.8 - 0.18]) })),
    spin: { rate: 0.018 + 0.012 * r(), phase: r() * 2 * Math.PI },
    lum: r() - 0.5,
  }
}

export function paintObject(s: Shape, draw: (part: Part) => void, inspected = false) {
  s.details.forEach(draw)
  if (inspected) {
    s.systems.forEach(draw)
    s.motif.forEach(draw)
  }
}
