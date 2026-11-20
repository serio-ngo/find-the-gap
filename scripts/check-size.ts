import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'

const limit = 30720

export const extractScripts = (html: string): { srcs: string[]; inline: string[] } => {
  const srcs: string[] = []
  const inline: string[] = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type\s*=\s*["']?application\/json/i.test(m[1])) continue
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[1])
    if (src) srcs.push(src[1] ?? src[2] ?? src[3])
    else if (m[2].trim()) inline.push(m[2])
  }
  return { srcs, inline }
}

export const gzipSize = (code: string | Buffer): number => gzipSync(code, { level: 9 }).length

export const pageSize = (html: string, read: (src: string) => Buffer | undefined): number => {
  const { srcs, inline } = extractScripts(html)
  const files = srcs.map(read).filter((b): b is Buffer => b !== undefined)
  return [...files, ...inline].reduce((n, c) => n + gzipSize(c), 0)
}

const pages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pages(join(dir, e.name)) : e.name === 'index.html' ? [join(dir, e.name)] : [])

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = 'dist'
  const found = existsSync(dist) ? pages(dist) : []
  if (!found.length) {
    console.error('no pages found in dist')
    process.exit(1)
  }
  let max = 0
  for (const p of found) {
    const base = dirname(p)
    const size = pageSize(readFileSync(p, 'utf8'), (s) => {
      if (/^(https?:)?\/\//.test(s)) return undefined
      const f = s.startsWith('/') ? join(dist, s) : join(base, s)
      return existsSync(f) ? readFileSync(f) : undefined
    })
    max = Math.max(max, size)
    console.log(`${p}: ${size} bytes gzip`)
  }
  console.log(`max: ${max} bytes (limit ${limit})`)
  if (max > limit) process.exit(1)
}
