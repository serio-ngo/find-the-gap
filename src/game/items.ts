import type { Row } from './levels/observations.ts'

const local = new Map<string, string>()

export const art = (name: string) => local.get(name) ?? new URL(`./art/${name}.webp`, import.meta.url).href

export const keep = (name: string) => fetch(art(name)).then((r) => r.blob()).then((b) => new Promise<void>((done) => {
  const f = new FileReader()
  f.onload = () => { local.set(name, String(f.result)); done() }
  f.readAsDataURL(b)
}))

export const ICONS = { odd_revision: 'artefact-odd_revision', missing_link: 'artefact-missing_link', pair: 'artefact-pair', lock_only: 'artefact-lock_only' }
export type Item = keyof typeof ICONS

export const itemOf = ({ rule }: Pick<Row, 'rule'>): Item => rule as Item

export const icon = (item: Item) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><image href="${art(ICONS[item])}" width="24" height="24"/></svg>`

export const collection = (bag: Map<Item, number>, l: Record<Item, string>) =>
  [...bag].map(([item, n]) => `<span class="ftg-item" role="img" aria-label="${l[item]}: ${n}">${icon(item)}<span class="ftg-count" aria-hidden="true">${n}</span></span>`).join('')
