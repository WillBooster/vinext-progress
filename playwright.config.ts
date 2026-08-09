import { defineConfig, devices } from '@playwright/test';

const port = 3117;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  globalSetup: './test/helpers/globalSetup.ts',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './test/e2e',
  use: {
    screenshot: process.env.CI ? 'only-on-failure' : 'on',
    video: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    baseURL: `http://localhost:${port}`,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
  },
  webServer: {
    command: `bun run dev -p ${port}`,
    cwd: './e2e/fixture',
    reuseExistingServer: !process.env.CI,
    url: `http://localhost:${port}`,
  },
});
