import type { ChoiceRecord, Deck, Wave } from './engine.ts'
import { hash, shape } from './gen.ts'
import type { Family } from './gen.ts'

export const records = (d: Deck, w: Wave): ChoiceRecord[] =>
  d.choiceRecords?.(w) ?? w.symbols.map((clue) => ({ clue, rule: w.rule, values: [clue] }))

const FAMILY: Record<string, Family> = { odd_revision: 'iron', missing_link: 'basalt', pair: 'chondrite' }
export const strength = (step: number) => Math.min(1, 0.55 + 0.1125 * (step - 1))

export function objectsFor(d: Deck, w: Wave) {
  return records(d, w).map((record, i) => {
    const id = record.id ?? `${w.rule}:${w.step}:${w.seed}:${i}`
    return { ...record, id, shape: shape(record, FAMILY[record.rule] ?? 'carbon', strength(w.step)) }
  })
}

export type TargetObject = ReturnType<typeof objectsFor>[number]

export function presentObjects(d: Deck, w: Wave) {
  return objectsFor(d, w)
    .map((object, sourceIndex) => ({ ...object, sourceIndex }))
    .sort((a, b) => hash(a.id) - hash(b.id) || a.sourceIndex - b.sourceIndex)
}
