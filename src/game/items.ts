import type { Row } from './levels/observations.ts'

export const ICONS = {
  odd_revision: '<circle cx="7" cy="8" r="4.6" fill="#E8C26A"/><circle cx="7" cy="8" r="1.8" fill="#5FC3C0"/><path d="M10.5 11L20 20.5M15.5 16l2.5-2.5M18 18.5l2-2" fill="none"/>',
  missing_link: '<rect x="2.5" y="8" width="9" height="8" rx="4" fill="#B8AE9C"/><rect x="12.5" y="8" width="9" height="8" rx="4" fill="#B8AE9C"/><path d="M11.5 10.5v3M12.5 10.5v3" stroke="#F08FB0" stroke-width="2.5"/>',
  pair: '<path d="M3.5 20V8a4 4 0 0 1 8 0v12z" fill="#D8C9A3"/><path d="M12.5 20V8a4 4 0 0 1 8 0v12z" fill="#D8C9A3"/><path d="M6 12h3M6 15h3M15 12h3M15 15h3" stroke="#6F58B8"/>',
  lock_only: '<path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/><rect x="5.5" y="11" width="13" height="9.5" rx="2" fill="#C9962B"/><circle cx="12" cy="15" r="1.6" fill="#C6E87A"/><path d="M12 16.5v2" stroke="#2B2620"/>',
}
export type Item = keyof typeof ICONS

export const itemOf = ({ rule }: Pick<Row, 'rule'>): Item => rule as Item

export const icon = (item: Item) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[item]}</svg>`

export const collection = (bag: Map<Item, number>, l: Record<Item, string>) =>
  [...bag].map(([item, n]) => `<span class="ftg-item" role="img" aria-label="${l[item]}: ${n}">${icon(item)}<span class="ftg-count" aria-hidden="true">${n}</span></span>`).join('')
