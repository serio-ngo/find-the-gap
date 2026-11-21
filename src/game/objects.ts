import { rng } from './engine.ts'
import type { ChoiceRecord, Deck, Wave } from './engine.ts'
import { families, hash, shape } from './gen.ts'

const hues = ['signal', 'copper', 'violet', 'rose', 'lime']

export const records = (d: Deck, w: Wave): ChoiceRecord[] =>
  d.choiceRecords?.(w) ?? w.symbols.map((clue) => ({ clue, cells: [hues[w.symbols.indexOf(clue)]!] }))

export function objectsFor(d: Deck, w: Wave, occurrence = '') {
  const key = JSON.stringify([d.id, w.rule, w.step, w.seed, occurrence])
  const r = rng(hash(key))
  const order = families.map((family) => ({ family, rank: r() })).sort((a, b) => a.rank - b.rank)
  return records(d, w).map((record, i) => {
    const id = JSON.stringify([key, record.clue, i])
    return { ...record, id, shape: shape(record.cells, id, order[i % order.length]!.family) }
  })
}

export type TargetObject = ReturnType<typeof objectsFor>[number]

export function presentObjects(d: Deck, w: Wave, occurrence = '') {
  const r = rng(hash(JSON.stringify(['display', d.id, w.rule, w.step, w.seed, occurrence])))
  return objectsFor(d, w, occurrence)
    .map((object, sourceIndex) => ({ object: { ...object, sourceIndex }, rank: r() }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ object }) => object)
}
