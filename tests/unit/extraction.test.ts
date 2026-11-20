import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractScripts } from '../../scripts/check-size.ts'

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
const slash = (p: string) => p.split(String.fromCharCode(92)).join('/')
const src = walk('src').map(slash)
const lines = (f: string) => readFileSync(f, 'utf8').trimEnd().split('\n').length

describe('extraction', () => {
  it('has exactly the two pages', () => {
    expect(src.filter((f) => f.startsWith('src/pages/')).sort()).toEqual([
      'src/pages/en/find-the-gap/[level].astro',
      'src/pages/find-the-gap/[level].astro',
    ])
  })
  it('has no @serio-ngo dependency', () => {
    expect(readFileSync('package.json', 'utf8')).not.toContain('@serio-ngo')
  })
  it('keeps the readmes short', () => {
    expect(lines('README.md')).toBeLessThanOrEqual(50)
    expect(lines('src/game/README.md')).toBeLessThanOrEqual(50)
  })
  it('extracts loaded scripts and skips json data', () => {
    const html = '<script type="module" src="/a.js"></script><script>let x=1</script><script type="application/json">{"a":1}</script><script></script>'
    expect(extractScripts(html)).toEqual({ srcs: ['/a.js'], inline: ['let x=1'] })
  })
})
