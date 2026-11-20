import { decks } from './levels/index.ts'
import { aiPick, begin, estimate, upcoming, wave, shoot, score } from './engine.ts'
import type { AiRun, Game, Mode, Wave } from './engine.ts'
import stored from './eval/ai-run.json'
import { askStep, resultRequest, resultRow, sendResult, stepRequest } from './net.ts'
import type { Step } from './net.ts'
import { presentObjects } from './objects.ts'
import { createField } from './render.ts'
import { bindInput } from './input.ts'
import { save, clearSaves } from './stats.ts'
import { refreshDownload, showReplay, showResult } from './debrief.ts'
import type { Rounds, Text } from './debrief.ts'

const root = document.querySelector<HTMLElement>('.ftg')!
const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
const text = JSON.parse(root.dataset.strings!) as Text
const { l } = text
const query = new URLSearchParams(location.search)
const deck = decks[query.get('deck') === 'fixture' ? 'fixture' : 'observations']
const edition = JSON.parse(root.dataset.editions!)[deck.id] as string
const level = deck.levels.find((x) => x.id === Number(root.dataset.level))?.id ?? 1
const total = deck.levels.find((x) => x.id === level)!.sequence.filter((s) => s.rule !== 'research').length
const ai: AiRun | undefined = deck.question ? stored : undefined
const api = root.dataset.api
const deckIdx = Object.values(decks).indexOf(deck)

const fieldEl = $('.ftg-field')
const rocksEl = $('.ftg-rocks')
const pauseEl = $('.ftg-pause')
const live = $('.ftg-sr')
const inspectBtn = $<HTMLButtonElement>('.ftg-inspect')
const readout = $('.ftg-readout')
const modeBtn = $<HTMLButtonElement>('.ftg-mode')
const calmBtn = $('.ftg-calm')
const studyBtn = $('.ftg-study')
const motion = matchMedia('(prefers-reduced-motion: reduce)')
const field = createField($('canvas') as HTMLCanvasElement, { calm: motion.matches })

let mode: Mode = ai && query.get('mode') === 'adaptive' ? 'adaptive' : 'standard'
let g: Game
let busy = false
let t0 = 0
let pausedAt = 0
let toggled = false
let neutral: string[] = []
let clues: string[] = []
let rounds: Rounds = []
let answer: Step | null = null
let waves: number[][] = []
let sent = false

const phase = (p: string) => {
  root.dataset.phase = p
  modeBtn.disabled = p === 'play' || p === 'paused'
  inspectBtn.hidden = p !== 'play'
}

const setCalm = (b: boolean) => {
  calmBtn.setAttribute('aria-pressed', String(b))
  if (b) root.dataset.calm = ''
  else delete root.dataset.calm
  field.setCalm(b)
}

const setMode = (m: Mode) => {
  mode = m
  modeBtn.setAttribute('aria-pressed', String(m === 'adaptive'))
}

const setPause = (p: boolean) => {
  if (root.dataset.phase !== (p ? 'play' : 'paused')) return
  if (p) pausedAt = performance.now()
  else t0 += performance.now() - pausedAt
  phase(p ? 'paused' : 'play')
  pauseEl.hidden = !p
  if (p) field.pause()
  else field.resume()
}

const inspect = (enabled: boolean) => {
  inspectBtn.setAttribute('aria-pressed', String(enabled))
  readout.hidden = !enabled
  readout.replaceChildren(...(enabled ? clues : []).map((clue) => Object.assign(document.createElement('li'), { textContent: clue })))
  rocksEl.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-label', enabled ? `${neutral[i]}. ${clues[i]}` : neutral[i]!))
  field.inspect(enabled)
}

const nextWave = () => {
  const spec = upcoming(deck, g)
  if (!spec) return end()
  const w = wave(deck, spec)
  const i = g.decisions.length
  const objects = presentObjects(deck, w, `${deck.id}:${level}:${g.mode}:${i}`)
  rounds[i] = objects
  neutral = objects.map((o, i) => l.rock.replace('{n}', String(i + 1)).replace('{s}', l[o.shape.family] ?? l.object))
  clues = objects.map((o) => l[o.clue] ?? o.clue)
  rocksEl.replaceChildren(...objects.map((_, i) => {
    const b = Object.assign(document.createElement('button'), { className: 'ftg-rock', onclick: () => pick(i, w) })
    b.dataset.rock = String(i)
    return b
  }))
  field.show(w, objects, neutral)
  inspect(false)
  const research = w.rule === 'research'
  $('.ftg-hits').textContent = String(score(g))
  $('.ftg-wave').textContent = research ? '?' : `${g.decisions.length + 1}/${total}`
  $('.ftg-wave').setAttribute('aria-label', research ? l.research : l.wave)
  t0 = performance.now()
  answer = null
  if (api && g.mode === 'adaptive' && !research) {
    askStep(api, stepRequest(deck, deckIdx, level, w, g.decisions)).then((a) => { if (rounds[i] === objects) answer = a })
  }
  busy = false
  rocksEl.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}

