import { expect, it } from 'vitest'
import { RUN, checkRun, hashContent, loadRun } from '../../scripts/ai.ts'
import { decks } from '../../src/game/levels/index.ts'

it('the stored AI run matches the deck', () => {
  expect(checkRun(loadRun(RUN), hashContent(decks.observations), decks.observations)).toBeNull()
})
