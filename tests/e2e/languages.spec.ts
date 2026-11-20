import { expect, test, type Page } from '@playwright/test'
import { open, play, playButton, strings, type Lang } from './helpers.ts'

const letters = (s: string) => s.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim()

const visibleTexts = (page: Page) =>
  page.locator('.ftg').evaluate((root) => {
    const out: string[] = []
    const walk = (n: Node) => {
      if (n.nodeType === 3) {
        const el = n.parentElement!
        const t = n.textContent!.trim()
        const cell = el.closest('td')
        const symbolCell = cell && ['3', '4'].includes(String(cell.cellIndex + 1))
        if (t && !el.closest('.ftg-rocks, .ftg-sr, .ftg-net, details:not([open])') && !symbolCell && el.checkVisibility()) out.push(t)
      }
      n.childNodes.forEach(walk)
    }
    walk(root)
    return out
  })

const names = async (page: Page) => {
  const all = [...(await page.getByRole('button').all()), ...(await page.getByRole('link').all())]
  const out: string[] = []
  for (const e of all) {
    if ((await e.getAttribute('data-rock')) !== null) continue
    out.push(await e.evaluate((el) => (el as HTMLElement).ariaLabel ?? el.textContent ?? ''))
  }
  return out
}

for (const [lang, url] of [['pl', '/find-the-gap/1/'], ['en', '/en/find-the-gap/1/']] as const)
  test(`the ${lang} page declares its language and uses only its own strings`, async ({ page }) => {
    await page.goto(url)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    const allowed = new Set([...Object.values(strings.visible[lang]), ...Object.values(strings.labels[lang])].map(letters))
    const seen = new Set<string>()
    const names_: string[] = []
    const collect = async () => {
      for (const t of await visibleTexts(page)) if (letters(t)) seen.add(letters(t))
      names_.push(...(await names(page)))
    }
    await collect()
    await playButton(page, lang as Lang).click()
    await collect()
    await page.keyboard.press('p')
    await collect()
    await page.keyboard.press('p')
    await play(page, { lang, begun: true })
    await collect()
    const visible = new Set(Object.values(strings.visible[lang]).map(letters))
    for (const s of seen) expect(visible, s).toContain(s)
    expect(seen.size).toBeLessThanOrEqual(12)
    for (const n of names_) expect(allowed, n).toContain(letters(n))
    expect(names_.length).toBeGreaterThan(0)
  })
