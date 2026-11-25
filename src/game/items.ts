import { Badge, BadgeCheck, BadgeX, Bot, User } from 'lucide'
import type { ChoiceRecord } from './engine.ts'
import { CHANNELS } from './levels/observations.ts'

export const ICONS = { Badge, BadgeCheck, BadgeX, Bot, User }
export type Item = keyof typeof ICONS

export const ITEMS: Record<'job' | 'agent', Item[]> = {
  job: ['Badge', 'BadgeX', 'BadgeCheck'],
  agent: ['User', 'Bot', 'Bot', 'Bot'],
}

export const itemOf = ({ rule, signs }: ChoiceRecord): Item => {
  if (!signs) return 'Badge'
  const channel = CHANNELS[rule]?.includes('job') ? 'job' : 'agent'
  return ITEMS[channel][signs[channel]]!
}

export const icon = (item: Item) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[item].map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`

export const collection = (bag: Map<Item, number>, l: Record<Item, string>) =>
  [...bag].map(([item, n]) => `<span class="ftg-item" role="img" aria-label="${l[item]}: ${n}">${icon(item)}<span class="ftg-count" aria-hidden="true">${n}</span></span>`).join('')
