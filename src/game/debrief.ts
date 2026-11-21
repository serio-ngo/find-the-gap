import { agreement, score, wave } from './engine.ts'
import type { Deck, Game } from './engine.ts'
import { colors, paintObject } from './gen.ts'
import type { presentObjects } from './objects.ts'
import { copy, links, resultText, share } from './share.ts'
import { exportSaves, load } from './stats.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }
export type Rounds = ReturnType<typeof presentObjects>[]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const link = (url: string, label: string) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
let download = ''

export const refreshDownload = (root: HTMLElement) => {
  URL.revokeObjectURL(download)
  download = URL.createObjectURL(new Blob([exportSaves()], { type: 'application/json' }))
  root.querySelector<HTMLAnchorElement>('.ftg-download')!.href = download
}

const svg = (shape: Rounds[number][number]['shape']) => {
  const paths: string[] = []
  paintObject(shape, ({ points, fill, stroke, width }) => {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join('')
    paths.push(`<path d="${d}${fill ? 'Z' : ''}" fill="${fill ? colors[fill] : 'none'}" stroke="${stroke ? colors[stroke] : 'none'}" stroke-width="${width}"/>`)
  }, true)
  return `<svg viewBox="-1.1 -1.1 2.2 2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.join('')}</svg>`
}

export const showReplay = (root: HTMLElement, deck: Deck, g: Game, rounds: Rounds, { v, l }: Text) => {
  const mark = (h: boolean | null) => `<span role="img" aria-label="${esc(h === null ? l.research : h ? l.hit : l.miss)}">${h === null ? '—' : h ? '✓' : '✕'}</span>`
  const rows = g.decisions.map((d, i) => {
    const w = wave(deck, d.spec)
    const objects = rounds[i]!
    const a = typeof d.ai === 'number'
    const ap = objects.findIndex((o) => o.sourceIndex === d.ai)
    const target = objects.findIndex((o) => o.sourceIndex === d.pick)
    const ahit = a && d.hit !== null ? w.answers.includes(d.ai!) : null
    const choice = (p: number) => `${p + 1}. ${esc(l[objects[p]!.clue] ?? objects[p]!.clue)}`
    const refs = () => objects.map(({ sourceIndex }, p) =>
      `<li><details class="ftg-object-evidence"><summary>${choice(p)} ${w.answers.includes(sourceIndex) ? mark(true) : ''}</summary></details></li>`).join('')
    const exhibit = (p: number) => {
      const { shape, url } = objects[p]!
      return `<div class="ftg-object-report">${svg(shape)}${url ? `<div>${link(url, url.replace('https://github.com/', ''))}</div>` : ''}</div>`
    }
    const seconds = new Intl.NumberFormat(root.dataset.lang, { style: 'unit', unit: 'second', maximumFractionDigits: 1 }).format(d.secs)
    const html = `<li class="ftg-decision"><details><summary>
      <span>${esc(v.you)} ${choice(target)} ${mark(d.hit)}</span>
      ${a ? `<span>${esc(v.ai)} ${choice(ap)} ${mark(ahit)}</span>` : ''}
      <span>${esc(seconds)}</span>
    </summary><ul class="ftg-sources" aria-label="${esc(l.sources)}"></ul></details></li>`
    return { hit: d.hit, ahit, html, refs, exhibit }
  })
  const strip = (name: string, hits: (boolean | null)[]) => {
    const played = hits.filter((h) => h !== null)
    return `<div><span>${esc(name)} <strong>${played.filter(Boolean).length}/${played.length}</strong></span> <span>${played.map(mark).join(' ')}</span></div>`
  }
  root.querySelector('.ftg-duel')!.innerHTML = strip(v.you, rows.map((r) => r.hit)) + (rows.some((r) => r.ahit !== null) ? strip(v.ai, rows.map((r) => r.ahit)) : '')
  root.querySelector('.ftg-decisions')!.innerHTML = rows.map((r) => r.html).join('')
  root.querySelectorAll<HTMLDetailsElement>('.ftg-decision > details').forEach((entry, i) => {
    entry.ontoggle = () => {
      if (!entry.open) return
      entry.querySelector('.ftg-sources')!.innerHTML = rows[i]!.refs()
      entry.querySelectorAll<HTMLDetailsElement>('.ftg-object-evidence').forEach((object, p) => {
        object.ontoggle = () => {
          if (!object.open) return
          object.insertAdjacentHTML('beforeend', rows[i]!.exhibit(p))
          object.ontoggle = null
        }
      })
      entry.ontoggle = null
    }
  })
}

export const showResult = (root: HTMLElement, deck: Deck, g: Game, edition: string, { v, l }: Text) => {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!
  const sc = score(g)
  const top = load(deck.id, g.level, undefined, edition)?.top ?? [sc]
  const cur = top.lastIndexOf(sc)
  $('.ftg-score').textContent = `${v.score} ${sc}`
  $('.ftg-top').replaceChildren(...top.map((t, n) => {
    const li = document.createElement('li')
    li.textContent = String(t)
    if (n === cur) {
      li.setAttribute('aria-current', 'true')
      li.setAttribute('aria-label', `${l.current}: ${t}`)
    }
    return li
  }))
  const dev = agreement(g)
  $('.ftg-ind').hidden = !dev
  root.querySelectorAll<HTMLElement>('.ftg-copy, .ftg-net').forEach((b) => (b.hidden = !dev))
  $('.ftg-sheet').hidden = !dev || !navigator.share
  if (dev) {
    $('.ftg-agree').textContent = `${dev.agree}%`
    const url = root.dataset.url!
    const text = resultText({ deck: v.title, level: g.level, score: sc, agree: dev.agree, names: { score: v.score, agreement: v.agreement }, url })
    const net = links(text, url)
    root.querySelectorAll<HTMLAnchorElement>('.ftg-net').forEach((a) => (a.href = net[a.dataset.net as keyof typeof net]))
    const notify = async (label: string, done: Promise<boolean>) => ($('.ftg-sr').textContent = `${label}: ${(await done) ? l.hit : l.miss}`)
    $('.ftg-copy').onclick = () => notify(l.copy, copy(text))
    $('.ftg-sheet').onclick = () => notify(l.shareSheet, share(text))
  }
  const nextEl = $<HTMLAnchorElement>('.ftg-next')
  nextEl.hidden = !deck.levels.some((x) => x.id === g.level + 1)
  nextEl.href = `${root.dataset.next}${location.search}`
}
