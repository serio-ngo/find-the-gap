import { chart, esc, of, spread, table } from './chart.ts'
import { report, score, wave } from './engine.ts'
import type { Deck, Game } from './engine.ts'
import { colors, paintObject } from './gen.ts'
import type { Facts } from './gen.ts'
import type { presentObjects } from './objects.ts'
import { copy, links, resultText, share } from './share.ts'
import { exportSaves, load } from './stats.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }
export type Rounds = ReturnType<typeof presentObjects>[]

const link = (url: string, label: string) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
let download = ''

export const say = (clue: string, l: Record<string, string | undefined>) => clue.split(' ').map((t) => l[t] ?? t).join(' ')

export const describe = (f: Facts, l: Record<string, string | undefined>) => {
  const n = (key: string, v: number) => l[key]!.replace('{n}', String(v))
  return [
    n('crystals', f.crystals), n('sockets', f.sockets), f.symmetric ? l.symmetric : l.lopsided,
    ...(f.segments ? [n('halo', f.segments).replace('{q}', String(f.lit)), n('craters', f.craters), n('alien', f.eyes), f.bright ? l.bright! : l.dim!] : []),
  ].join(', ')
}

export const refreshDownload = (root: HTMLElement) => {
  URL.revokeObjectURL(download)
  download = URL.createObjectURL(new Blob([exportSaves()], { type: 'application/json' }))
  root.querySelector<HTMLAnchorElement>('.ftg-download')!.href = download
}

const svg = (shape: Rounds[number][number]['shape']) => {
  const paths: string[] = []
  paintObject(shape, ({ points, fill, stroke, width }) => {
    const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join('')
    paths.push(`<path d="${d}${fill ? 'Z' : ''}" fill="${fill ? (colors[fill] ?? fill) : 'none'}" stroke="${stroke ? (colors[stroke] ?? stroke) : 'none'}" stroke-width="${width}"/>`)
  })
  return `<svg viewBox="-1.05 -1.05 2.1 2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.join('')}</svg>`
}

export const showReplay = (root: HTMLElement, deck: Deck, g: Game, rounds: Rounds, { v, l }: Text) => {
  const level = deck.levels.find((x) => x.id === g.level)!
  const tailFrom = level.sequence.length - (level.tail ?? 0)
  const mark = (h: boolean | null) => `<span role="img" aria-label="${esc(h === null ? l.noai : h ? l.hit : l.miss)}">${h === null ? '—' : h ? '✓' : '✕'}</span>`
  const tag = (label: string, glyph: string) => `<span role="img" aria-label="${esc(label)}">${glyph}</span>`
  const rows = g.decisions.map((d, i) => {
    const w = wave(deck, d.spec)
    const objects = rounds[i]!
    const a = typeof d.ai === 'number'
    const ap = objects.findIndex((o) => o.sourceIndex === d.ai)
    const target = objects.findIndex((o) => o.sourceIndex === d.pick)
    const ahit = a ? w.answers.includes(d.ai!) : null
    const choice = (p: number) => `${p + 1}. ${esc(say(objects[p]!.clue, l))}`
    const refs = () => objects.map(({ sourceIndex }, p) =>
      `<li><details class="ftg-object-evidence"><summary>${choice(p)} ${w.answers.includes(sourceIndex) ? mark(true) : ''}</summary></details></li>`).join('')
    const exhibit = (p: number) => {
      const { shape, url } = objects[p]!
      return `<div class="ftg-object-report">${svg(shape)}${url ? `<div>${link(url, url.replace('https://github.com/', ''))}</div>` : ''}</div>`
    }
    const tags = [i >= tailFrom ? tag(l.unseen, '✦') : '', d.anchor && deck.typical && !deck.typical(w) ? tag(v.atypical, '◇') : ''].join('')
    const seconds = new Intl.NumberFormat(root.dataset.lang, { style: 'unit', unit: 'second', maximumFractionDigits: 1 }).format(d.secs)
    const html = `<li class="ftg-decision"><details><summary>
      <span>${esc(v.you)} ${choice(target)} ${mark(d.hit)}</span>
      ${a ? `<span>${esc(v.ai)} ${choice(ap)} ${mark(ahit)}</span>` : ''}
      <span>${esc(seconds)}</span>${tags}
    </summary><ul class="ftg-sources" aria-label="${esc(l.sources)}"></ul></details></li>`
    return { anchor: d.anchor, secs: d.secs, html, refs, exhibit }
  })
  const scored = rows.filter((r) => r.anchor)
  const research = spread(rows.filter((r) => !r.anchor).map((r) => r.secs))
  const sec = new Intl.NumberFormat(root.dataset.lang, { style: 'unit', unit: 'second', maximumFractionDigits: 1 })
  const line = research.n ? `<li class="ftg-research">${esc(v.research.replace('{n}', String(research.n)).replace('{median}', sec.format(research.median)).replace('{range}', `${sec.format(research.min)}–${sec.format(research.max)}`))}</li>` : ''
  root.querySelector('.ftg-decisions')!.innerHTML = scored.map((r) => r.html).join('') + line
  root.querySelectorAll<HTMLElement>('.ftg-decision').forEach((li, i) => {
    const entry = li.querySelector<HTMLDetailsElement>(':scope > details')
    if (!entry) return
    entry.ontoggle = () => {
      if (!entry.open) return
      entry.querySelector('.ftg-sources')!.innerHTML = scored[i]!.refs()
      entry.querySelectorAll<HTMLDetailsElement>('.ftg-object-evidence').forEach((object, p) => {
        object.ontoggle = () => {
          if (!object.open) return
          object.insertAdjacentHTML('beforeend', scored[i]!.exhibit(p))
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
  const r = report(deck, g)
  const labels = { ...v, chart: l.chart }
  $('.ftg-chart').innerHTML = chart(r, labels)
  $('.ftg-why').textContent = v.explain
  $('.ftg-table').innerHTML = table(r, labels)
  const url = root.dataset.url!
  const text = resultText({ deck: v.title, level: g.level, score: sc, you: of(r.all.you, r.all.n), ai: of(r.all.ai, r.all.aiN), names: { score: v.score, you: v.you, ai: v.ai }, url })
  const net = links(text, url)
  root.querySelectorAll<HTMLAnchorElement>('.ftg-net').forEach((a) => (a.href = net[a.dataset.net as keyof typeof net]))
  $('.ftg-sheet').hidden = !navigator.share
  const notify = async (label: string, done: Promise<boolean>) => ($('.ftg-sr').textContent = `${label}: ${(await done) ? l.hit : l.miss}`)
  $('.ftg-copy').onclick = () => notify(l.copy, copy(text))
  $('.ftg-sheet').onclick = () => notify(l.shareSheet, share(text))
  const nextEl = $<HTMLAnchorElement>('.ftg-next')
  nextEl.hidden = !deck.levels.some((x) => x.id === g.level + 1)
  nextEl.href = `${root.dataset.next}${location.search}`
}
