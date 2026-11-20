import { expect, test } from '@playwright/test'
import { begin, shoot, upcoming, wave } from '../../src/game/engine.ts'
import type { Mode } from '../../src/game/engine.ts'
import { decks } from '../../src/game/levels/index.ts'

const deck = decks.lifecycle

for (const mode of ['standard', 'adaptive'] as Mode[]) {
  test(`plays level 1 to the end screen in ${mode} mode`, async ({ page }) => {
    await page.goto(`/find-the-gap/1/?mode=${mode}`)
    const root = page.locator('.ftg')
    await expect(root).toHaveAttribute('data-phase', 'start')
    await page.locator('.ftg-play').click()
    let g = begin(deck, 1, mode)
    for (let spec = upcoming(deck, g); spec; spec = upcoming(deck, g)) {
      const pick = wave(deck, spec).answers[0] ?? 0
      await expect(root).toHaveAttribute('data-phase', 'play')
      const label = await page.locator('.ftg-wave').textContent()
      await page.locator(`[data-rock="${pick}"]`).click()
      g = shoot(deck, g, pick)
      await page.waitForFunction(
        (before) => document.querySelector('.ftg')!.getAttribute('data-phase') === 'end' || document.querySelector('.ftg-wave')!.textContent !== before,
        label,
      )
    }
    await expect(root).toHaveAttribute('data-phase', 'end')
    await expect(page.locator('.ftg-end')).toBeVisible()
    await expect(page.locator('.ftg-table tr')).toHaveCount(g.decisions.length)
    if (mode === 'adaptive') {
      await expect(page.locator('.ftg-steps')).toHaveAttribute('data-steps', g.decisions.map((d) => d.spec.step).join(','))
    }
  })
}
