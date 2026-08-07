import { defineConfig, devices } from '@playwright/test';

const port = 3117;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './test/e2e',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    // The fixture aliases vinext-progress to ../../dist, so build the library before serving.
    command: `bun run --cwd ../.. build && bun run dev -p ${port}`,
    cwd: './e2e/fixture',
    reuseExistingServer: !process.env.CI,
    url: `http://localhost:${port}`,
  },
});
