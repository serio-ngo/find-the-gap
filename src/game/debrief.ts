import { chart } from './chart.ts'
import { report, wave } from './engine.ts'
import type { Deck, Game, Tally } from './engine.ts'
import { icon, itemOf } from './items.ts'
import type { Facts } from './gen.ts'
import type { presentObjects } from './objects.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }
export type Rounds = ReturnType<typeof presentObjects>[]

export const describe = (f: Facts, l: Record<string, string | undefined>) => {
  const n = (key: string, v: number) => l[key]!.replace('{n}', String(v))
  return [
    n('crystals', f.crystals), f.symmetric ? l.symmetric : l.lopsided,
    ...(f.signs ? [n('halo', f.arcs), f.lit ? l.lit! : l.unlit!, n('craters', f.craters), f.bright ? l.bright! : l.dim!] : []),
  ].join(', ')
}

export const deviation = (deck: Deck, g: Game) => {
  const ps = g.decisions.filter((x) => x.anchor).map((x) => 1 / wave(deck, x.spec).symbols.length)
  const spread = Math.sqrt(ps.reduce((t, p) => t + p * (1 - p), 0))
  return spread ? (g.decisions.filter((x) => x.anchor && x.hit).length - ps.reduce((t, p) => t + p, 0)) / spread : 0
}

const ratio = (t: Tally | null) => (t?.n ? `${t.you}/${t.n}` : '–')

export const loot = (deck: Deck, g: Game, rounds: Rounds, l: Record<string, string | undefined>) => g.decisions.map((x, i) => {
  const objects = rounds[i] ?? []
  const w = wave(deck, x.spec)
  const at = (k: number | null | undefined) => (typeof k === 'number' ? objects.find((o) => o.sourceIndex === k) : undefined)
  const cell = (who: string, k: number | null | undefined, won: boolean) => {
    const o = at(k)
    if (!o) return `<span class="ftg-${who}"></span>`
    const item = itemOf(o)
    return `<span class="ftg-${who}${won ? ' ftg-won' : ''}" role="img" aria-label="${l.wave} ${i + 1}. ${who === 'me' ? l.you : 'AI'}: ${l[item]}${won ? `, ${l.won}` : ''}">${icon(item)}</span>`
  }
  return `<li>${cell('me', x.pick, x.anchor && x.hit)}${cell('ai', x.ai, x.anchor && typeof x.ai === 'number' && w.answers.includes(x.ai))}</li>`
}).join('')

export const showResult = (root: HTMLElement, deck: Deck, g: Game, { v, l }: Text, rounds: Rounds) => {
  const r = report(deck, g)
  root.querySelector('.ftg-chart')!.innerHTML = chart(r, { ...v, chart: l.chart })
  const z = deviation(deck, g)
  const signed = `${z >= 0 ? '+' : ''}${z.toFixed(1)}`
  const norm = root.querySelector('.ftg-norm')!
  norm.textContent = `${signed}${v.sigma}`
  norm.setAttribute('aria-label', [l.norm!.replace('{z}', signed), ...(r.typical ? [l.typicalSplit!.replace('{a}', ratio(r.typical)).replace('{b}', ratio(r.atypical))] : [])].join('. '))
  root.querySelector('.ftg-loot')!.innerHTML = loot(deck, g, rounds, l)
  const nextEl = root.querySelector<HTMLAnchorElement>('.ftg-next')!
  nextEl.hidden = !deck.levels.some((x) => x.id === g.level + 1)
  nextEl.href = `${root.dataset.next}${location.search}`
}
