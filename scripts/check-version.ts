import { fileURLToPath } from 'node:url'
import { decks } from '../src/game/levels/index.ts'
import { checkRun, hashContent, loadRun } from '../src/game/eval/version.ts'

const deck = decks.lifecycle
const hash = hashContent(deck)
const error = checkRun(loadRun(fileURLToPath(new URL('../src/game/eval/ai-run.json', import.meta.url))), hash, deck)
if (error) {
  console.error(error)
  process.exit(1)
}
console.log(`ai run ok ${hash.slice(0, 12)}`)
