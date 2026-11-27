import { expect, test } from '@playwright/test'
import { Run, expectEnd, open, playButton, right, strings, trunk, wrong } from './helpers.ts'

test('the end screen shows the loot of the certain rooms, the deviation from chance, and the leaderboard', async ({ page }) => {
  await open(page)
  await playButton(page).click()
  const r = new Run(page)
  r.pick = (room) => (trunk.indexOf(room) % 3 ? right(room) : wrong(room))
  await r.finish()
  await expectEnd(page)
  const loot = page.locator('.ftg-loot li')
  await expect(loot).toHaveCount(trunk.length)
  await expect(loot.first().locator('.ftg-me')).toHaveAccessibleName(new RegExp(`^${strings.labels.en.room.replace('{n}', '1')}\\. ${strings.labels.en.you}: `))
  await expect(page.locator('.ftg-norm')).toHaveText(/^[+-]\d+\.\dσ$/)
  await expect(page.locator('.ftg-norm')).toHaveAccessibleName(/^[+-]\d+\.\dσ from chance(\. typical (\d+\/\d+|–), atypical (\d+\/\d+|–))?$/)
  const nick = `Tester ${Date.now() % 1e6}`
  const board = page.getByRole('form', { name: strings.visible.en.board })
  await board.getByLabel(strings.visible.en.nick).fill(nick)
  await board.getByRole('button', { name: strings.visible.en.save }).click()
  await expect(page.locator('.ftg-top .ftg-mine')).toContainText(nick)
  await expect(page.locator('.ftg-top')).toBeFocused()
  await expect(page.locator('.ftg-norm')).toHaveAccessibleName(/\. better than \d+% of players$/)
})
