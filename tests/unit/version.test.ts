import { expect, it } from 'vitest'
import type { ChoiceRecord, Wave } from '../../src/game/engine.ts'
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

it('the edition changes when what a rock shows changes', async () => {
  const d = decks.observations
  const relinked = { ...d, choiceRecords: (w: Wave) => d.choiceRecords!(w).map((r) => ({ ...r, url: `${r.url}#moved` })) }
  expect(await edition(relinked)).not.toBe(await edition(d))
})

it('the edition changes when a drawn context sign changes', async () => {
  const d = decks.observations
  const bump = (r: ChoiceRecord) => ({ ...r, signs: r.signs ? { ...r.signs, impacts: r.signs.impacts + 1 } : { job: 0, impacts: 1, criteria: 0, many: 0 } })
  const resigned = { ...d, choiceRecords: (w: Wave) => d.choiceRecords!(w).map((r, i) => (i ? r : bump(r))) }
  expect(await edition(resigned)).not.toBe(await edition(d))
})
