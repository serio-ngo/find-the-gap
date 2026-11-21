import { report, score, wave } from './engine.ts'
import type { Deck, Game, Tally } from './engine.ts'
import { colors, paintObject } from './gen.ts'
import type { Facts } from './gen.ts'
import type { presentObjects } from './objects.ts'
import { copy, links, resultText, share } from './share.ts'
import { exportSaves, load } from './stats.ts'

type Strings = typeof import('./strings.json')
export type Text = { v: Strings['visible']['en']; l: Strings['labels']['en'] & Record<string, string | undefined> }
export type Rounds = ReturnType<typeof presentObjects>[]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const link = (url: string, label: string) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
let download = ''

// A clue in the page language: known words (reported, passed, missing…) have labels; criteria, tests and commits stay as they are.
export const say = (clue: string, l: Record<string, string | undefined>) => clue.split(' ').map((t) => l[t] ?? t).join(' ')

// What a rock shows, in words: the same parts a sighted player sees, never the record's raw values.
export const describe = (f: Facts, l: Record<string, string | undefined>) => {
  const n = (key: string, v: number) => l[key]!.replace('{n}', String(v))
  return [
    n('crystals', f.crystals), n('sockets', f.sockets), f.symmetric ? l.symmetric : l.lopsided,
    ...(f.segments ? [n('halo', f.segments).replace('{q}', String(f.lit)), n('craters', f.craters), n('alien', f.eyes)] : []),
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
    const tags = [i >= tailFrom ? tag(l.unseen, '✦') : '', deck.typical && !deck.typical(w) ? tag(v.atypical, '◇') : ''].join('')
    const seconds = new Intl.NumberFormat(root.dataset.lang, { style: 'unit', unit: 'second', maximumFractionDigits: 1 }).format(d.secs)
    const html = `<li class="ftg-decision"><details><summary>
      <span>${esc(v.you)} ${choice(target)} ${mark(d.hit)}</span>
      ${a ? `<span>${esc(v.ai)} ${choice(ap)} ${mark(ahit)}</span>` : ''}
      <span>${esc(seconds)}</span>${tags}
    </summary><ul class="ftg-sources" aria-label="${esc(l.sources)}"></ul></details></li>`
    // a research wave keeps what was under it hidden: no verdict, no sources, only the pick and its time
    const hidden = `<li class="ftg-decision"><div class="ftg-quiet"><span>${esc(v.you)} ${target + 1}.</span> <span>${esc(seconds)}</span></div></li>`
    return { hit: d.anchor ? d.hit : null, ahit: d.anchor ? ahit : null, scored: d.anchor, html: d.anchor ? html : hidden, refs, exhibit }
  })
  const strip = (name: string, hits: (boolean | null)[]) => {
    const played = hits.filter((h) => h !== null)
    return `<div><span>${esc(name)} <strong>${played.filter(Boolean).length}/${played.length}</strong></span> <span>${hits.map(mark).join(' ')}</span></div>`
  }
  const scored = rows.filter((r) => r.scored)
  root.querySelector('.ftg-duel')!.innerHTML = strip(v.you, scored.map((r) => r.hit)) + (scored.some((r) => r.ahit !== null) ? strip(v.ai, scored.map((r) => r.ahit)) : '')
  root.querySelector('.ftg-decisions')!.innerHTML = rows.map((r) => r.html).join('')
  root.querySelectorAll<HTMLElement>('.ftg-decision').forEach((li, i) => {
    const entry = li.querySelector<HTMLDetailsElement>(':scope > details')
    if (!entry) return
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

// One table: you, the AI and blind guessing on the same scored waves, split by how common the gap's pattern is in the deck.
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
  const num = new Intl.NumberFormat(root.dataset.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const of = (hits: number, n: number) => (n ? `${hits}/${n}` : '—')
  const row = (name: string, t: Tally) =>
    `<tr><th scope="row">${esc(name)}</th><td>${of(t.you, t.n)}</td><td>${of(t.ai, t.aiN)}</td><td>${t.n ? num.format(t.chance) : '—'}</td></tr>`
  $('.ftg-table').innerHTML = `<thead><tr><td></td><th scope="col">${esc(v.you)}</th><th scope="col">${esc(v.ai)}</th><th scope="col">${esc(v.chance)}</th></tr></thead>`
    + `<tbody>${r.typical && r.atypical ? row(v.typical, r.typical) + row(v.atypical, r.atypical) : ''}${row(v.all, r.all)}</tbody>`
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
