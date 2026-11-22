import type { report } from './engine.ts'
import type { Tally } from './engine.ts'
import { wilson } from './stats.ts'

type Report = ReturnType<typeof report>
export type Labels = { you: string; ai: string; chance: string; typical: string; atypical: string; all: string; chart: string }

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const pct = (p: number) => Math.round(p * 100)
const X0 = 80
const W = 220

export const spread = (secs: number[]) => {
  const s = [...secs].sort((a, b) => a - b)
  const m = s.length >> 1
  return { n: s.length, median: s.length % 2 ? s[m]! : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2, min: s[0] ?? 0, max: s.at(-1) ?? 0 }
}

// Your and the AI's hit rate with its 95% Wilson interval, against the chance rate as a vertical line.
export const chart = ({ all }: Report, l: Labels) => {
  if (!all.n) return ''
  const chance = pct(all.chance / all.n)
  const rows = [{ k: 'you', name: l.you, hits: all.you, n: all.n }, ...(all.aiN ? [{ k: 'ai', name: l.ai, hits: all.ai, n: all.aiN }] : [])].map((r) => {
    const [lo, hi] = wilson(r.hits, r.n).map(pct) as [number, number]
    return { ...r, lo, hi, p: r.hits / r.n }
  })
  const x = (p: number) => X0 + p * W
  const label = `${rows.map((r) => `${r.name} ${r.hits}/${r.n}, ${l.chart} ${r.lo}–${r.hi}%`).join('; ')}; ${l.chance.toLowerCase()} ${chance}%`
  const body = rows.map((r, i) => {
    const y = 30 + i * 36
    return `<text class="ftg-chart-t" x="0" y="${y + 4}">${esc(`${r.name} ${r.hits}/${r.n}`)}</text>`
      + `<line class="ftg-chart-${r.k}" x1="${x(r.lo / 100)}" x2="${x(r.hi / 100)}" y1="${y}" y2="${y}" stroke-width="3"/>`
      + `<circle class="ftg-chart-${r.k}" cx="${x(r.p)}" cy="${y}" r="6"/>`
  }).join('')
  const h = 30 + rows.length * 36
  const ticks = [0, 50, 100].map((t) => `<text class="ftg-chart-t" x="${x(t / 100)}" y="${h}" text-anchor="middle">${t}%</text>`).join('')
  return `<svg class="ftg-chart-svg" viewBox="0 0 320 ${h + 6}" role="img" aria-label="${esc(label)}">`
    + `<line class="ftg-chart-chance" x1="${x(chance / 100)}" x2="${x(chance / 100)}" y1="8" y2="${h - 16}" stroke-width="2" stroke-dasharray="4 3"/>`
    + `<text class="ftg-chart-t" x="${x(chance / 100)}" y="6" text-anchor="middle">${esc(`${l.chance} ${chance}%`)}</text>${body}${ticks}</svg>`
}

// Typical and atypical rows only when both have waves; chance as a rate.
export const table = (r: Report, l: Labels) => {
  const of = (hits: number, n: number) => (n ? `${hits}/${n}` : '—')
  const row = (name: string, t: Tally) =>
    `<tr><th scope="row">${esc(name)}</th><td>${of(t.you, t.n)}</td><td>${of(t.ai, t.aiN)}</td><td>${t.n ? `${pct(t.chance / t.n)}%` : '—'}</td></tr>`
  const split = r.typical?.n && r.atypical?.n
  return `<thead><tr><td></td><th scope="col">${esc(l.you)}</th><th scope="col">${esc(l.ai)}</th><th scope="col">${esc(l.chance)}</th></tr></thead>`
    + `<tbody>${split ? row(l.typical, r.typical!) + row(l.atypical, r.atypical!) : ''}${row(l.all, r.all)}</tbody>`
}
