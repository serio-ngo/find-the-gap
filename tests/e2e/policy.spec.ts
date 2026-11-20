import { expect, test, type Page } from '@playwright/test'
import { replay } from '../../src/game/engine.ts'
import type { Game } from '../../src/game/engine.ts'
import { deck, open, play, right, wrong } from './helpers.ts'

const patterns: [string, (g: Game) => number][] = [
  ['always wrong', (g) => wrong(deck, g)],
  ['always right', (g) => right(deck, g)],
  ['wrong then right', (g) => (g.decisions.length < 5 ? wrong(deck, g) : right(deck, g))],
]

const path = (page: Page) => page.locator('.ftg-steps').evaluate((e: HTMLElement) => [e.dataset.steps, e.dataset.rules])

for (const [name, pick] of patterns)
  test(`adaptive steps and rules match the engine replay for picks that are ${name}`, async ({ page }) => {
    await open(page, 'en', 1, '?mode=adaptive')
    const g = await play(page, { mode: 'adaptive', pick })
    const r = replay(deck, 1, 'adaptive', g.decisions.map((d) => d.pick))
    await expect(page.locator('.ftg-steps')).toHaveAttribute('data-steps', r.decisions.map((d) => d.spec.step).join(','))
    await expect(page.locator('.ftg-steps')).toHaveAttribute('data-rules', r.decisions.map((d) => d.spec.rule).join(','))
  })

test('replaying the same picks twice gives identical paths', async ({ page }) => {
  await open(page, 'en', 1, '?mode=adaptive')
  const first = await play(page, { mode: 'adaptive', pick: patterns[2][1] })
  const one = await path(page)
  const picks = first.decisions.map((d) => d.pick)
  await page.getByRole('button', { name: /Play again/ }).click()
  await play(page, { mode: 'adaptive', begun: true, pick: (g) => picks[g.decisions.length] })
  await expect(page.locator('.ftg')).toHaveAttribute('data-phase', 'end')
  expect(await path(page)).toEqual(one)
})
