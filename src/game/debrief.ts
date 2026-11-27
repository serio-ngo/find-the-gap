import { f } from './cards.ts'
import { chart } from './chart.ts'
import { chance, hit, report, rooms } from './engine.ts'
import type { AiRun, Tally, Visit } from './engine.ts'
import { monster } from './gen.ts'
import { itemOf } from './items.ts'
import type { Row, World } from './levels/observations.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }

const certain = (w: World, visits: Visit[]) => visits.flatMap((v) => (rooms(w)[v.room]?.certain && v.pick >= 0 ? [{ room: rooms(w)[v.room]!, pick: v.pick }] : []))

export const deviation = (w: World, rows: Map<string, Row>, visits: Visit[]) => {
  const played = certain(w, visits)
  const ps = played.map(({ room }) => chance(room))
  const spread = Math.sqrt(ps.reduce((t, p) => t + p * (1 - p), 0))
  return spread ? (played.filter(({ room, pick }) => hit(rows, room, pick)).length - ps.reduce((t, p) => t + p, 0)) / spread : 0
}

const ratio = (t: Tally | null) => (t?.n ? `${t.you}/${t.n}` : '–')

export const loot = (w: World, rows: Map<string, Row>, visits: Visit[], ai: AiRun['picks'], { v, l }: Text) => certain(w, visits).map(({ room, pick }, i) => {
  const cell = (who: 'me' | 'ai', k: number | null | undefined) => {
    const row = typeof k === 'number' ? rows.get(room.monsters[k]!) : undefined
    if (!row) return `<span class="ftg-${who}"></span>`
    const won = hit(rows, room, k!)
    return `<span class="ftg-${who}${won ? ' ftg-won' : ''}" role="img" aria-label="${f(l.room, i + 1)}. ${who === 'me' ? l.you : v.ai}: ${f(l.pick, k! + 1)}, ${l[itemOf(row)]}${won ? `, ${l.won}` : ''}">${monster(row)}</span>`
  }
  return `<li>${cell('me', pick)}${cell('ai', ai[room.id])}</li>`
}).join('')

export const showResult = (root: HTMLElement, w: World, rows: Map<string, Row>, visits: Visit[], ai: AiRun['picks'], text: Text, hasNext: boolean) => {
  const { v, l } = text
  const r = report(w, rows, visits, ai)
  root.querySelector('.ftg-chart')!.innerHTML = chart(r, { ...v, chart: l.chart })
  const z = deviation(w, rows, visits)
  const signed = `${z >= 0 ? '+' : ''}${z.toFixed(1)}`
  const norm = root.querySelector('.ftg-norm')!
  norm.textContent = `${signed}${v.sigma}`
  norm.setAttribute('aria-label', [l.norm.replace('{z}', signed), ...(r.typical ? [l.typicalSplit.replace('{a}', ratio(r.typical)).replace('{b}', ratio(r.atypical))] : [])].join('. '))
  root.querySelector('.ftg-loot')!.innerHTML = loot(w, rows, visits, ai, text)
  const nextEl = root.querySelector<HTMLAnchorElement>('.ftg-next')!
  nextEl.hidden = !hasNext
  nextEl.href = `${root.dataset.next}${location.search}`
}
