import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { canonical, content, pool } from '../engine.ts'
import type { AiRun, Deck } from '../engine.ts'

export const hashContent = (d: Deck): string => createHash('sha256').update(canonical(content(d))).digest('hex')

export const loadRun = (path: string): AiRun | undefined => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

export const checkRun = (run: AiRun | undefined, hash: string, d: Deck): string | null => {
  if (!run) return 'ai run missing: run npm run ai'
  if (run.hash !== hash) return 'ai run stale: run npm run ai'
  for (const l of d.levels) {
    if (run.standard[l.id]?.length !== l.sequence.length) return `ai run incomplete: standard level ${l.id}`
  }
  for (const r of d.rules) {
    for (let step = 1; step <= d.steps; step++) {
      const have = run.pool[`${r.id}:${step}`] ?? []
      if (!pool(d, r.id, step).every((s) => have.some((e) => e.seed === s.seed))) {
        return `ai run incomplete: pool ${r.id}:${step}`
      }
    }
  }
  return null
}
