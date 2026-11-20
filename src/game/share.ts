export type Result = { deck: string; level: number; mode: 'standard' | 'adaptive'; you: boolean[]; ai: boolean[]; lang: 'pl' | 'en'; url: string }

const row = (h: boolean[]) => `${h.filter(Boolean).length} ${h.map((x) => (x ? '🟩' : '🟥')).join('')}`

export const resultText = (r: Result): string =>
  [`${r.mode === 'adaptive' ? '🛸 ' : ''}${r.deck} #${r.level}`, `${r.lang === 'pl' ? 'Ty' : 'You'} ${row(r.you)}`, `🤖 ${row(r.ai)}`, r.url].join('\n')

export const links = (text: string, url: string) => {
  const t = encodeURIComponent(text), u = encodeURIComponent(url)
  return {
    x: `https://x.com/intent/post?text=${t}`,
    bluesky: `https://bsky.app/intent/compose?text=${t}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  }
}

export const share = async (text: string, url: string): Promise<boolean> => {
  if (!navigator.share) return false
  try { await navigator.share({ text, url }); return true } catch { return false }
}

export const copy = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
