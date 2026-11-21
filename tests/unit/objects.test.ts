import { expect, it } from 'vitest'
import { pool, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { objectsFor, presentObjects } from '../../src/game/objects.ts'

it('draws every wave the same way each time, never from the answer, and tells its rocks apart', () => {
  for (const deck of Object.values(decks)) {
    const specs = [
      ...deck.levels.flatMap((level) => level.sequence.map((spec, index) => ({ spec, occurrence: `standard:${level.id}:${index}` }))),
      ...deck.rules.flatMap(({ id }) => Array.from({ length: deck.steps }, (_, step) => pool(deck, id, step + 1)).flat())
        .map((spec) => ({ spec, occurrence: `adaptive:${spec.rule}:${spec.step}:${spec.seed}` })),
    ]
    for (const { spec, occurrence } of specs) {
      const w = wave(deck, spec)
      const objects = objectsFor(deck, w, occurrence)
      expect(objects.map(({ clue }) => clue)).toEqual(w.symbols)
      expect(objectsFor(deck, wave(deck, spec), occurrence)).toEqual(objects)
      const otherAnswers = objects.flatMap((_, index) => (w.answers.includes(index) ? [] : [index]))
      expect(objectsFor(deck, { ...w, answers: otherAnswers }, occurrence)).toEqual(objects)
      expect(new Set(objects.map(({ shape }) => JSON.stringify([shape.family, shape.outline]))).size).toBe(objects.length)
      expect(presentObjects(deck, w, occurrence).map((o) => o.sourceIndex).sort()).toEqual(objects.map((_, i) => i))
    }
  }
}, 20_000)
