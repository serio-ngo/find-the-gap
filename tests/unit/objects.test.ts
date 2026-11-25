import { expect, it } from 'vitest'
import { pool, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { objectsFor, presentObjects } from '../../src/game/objects.ts'

it('draws every wave the same way each time, never from the answer, and the same run alike in every wave', () => {
  const seen = new Map<string, string>()
  for (const deck of Object.values(decks)) {
    const specs = [
      ...deck.levels.flatMap((level) => level.sequence),
      ...deck.rules.flatMap(({ id }) => Array.from({ length: deck.steps }, (_, step) => pool(deck, id, step + 1)).flat()),
    ]
    for (const spec of specs) {
      const w = wave(deck, spec)
      const objects = objectsFor(deck, w)
      expect(objects.map(({ id }) => id)).toEqual(w.ids ?? objects.map(({ id }) => id))
      expect(objects).toHaveLength(w.symbols.length)
      expect(objectsFor(deck, wave(deck, spec))).toEqual(objects)
      const otherAnswers = objects.flatMap((_, index) => (w.answers.includes(index) ? [] : [index]))
      expect(objectsFor(deck, { ...w, answers: otherAnswers })).toEqual(objects)
      expect(presentObjects(deck, w).map((o) => o.sourceIndex).sort()).toEqual(objects.map((_, i) => i))
      expect(presentObjects(deck, w)).toEqual(presentObjects(deck, w))
      for (const o of objects) {
        const look = JSON.stringify([o.shape.outline, o.shape.marks, o.shape.facts])
        expect(seen.get(`${deck.id}:${o.id}`) ?? look).toBe(look)
        seen.set(`${deck.id}:${o.id}`, look)
      }
    }
  }
}, 20_000)
