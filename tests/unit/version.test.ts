import { expect, it } from 'vitest'
import { RUN, checkRun, hashContent, loadRun } from '../../scripts/ai.ts'
import { edition } from '../../src/game/eval/version.ts'
import { rows } from '../../src/game/levels/rows.ts'
import { world } from '../../src/game/levels/world.ts'

it('the stored AI run matches the world', async () => {
  expect(checkRun(loadRun(RUN), await hashContent(world, rows), world)).toBeNull()
})

it('checkRun reports a missing, stale or incomplete run', async () => {
  const hash = await hashContent(world, rows)
  expect(checkRun(undefined, hash, world)).toMatch(/missing/)
  expect(checkRun({ hash: 'old', model: 'd1.1', date: '', picks: {} }, hash, world)).toMatch(/stale/)
  expect(checkRun({ hash, model: 'd1.1', date: '', picks: {} }, hash, world)).toMatch(/incomplete/)
})

it('the edition changes when a row or the world changes', async () => {
  const base = await edition(world, rows)
  expect(base).toMatch(/^world:[0-9a-f]{12}$/)
  expect(await edition(world, rows.map((r, i) => (i ? r : { ...r, values: [...r.values.slice(1), 'moved'] })))).not.toBe(base)
  expect(await edition({ ...world, key: world.key + 1 }, rows)).not.toBe(base)
})
