import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  timeout: 120_000,
  reporter: [['line']],
  use: { baseURL: process.env.GAME_URL ?? 'http://localhost:4321', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'touch', use: { ...devices['Pixel 7'] }, testIgnore: 'research.spec.ts' },
  ],
})
