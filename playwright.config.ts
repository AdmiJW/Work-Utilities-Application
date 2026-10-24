import { defineConfig } from '@playwright/test';

const channel = process.env['PLAYWRIGHT_CHANNEL'];
const baseURL = process.env['TEST_BASE_URL'] ?? 'http://127.0.0.1:4173';
export default defineConfig({
  testDir: './e2e',
  outputDir: `test-results/${channel ?? 'chromium'}`,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  projects: [{ name: channel ?? 'chromium' }],
  reporter: [['list'], ['json', { outputFile: `artifacts/browser-${channel ?? 'chromium'}.json` }]],
  use: {
    baseURL,
    browserName: 'chromium',
    channel,
    viewport: { width: 1280, height: 720 },
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
