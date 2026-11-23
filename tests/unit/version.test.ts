import { expect, it } from 'vitest'
import { RUN, checkRun, hashContent, loadRun } from '../../scripts/ai.ts'
import { edition } from '../../src/game/eval/version.ts'
import { decks } from '../../src/game/levels/index.ts'

it('the stored AI run matches the deck', async () => {
  expect(checkRun(loadRun(RUN), await hashContent(decks.observations), decks.observations)).toBeNull()
})

it('the edition changes when the anchors change', async () => {
  const d = decks.observations
  const moved = { ...d, levels: d.levels.map((l) => ({ ...l, anchors: [...l.anchors, 99] })) }
  expect(await edition(moved)).not.toBe(await edition(d))
})
