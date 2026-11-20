import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['line']] : [['html', { open: 'never' }]],
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4329', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'touch', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npx astro preview --port 4329', url: 'http://localhost:4329/find-the-gap/1/', reuseExistingServer: !process.env.CI },
});
