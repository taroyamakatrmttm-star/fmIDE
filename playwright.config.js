// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.js$/,
  outputDir: 'test-results',
  // toMatchSnapshot files live next to the JSON snapshots in tests/snapshots/.
  snapshotPathTemplate: '{testDir}/snapshots/{arg}{ext}',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
    timezoneId: 'UTC',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
