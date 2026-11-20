import { createHash } from 'node:crypto'
import { canonical, content } from '../engine.ts'
import type { Deck } from '../engine.ts'

export const digest = (text: string) => createHash('sha256').update(text).digest('hex')

export const hashEdition = (d: Deck, files: Record<string, string>): string => {
  const source = Object.fromEntries(Object.entries(files).map(([path, text]) => [path, text.replace(/\r\n/g, '\n')]))
  return digest(canonical({ content: content(d), anchors: d.levels.map((l) => l.anchors), source }))
}
