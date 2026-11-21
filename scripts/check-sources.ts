import { pathToFileURL } from 'node:url'
import { rows } from '../src/game/levels/rows.ts'

export const runApi = (url: string) => {
  const m = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/actions\/runs\/(\d+)$/.exec(url)
  if (!m) throw new Error(`not a public run link: ${url}`)
  return `https://api.github.com/repos/${m[1]}/actions/runs/${m[2]}`
}

export const check = async (urls: string[], token = '', fetchFn: typeof fetch = fetch) => {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'find-the-gap-check', ...(token ? { authorization: `Bearer ${token}` } : {}) }
  const missing: string[] = []
  for (const url of [...new Set(urls)]) {
    const r = await fetchFn(runApi(url), { headers })
    if (!r.ok) missing.push(`${url} ${r.status}`)
  }
  return missing
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = await check(rows.map((r) => r.run), process.env.GH_TOKEN)
  if (missing.length) {
    console.error(missing.join('\n'))
    process.exit(1)
  }
  console.log(`${new Set(rows.map((r) => r.run)).size} public runs ok`)
}
