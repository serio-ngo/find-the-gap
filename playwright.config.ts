import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['line']] : [['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4329', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: 'research.spec.ts' },
    { name: 'touch', use: { ...devices['Pixel 7'] }, testIgnore: 'research.spec.ts' },
    // research.spec.ts runs against the build with PUBLIC_GAME_API; every other spec stays on the offline build
    { name: 'research', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4330' }, testMatch: 'research.spec.ts' },
  ],
  webServer: [
    { command: 'npx astro preview --port 4329', url: 'http://localhost:4329/find-the-gap/1/', reuseExistingServer: !process.env.CI },
    {
      command: 'npx astro build --outDir dist-api && npx vite preview --outDir dist-api --port 4330 --strictPort',
      env: { PUBLIC_GAME_API: '/api/game' },
      url: 'http://localhost:4330/find-the-gap/1/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
