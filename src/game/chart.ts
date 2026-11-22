import type { report } from './engine.ts'
import type { Tally } from './engine.ts'
import { wilson } from './stats.ts'

type Report = ReturnType<typeof report>
export type Labels = { you: string; ai: string; chance: string; typical: string; atypical: string; all: string; chart: string }

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const pct = (p: number) => Math.round(p * 100)
export const of = (hits: number, n: number) => (n ? `${hits}/${n}` : '—')
const X0 = 56
const W = 240
const TOP = 22

export const spread = (secs: number[]) => {
  const s = [...secs].sort((a, b) => a - b)
  const m = s.length >> 1
  return { n: s.length, median: s.length % 2 ? s[m]! : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2, min: s[0] ?? 0, max: s.at(-1) ?? 0 }
}

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

// Your and the AI's hit rate with its 95% Wilson interval, against the chance rate as a vertical line.
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

// Typical and atypical rows only when both have waves; chance as a rate.
export const table = (r: Report, l: Labels) => {
  const row = (name: string, t: Tally) =>
    `<tr><th scope="row">${esc(name)}</th><td>${of(t.you, t.n)}</td><td>${of(t.ai, t.aiN)}</td><td>${t.n ? `${pct(t.chance / t.n)}%` : '—'}</td></tr>`
  const split = r.typical?.n && r.atypical?.n
  return `<thead><tr><td></td><th scope="col">${esc(l.you)}</th><th scope="col">${esc(l.ai)}</th><th scope="col">${esc(l.chance)}</th></tr></thead>`
    + `<tbody>${split ? row(l.typical, r.typical!) + row(l.atypical, r.atypical!) : ''}${row(l.all, r.all)}</tbody>`
}
