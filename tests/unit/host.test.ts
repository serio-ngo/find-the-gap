// Host fixture: applies the host lines read from src/game/README.md to a copy of src/game and the two pages.
// The tsconfig/build setup below is a copy of audioblog 6b0b6c5 (audioblog is private), so this is not audioblog itself.
// Limits: Workers globals are stand-ins from lib "dom" in .astro/worker.d.ts; .astro files are not type-checked
// (astro check needs @astrojs/check); no wrangler; the main-config typecheck is tsc on a config extending the host one.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const repo = resolve(import.meta.dirname, '../..')
const dir = join(repo, `.host-${process.pid}`)
const w = (f: string, s: string) => {
  mkdirSync(join(dir, f, '..'), { recursive: true })
  writeFileSync(join(dir, f), s)
}
const run = (bin: string, args: string[], env = {}) =>
  execFileSync(process.execPath, [join(repo, 'node_modules', bin), ...args], { cwd: dir, env: { ...process.env, ...env }, stdio: 'pipe' })
const ORIGIN = 'https://serio.org.pl'
// Host lines come from the README's backtick code, so deleting one there fails this test.
const spans = [...readFileSync(join(repo, 'src/game/README.md'), 'utf8').matchAll(/`([^`]+)`/g)].map((m) => m[1]!)
const hostLine = (needle: string) => {
  const line = spans.find((s) => s.includes(needle))
  if (!line) throw new Error(`README has no host line with ${needle}`)
  return line
}

const mainConfig = {
  extends: 'astro/tsconfigs/strict',
  include: ['.astro/types.d.ts', '**/*'],
  exclude: ['dist', 'editorial', 'node_modules', 'src/worker/**'],
  compilerOptions: { types: ['astro/client'], verbatimModuleSyntax: false, erasableSyntaxOnly: true, noUncheckedIndexedAccess: true },
}
const workerConfig = {
  compilerOptions: {
    target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023'], types: [], strict: true,
    noUncheckedIndexedAccess: true, noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true, allowJs: true, resolveJsonModule: true, skipLibCheck: true, noEmit: true,
  },
  include: ['src/worker/**/*', '.astro/worker.d.ts'],
}

beforeAll(() => {
  mkdirSync(dir, { recursive: true })
  cpSync(join(repo, 'src/game'), join(dir, 'src/game'), { recursive: true })
  cpSync(join(repo, 'src/pages'), join(dir, 'src/pages'), { recursive: true })
  w('package.json', JSON.stringify({ name: 'host', private: true, type: 'module' }))
  w('astro.config.mjs', `import { defineConfig } from 'astro/config';\nexport default defineConfig({ site: '${ORIGIN}', trailingSlash: 'ignore' });\n`)
  w('tsconfig.json', JSON.stringify(mainConfig))
  w('tsconfig.worker.json', JSON.stringify({ ...workerConfig, compilerOptions: { ...workerConfig.compilerOptions, ...JSON.parse(`{${hostLine('allowImportingTsExtensions')}}`) } }))
  w('.astro/worker.d.ts', '/// <reference lib="dom" />\n')
  w('tsconfig.check.json', JSON.stringify({ extends: './tsconfig.json', include: ['src/game/**/*.ts'], compilerOptions: { noEmit: true } }))
  w(
    'src/worker/index.ts',
    `${hostLine('import { route as game }')}
import type { GameEnv } from '../game/worker/route';
export default {
  fetch(req: Request, env: GameEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const pathname = new URL(req.url).pathname;
    ${hostLine('/api/game/step')}
    return new Response(null, { status: 404 });
  },
};
`,
  )
}, 30_000)
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const jsFiles = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? jsFiles(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []))

describe('host fixture', () => {
  it('astro build emits both pages with the API base', () => {
    run('astro/bin/astro.mjs', ['build'], { PUBLIC_GAME_API: '/api/game' })
    expect(existsSync(join(dir, 'dist/find-the-gap/1/index.html'))).toBe(true)
    expect(existsSync(join(dir, 'dist/en/find-the-gap/1/index.html'))).toBe(true)
    expect(jsFiles(join(dir, 'dist')).some((f) => readFileSync(f, 'utf8').includes('/api/game'))).toBe(true)
  }, 120_000)

  it('typechecks under the worker config', () => {
    run('typescript/bin/tsc', ['-p', 'tsconfig.worker.json'])
  }, 120_000)

  it('typechecks src/game under the main config', () => {
    run('typescript/bin/tsc', ['-p', 'tsconfig.check.json'])
  }, 120_000)

  it('bundles for Workers without node: imports and answers', async () => {
    const b = await rolldown({ input: join(dir, 'src/worker/index.ts'), platform: 'neutral', logLevel: 'silent' })
    const { output } = await b.generate({ format: 'esm' })
    const code = output[0].code
    expect(code).not.toMatch(/node:/)
    const file = join(dir, 'worker.mjs')
    writeFileSync(file, code)
    const worker = (await import(pathToFileURL(file).href)).default
    const env = {
      ASK_DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => {} }) }) },
      RL_GAME: { limit: async () => ({ success: true }) },
      LIQUID_AI_KEY: 'k',
    }
    const body = JSON.stringify({ v: 1, level: 1, mode: 0, wave: [0, 2, 1], past: [[0, 1, 0, 0, 1]] })
    const post = (origin: string) =>
      worker.fetch(new Request(ORIGIN + '/api/game/step', { method: 'POST', body, headers: { origin } }), env, { waitUntil() {} })
    expect((await post('https://evil.example')).status).toBe(403)
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }))
    const r = await post(ORIGIN)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ fallback: true })
    vi.unstubAllGlobals()
  }, 120_000)
})
