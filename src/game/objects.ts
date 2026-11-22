import type { ChoiceRecord, Deck, Wave } from './engine.ts'
import { hash, shape } from './gen.ts'
import type { Family } from './gen.ts'

export const records = (d: Deck, w: Wave): ChoiceRecord[] =>
  d.choiceRecords?.(w) ?? w.symbols.map((clue) => ({ clue, rule: w.rule, values: [clue] }))

// One mineral per level, so the mineral never tells runs apart.
const FAMILY: Record<string, Family> = { odd_revision: 'iron', missing_link: 'basalt', pair: 'chondrite' }
// Step k shows context at strength 0.55 + 0.1125 (k - 1): adaptive play moves the step, so it moves this parameter too.
export const strength = (step: number) => Math.min(1, 0.55 + 0.1125 * (step - 1))

// Every rock comes from its record alone: the same run gives the same rock in every wave, and the answer is never read.
export function objectsFor(d: Deck, w: Wave) {
  return records(d, w).map((record, i) => {
    const id = record.id ?? `${w.rule}:${w.step}:${w.seed}:${i}`
    return { ...record, id, shape: shape(record, FAMILY[record.rule] ?? 'carbon', strength(w.step)) }
  })
}

export type TargetObject = ReturnType<typeof objectsFor>[number]

// Neutral order: by a hash of each run's id, so a wave always has the same layout and time or answer never sets it.
export function presentObjects(d: Deck, w: Wave) {
  return objectsFor(d, w)
    .map((object, sourceIndex) => ({ ...object, sourceIndex }))
    .sort((a, b) => hash(a.id) - hash(b.id) || a.sourceIndex - b.sourceIndex)
}
