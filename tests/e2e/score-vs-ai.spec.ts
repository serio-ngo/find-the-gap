import { expect, test } from '@playwright/test'
import { Run, chartName, expectEnd, open, playButton, right, trunk, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  test(`the end screen charts you against the AI and chance in ${lang}`, async ({ page }) => {
    await open(page, lang)
    await playButton(page, lang).click()
    const r = new Run(page)
    r.pick = (room) => (trunk.indexOf(room) % 2 ? wrong(room) : right(room))
    await r.finish()
    await expectEnd(page)
    await expect(page.locator('.ftg-chart [role=img]')).toHaveAccessibleName(chartName(r.visits, lang))
  })
