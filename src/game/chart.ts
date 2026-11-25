import type { report } from './engine.ts'
import { wilson } from './stats.ts'

type Report = Pick<ReturnType<typeof report>, 'all'>
export type Labels = { you: string; ai: string; chance: string; chart: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const pct = (p: number) => Math.round(p * 100)
const X0 = 56
const W = 240
const TOP = 22

const stats = ({ all }: Report, l: Labels) => {
  const chance = pct(all.chance / all.n)
  const rows = [{ k: 'you', name: l.you, hits: all.you, n: all.n }, ...(all.aiN ? [{ k: 'ai', name: l.ai, hits: all.ai, n: all.aiN }] : [])].map((r) => {
    const [lo, hi] = wilson(r.hits, r.n).map(pct) as [number, number]
    return { ...r, lo, hi, p: r.hits / r.n }
  })
  return { chance, rows }
}

export const label = (r: Report, l: Labels) => {
  const { chance, rows } = stats(r, l)
  return `${rows.map((x) => `${x.name} ${x.hits}/${x.n}, ${l.chart} ${x.lo}–${x.hi}%`).join('; ')}; ${l.chance.toLowerCase()} ${chance}%`
}

export const chart = (r: Report, l: Labels) => {
  if (!r.all.n) return ''
  const { chance, rows } = stats(r, l)
  const x = (p: number) => X0 + p * W
  const body = rows.map((r, i) => {
    const y = TOP + 18 + i * 36
    return `<text class="ftg-chart-t" x="0" y="${y + 4}">${esc(`${r.name} ${r.hits}/${r.n}`)}</text>`
      + `<line class="ftg-chart-${r.k}" x1="${x(r.lo / 100)}" x2="${x(r.hi / 100)}" y1="${y}" y2="${y}" stroke-width="3"/>`
      + `<circle class="ftg-chart-${r.k}" cx="${x(r.p)}" cy="${y}" r="6"/>`
  }).join('')
  const base = TOP + rows.length * 36
  const grid = [0, 50, 100].map((t) => `<line class="ftg-chart-grid" x1="${x(t / 100)}" x2="${x(t / 100)}" y1="${TOP}" y2="${base}"/>`
    + `<text class="ftg-chart-t" x="${x(t / 100)}" y="${base + 14}" text-anchor="middle">${t}%</text>`).join('')
  return `<svg class="ftg-chart-svg" viewBox="0 0 320 ${base + 20}" role="img" aria-label="${esc(label(r, l))}">${grid}`
    + `<line class="ftg-chart-grid" x1="${x(0)}" x2="${x(1)}" y1="${base}" y2="${base}"/>`
    + `<line class="ftg-chart-chance" x1="${x(chance / 100)}" x2="${x(chance / 100)}" y1="${TOP}" y2="${base}" stroke-width="2" stroke-dasharray="4 3"/>`
    + `<text class="ftg-chart-t" x="${x(chance / 100)}" y="12" text-anchor="${chance > 60 ? 'end' : 'start'}">${esc(`${l.chance} ${chance}%`)}</text>${body}</svg>`
}
