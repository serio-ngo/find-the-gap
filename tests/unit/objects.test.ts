import { expect, it } from 'vitest'
import { pool, wave } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'
import { objectsFor } from '../../src/game/objects.ts'

it('draws unique geometry for every choice across fixed standard and adaptive presentations', () => {
  const geometry = new Map<string, string>()
  for (const deck of Object.values(decks)) {
    const specs = [
      ...deck.levels.flatMap((level) => level.sequence.map((spec, index) => ({ spec, occurrence: `standard:${level.id}:${index}` }))),
      ...deck.rules.flatMap(({ id }) => Array.from({ length: deck.steps }, (_, step) => pool(deck, id, step + 1)).flat())
        .map((spec) => ({ spec, occurrence: `adaptive:${spec.rule}:${spec.step}:${spec.seed}` })),
    ]
    for (const { spec, occurrence } of specs) {
      const w = wave(deck, spec)
      const objects = objectsFor(deck, w, occurrence)
      expect(objects.length).toBeGreaterThanOrEqual(4)
      expect(objects.length).toBeLessThanOrEqual(7)
      expect(objects.map(({ clue }) => clue)).toEqual(w.symbols)
      expect(objectsFor(deck, wave(deck, spec), occurrence)).toEqual(objects)
      const otherAnswers = objects.flatMap((_, index) => w.answers.includes(index) ? [] : [index])
      expect(objectsFor(deck, { ...w, answers: otherAnswers }, occurrence)).toEqual(objects)
      // No two choices in a wave share their data or their closed look, even when the AI token repeats (odd, changed).
      if (deck.choiceRecords) expect(new Set(objects.map(({ clue, context, sources, stages }) => JSON.stringify({ clue, context, sources, stages }))).size).toBe(objects.length)
      expect(new Set(objects.map(({ shape }) => JSON.stringify([shape.shell, shape.surface]))).size).toBe(objects.length)
      for (const [index, { shape: { spin, lum, ...drawn } }] of objects.entries()) {
        const choice = `${deck.id}:${occurrence}:${index + 1}`
        const key = JSON.stringify(drawn)
        expect(geometry.get(key), `${choice} repeats ${geometry.get(key)}`).toBeUndefined()
        geometry.set(key, choice)
      }
    }
  }
}, 20_000) // exhaustive over all 625 choice positions
