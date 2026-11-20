import { expect, test } from '@playwright/test'
import { open } from './helpers.ts'

const style = (page: import('@playwright/test').Page) =>
  page.locator('.ftg').evaluate((e) => {
    const s = getComputedStyle(e)
    return { bg: s.backgroundColor, fg: s.color, font: s.fontFamily, field: getComputedStyle(e.querySelector('.ftg-field')!).backgroundColor }
  })

test('the root uses local fallbacks without brand variables', async ({ page }) => {
  await open(page)
  expect(await style(page)).toEqual({ bg: 'rgb(250, 247, 242)', fg: 'rgb(22, 19, 15)', font: '"Libre Franklin", system-ui, sans-serif', field: 'rgb(22, 19, 15)' })
})

test('the root switches to brand variables when they are defined', async ({ page }) => {
  await open(page)
  await page.addStyleTag({ content: ':root { --surface-page: #112233; --text-strong: #ffeedd; --font-ui: monospace; }' })
  expect(await style(page)).toEqual({ bg: 'rgb(17, 34, 51)', fg: 'rgb(255, 238, 221)', font: 'monospace', field: 'rgb(22, 19, 15)' })
})

test('the field colour follows the brand ink variable', async ({ page }) => {
  await open(page)
  await page.addStyleTag({ content: ':root { --ink-1: #102030; }' })
  expect((await style(page)).field).toBe('rgb(16, 32, 48)')
})
