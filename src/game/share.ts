export type Result = { deck: string; level: number; score: number; you: string; ai: string; names: { score: string; you: string; ai: string }; url: string }

export const resultText = (r: Result): string =>
  [`${r.deck} #${r.level}`, `${r.names.score} ${r.score}`, `${r.names.you} ${r.you} · ${r.names.ai} ${r.ai}`, r.url].join('\n')

export const links = (text: string, url: string) => {
  const t = encodeURIComponent(text), u = encodeURIComponent(url)
  return {
    x: `https://x.com/intent/post?text=${t}`,
    bluesky: `https://bsky.app/intent/compose?text=${t}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  }
}

export const share = async (text: string): Promise<boolean> => {
  if (!navigator.share) return false
  try { await navigator.share({ text }); return true } catch { return false }
}

export const copy = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
