import { decks } from './levels/index.ts'
import { aiPick, asks, begin, forecast, upcoming, wave, shoot, score } from './engine.ts'
import type { AiRun, Game, Mode, Wave } from './engine.ts'
import stored from './eval/ai-run.json'
import { askStep, resultRequest, resultRow, sendResult, stepRequest } from './net.ts'
import type { Step } from './net.ts'
import { presentObjects } from './objects.ts'
import { createField } from './render.ts'
import { aimTracker } from './aim.ts'
import { bindInput } from './input.ts'
import { load, save, clearSaves } from './stats.ts'
import { describe, refreshDownload, showReplay, showResult } from './debrief.ts'
import type { Rounds, Text } from './debrief.ts'

const root = document.querySelector<HTMLElement>('.ftg')!
const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
const text = JSON.parse(root.dataset.strings!) as Text
const { l } = text
const query = new URLSearchParams(location.search)
const deck = decks[query.get('deck') === 'fixture' ? 'fixture' : 'observations']
const edition = JSON.parse(root.dataset.editions!)[deck.id] as string
const level = deck.levels.find((x) => x.id === Number(root.dataset.level))?.id ?? 1
const total = deck.levels.find((x) => x.id === level)!.sequence.length
const ai: AiRun | undefined = deck.question ? stored : undefined
const api = root.dataset.api
const deckIdx = Object.values(decks).indexOf(deck)

const fieldEl = $('.ftg-field')
const rocksEl = $('.ftg-rocks')
const pauseEl = $('.ftg-pause')
const live = $('.ftg-sr')
const modeBtn = $<HTMLButtonElement>('.ftg-mode')
const calmBtn = $('.ftg-calm')
const studyBtn = $('.ftg-study')
const motion = matchMedia('(prefers-reduced-motion: reduce)')
// Aim behaviour for research: how long the lock rested on each rock this wave, and how often it moved to another rock.
const aim = aimTracker()
const onAim = (i: number) => aim.lock(i, root.dataset.phase === 'paused' ? pausedAt : performance.now(), root.dataset.phase === 'play')
const field = createField($('canvas') as HTMLCanvasElement, { calm: motion.matches, onAim })

let mode: Mode = ai && query.get('mode') === 'adaptive' ? 'adaptive' : 'standard'
let g: Game
let busy = false
let t0 = 0
let pausedAt = 0
let toggled = false
let first = false
let rounds: Rounds = []
let answer: Step | null = null
let waves: number[][] = []
let sent = false

const phase = (p: string) => {
  root.dataset.phase = p
  modeBtn.disabled = p === 'play' || p === 'paused'
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
  else {
    t0 += performance.now() - pausedAt
    aim.resume(performance.now() - pausedAt)
  }
  phase(p ? 'paused' : 'play')
  pauseEl.hidden = !p
  if (p) field.pause()
  else field.resume()
}

// The whole wave, evidence and context, is on screen and in every accessible name before the clock starts; one pick ends the wave.
const nextWave = () => {
  const spec = upcoming(deck, g)
  if (!spec) return end()
  const w = wave(deck, spec)
  const i = g.decisions.length
  const objects = presentObjects(deck, w)
  rounds[i] = objects
  const names = objects.map((o, k) => `${l.rock.replace('{n}', String(k + 1)).replace('{s}', l[o.shape.family] ?? l.object)}. ${describe(o.shape.facts, l)}`)
  rocksEl.replaceChildren(...objects.map((_, k) => {
    const b = Object.assign(document.createElement('button'), { className: 'ftg-rock', onclick: () => pick(k, w) })
    b.dataset.rock = String(k)
    b.setAttribute('aria-label', names[k]!)
    return b
  }))
  field.show(objects, names)
  $('.ftg-hits').textContent = String(score(g))
  $('.ftg-wave').textContent = `${i + 1}/${total}`
  answer = null
  if (api && asks(deck, g, i)) {
    askStep(api, stepRequest(deck, deckIdx, level, w, g.decisions)).then((a) => { if (rounds[i] === objects && g.decisions.length === i) answer = a })
  }
  busy = false
  rocksEl.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  // the automatic first focus is not the player's aim
  field.lock(-1)
  t0 = performance.now()
  aim.reset(t0)
}

const pick = async (i: number, w: Wave) => {
  if (busy || root.dataset.phase !== 'play') return
  busy = true
  const objects = rounds[g.decisions.length]!
  const rule = g.rule
  const got = answer
  onAim(i)
  const aimed = { ms: performance.now() - t0, ...aim.read(objects.map((o) => o.sourceIndex)) }
  g = shoot(deck, g, objects[i]!.sourceIndex, (performance.now() - t0) / 1000, got ? { hit: got.hit, miss: got.miss } : undefined)
  const d = g.decisions.at(-1)!
  d.ai = got ? got.ai : ai && aiPick(ai, deck, g, g.decisions.length - 1)
  const p = g.mode === 'adaptive' ? forecast(deck, { ...g, rule }, got ?? undefined) : 0
  waves.push(resultRow(deck, d, p, got, first, aimed))
  const switched = g.mode === 'adaptive' && g.rule !== rule
  $('.ftg-switch').hidden = !switched
  live.textContent = [d.anchor ? (d.hit ? l.hit : l.miss) : `${l.wave} ${g.decisions.length}`, switched ? l.switch : ''].filter(Boolean).join('. ')
  const answers = d.anchor ? objects.flatMap((o, index) => w.answers.includes(o.sourceIndex) ? [index] : []) : undefined
  await field.shoot(i, d.anchor ? d.hit : null, answers)
  nextWave()
}

const start = () => {
  g = begin(deck, level, mode)
  first = !load(deck.id, level, undefined, edition)?.plays
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
  sendResult(api, resultRequest(deckIdx, level, g.mode, waves, edition))
}

const end = () => {
  phase('end')
  field.pause()
  fieldEl.hidden = true
  rocksEl.replaceChildren()
  $('.ftg-end').hidden = false
  // the saved history keeps a research wave's truth out, like the screen does
  save(deck.id, level, score(g), { edition, mode: g.mode, picks: g.decisions.map((d) => d.pick), decisions: g.decisions.map(({ hit, ...d }) => (d.anchor ? { ...d, hit } : d)) })
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
bindInput(root, field, { togglePause: () => setPause(root.dataset.phase === 'play'), focus: (i) => field.focus(i), aim: (x, y) => field.aim(x, y), lock: (i) => field.lock(i) })
$('.ftg-play').onclick = start
$('.ftg-again').onclick = start
$('.ftg-resume').onclick = () => setPause(false)
$('.ftg-pausebtn').onclick = () => setPause(root.dataset.phase === 'play')
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
