import type { Row } from './levels/observations.ts'

export const hash = (s: string) => {
  let n = 2166136261
  for (const c of s) n = Math.imul(n ^ c.codePointAt(0)!, 16777619)
  return n >>> 0
}

export const digits = (v: string) => [...(v.length > 7 ? hash(v).toString(16) : v).padEnd(7, '0').slice(0, 7)].map((c) => {
  const d = parseInt(c, 16)
  return Number.isNaN(d) ? c.codePointAt(0)! % 16 : d
})

export const druse = (v: string) => {
  const d = digits(v)
  return { count: 2 + (d[0]! % 3), tint: d[6]! % 4, length: (j: number) => 9 + d[j + 1]! }
}

const INK = '#2B2620'
const TINTS = [['#5FC3C0', '#127C80'], ['#B7A0F0', '#6F58B8'], ['#C6E87A', '#84A640'], ['#F08FB0', '#B4567A']]
const HORNS: Record<number, number[][]> = {
  2: [[-7, -22, -18], [-15, -18, -42]],
  3: [[-5, -23, -12], [-12, -21, -32], [-18, -16, -52]],
  4: [[-4, -24, -8], [-9, -22, -24], [-14, -19, -40], [-19, -15, -56]],
}
const BODY = 'M-24,6 C-26,-14 -14,-25 0,-25 C14,-25 26,-14 24,6 C22,20 13,26 0,26 C-13,26 -22,20 -24,6 Z'
const EYE = (x: number, y: number, rx: number, ry: number, r: number, w: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#FFFDF5" stroke="${INK}" stroke-width="${w}"/><circle cx="${x + 0.4}" cy="${y + 0.6}" r="${r}" fill="#127C80"/>`
const EYES = [
  [[0, -5, 8, 7, 3.6, 2]],
  [[-8, -5, 6, 5.4, 2.8, 1.9], [8, -5, 6, 5.4, 2.8, 1.9]],
  [[-11, -4, 5, 4.6, 2.3, 1.8], [0, -8, 5, 4.6, 2.3, 1.8], [11, -4, 5, 4.6, 2.3, 1.8]],
]

const horns = (v: string, right: boolean) => {
  const { count, tint, length } = druse(v)
  const [lit, shade] = TINTS[tint]!
  return HORNS[count]!.map(([x, y, a], j) => {
    const l = length(j)
    const w = +(l * 0.19).toFixed(1)
    const m = +(l * 0.78).toFixed(1)
    return `<g transform="translate(${right ? -x! : x},${y})${right ? ' scale(-1,1)' : ''} rotate(${a})"><polygon points="${-w},0 ${-w},${-m} 0,${-l} 0,0" fill="${lit}"/><polygon points="0,0 0,${-l} ${w},${-m} ${w},0" fill="${shade}"/></g>`
  }).join('')
}

const mark = (v: string) => {
  if (v === '-') return `<circle r="1" fill="${INK}" opacity="0.5"/>`
  if (/^pass/.test(v)) return `<circle r="3" fill="#127C80" stroke="${INK}"/>`
  if (/^fail/.test(v)) return `<circle r="3" fill="#B4567A" stroke="${INK}"/><path d="M-1.4,-1.4 l2.8,2.8 m0,-2.8 l-2.8,2.8" stroke="#FFFDF5" stroke-width="1"/>`
  if (v === 'missing') return `<circle r="3" fill="none" stroke="${INK}" stroke-dasharray="1.5 1.5"/>`
  const h = hash(v)
  const n = 3 + (h % 4)
  const pts = Array.from({ length: n }, (_, i) => { const a = ((h >>> 3) % 8) * 0.4 + (i * 2 * Math.PI) / n; return `${(3.6 * Math.cos(a)).toFixed(1)},${(3.6 * Math.sin(a)).toFixed(1)}` })
  return `<polygon points="${pts.join(' ')}" fill="${TINTS[(h >>> 6) % 4]![1]}" stroke="${INK}"/>`
}

export const monster = ({ rule, values, context }: Pick<Row, 'rule' | 'values' | 'context'>) => {
  const odd = rule === 'odd_revision'
  const c = context?.criteria ?? 0
  const eyes = EYES[c <= 3 ? 0 : c === 4 ? 1 : 2]!.map((e) => EYE(...(e as [number, number, number, number, number, number]))).join('')
  const segments = odd ? '' : values.map((v, i) => `<g transform="translate(${(i - (values.length - 1) / 2) * 8},19.5)">${mark(v)}</g>`).join('')
  return `<svg viewBox="-46 -48 92 82" aria-hidden="true"><path d="${BODY}" fill="#E3A6C3" opacity="0.7" transform="translate(3,3)"/>` +
    (odd ? `<g stroke="${INK}" stroke-width="1.2">${horns(values[0]!, false)}${horns(values[1]!, true)}</g>` : '') +
    `<path d="${BODY}" fill="#CDBE9C" stroke="${INK}" stroke-width="2.5"/><path d="M24,6 C22,20 13,26 0,26 C-6,26 -11,24 -15,21 C-4,22 12,16 24,6 Z" fill="url(#rg-hatch)"/>` +
    `<line x1="0" y1="-24" x2="0" y2="25" stroke="${INK}" stroke-dasharray="2 3" opacity="0.5"/>${eyes}${segments}` +
    `<path d="M-8,11 Q0,16 8,11" stroke="${INK}" stroke-width="2" fill="none"/><polygon points="-3,12.4 -1.4,16 0.2,13.3" fill="#FFFDF5" stroke="${INK}"/><ellipse cx="-11" cy="27" rx="6" ry="3.5" fill="${INK}"/><ellipse cx="11" cy="27" rx="6" ry="3.5" fill="${INK}"/></svg>`
}
