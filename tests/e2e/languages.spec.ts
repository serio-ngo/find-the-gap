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
        if (t && !el.closest('.ftg-rocks, .ftg-sr') && el.checkVisibility()) out.push(t)
      }
      n.childNodes.forEach(walk)
    }
    walk(root)
    return out
  })

const names = async (page: Page) => {
  const game = page.locator('.ftg')
  const all = [...(await game.getByRole('button').all()), ...(await game.getByRole('link').all())]
  const out: string[] = []
  for (const e of all) {
    if ((await e.getAttribute('data-rock')) !== null) continue
    out.push(await e.evaluate((el) => (el as HTMLElement).ariaLabel ?? el.textContent ?? ''))
  }
  return out
}

const unnamed = (page: Page) =>
  page.locator('.ftg').evaluate((root) => {
    const letters = (s: string) => s.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
    return [...root.querySelectorAll<HTMLElement>('button:not([data-rock]), a.ftg-next')]
      .filter((e) => e.checkVisibility() && letters(e.textContent!))
      .filter((e) => !letters(e.ariaLabel ?? e.textContent!).startsWith(letters(e.textContent!)))
      .map((e) => e.textContent)
  })

for (const lang of ['pl', 'en'] as const)
  test(`every ${lang} button with visible text carries it in its accessible name`, async ({ page }) => {
    await open(page, lang)
    expect(await unnamed(page)).toEqual([])
    await playButton(page, lang).click()
    await page.keyboard.press('p')
    expect(await unnamed(page)).toEqual([])
    await page.keyboard.press('p')
    await play(page, { lang, begun: true })
    expect(await unnamed(page)).toEqual([])
  })

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
