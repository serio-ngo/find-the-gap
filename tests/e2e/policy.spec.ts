import { expect, test } from '@playwright/test'
import { replay } from '../../src/game/engine.ts'
import type { Game } from '../../src/game/engine.ts'
import { deck, open, play, right, strings, wrong } from './helpers.ts'

const patterns: [string, (g: Game) => number][] = [
  ['always wrong', (g) => wrong(deck, g)],
  ['always right', (g) => right(deck, g)],
  ['wrong then right', (g) => (g.decisions.length < 5 ? wrong(deck, g) : right(deck, g))],
]

// play() asserts before every pick that the page shows the rocks of the engine's adaptive wave.
for (const [name, pick] of patterns)
  test(`adaptive waves on the page match the engine replay for picks that are ${name}`, async ({ page }) => {
    await open(page, 'en', 1, '?mode=adaptive')
    const g = await play(page, { mode: 'adaptive', pick })
    await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
    const r = replay(deck, 1, 'adaptive', g.decisions.map((d) => d.pick))
    expect(r.decisions.map((d) => d.spec)).toEqual(g.decisions.map((d) => d.spec))
  })

test('the adaptive policy follows the picks', () => {
  const steps = (pick: (g: Game) => number) => {
    let g = replay(deck, 1, 'adaptive', [])
    while (g.decisions.length < 9) g = replay(deck, 1, 'adaptive', [...g.decisions.map((d) => d.pick), pick(g)])
    return g.decisions.map((d) => `${d.spec.rule}:${d.spec.step}`)
  }
  expect(steps((g) => right(deck, g))).not.toEqual(steps((g) => wrong(deck, g)))
})

test('replaying the same picks twice shows the same waves', async ({ page }) => {
  await open(page, 'en', 1, '?mode=adaptive')
  const first = await play(page, { mode: 'adaptive', pick: patterns[2][1] })
  const picks = first.decisions.map((d) => d.pick)
  await page.getByRole('button', { name: strings.labels.en.replay, exact: true }).click()
  const second = await play(page, { mode: 'adaptive', begun: true, pick: (g) => picks[g.decisions.length] })
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  expect(second.decisions.map((d) => d.spec)).toEqual(first.decisions.map((d) => d.spec))
})
