import { expect, test } from '@playwright/test'
import { aiPick, deviation, wave } from '../../src/game/engine.ts'
import { deck, displayed, expectEnd, open, play, right, run, strings, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  for (const level of [1, 2])
    test(`the end screen indicators equal the deviation of the picks in ${lang} level ${level}`, async ({ page }) => {
      await open(page, lang, level)
      const g = await play(page, { lang, level, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
      await expectEnd(page, g, lang)
      const dev = deviation(deck, run, g)!
      await expect(page.locator('.ftg-ind')).toBeVisible()
      await expect(page.locator('.ftg-agree')).toHaveText(`${dev.agree}%`)
      await expect(page.locator('.ftg-atyp')).toHaveText(String(dev.atypical))
      await expect(page.locator('.ftg-ind dt')).toHaveText([strings.visible[lang].agreement, strings.visible[lang].atypical])
    })

test('after two plays the top list has two entries and one is current', async ({ page }) => {
  await open(page)
  await play(page)
  await page.getByRole('button', { name: strings.labels.en.replay, exact: true }).click()
  const g = await play(page, { begun: true, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
  await expectEnd(page, g)
  await expect(page.locator('.ftg-top li')).toHaveCount(2)
  await expect(page.locator('.ftg-top [aria-current]')).toHaveCount(1)
})

test('the debrief follows the actual decisions and links each research choice to its own sources', async ({ page }) => {
  await open(page, 'en', 3)
  const g = await play(page, { level: 3, pick: (s) => s.decisions.length === 10 ? 2 : wrong(deck, s) })
  await expectEnd(page, g)
  const scored = g.decisions.filter((d) => d.hit !== null)
  const aiHits = scored.filter((d, i) => wave(deck, d.spec).answers.includes(Number(aiPick(run, g, i)!.choice.slice(1)))).length
  await expect(page.locator('.ftg-duel strong')).toHaveText([`${scored.filter((d) => d.hit).length}/10`, `${aiHits}/10`])
  const replay = page.locator('.ftg-replay')
  const rows = replay.locator('.ftg-decision')
  await expect(rows.first()).toBeHidden()
  await replay.locator(':scope > summary').click()
  await expect(rows).toHaveCount(g.decisions.length)
  const i = g.decisions.length - 1
  const research = rows.nth(i)
  const a = aiPick(run, g, i)!
  const slots = displayed(deck, g, i)
  const checked = slots.findIndex((o) => o.sourceIndex === 1)
  const comparison = slots.findIndex((o) => o.sourceIndex === 2)
  await expect(research.locator('summary').first()).toContainText(`You ${comparison + 1}. 5.00→5.000`)
  await expect(research.getByLabel(`AI confidence ${Math.round(100 * a.probabilities[a.choice])}%`)).toBeVisible()
  await research.locator('summary').first().click()
  const objects = research.locator('.ftg-object-evidence')
  await expect(objects).toHaveCount(4)
  await expect(objects.locator('svg')).toHaveCount(0)
  await objects.nth(checked).locator('summary').click()
  await expect(objects.nth(checked).getByRole('link', { name: /^HEAD is now at 237c08c/ })).toHaveAttribute('href', /44411666642\/job\/135181131850$/)
  await objects.nth(comparison).locator('summary').click()
  await expect(objects.nth(comparison).locator('svg path').first()).toBeVisible()
  await expect(objects.nth(comparison).getByRole('link', { name: 'Received: "5.000"', exact: true })).toHaveAttribute('href', /44288017206\/job\/134745629329$/)
  await expect(objects.nth(comparison).getByRole('link', { name: /pr-loop/ })).toHaveAttribute('href', /44288184249\/job\/134746341603$/)
  await rows.first().locator('summary').first().click()
  const control = rows.first().getByText(strings.labels.en.control).first()
  await control.click()
  await expect(rows.first().getByRole('link', { name: /#20 gate/ })).toHaveCount(1)
  await expect(rows.first().getByRole('link', { name: /pr-loop/ })).toHaveCount(0)
})

test('the fixed missing-data waves vary the display slot without changing the scored pick or evidence', async ({ page }) => {
  await open(page, 'en', 4)
  const g = await play(page, { level: 4, inspect: true, by: 'keys' })
  await expectEnd(page, g)
  const positions = g.decisions.slice(0, 3).map((d, i) => {
    expect(d.pick).toBe(1)
    return displayed(deck, g, i).findIndex((o) => o.sourceIndex === d.pick) + 1
  })
  expect(new Set(positions).size).toBeGreaterThan(1)
  await page.locator('.ftg-replay > summary').click()
  const row = page.locator('.ftg-decision').nth(2)
  await expect(row.locator('summary').first()).toContainText(`You ${positions[2]}. AC2 ◆ ✓`)
  await row.locator('summary').first().click()
  const choice = row.locator('.ftg-object-evidence').nth(positions[2] - 1)
  await choice.locator('summary').click()
  await expect(choice.getByRole('link', { name: /^\| AC2 \|/ })).toHaveAttribute('href', /pull\/22#issuecomment-6991893620$/)
})