const pick = async (i: number, w: Wave) => {
  if (busy || root.dataset.phase !== 'play') return
  busy = true
  const objects = rounds[g.decisions.length]!
  const rule = g.rule
  const got = answer
  g = shoot(deck, g, objects[i]!.sourceIndex, (performance.now() - t0) / 1000, got ? { hit: got.hit, miss: got.miss } : undefined)
  const d = g.decisions.at(-1)!
  d.ai = got ? got.ai : ai && aiPick(ai, g, g.decisions.length - 1)
  const p = g.mode === 'adaptive' && d.hit !== null ? (got ? got[d.hit ? 'hit' : 'miss'] : estimate(deck, { ...g, rule })) : 0
  waves.push(resultRow(deck, d, p, got))
  const switched = g.mode === 'adaptive' && g.rule !== rule
  $('.ftg-switch').hidden = !switched
  live.textContent = [d.anchor && d.hit !== null ? (d.hit ? l.hit : l.miss) : `${l.wave} ${g.decisions.length}`, switched ? l.switch : ''].filter(Boolean).join('. ')
  const answers = d.anchor ? objects.flatMap((o, index) => w.answers.includes(o.sourceIndex) ? [index] : []) : undefined
  await field.shoot(i, d.anchor ? d.hit : null, answers)
  nextWave()
}

const start = () => {
  g = begin(deck, level, mode)
  rounds = []
  waves = []
  sent = false
  $('.ftg-switch').hidden = true
  $('.ftg-end').hidden = true
  $<HTMLDetailsElement>('.ftg-replay').open = false
  fieldEl.hidden = false
  $('.ftg-start').hidden = true
  phase('play')
  field.resume()
  nextWave()
}

const study = () => { try { return localStorage.getItem('ftg:study') === '1' } catch { return false } }
const contribute = () => {
  if (!api || sent || !study()) return
  sent = true
  sendResult(api, resultRequest(deckIdx, level, g.mode, waves))
}

const end = () => {
  phase('end')
  field.pause()
  fieldEl.hidden = true
  rocksEl.replaceChildren()
  readout.hidden = true
  $('.ftg-end').hidden = false
  save(deck.id, level, score(g), { edition, mode: g.mode, picks: g.decisions.map((d) => d.pick), decisions: g.decisions })
  refreshDownload(root)
  showResult(root, deck, g, edition, text)
  showReplay(root, deck, g, rounds, text)
  contribute()
  $('.ftg-score').focus()
}

setCalm(motion.matches)
motion.onchange = (e) => !toggled && setCalm(e.matches)
setMode(mode)
modeBtn.hidden = !ai
phase('start')
bindInput(root, field, { togglePause: () => setPause(root.dataset.phase === 'play'), focus: (i) => field.focus(i), aim: (x) => field.aim(x) })
$('.ftg-play').onclick = start
$('.ftg-again').onclick = start
$('.ftg-resume').onclick = () => setPause(false)
$('.ftg-pausebtn').onclick = () => setPause(root.dataset.phase === 'play')
inspectBtn.onclick = () => { if (!busy && root.dataset.phase === 'play') inspect(inspectBtn.getAttribute('aria-pressed') !== 'true') }
modeBtn.onclick = () => setMode(mode === 'adaptive' ? 'standard' : 'adaptive')
calmBtn.onclick = () => (toggled = true) && setCalm(calmBtn.getAttribute('aria-pressed') !== 'true')
studyBtn.hidden = !api
studyBtn.setAttribute('aria-pressed', String(study()))
studyBtn.onclick = () => {
  const on = !study()
  try { localStorage.setItem('ftg:study', on ? '1' : '0') } catch {}
  studyBtn.setAttribute('aria-pressed', String(on))
  contribute()
}
$('.ftg-delete').onclick = () => {
  clearSaves()
  studyBtn.setAttribute('aria-pressed', 'false')
  refreshDownload(root)
}
document.addEventListener('visibilitychange', () => document.hidden && setPause(true))
