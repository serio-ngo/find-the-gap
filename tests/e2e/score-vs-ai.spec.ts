import { expect, test } from '@playwright/test'
import { chartName, deck, expectEnd, open, play, right, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  test(`the end screen charts you against the AI and chance in ${lang}`, async ({ page }) => {
    await open(page, lang, 1)
    const g = await play(page, { lang, level: 1, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
    await expectEnd(page)
    await expect(page.locator('.ftg-chart [role=img]')).toHaveAccessibleName(chartName(g, lang))
  })
