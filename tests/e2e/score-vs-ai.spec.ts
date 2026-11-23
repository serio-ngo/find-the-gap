import { expect, test } from '@playwright/test'
import { aiPick, report, wave } from '../../src/game/engine.ts'
import { chartName, deck, displayed, expectEnd, open, play, right, run, strings, wrong } from './helpers.ts'

for (const lang of ['en', 'pl'] as const)
  test(`the end screen sets you against the AI and chance, by typical and atypical gap, in ${lang}`, async ({ page }) => {
    await open(page, lang, 3)
    const g = await play(page, { lang, level: 3, pick: (s) => (s.decisions.length % 2 ? wrong(deck, s) : right(deck, s)) })
    await expectEnd(page, g, lang)
    g.decisions.forEach((d, i) => (d.ai = aiPick(run, deck, g, i)))
    const r = report(deck, g)
    const v = strings.visible[lang]
    const of = (a: number, n: number) => (n ? `${a}/${n}` : '—')
    const line = (name: string, t: NonNullable<typeof r.typical>) => [name, of(t.you, t.n), of(t.ai, t.aiN), t.n ? `${Math.round((100 * t.chance) / t.n)}%` : '—']
    const table = page.locator('.ftg-table')
    await expect(table.locator('thead th')).toHaveText([v.you, v.ai, v.chance])
    await expect(table.locator('tbody tr')).toHaveText([line(v.typical, r.typical!), line(v.atypical, r.atypical!), line(v.all, r.all)].map((c) => c.join('')))
    for (const cell of await table.locator('tbody td').allTextContents()) expect(cell).not.toMatch(/^\d\.\d$/)
    await expect(page.locator('.ftg-why')).toBeVisible()
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

test('the debrief scores certain waves only, links their runs and keeps research waves hidden', async ({ page }) => {
  await open(page, 'en', 2)
  const g = await play(page, { level: 2, pick: (s) => wrong(deck, s) })
  await expectEnd(page, g)
  const scored = g.decisions.flatMap((d, i) => (d.anchor ? [{ d, ai: aiPick(run, deck, g, i) }] : []))
  const aiPlayed = scored.filter(({ ai }) => typeof ai === 'number')
  const aiHits = aiPlayed.filter(({ d, ai }) => wave(deck, d.spec).answers.includes(ai!)).length
  await expect(page.locator('.ftg-chart [role=img]')).toHaveAccessibleName(chartName(g))
  await expect(page.locator('.ftg-table tbody tr').last().locator('td')).toHaveText([`0/${scored.length}`, `${aiHits}/${aiPlayed.length}`, /^\d+%$/])
  const replay = page.locator('.ftg-replay')
  await replay.locator(':scope > summary').click()
  const rowsShown = replay.locator('.ftg-decision')
  await expect(rowsShown).toHaveCount(scored.length)
  await expect(replay.locator('.ftg-research')).toHaveCount(1)
  await expect(replay.locator('.ftg-research').locator('details, a, svg')).toHaveCount(0)
  const certain = rowsShown.first()
  await certain.locator('summary').first().click()
  const objects = certain.locator('.ftg-object-evidence')
  const slots = displayed(deck, g, g.decisions.findIndex((d) => d.anchor))
  await expect(objects).toHaveCount(slots.length)
  await objects.first().locator('summary').click()
  await expect(objects.first().getByRole('link')).toHaveAttribute('href', slots[0]!.url!)
  await expect(objects.first().locator('svg path').first()).toBeVisible()
})
